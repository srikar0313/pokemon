const fs = require("fs");
const path = require("path");
const {
  POKEAPI_BASE_URL,
  flattenEvolutionChainGraph,
  getResourceId,
  loadCachedJson,
  mapLimit,
  normalizePokemonName,
  readValidJson,
  saveJsonAtomic,
} = require("./pokeApiUtils");

const rootDir = path.join(__dirname, "..");
const outputDir = path.join(rootDir, "data", "pokeapi");
const cacheRoot = path.join(outputDir, "raw");
const speciesMapPath = path.join(outputDir, "species-map.json");
const pokemonPath = path.join(rootDir, "pokemon.json");
const canonicalOutputPath = path.join(outputDir, "canonical-pokemon.json");
const evolutionOutputPath = path.join(outputDir, "evolutions.json");
const refresh = process.argv.includes("--refresh");
const concurrency = 4;
const cacheStats = { hits: 0, fetched: 0, failures: 0 };
const fetchErrors = [];
const statNameMap = {
  hp: "hp",
  attack: "attack",
  defense: "defense",
  "special-attack": "specialAttack",
  "special-defense": "specialDefense",
  speed: "speed",
};
const regionalSuffixes = ["alola", "galar", "hisui", "paldea"];

function readRequiredJson(filePath, label) {
  const data = readValidJson(filePath);
  if (!data) throw new Error(`${label} is missing or invalid: ${filePath}`);
  return data;
}

function titleCaseName(value) {
  return String(value || "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getTypes(pokemonData) {
  return (pokemonData?.types || [])
    .slice()
    .sort((left, right) => left.slot - right.slot)
    .map((entry) => titleCaseName(entry.type?.name));
}

function getBaseStats(pokemonData) {
  return Object.fromEntries(
    (pokemonData?.stats || [])
      .filter((entry) => statNameMap[entry.stat?.name])
      .map((entry) => [statNameMap[entry.stat.name], entry.base_stat]),
  );
}

function getArtwork(pokemonData) {
  const artwork = pokemonData?.sprites?.other?.["official-artwork"] || {};
  return {
    normal: artwork.front_default || null,
    shiny: artwork.front_shiny || null,
  };
}

function getAbilities(pokemonData) {
  return (pokemonData?.abilities || [])
    .slice()
    .sort((left, right) => left.slot - right.slot)
    .map((entry) => ({
      name: entry.ability?.name || null,
      hidden: Boolean(entry.is_hidden),
    }));
}

function getRegionalScope(varietyName) {
  const normalized = String(varietyName || "").toLowerCase();
  return (
    regionalSuffixes.find(
      (region) =>
        normalized.endsWith(`-${region}`) ||
        normalized.includes(`-${region}-`),
    ) || null
  );
}

function classifyVariety(variety, speciesName) {
  if (variety.is_default) return { category: "default", region: null };
  const region = getRegionalScope(variety.pokemon?.name);
  if (region) return { category: "regional", region };
  const isBaseNamedForm =
    normalizePokemonName(variety.pokemon?.name) ===
    normalizePokemonName(speciesName);
  return {
    category: isBaseNamedForm ? "default" : "other",
    region: null,
  };
}

async function loadResource(category, key, url, label) {
  const result = await loadCachedJson({
    cacheRoot,
    category,
    key,
    url,
    refresh,
    cacheStats,
  });
  if (!result.data) {
    fetchErrors.push(`${label}: ${result.error || "unknown fetch error"}`);
  }
  return result.data;
}

function validateSpeciesMap(speciesMap, localPokemon) {
  const errors = [];
  const mappings = speciesMap.species || [];
  const localKeys = new Set(
    localPokemon.map(
      (pokemon) => `${pokemon.id}:${normalizePokemonName(pokemon.name)}`,
    ),
  );
  const mappingKeys = mappings.map(
    (mapping) =>
      `${mapping.localId}:${normalizePokemonName(mapping.localName)}`,
  );
  if (mappings.length !== localPokemon.length) {
    errors.push(
      `species map has ${mappings.length} entries for ${localPokemon.length} local Pokemon`,
    );
  }
  if (new Set(mappingKeys).size !== mappingKeys.length) {
    errors.push("species map contains duplicate local mappings");
  }
  mappingKeys.forEach((key) => {
    if (!localKeys.has(key)) errors.push(`species map has stale mapping ${key}`);
  });
  mappings.forEach((mapping) => {
    if (
      !["MATCH", "ID_MISMATCH"].includes(mapping.status) ||
      !Number.isInteger(mapping.canonicalSpeciesId) ||
      mapping.canonicalSpeciesId <= 0 ||
      normalizePokemonName(mapping.localName) !==
        normalizePokemonName(mapping.canonicalName)
    ) {
      errors.push(`unresolved or unsafe species mapping for ${mapping.localName}`);
    }
  });
  if (errors.length) {
    throw new Error(`Species map validation failed:\n- ${errors.join("\n- ")}`);
  }
}

async function loadMappedRecords(speciesMap) {
  const mappings = speciesMap.species
    .slice()
    .sort((left, right) => left.canonicalSpeciesId - right.canonicalSpeciesId);
  return mapLimit(mappings, concurrency, async (mapping) => {
    const speciesId = mapping.canonicalSpeciesId;
    const pokemonData = await loadResource(
      "pokemon",
      speciesId,
      `${POKEAPI_BASE_URL}/pokemon/${speciesId}`,
      `${mapping.localName} Pokemon data`,
    );
    const speciesData = await loadResource(
      "species",
      speciesId,
      `${POKEAPI_BASE_URL}/pokemon-species/${speciesId}`,
      `${mapping.localName} species data`,
    );
    return { mapping, pokemonData, speciesData };
  });
}

async function loadVarietyData(records) {
  const requests = new Map();
  const baseByPokemonId = new Map();
  records.forEach((record) => {
    if (record.pokemonData?.id) {
      baseByPokemonId.set(record.pokemonData.id, record.pokemonData);
    }
    (record.speciesData?.varieties || []).forEach((variety) => {
      const pokemonId = getResourceId(variety.pokemon?.url);
      if (!pokemonId || baseByPokemonId.has(pokemonId)) return;
      requests.set(variety.pokemon.name, {
        name: variety.pokemon.name,
        pokemonId,
        url: variety.pokemon.url,
      });
    });
  });

  const loaded = await mapLimit(
    [...requests.values()].sort((left, right) => left.pokemonId - right.pokemonId),
    concurrency,
    async (request) => [
      request.pokemonId,
      await loadResource(
        path.join("pokemon", "forms"),
        request.name,
        request.url,
        `form ${request.name}`,
      ),
    ],
  );
  return new Map([...baseByPokemonId, ...loaded]);
}

function buildForms(speciesData, varietyData) {
  return (speciesData.varieties || [])
    .map((variety) => {
      const pokemonId = getResourceId(variety.pokemon?.url);
      const pokemonData = varietyData.get(pokemonId);
      const classification = classifyVariety(variety, speciesData.name);
      return {
        pokemonId,
        name: variety.pokemon?.name || null,
        isDefault: Boolean(variety.is_default),
        category: classification.category,
        region: classification.region,
        types: getTypes(pokemonData),
        artwork: getArtwork(pokemonData),
      };
    })
    .sort(
      (left, right) =>
        Number(right.isDefault) - Number(left.isDefault) ||
        left.pokemonId - right.pokemonId,
    );
}

function buildCanonicalPokemon(records, varietyData, generatedAt) {
  return {
    generatedAt,
    source: "https://pokeapi.co",
    speciesCount: records.length,
    pokemon: records
      .map(({ mapping, pokemonData, speciesData }) => ({
        localId: mapping.localId,
        localName: mapping.localName,
        speciesId: mapping.canonicalSpeciesId,
        canonicalName: speciesData?.name || mapping.canonicalName,
        types: getTypes(pokemonData),
        baseStats: getBaseStats(pokemonData),
        captureRate: speciesData?.capture_rate ?? null,
        baseExperience: pokemonData?.base_experience ?? null,
        height: pokemonData?.height ?? null,
        weight: pokemonData?.weight ?? null,
        growthRate: speciesData?.growth_rate?.name || null,
        baseHappiness: speciesData?.base_happiness ?? null,
        genderRate: speciesData?.gender_rate ?? null,
        isLegendary: Boolean(speciesData?.is_legendary),
        isMythical: Boolean(speciesData?.is_mythical),
        generation: speciesData?.generation?.name || null,
        abilities: getAbilities(pokemonData),
        evolutionChainId: getResourceId(speciesData?.evolution_chain?.url),
        artwork: getArtwork(pokemonData),
        forms: buildForms(speciesData || {}, varietyData),
      }))
      .sort((left, right) => left.speciesId - right.speciesId),
  };
}

async function loadEvolutionChains(records) {
  const requests = new Map();
  records.forEach((record) => {
    const url = record.speciesData?.evolution_chain?.url;
    const chainId = getResourceId(url);
    if (url && chainId) requests.set(chainId, url);
  });
  const loaded = await mapLimit(
    [...requests.entries()].sort((left, right) => left[0] - right[0]),
    concurrency,
    async ([chainId, url]) => [
      chainId,
      await loadResource(
        "evolution-chains",
        chainId,
        url,
        `evolution chain ${chainId}`,
      ),
    ],
  );
  return new Map(loaded);
}

async function loadEvolutionSpecies(chains, records) {
  const known = new Map(
    records
      .filter((record) => record.speciesData?.id)
      .map((record) => [record.speciesData.id, record.speciesData]),
  );
  const required = new Map();
  chains.forEach((chain) => {
    if (!chain?.chain) return;
    flattenEvolutionChainGraph(chain.chain).species.forEach((species) => {
      if (species.speciesId && !known.has(species.speciesId)) {
        required.set(species.speciesId, species.name);
      }
    });
  });
  const loaded = await mapLimit(
    [...required.entries()].sort((left, right) => left[0] - right[0]),
    concurrency,
    async ([speciesId, name]) => [
      speciesId,
      await loadResource(
        "species",
        speciesId,
        `${POKEAPI_BASE_URL}/pokemon-species/${speciesId}`,
        `evolution species ${name} #${speciesId}`,
      ),
    ],
  );
  return new Map([...known, ...loaded]);
}

function getSpeciesRegions(speciesData) {
  return [
    ...new Set(
      (speciesData?.varieties || [])
        .map((variety) => getRegionalScope(variety.pokemon?.name))
        .filter(Boolean),
    ),
  ].sort();
}

function normalizeMethod(condition) {
  if (condition.trigger === "use-item") return "item";
  if (condition.trigger === "trade") {
    return condition.heldItem ? "trade-item" : "trade";
  }
  if (condition.trigger !== "level-up") return "special";
  if (condition.minHappiness || condition.minAffection) return "friendship";
  if (condition.heldItem) return "level-item";
  if (condition.knownMove || condition.knownMoveType) return "level-move";
  if (condition.location) return "level-location";
  if (condition.timeOfDay) return "level-time";
  if (condition.minLevel) return "level";
  return "special";
}

function addFormScope(condition, fromSpecies, toSpecies) {
  const regions = [
    ...new Set([
      ...getSpeciesRegions(fromSpecies),
      ...getSpeciesRegions(toSpecies),
    ]),
  ];
  if (!regions.length) {
    return {
      ...condition,
      method: normalizeMethod(condition),
      formScope: "base",
      requiresFormResolution: false,
    };
  }
  return {
    ...condition,
    method: normalizeMethod(condition),
    formScope: "ambiguous",
    possibleRegionalScopes: regions,
    requiresFormResolution: true,
  };
}

function deduplicateConditions(conditions) {
  const normalized = conditions.length ? conditions : [{}];
  return [
    ...new Map(
      normalized.map((condition) => [JSON.stringify(condition), condition]),
    ).values(),
  ].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function buildEvolutionData(chains, evolutionSpecies, records, generatedAt) {
  const localBySpeciesId = new Map(
    records.map((record) => [record.mapping.canonicalSpeciesId, record.mapping]),
  );
  const chainEntries = [...chains.entries()]
    .filter(([, chain]) => chain?.chain)
    .map(([chainId, chain]) => {
      const graph = flattenEvolutionChainGraph(chain.chain);
      const species = graph.species
        .map((entry) => {
          const mapping = localBySpeciesId.get(entry.speciesId);
          return {
            speciesId: entry.speciesId,
            name: entry.name,
            presentInGame: Boolean(mapping),
            localId: mapping?.localId ?? null,
          };
        })
        .sort((left, right) => left.speciesId - right.speciesId);
      const edges = graph.edges
        .map((edge) => {
          const fromSpecies = evolutionSpecies.get(edge.fromSpeciesId);
          const toSpecies = evolutionSpecies.get(edge.toSpeciesId);
          const conditions = deduplicateConditions(
            edge.conditions.map((condition) =>
              addFormScope(condition, fromSpecies, toSpecies),
            ),
          );
          return { ...edge, conditions };
        })
        .sort(
          (left, right) =>
            left.fromSpeciesId - right.fromSpeciesId ||
            left.toSpeciesId - right.toSpeciesId,
        );
      const targetCounts = new Map();
      edges.forEach((edge) => {
        targetCounts.set(
          edge.fromSpeciesId,
          (targetCounts.get(edge.fromSpeciesId) || 0) + 1,
        );
      });
      const branchingSpecies = species.filter(
        (entry) => (targetCounts.get(entry.speciesId) || 0) > 1,
      );
      return { chainId, species, edges, branchingSpecies };
    })
    .sort((left, right) => left.chainId - right.chainId);

  const speciesIndex = [
    ...new Map(
      chainEntries
        .flatMap((chain) => chain.species)
        .map((entry) => [entry.speciesId, entry]),
    ).values(),
  ].sort((left, right) => left.speciesId - right.speciesId);

  return {
    generatedAt,
    source: "https://pokeapi.co",
    chains: chainEntries,
    species: speciesIndex,
  };
}

function countEvolutionSummary(evolutionData) {
  const edges = evolutionData.chains.flatMap((chain) => chain.edges);
  const conditions = edges.flatMap((edge) => edge.conditions);
  const countMethods = (predicate) => conditions.filter(predicate).length;
  return {
    evolutionChains: evolutionData.chains.length,
    evolutionSpecies: evolutionData.species.length,
    evolutionEdges: edges.length,
    missingGameSpecies: evolutionData.species.filter(
      (species) => !species.presentInGame,
    ).length,
    levelEvolutions: countMethods((condition) =>
      condition.method.startsWith("level"),
    ),
    itemEvolutions: countMethods((condition) => condition.method === "item"),
    friendshipEvolutions: countMethods(
      (condition) => condition.method === "friendship",
    ),
    tradeEvolutions: countMethods((condition) =>
      condition.method.startsWith("trade"),
    ),
    specialEvolutions: countMethods(
      (condition) =>
        !condition.method.startsWith("level") &&
        !["item", "friendship"].includes(condition.method) &&
        !condition.method.startsWith("trade"),
    ),
    branchingSpecies: evolutionData.chains.reduce(
      (total, chain) => total + chain.branchingSpecies.length,
      0,
    ),
    formSpecificEdges: edges.filter((edge) =>
      edge.conditions.some(
        (condition) =>
          !["base", "ambiguous"].includes(condition.formScope),
      ),
    ).length,
    ambiguousFormEdges: edges.filter((edge) =>
      edge.conditions.some((condition) => condition.formScope === "ambiguous"),
    ).length,
  };
}

function validateGeneratedData(canonicalData, evolutionData, speciesMap) {
  const errors = [...fetchErrors];
  const entries = canonicalData.pokemon;
  const speciesIds = entries.map((entry) => entry.speciesId);
  const localKeys = entries.map(
    (entry) => `${entry.localId}:${normalizePokemonName(entry.localName)}`,
  );
  if (entries.length !== speciesMap.species.length) {
    errors.push("canonical Pokemon count does not match species map");
  }
  if (new Set(speciesIds).size !== speciesIds.length) {
    errors.push("canonical Pokemon contains duplicate speciesId values");
  }
  if (new Set(localKeys).size !== localKeys.length) {
    errors.push("a local Pokemon maps more than once");
  }
  entries.forEach((entry) => {
    if (!Number.isInteger(entry.speciesId) || entry.speciesId <= 0) {
      errors.push(`${entry.localName} has invalid speciesId`);
    }
    if (!entry.types.length) errors.push(`${entry.localName} has no canonical types`);
    ["hp", "attack", "defense", "specialAttack", "specialDefense", "speed"].forEach(
      (stat) => {
        if (!Number.isFinite(entry.baseStats[stat])) {
          errors.push(`${entry.localName} has invalid ${stat} base stat`);
        }
      },
    );
    entry.forms.forEach((form) => {
      if (!Number.isInteger(form.pokemonId) || !form.types.length) {
        errors.push(`${entry.localName} has invalid form ${form.name}`);
      }
    });
  });

  const evolutionSpeciesIds = new Set(
    evolutionData.species.map((species) => species.speciesId),
  );
  const conditionKeys = new Set();
  evolutionData.chains.forEach((chain) => {
    chain.species.forEach((species) => {
      if (typeof species.presentInGame !== "boolean") {
        errors.push(`chain ${chain.chainId} does not mark ${species.name} presence`);
      }
      if (!species.presentInGame && species.localId !== null) {
        errors.push(`missing species ${species.name} has a localId`);
      }
    });
    chain.edges.forEach((edge) => {
      if (
        !evolutionSpeciesIds.has(edge.fromSpeciesId) ||
        !evolutionSpeciesIds.has(edge.toSpeciesId)
      ) {
        errors.push(`chain ${chain.chainId} has edge with unknown species`);
      }
      if (edge.fromSpeciesId === edge.toSpeciesId) {
        errors.push(`chain ${chain.chainId} has self-evolution for ${edge.from}`);
      }
      edge.conditions.forEach((condition) => {
        const key = `${chain.chainId}:${edge.fromSpeciesId}:${edge.toSpeciesId}:${JSON.stringify(condition)}`;
        if (conditionKeys.has(key)) {
          errors.push(`chain ${chain.chainId} has duplicate edge condition ${edge.from} -> ${edge.to}`);
        }
        conditionKeys.add(key);
        if (!condition.formScope || typeof condition.requiresFormResolution !== "boolean") {
          errors.push(`chain ${chain.chainId} has evolution without explicit form scope`);
        }
        if (
          condition.formScope === "ambiguous" &&
          condition.requiresFormResolution !== true
        ) {
          errors.push(`chain ${chain.chainId} hides ambiguous form evolution`);
        }
      });
    });
  });
  if (errors.length) {
    throw new Error(`Canonical build validation failed:\n- ${errors.join("\n- ")}`);
  }
}

function printSummary(canonicalData, evolutionData, speciesMap) {
  const summary = countEvolutionSummary(evolutionData);
  const forms = canonicalData.pokemon.reduce(
    (total, pokemon) => total + pokemon.forms.length,
    0,
  );
  console.log(`Canonical Pokemon built: ${canonicalData.speciesCount}`);
  console.log(
    `Local ID mismatches preserved: ${speciesMap.summary.localIdMismatches}`,
  );
  console.log(`Evolution chains: ${summary.evolutionChains}`);
  console.log(`Evolution species referenced: ${summary.evolutionSpecies}`);
  console.log(`Evolution edges: ${summary.evolutionEdges}`);
  console.log(`Missing game species: ${summary.missingGameSpecies}`);
  console.log(`Level evolutions: ${summary.levelEvolutions}`);
  console.log(`Item evolutions: ${summary.itemEvolutions}`);
  console.log(`Friendship evolutions: ${summary.friendshipEvolutions}`);
  console.log(`Trade evolutions: ${summary.tradeEvolutions}`);
  console.log(`Special evolutions: ${summary.specialEvolutions}`);
  console.log(`Branching species: ${summary.branchingSpecies}`);
  console.log(`Canonical forms represented: ${forms}`);
  console.log(`Form-specific edges: ${summary.formSpecificEdges}`);
  console.log(`Ambiguous form edges: ${summary.ambiguousFormEdges}`);
  console.log(
    `Cache hits: ${cacheStats.hits}; fetched: ${cacheStats.fetched}; failures: ${cacheStats.failures}`,
  );
  console.log("Errors: 0");
}

async function main() {
  console.log(
    `[pokeapi:build] Building canonical data (${refresh ? "refresh" : "cache-first"})...`,
  );
  const localPokemon = readRequiredJson(pokemonPath, "pokemon.json");
  if (!Array.isArray(localPokemon)) throw new Error("pokemon.json must be an array");
  const speciesMap = readRequiredJson(speciesMapPath, "species map");
  validateSpeciesMap(speciesMap, localPokemon);

  const records = await loadMappedRecords(speciesMap);
  const varietyData = await loadVarietyData(records);
  const chains = await loadEvolutionChains(records);
  const evolutionSpecies = await loadEvolutionSpecies(chains, records);
  const generatedAt = new Date().toISOString();
  const canonicalData = buildCanonicalPokemon(records, varietyData, generatedAt);
  const evolutionData = buildEvolutionData(
    chains,
    evolutionSpecies,
    records,
    generatedAt,
  );
  validateGeneratedData(canonicalData, evolutionData, speciesMap);
  saveJsonAtomic(canonicalOutputPath, canonicalData);
  saveJsonAtomic(evolutionOutputPath, evolutionData);
  printSummary(canonicalData, evolutionData, speciesMap);
}

main().catch((error) => {
  console.error(`[pokeapi:build] ${error.stack || error.message}`);
  process.exitCode = 1;
});
