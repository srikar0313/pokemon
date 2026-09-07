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
const canonicalMovesOutputPath = path.join(outputDir, "canonical-moves.json");
const evolutionOutputPath = path.join(outputDir, "evolutions.json");
const importsPath = path.join(outputDir, "imports.json");
const refresh = process.argv.includes("--refresh");
const dexMaxArgument = process.argv.find((argument) =>
  argument.startsWith("--dex-max="),
);
const dexMax = Number(dexMaxArgument?.split("=")[1] || 400);
const reservedLocalIdStart = 10000;
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
const learnsetVersionPreference = [
  "scarlet-violet",
  "sword-shield",
  "ultra-sun-ultra-moon",
  "omega-ruby-alpha-sapphire",
  "black-2-white-2",
];

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

function getEnglishSpeciesName(speciesData) {
  return (
    (speciesData?.names || []).find(
      (entry) => entry.language?.name === "en",
    )?.name || titleCaseName(speciesData?.name)
  );
}

function createExpansionTargets(existingSpeciesMap) {
  if (!Number.isInteger(dexMax) || dexMax < 1) {
    throw new Error(`Invalid --dex-max value: ${dexMax}`);
  }
  const speciesIds = new Set(
    Array.from({ length: dexMax }, (_, index) => index + 1),
  );
  (existingSpeciesMap.species || []).forEach((mapping) => {
    if (mapping.canonicalSpeciesId > dexMax) {
      speciesIds.add(mapping.canonicalSpeciesId);
    }
  });
  const imports = readValidJson(importsPath)?.speciesIds || [];
  imports.forEach((speciesId) => {
    if (Number.isInteger(speciesId) && speciesId > 0) speciesIds.add(speciesId);
  });
  return [...speciesIds].sort((left, right) => left - right);
}

function collectEvolutionFamilySpeciesIds(chains) {
  const speciesIds = new Set();
  chains.forEach((chain) => {
    if (!chain?.chain) return;
    flattenEvolutionChainGraph(chain.chain).species.forEach((species) => {
      if (Number.isInteger(species.speciesId) && species.speciesId > 0) {
        speciesIds.add(species.speciesId);
      }
    });
  });
  return speciesIds;
}

function createProvisionalSpeciesMap(existingSpeciesMap, targetSpeciesIds) {
  const existingBySpeciesId = new Map(
    (existingSpeciesMap.species || []).map((mapping) => [
      mapping.canonicalSpeciesId,
      mapping,
    ]),
  );
  return {
    species: targetSpeciesIds.map(
      (speciesId) =>
        existingBySpeciesId.get(speciesId) || {
          canonicalSpeciesId: speciesId,
          localName: `National Dex #${speciesId}`,
        },
    ),
  };
}

function buildExpandedSpeciesMap(
  existingSpeciesMap,
  currentPokemon,
  records,
  generatedAt,
) {
  const existingBySpeciesId = new Map(
    (existingSpeciesMap.species || []).map((mapping) => [
      mapping.canonicalSpeciesId,
      mapping,
    ]),
  );
  const usedLocalIds = new Set(currentPokemon.map((pokemon) => pokemon.id));
  let nextReservedId = Math.max(
    reservedLocalIdStart,
    ...usedLocalIds,
  );
  const allocateReservedId = () => {
    do {
      nextReservedId += 1;
    } while (usedLocalIds.has(nextReservedId));
    usedLocalIds.add(nextReservedId);
    return nextReservedId;
  };

  const species = records
    .slice()
    .sort(
      (left, right) =>
        left.mapping.canonicalSpeciesId - right.mapping.canonicalSpeciesId,
    )
    .map((record) => {
      const speciesId = record.mapping.canonicalSpeciesId;
      const existing = existingBySpeciesId.get(speciesId);
      if (existing) {
        const existingMetadata = { ...existing };
        if (existingMetadata.addedByEvolutionClosure !== true) {
          delete existingMetadata.addedByEvolutionClosure;
        }
        usedLocalIds.add(existing.localId);
        if (existing.existingBeforeExpansion === false) {
          const canonicalName = record.speciesData?.name;
          const localName = getEnglishSpeciesName(record.speciesData);
          return {
            ...existingMetadata,
            localName,
            canonicalName,
            idMatches: existing.localId === speciesId,
            nameMatches:
              normalizePokemonName(localName) ===
              normalizePokemonName(canonicalName),
            lookupName: canonicalName,
            status:
              existing.localId === speciesId ? "MATCH" : "ID_MISMATCH",
          };
        }
        return {
          ...existingMetadata,
          existingBeforeExpansion: existing.existingBeforeExpansion ?? true,
        };
      }

      const localId = usedLocalIds.has(speciesId)
        ? allocateReservedId()
        : speciesId;
      usedLocalIds.add(localId);
      const canonicalName = record.speciesData?.name;
      const localName = getEnglishSpeciesName(record.speciesData);
      return {
        localId,
        localName,
        canonicalSpeciesId: speciesId,
        canonicalName,
        idMatches: localId === speciesId,
        nameMatches:
          normalizePokemonName(localName) ===
          normalizePokemonName(canonicalName),
        resolutionMethod: "evolution-family-closure",
        lookupName: canonicalName,
        status: localId === speciesId ? "MATCH" : "ID_MISMATCH",
        existingBeforeExpansion: false,
        addedByEvolutionClosure: true,
      };
    });

  const nationalDexCoverage = species.filter(
    (mapping) =>
      mapping.canonicalSpeciesId >= 1 &&
      mapping.canonicalSpeciesId <= dexMax,
  ).length;
  const existingAboveDexMax = species.filter(
    (mapping) =>
      mapping.existingBeforeExpansion && mapping.canonicalSpeciesId > dexMax,
  ).length;
  return {
    generatedAt,
    source: "https://pokeapi.co",
    resolutionKey: "localName",
    dexMax,
    summary: {
      currentPokemon: species.length,
      resolved: species.length,
      localIdsCorrect: species.filter((mapping) => mapping.idMatches).length,
      localIdMismatches: species.filter((mapping) => !mapping.idMatches).length,
      unresolved: 0,
      nationalDexCoverage,
      existingAboveDexMax,
      existingBeforeExpansion: species.filter(
        (mapping) => mapping.existingBeforeExpansion,
      ).length,
      addedByExpansion: species.filter(
        (mapping) =>
          !mapping.existingBeforeExpansion &&
          !mapping.addedByEvolutionClosure,
      ).length,
      addedByEvolutionClosure: species.filter(
        (mapping) => mapping.addedByEvolutionClosure,
      ).length,
    },
    species,
  };
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
      slot: entry.slot ?? null,
      hidden: Boolean(entry.is_hidden),
    }));
}

function selectLevelUpLearnset(pokemonData) {
  for (const versionGroup of learnsetVersionPreference) {
    const entries = (pokemonData?.moves || []).flatMap((entry) =>
      (entry.version_group_details || [])
        .filter(
          (detail) =>
            detail.move_learn_method?.name === "level-up" &&
            detail.version_group?.name === versionGroup,
        )
        .map((detail) => ({
          level: Math.max(1, Number(detail.level_learned_at) || 1),
          move: entry.move?.name,
          moveUrl: entry.move?.url,
        })),
    );
    if (!entries.length) continue;
    const deduplicated = [
      ...new Map(
        entries
          .sort((left, right) => left.level - right.level)
          .map((entry) => [entry.move, entry]),
      ).values(),
    ].sort((left, right) => left.level - right.level || left.move.localeCompare(right.move));
    return { versionGroup, entries: deduplicated };
  }
  return { versionGroup: null, entries: [] };
}

function buildLearnsetIndex(records) {
  return new Map(
    records.map((record) => [
      record.mapping.canonicalSpeciesId,
      selectLevelUpLearnset(record.pokemonData),
    ]),
  );
}

async function loadCanonicalMoves(learnsets) {
  const requests = new Map();
  learnsets.forEach((learnset) => {
    learnset.entries.forEach((entry) => {
      if (entry.move && entry.moveUrl) requests.set(entry.move, entry.moveUrl);
    });
  });
  const loaded = await mapLimit(
    [...requests.entries()].sort(([left], [right]) => left.localeCompare(right)),
    concurrency,
    async ([moveName, url]) => [
      moveName,
      await loadResource("moves", moveName, url, `move ${moveName}`),
    ],
  );
  return new Map(loaded);
}

function normalizeMoveEffect(moveData) {
  const ailmentMap = {
    burn: "burned",
    confusion: "confused",
    freeze: "frozen",
    paralysis: "paralyzed",
    poison: "poisoned",
    sleep: "asleep",
    "badly-poisoned": "badpoison",
  };
  const ailment = ailmentMap[moveData?.meta?.ailment?.name];
  if (ailment) {
    return {
      type: "status",
      status: ailment,
      chance: moveData.meta.ailment_chance || 100,
    };
  }
  const statChange = moveData?.stat_changes?.[0];
  if (statChange?.stat?.name) {
    const stat = statNameMap[statChange.stat.name];
    if (!stat) return undefined;
    return {
      type: "statChange",
      target: moveData.target?.name === "user" ? "self" : "opponent",
      stat,
      stages: statChange.change,
      chance: moveData.meta?.stat_chance || 100,
    };
  }
  if (Number(moveData?.meta?.drain) > 0) {
    return { type: "heal", target: "self", percent: moveData.meta.drain };
  }
  return undefined;
}

function buildCanonicalMoveData(moveDataByName, generatedAt) {
  const moves = {};
  [...moveDataByName.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([canonicalName, moveData]) => {
      if (!moveData) return;
      const name = titleCaseName(canonicalName);
      const effect = normalizeMoveEffect(moveData);
      moves[name] = {
        name,
        canonicalName,
        type: titleCaseName(moveData.type?.name),
        category: titleCaseName(moveData.damage_class?.name),
        power: moveData.power ?? 0,
        accuracy: moveData.accuracy ?? 100,
        pp: moveData.pp ?? 10,
        maxPp: moveData.pp ?? 10,
        priority: moveData.priority || 0,
        ...(effect ? { effect } : {}),
      };
    });
  return {
    generatedAt,
    source: "https://pokeapi.co",
    moveCount: Object.keys(moves).length,
    moves,
  };
}

function getLearnsetOutput(learnset, canonicalMoves) {
  return {
    learnsetVersionGroup: learnset.versionGroup,
    learnset: learnset.entries
      .map((entry) => ({
        level: entry.level,
        move: titleCaseName(entry.move),
      }))
      .filter((entry) => canonicalMoves.moves[entry.move]),
  };
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
        abilities: getAbilities(pokemonData),
        artwork: getArtwork(pokemonData),
      };
    })
    .sort(
      (left, right) =>
        Number(right.isDefault) - Number(left.isDefault) ||
        left.pokemonId - right.pokemonId,
    );
}

function buildCanonicalPokemon(
  records,
  varietyData,
  learnsets,
  canonicalMoves,
  generatedAt,
) {
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
        ...getLearnsetOutput(
          learnsets.get(mapping.canonicalSpeciesId),
          canonicalMoves,
        ),
        evolutionChainId: getResourceId(speciesData?.evolution_chain?.url),
        artwork: getArtwork(pokemonData),
        forms: buildForms(speciesData || {}, varietyData),
      }))
      .sort((left, right) => left.speciesId - right.speciesId),
  };
}

function getInitialCanonicalMoves(learnset) {
  return learnset.slice(0, 4).map((entry) => entry.move);
}

function buildCatalogOnlyTemplate(record, canonicalEntry) {
  const { mapping, pokemonData, speciesData } = record;
  const baseStats = getBaseStats(pokemonData);
  const types = getTypes(pokemonData);
  return {
    id: mapping.localId,
    speciesId: mapping.canonicalSpeciesId,
    canonicalName: speciesData.name,
    name: mapping.localName,
    type: types[0],
    types,
    rarity: "common",
    hp: baseStats.hp,
    maxHp: baseStats.hp,
    attack: baseStats.attack,
    defense: baseStats.defense,
    specialAttack: baseStats.specialAttack,
    specialDefense: baseStats.specialDefense,
    speed: baseStats.speed,
    xpYield: pokemonData.base_experience ?? 50,
    habitats: [],
    times: [],
    baseCatchRate: speciesData.capture_rate,
    level: 1,
    xp: 0,
    moves: getInitialCanonicalMoves(canonicalEntry.learnset).length
      ? getInitialCanonicalMoves(canonicalEntry.learnset)
      : ["Tackle"],
    learnsetVersionGroup: canonicalEntry.learnsetVersionGroup,
    imageId: mapping.canonicalSpeciesId,
    isLegendary: Boolean(speciesData.is_legendary),
    isMythical: Boolean(speciesData.is_mythical),
    catalogOnly: true,
    movesetPolicy: canonicalEntry.learnset.length
      ? "canonical-level-up"
      : "canonical-unavailable",
  };
}

function buildExpandedPokemonCatalog(currentPokemon, records, canonicalData) {
  const currentByLocalIdentity = new Map(
    currentPokemon.map((pokemon) => [
      `${pokemon.id}:${normalizePokemonName(pokemon.name)}`,
      pokemon,
    ]),
  );

  return records
    .slice()
    .sort(
      (left, right) =>
        left.mapping.canonicalSpeciesId - right.mapping.canonicalSpeciesId,
    )
    .map((record) => {
      const existing = currentByLocalIdentity.get(
        `${record.mapping.localId}:${normalizePokemonName(record.mapping.localName)}`,
      );
      const canonicalEntry = canonicalData.pokemon.find(
        (entry) => entry.speciesId === record.mapping.canonicalSpeciesId,
      );
      const isGeneratedCatalogMoveset =
        existing?.catalogOnly &&
        [
          "temporary-default",
          "canonical-level-up",
          "canonical-unavailable",
        ].includes(existing.movesetPolicy);
      if (existing && !isGeneratedCatalogMoveset) return existing;
      if (existing) {
        const canonicalInitialMoves = getInitialCanonicalMoves(
          canonicalEntry.learnset,
        );
        const updated = {
          ...existing,
          moves: canonicalInitialMoves.length ? canonicalInitialMoves : existing.moves,
          learnsetVersionGroup: canonicalEntry.learnsetVersionGroup,
          movesetPolicy: canonicalEntry.learnset.length
            ? "canonical-level-up"
            : "canonical-unavailable",
        };
        delete updated.learnset;
        return updated;
      }
      return buildCatalogOnlyTemplate(record, canonicalEntry);
    });
}

function validateCatalogExpansion(
  beforePokemon,
  afterPokemon,
  speciesMap,
  canonicalData,
  evolutionData,
) {
  const errors = [];
  const mappings = speciesMap.species || [];
  const localIds = afterPokemon.map((pokemon) => pokemon.id);
  const speciesIds = mappings.map((mapping) => mapping.canonicalSpeciesId);
  const speciesIdSet = new Set(speciesIds);
  const afterByName = new Map(
    afterPokemon.map((pokemon) => [normalizePokemonName(pokemon.name), pokemon]),
  );

  if (afterPokemon.length !== mappings.length) {
    errors.push("expanded Pokemon catalog and species map counts differ");
  }
  if (new Set(localIds).size !== localIds.length) {
    errors.push("expanded Pokemon catalog has duplicate local IDs");
  }
  if (new Set(speciesIds).size !== speciesIds.length) {
    errors.push("expanded species map has duplicate canonical species IDs");
  }
  for (let speciesId = 1; speciesId <= dexMax; speciesId += 1) {
    if (!speciesIdSet.has(speciesId)) {
      errors.push(`National Dex #${speciesId} is missing`);
    }
  }

  beforePokemon.forEach((before) => {
    const after = afterByName.get(normalizePokemonName(before.name));
    if (!after) {
      errors.push(`existing Pokemon removed: ${before.name}`);
      return;
    }
    const isGeneratedMoveset =
      before.catalogOnly &&
      [
        "temporary-default",
        "canonical-level-up",
        "canonical-unavailable",
      ].includes(before.movesetPolicy);
    const comparableBefore = { ...before };
    const comparableAfter = { ...after };
    if (isGeneratedMoveset) {
      ["moves", "learnset", "learnsetVersionGroup", "movesetPolicy"].forEach(
        (key) => {
          delete comparableBefore[key];
          delete comparableAfter[key];
        },
      );
    }
    if (JSON.stringify(comparableBefore) !== JSON.stringify(comparableAfter)) {
      errors.push(`existing game configuration changed: ${before.name}`);
    }
  });

  afterPokemon
    .filter((pokemon) => pokemon.catalogOnly)
    .forEach((pokemon) => {
      if ((pokemon.habitats || []).length || (pokemon.times || []).length) {
        errors.push(`new catalog-only Pokemon can spawn: ${pokemon.name}`);
      }
      if (
        !["canonical-level-up", "canonical-unavailable"].includes(
          pokemon.movesetPolicy,
        )
      ) {
        errors.push(`new Pokemon lacks canonical moveset marker: ${pokemon.name}`);
      }
      if (!(pokemon.moves || []).length) {
        errors.push(`new Pokemon lacks usable canonical moves: ${pokemon.name}`);
      }
    });

  const evolutionSpeciesIds = new Set(
    (evolutionData.species || []).map((species) => species.speciesId),
  );
  const canonicalSpeciesIds = new Set(
    (canonicalData.pokemon || []).map((species) => species.speciesId),
  );
  const runtimeLocalIds = new Set(afterPokemon.map((pokemon) => pokemon.id));
  const mappingBySpeciesId = new Map(
    mappings.map((mapping) => [mapping.canonicalSpeciesId, mapping]),
  );
  for (let speciesId = 1; speciesId <= dexMax; speciesId += 1) {
    if (!evolutionSpeciesIds.has(speciesId)) {
      errors.push(`evolution catalog is missing National Dex #${speciesId}`);
    }
  }
  (evolutionData.species || []).forEach((species) => {
    const mapping = mappingBySpeciesId.get(species.speciesId);
    if (!species.presentInGame || !Number.isInteger(species.localId)) {
      errors.push(
        `evolution-family species is not in the runtime catalog: ${species.name}`,
      );
    }
    if (!speciesIdSet.has(species.speciesId)) {
      errors.push(
        `species map is missing evolution-family species: ${species.name}`,
      );
    }
    if (!mapping || !runtimeLocalIds.has(mapping.localId)) {
      errors.push(
        `pokemon.json is missing evolution-family species: ${species.name}`,
      );
    }
    if (!canonicalSpeciesIds.has(species.speciesId)) {
      errors.push(
        `canonical Pokemon data is missing evolution-family species: ${species.name}`,
      );
    }
    if (mapping && species.localId !== mapping.localId) {
      errors.push(`evolution localId mismatch for ${species.name}`);
    }
  });

  if (errors.length) {
    throw new Error(`Catalog expansion validation failed:\n- ${errors.join("\n- ")}`);
  }
}

function savePokemonCatalog(pokemon) {
  fs.mkdirSync(path.dirname(pokemonPath), { recursive: true });
  const tempPath = `${pokemonPath}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(pokemon, null, "\t")}\n`);
  fs.renameSync(tempPath, pokemonPath);
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

async function loadEvolutionClosure(existingSpeciesMap, initialSpeciesIds) {
  const targetSpeciesIds = new Set(initialSpeciesIds);
  const recordsBySpeciesId = new Map();
  let chains = new Map();

  while (true) {
    const missingRecordIds = [...targetSpeciesIds]
      .filter((speciesId) => !recordsBySpeciesId.has(speciesId))
      .sort((left, right) => left - right);
    if (missingRecordIds.length) {
      const provisionalSpeciesMap = createProvisionalSpeciesMap(
        existingSpeciesMap,
        missingRecordIds,
      );
      const loadedRecords = await loadMappedRecords(provisionalSpeciesMap);
      if (
        loadedRecords.some(
          (record) => !record.pokemonData || !record.speciesData,
        )
      ) {
        throw new Error(
          "Could not load every species required for evolution-family closure",
        );
      }
      loadedRecords.forEach((record) => {
        recordsBySpeciesId.set(record.mapping.canonicalSpeciesId, record);
      });
    }

    chains = await loadEvolutionChains([...recordsBySpeciesId.values()]);
    const familySpeciesIds = collectEvolutionFamilySpeciesIds(chains);
    const newlyRequired = [...familySpeciesIds].filter(
      (speciesId) => !targetSpeciesIds.has(speciesId),
    );
    if (!newlyRequired.length) break;
    newlyRequired.forEach((speciesId) => targetSpeciesIds.add(speciesId));
  }

  return {
    records: [...recordsBySpeciesId.values()].sort(
      (left, right) =>
        left.mapping.canonicalSpeciesId - right.mapping.canonicalSpeciesId,
    ),
    chains,
  };
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

function validateGeneratedData(
  canonicalData,
  canonicalMoves,
  evolutionData,
  speciesMap,
) {
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
  if (new Set(entries.map((entry) => entry.localId)).size !== entries.length) {
    errors.push("canonical Pokemon contains duplicate localId values");
  }
  if (new Set(localKeys).size !== localKeys.length) {
    errors.push("a local Pokemon maps more than once");
  }
  entries.forEach((entry) => {
    if (!Number.isInteger(entry.speciesId) || entry.speciesId <= 0) {
      errors.push(`${entry.localName} has invalid speciesId`);
    }
    if (!entry.types.length) errors.push(`${entry.localName} has no canonical types`);
    (entry.learnset || []).forEach((learnedMove) => {
      if (!canonicalMoves.moves[learnedMove.move]) {
        errors.push(`${entry.localName} references missing move ${learnedMove.move}`);
      }
    });
    if (!(entry.abilities || []).some((ability) => !ability.hidden)) {
      errors.push(`${entry.localName} has no normal canonical ability`);
    }
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
    `National Dex coverage: ${speciesMap.summary.nationalDexCoverage}/${dexMax}`,
  );
  console.log(
    `Existing species above #${dexMax} preserved: ${speciesMap.summary.existingAboveDexMax}`,
  );
  console.log(`New catalog species: ${speciesMap.summary.addedByExpansion}`);
  console.log(
    `Evolution-closure species: ${speciesMap.summary.addedByEvolutionClosure}`,
  );
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
  console.log(
    `Canonical learnsets: ${canonicalData.pokemon.filter((entry) => entry.learnset.length).length}/${canonicalData.speciesCount}`,
  );
  console.log(
    `Canonical abilities: ${canonicalData.pokemon.filter((entry) => entry.abilities.length).length}/${canonicalData.speciesCount}`,
  );
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
  const existingSpeciesMap = readRequiredJson(speciesMapPath, "species map");
  validateSpeciesMap(existingSpeciesMap, localPokemon);

  const startingSpeciesIds = createExpansionTargets(existingSpeciesMap);
  const closure = await loadEvolutionClosure(
    existingSpeciesMap,
    startingSpeciesIds,
  );
  let records = closure.records;
  const generatedAt = new Date().toISOString();
  const speciesMap = buildExpandedSpeciesMap(
    existingSpeciesMap,
    localPokemon,
    records,
    generatedAt,
  );
  const expandedMappingBySpeciesId = new Map(
    speciesMap.species.map((mapping) => [mapping.canonicalSpeciesId, mapping]),
  );
  records = records.map((record) => ({
    ...record,
    mapping: expandedMappingBySpeciesId.get(record.mapping.canonicalSpeciesId),
  }));
  const varietyData = await loadVarietyData(records);
  const learnsets = buildLearnsetIndex(records);
  const canonicalMoveRecords = await loadCanonicalMoves(learnsets);
  const canonicalMoves = buildCanonicalMoveData(
    canonicalMoveRecords,
    generatedAt,
  );
  const chains = closure.chains;
  const evolutionSpecies = await loadEvolutionSpecies(chains, records);
  const canonicalData = buildCanonicalPokemon(
    records,
    varietyData,
    learnsets,
    canonicalMoves,
    generatedAt,
  );
  const evolutionData = buildEvolutionData(
    chains,
    evolutionSpecies,
    records,
    generatedAt,
  );
  const expandedPokemon = buildExpandedPokemonCatalog(
    localPokemon,
    records,
    canonicalData,
  );
  validateGeneratedData(
    canonicalData,
    canonicalMoves,
    evolutionData,
    speciesMap,
  );
  validateCatalogExpansion(
    localPokemon,
    expandedPokemon,
    speciesMap,
    canonicalData,
    evolutionData,
  );
  validateSpeciesMap(speciesMap, expandedPokemon);
  saveJsonAtomic(speciesMapPath, speciesMap);
  savePokemonCatalog(expandedPokemon);
  saveJsonAtomic(canonicalOutputPath, canonicalData);
  saveJsonAtomic(canonicalMovesOutputPath, canonicalMoves);
  saveJsonAtomic(evolutionOutputPath, evolutionData);
  printSummary(canonicalData, evolutionData, speciesMap);
}

main().catch((error) => {
  console.error(`[pokeapi:build] ${error.stack || error.message}`);
  process.exitCode = 1;
});
