const fs = require("fs");
const path = require("path");
const {
  POKEAPI_BASE_URL,
  flattenEvolutionChain,
  getConfiguredFormSlug,
  getResourceId,
  loadCachedJson,
  mapLimit,
  normalizePokemonName,
  saveJsonAtomic,
  toDisplayName,
} = require("./pokeApiUtils");

const rootDir = path.join(__dirname, "..");
const pokemonPath = path.join(rootDir, "pokemon.json");
const outputDir = path.join(rootDir, "data", "pokeapi");
const cacheRoot = path.join(outputDir, "raw");
const jsonReportPath = path.join(outputDir, "pokemon-audit.json");
const markdownReportPath = path.join(outputDir, "AUDIT_REPORT.md");
const refresh = process.argv.includes("--refresh");
const concurrency = 4;
const cacheStats = { hits: 0, fetched: 0, failures: 0 };
const networkFailures = [];

function readPokemonData() {
  const parsed = JSON.parse(fs.readFileSync(pokemonPath, "utf8"));
  if (!Array.isArray(parsed)) throw new Error("pokemon.json must contain an array");
  return parsed;
}

function titleType(value) {
  return String(value || "")
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("-");
}

function canonicalTypes(pokemonData) {
  return (pokemonData?.types || [])
    .slice()
    .sort((left, right) => left.slot - right.slot)
    .map((entry) => titleType(entry.type?.name));
}

function canonicalStats(pokemonData) {
  const statMap = {
    hp: "hp",
    attack: "attack",
    defense: "defense",
    "special-attack": "specialAttack",
    "special-defense": "specialDefense",
    speed: "speed",
  };
  return Object.fromEntries(
    (pokemonData?.stats || [])
      .filter((entry) => statMap[entry.stat?.name])
      .map((entry) => [statMap[entry.stat.name], entry.base_stat]),
  );
}

function arraysEqual(left = [], right = []) {
  return (
    left.length === right.length &&
    left.every(
      (value, index) =>
        normalizePokemonName(value) === normalizePokemonName(right[index]),
    )
  );
}

function addFinding(entry, severity, code, field, current, canonical, message) {
  entry.findings.push({ severity, code, field, current, canonical, message });
  entry.mismatchFields.push(field);
}

function addMatch(entry, field) {
  if (!entry.matchedFields.includes(field)) entry.matchedFields.push(field);
}

function recordFailure(kind, identity, result) {
  if (result.data) return;
  networkFailures.push({ kind, identity, error: result.error || "unknown error" });
}

async function fetchBaseRecords(localPokemon) {
  return mapLimit(localPokemon, concurrency, async (local) => {
    const pokemonResult = await loadCachedJson({
      cacheRoot,
      category: "pokemon",
      key: local.id,
      url: `${POKEAPI_BASE_URL}/pokemon/${local.id}`,
      refresh,
      cacheStats,
    });
    recordFailure("pokemon", `${local.name} #${local.id}`, pokemonResult);

    const speciesResult = await loadCachedJson({
      cacheRoot,
      category: "species",
      key: local.id,
      url: `${POKEAPI_BASE_URL}/pokemon-species/${local.id}`,
      refresh,
      cacheStats,
    });
    recordFailure("species", `${local.name} #${local.id}`, speciesResult);
    return {
      local,
      pokemon: pokemonResult.data,
      species: speciesResult.data,
      failures: [pokemonResult, speciesResult]
        .filter((result) => !result.data)
        .map((result) => result.error),
    };
  });
}

async function fetchEvolutionChains(baseRecords) {
  const urls = [
    ...new Set(
      baseRecords
        .map((record) => record.species?.evolution_chain?.url)
        .filter(Boolean),
    ),
  ];
  const results = await mapLimit(urls, concurrency, async (url) => {
    const chainId = getResourceId(url) || `unknown-${urls.indexOf(url)}`;
    const result = await loadCachedJson({
      cacheRoot,
      category: "evolution-chains",
      key: chainId,
      url,
      refresh,
      cacheStats,
    });
    recordFailure("evolution-chain", chainId, result);
    return [url, result.data];
  });
  return new Map(results);
}

async function fetchVarieties(baseRecords) {
  const varieties = new Map();
  baseRecords.forEach((record) => {
    (record.species?.varieties || [])
      .filter((variety) => !variety.is_default && variety.pokemon?.url)
      .forEach((variety) =>
        varieties.set(variety.pokemon.name, variety.pokemon.url),
      );
  });
  const results = await mapLimit(
    [...varieties.entries()],
    concurrency,
    async ([name, url]) => {
      const result = await loadCachedJson({
        cacheRoot,
        category: path.join("pokemon", "forms"),
        key: name,
        url,
        refresh,
        cacheStats,
      });
      recordFailure("form", name, result);
      return [name, result.data];
    },
  );
  return new Map(results);
}

function getEvolutionAudit(local, speciesData, chainData, localNameSet) {
  if (!chainData?.chain) {
    return {
      status: "UNAVAILABLE",
      current: { target: local.evolvesTo || null, level: local.evolveLevel || null },
      canonicalTargets: [],
      canonicalEdges: [],
      presentSpecies: [local.name],
      missingSpecies: [],
      branching: false,
    };
  }

  const flattened = flattenEvolutionChain(chainData.chain);
  const localCanonicalName = speciesData?.name || local.name;
  const directEdges = flattened.edges.filter(
    (edge) =>
      normalizePokemonName(edge.from) === normalizePokemonName(localCanonicalName),
  );
  const canonicalTargets = [...new Set(directEdges.map((edge) => edge.to))];
  const presentSpecies = flattened.nodes
    .filter((name) => localNameSet.has(normalizePokemonName(name)))
    .map(toDisplayName);
  const missingSpecies = flattened.nodes
    .filter((name) => !localNameSet.has(normalizePokemonName(name)))
    .map(toDisplayName);

  return {
    chainId: chainData.id || getResourceId(speciesData?.evolution_chain?.url),
    status: "MATCH",
    current: { target: local.evolvesTo || null, level: local.evolveLevel || null },
    canonicalTargets: canonicalTargets.map(toDisplayName),
    canonicalEdges: directEdges,
    presentSpecies,
    missingSpecies,
    branching: canonicalTargets.length > 1,
  };
}

function auditEvolution(entry, local, evolution) {
  if (evolution.status === "UNAVAILABLE") return;
  const currentTarget = normalizePokemonName(local.evolvesTo);
  const canonicalTargets = evolution.canonicalTargets.map(normalizePokemonName);

  if (!currentTarget && canonicalTargets.length) {
    evolution.status = canonicalTargets.length > 1 ? "BRANCHING_MISMATCH" : "TARGET_MISSING";
    addFinding(
      entry,
      "HIGH",
      evolution.status,
      "evolution",
      null,
      evolution.canonicalTargets,
      `${local.name} is missing canonical evolution target information.`,
    );
    return;
  }
  if (currentTarget && !canonicalTargets.includes(currentTarget)) {
    evolution.status = canonicalTargets.length ? "TARGET_MISMATCH" : "TARGET_EXTRA";
    addFinding(
      entry,
      "HIGH",
      evolution.status,
      "evolution",
      evolution.current,
      { targets: evolution.canonicalTargets },
      `${local.name}'s configured evolution target does not match PokéAPI.`,
    );
    return;
  }
  if (!currentTarget) return;

  if (canonicalTargets.length > 1) {
    evolution.status = "BRANCHING_MISMATCH";
    addFinding(
      entry,
      "HIGH",
      "BRANCHING_MISMATCH",
      "evolution",
      evolution.current,
      { targets: evolution.canonicalTargets },
      `${local.name} has multiple canonical evolution branches.`,
    );
    return;
  }

  const matchingEdges = evolution.canonicalEdges.filter(
    (edge) => normalizePokemonName(edge.to) === currentTarget,
  );
  const conditions = matchingEdges.flatMap((edge) => edge.conditions);
  const levelMatches = conditions.some(
    (condition) =>
      condition.trigger === "level-up" &&
      condition.minLevel === Number(local.evolveLevel),
  );
  if (levelMatches) return;

  const canonicalLevels = conditions
    .filter((condition) => condition.trigger === "level-up" && condition.minLevel)
    .map((condition) => condition.minLevel);
  evolution.status = canonicalLevels.length
    ? "LEVEL_MISMATCH"
    : "METHOD_MISMATCH";
  addFinding(
    entry,
    "HIGH",
    evolution.status,
    "evolution",
    evolution.current,
    { targets: evolution.canonicalTargets, conditions },
    canonicalLevels.length
      ? `${local.name}'s evolution level differs from PokéAPI.`
      : `${local.name} uses a simplified level evolution for a different canonical method.`,
  );
}

function getArtworkAvailability(pokemonData) {
  const artwork = pokemonData?.sprites?.other?.["official-artwork"] || {};
  return {
    normal: Boolean(artwork.front_default),
    shiny: Boolean(artwork.front_shiny),
  };
}

function auditForms(entry, local, speciesData, varietyData) {
  const canonicalForms = (speciesData?.varieties || [])
    .filter((variety) => !variety.is_default)
    .map((variety) => {
      const data = varietyData.get(variety.pokemon.name);
      return {
        name: variety.pokemon.name,
        pokemonId: data?.id || getResourceId(variety.pokemon.url),
        types: canonicalTypes(data),
        artwork: getArtworkAvailability(data),
        available: Boolean(data),
      };
    });
  const configuredForms = (local.forms || []).map((form) => {
    const expectedSlug = getConfiguredFormSlug(speciesData?.name || local.name, form.id);
    const canonical = canonicalForms.find(
      (candidate) =>
        normalizePokemonName(candidate.name) === normalizePokemonName(expectedSlug),
    );
    const result = {
      id: form.id,
      name: form.name,
      category: form.category,
      types: form.types || [],
      imageId: form.imageId || null,
      expectedCanonicalName: expectedSlug,
      canonical: canonical || null,
      status: canonical ? "MATCH" : "CANONICAL_FORM_NOT_FOUND",
    };
    if (!canonical) {
      addFinding(
        entry,
        "HIGH",
        "FORM_IDENTITY_MISMATCH",
        `forms.${form.id}`,
        result,
        canonicalForms.map((candidate) => candidate.name),
        `${local.name}'s configured ${form.name} could not be matched to a PokéAPI variety.`,
      );
      return result;
    }
    if (!arraysEqual(form.types || [], canonical.types)) {
      result.status = "TYPE_MISMATCH";
      addFinding(
        entry,
        "MEDIUM",
        "FORM_TYPE_MISMATCH",
        `forms.${form.id}.types`,
        form.types || [],
        canonical.types,
        `${local.name}'s ${form.name} types differ from PokéAPI.`,
      );
    }
    if (Number(form.imageId) !== Number(canonical.pokemonId)) {
      result.status = "IMAGE_ID_SUSPICIOUS";
      addFinding(
        entry,
        "HIGH",
        "FORM_IMAGE_ID_SUSPICIOUS",
        `forms.${form.id}.imageId`,
        form.imageId || null,
        canonical.pokemonId,
        `${local.name}'s ${form.name} imageId does not match the canonical variety ID.`,
      );
    }
    return result;
  });
  const configuredCanonicalNames = new Set(
    configuredForms
      .filter((form) => form.canonical)
      .map((form) => normalizePokemonName(form.canonical.name)),
  );
  const missingForms = canonicalForms.filter(
    (form) => !configuredCanonicalNames.has(normalizePokemonName(form.name)),
  );
  missingForms.forEach((form) => {
    entry.findings.push({
      severity: "INFO",
      code: "CANONICAL_FORM_NOT_CONFIGURED",
      field: "forms",
      current: null,
      canonical: form.name,
      message: `${toDisplayName(form.name)} is available in PokéAPI but not configured in the game.`,
    });
  });
  return { canonicalForms, configuredForms, missingForms };
}

function auditRecord(record, chainDataByUrl, varietyData, localNameSet, duplicates) {
  const { local, pokemon, species } = record;
  const entry = {
    id: local.id,
    name: local.name,
    status: "MATCH",
    matchedFields: [],
    mismatchFields: [],
    findings: [],
    current: {
      id: local.id,
      name: local.name,
      type: local.type || null,
      types: local.types || (local.type ? [local.type] : []),
      stats: {
        hp: local.hp ?? null,
        maxHp: local.maxHp ?? null,
        attack: local.attack ?? null,
        defense: local.defense ?? null,
        specialAttack: local.specialAttack ?? null,
        specialDefense: local.specialDefense ?? null,
        speed: local.speed ?? null,
      },
      baseCatchRate: local.baseCatchRate ?? null,
      rarity: local.rarity || null,
      imageId: local.imageId ?? local.id,
      evolvesTo: local.evolvesTo || null,
      evolveLevel: local.evolveLevel ?? null,
    },
    canonical: null,
    evolution: null,
    forms: null,
  };

  if (duplicates.ids.has(local.id)) {
    addFinding(entry, "CRITICAL", "DUPLICATE_ID", "id", local.id, null, `National Pokédex ID ${local.id} is assigned more than once.`);
  }
  if (duplicates.names.has(normalizePokemonName(local.name))) {
    addFinding(entry, "CRITICAL", "DUPLICATE_NAME", "name", local.name, null, `${local.name} is defined more than once.`);
  }
  if (!pokemon || !species) {
    entry.status = "FAILED";
    entry.failures = record.failures;
    addFinding(entry, "CRITICAL", "CANONICAL_DATA_UNAVAILABLE", "identity", { id: local.id, name: local.name }, null, "PokéAPI Pokémon or species data could not be loaded.");
    return entry;
  }

  const types = canonicalTypes(pokemon);
  const stats = canonicalStats(pokemon);
  entry.canonical = {
    id: pokemon.id,
    pokemonName: pokemon.name,
    speciesName: species.name,
    types,
    stats,
    captureRate: species.capture_rate,
    baseExperience: pokemon.base_experience,
    abilities: (pokemon.abilities || []).map((entry) => entry.ability?.name).filter(Boolean),
    height: pokemon.height,
    weight: pokemon.weight,
    baseHappiness: species.base_happiness,
    growthRate: species.growth_rate?.name || null,
    genderRate: species.gender_rate,
    isLegendary: Boolean(species.is_legendary),
    isMythical: Boolean(species.is_mythical),
    generation: species.generation?.name || null,
    pokemonForms: (pokemon.forms || [])
      .map((form) => form.name)
      .filter(Boolean),
    artwork: getArtworkAvailability(pokemon),
  };

  if (
    Number(local.id) !== Number(pokemon.id) ||
    normalizePokemonName(local.name) !== normalizePokemonName(pokemon.name) ||
    normalizePokemonName(local.name) !== normalizePokemonName(species.name)
  ) {
    addFinding(entry, "CRITICAL", "ID_NAME_MISMATCH", "identity", { id: local.id, name: local.name }, { id: pokemon.id, pokemonName: pokemon.name, speciesName: species.name }, "Local ID and name do not resolve to the same canonical species.");
  }
  else {
    addMatch(entry, "identity");
  }

  if (normalizePokemonName(local.type) !== normalizePokemonName(types[0])) {
    addFinding(entry, "MEDIUM", "PRIMARY_TYPE_MISMATCH", "type", local.type || null, types[0] || null, `${local.name}'s primary type differs from PokéAPI.`);
  }
  else {
    addMatch(entry, "type");
  }
  const localTypes = local.types || (local.type ? [local.type] : []);
  if (!arraysEqual(localTypes, types)) {
    addFinding(entry, "MEDIUM", "TYPES_ARRAY_MISMATCH", "types", localTypes, types, `${local.name}'s types array differs from PokéAPI.`);
  }
  else {
    addMatch(entry, "types");
  }

  ["hp", "attack", "defense", "specialAttack", "specialDefense", "speed"].forEach((stat) => {
    if (Number(local[stat]) !== Number(stats[stat])) {
      addFinding(entry, "MEDIUM", "BASE_STAT_MISMATCH", `stats.${stat}`, local[stat] ?? null, stats[stat] ?? null, `${local.name}'s ${stat} base stat differs from PokéAPI.`);
    }
    else {
      addMatch(entry, `stats.${stat}`);
    }
  });
  if (Number(local.maxHp) !== Number(stats.hp)) {
    addFinding(entry, "MEDIUM", "BASE_STAT_MISMATCH", "stats.maxHp", local.maxHp ?? null, stats.hp ?? null, `${local.name}'s maxHp template value differs from canonical base HP.`);
  }
  else {
    addMatch(entry, "stats.maxHp");
  }
  if (Number(local.baseCatchRate) !== Number(species.capture_rate)) {
    addFinding(entry, "MEDIUM", "CAPTURE_RATE_MISMATCH", "baseCatchRate", local.baseCatchRate ?? null, species.capture_rate, `${local.name}'s base catch rate differs from PokéAPI.`);
  }
  else {
    addMatch(entry, "baseCatchRate");
  }

  const localLegendary = local.rarity === "legendary";
  const localMythical = local.rarity === "mythical";
  if (localLegendary !== Boolean(species.is_legendary) || localMythical !== Boolean(species.is_mythical)) {
    addFinding(entry, "MEDIUM", "CLASSIFICATION_MISMATCH", "classification", { legendary: localLegendary, mythical: localMythical }, { legendary: Boolean(species.is_legendary), mythical: Boolean(species.is_mythical) }, `${local.name}'s legendary/mythical classification differs from PokéAPI.`);
  }
  else {
    addMatch(entry, "classification");
  }
  if (Number(local.imageId ?? local.id) !== Number(pokemon.id)) {
    addFinding(entry, "HIGH", "IMAGE_ID_SUSPICIOUS", "imageId", local.imageId ?? local.id, pokemon.id, `${local.name}'s base imageId does not match its canonical Pokémon ID.`);
  }
  else {
    addMatch(entry, "imageId");
  }

  const chainUrl = species.evolution_chain?.url;
  entry.evolution = getEvolutionAudit(
    local,
    species,
    chainDataByUrl.get(chainUrl),
    localNameSet,
  );
  auditEvolution(entry, local, entry.evolution);
  if (entry.evolution.status === "MATCH") addMatch(entry, "evolution");
  entry.forms = auditForms(entry, local, species, varietyData);
  entry.forms.configuredForms
    .filter((form) => form.status === "MATCH")
    .forEach((form) => addMatch(entry, `forms.${form.id}`));

  entry.mismatchFields = [...new Set(entry.mismatchFields)];
  if (entry.findings.some((finding) => ["CRITICAL", "HIGH", "MEDIUM"].includes(finding.severity))) {
    entry.status = "MISMATCH";
  }
  return entry;
}

function collectEvolutionMethods(chains) {
  const methods = { item: [], friendship: [], trade: [] };
  const seen = { item: new Set(), friendship: new Set(), trade: new Set() };
  const addMethod = (category, record) => {
    const key = `${record.from}|${record.to}|${JSON.stringify(record.condition)}`;
    if (seen[category].has(key)) return;
    seen[category].add(key);
    methods[category].push(record);
  };
  chains.forEach((chain) => {
    if (!chain?.chain) return;
    flattenEvolutionChain(chain.chain).edges.forEach((edge) => {
      edge.conditions.forEach((condition) => {
        const record = { from: toDisplayName(edge.from), to: toDisplayName(edge.to), condition };
        if (condition.trigger === "use-item" || condition.item || condition.heldItem) addMethod("item", record);
        if (condition.minHappiness) addMethod("friendship", record);
        if (condition.trigger === "trade") addMethod("trade", record);
      });
    });
  });
  return methods;
}

function uniqueChains(chainDataByUrl) {
  return [...chainDataByUrl.values()].filter(Boolean);
}

function buildSummary(entries, chainDataByUrl) {
  const allFindings = entries.flatMap((entry) => entry.findings);
  const countCode = (code) => allFindings.filter((finding) => finding.code === code).length;
  const evolutionCodes = new Set(["TARGET_MISSING", "TARGET_MISMATCH", "TARGET_EXTRA", "LEVEL_MISMATCH", "METHOD_MISMATCH", "BRANCHING_MISMATCH"]);
  const missingFamilyNames = new Set();
  entries.forEach((entry) => {
    (entry.evolution?.missingSpecies || []).forEach((name) => missingFamilyNames.add(name));
  });
  const chains = uniqueChains(chainDataByUrl);
  const branchingFamilies = chains.filter((chain) => {
    const outgoingCounts = new Map();
    flattenEvolutionChain(chain.chain).edges.forEach((edge) => {
      outgoingCounts.set(edge.from, (outgoingCounts.get(edge.from) || 0) + 1);
    });
    return [...outgoingCounts.values()].some((count) => count > 1);
  }).length;
  const methods = collectEvolutionMethods(chains);
  return {
    speciesChecked: entries.length,
    speciesMatched: entries.filter((entry) => entry.status === "MATCH").length,
    speciesWithMismatches: entries.filter((entry) => entry.status === "MISMATCH").length,
    speciesFailed: entries.filter((entry) => entry.status === "FAILED").length,
    networkFailures: networkFailures.length,
    identityProblems: countCode("ID_NAME_MISMATCH") + countCode("DUPLICATE_ID") + countCode("DUPLICATE_NAME") + countCode("CANONICAL_DATA_UNAVAILABLE"),
    statMismatches: countCode("BASE_STAT_MISMATCH"),
    typeMismatches: countCode("PRIMARY_TYPE_MISMATCH") + countCode("TYPES_ARRAY_MISMATCH") + countCode("FORM_TYPE_MISMATCH"),
    captureRateMismatches: countCode("CAPTURE_RATE_MISMATCH"),
    evolutionMismatches: entries.filter((entry) => entry.findings.some((finding) => evolutionCodes.has(finding.code))).length,
    branchingFamilies,
    missingEvolutionSpecies: missingFamilyNames.size,
    formsDetected: entries.reduce((total, entry) => total + (entry.forms?.canonicalForms.length || 0), 0),
    configuredForms: entries.reduce((total, entry) => total + (entry.forms?.configuredForms.length || 0), 0),
    itemEvolutions: methods.item.length,
    friendshipEvolutions: methods.friendship.length,
    tradeEvolutions: methods.trade.length,
  };
}

function formatValue(value) {
  if (value === null || value === undefined) return "none";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "none";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function findingsSection(title, entries, codes) {
  const lines = [`## ${title}`, ""];
  const rows = entries.flatMap((entry) =>
    entry.findings
      .filter((finding) => codes.has(finding.code))
      .map((finding) => ({ entry, finding })),
  );
  if (!rows.length) return [...lines, "None.", ""].join("\n");
  rows.forEach(({ entry, finding }) => {
    lines.push(
      `- **${entry.name} #${entry.id}** [${finding.severity}] ${finding.message} Current: \`${formatValue(finding.current)}\`; canonical: \`${formatValue(finding.canonical)}\`.`,
    );
  });
  lines.push("");
  return lines.join("\n");
}

function buildMarkdown(report) {
  const { summary, pokemon: entries, evolutionMethods } = report;
  const lines = [
    "# PokéAPI Data Audit",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `- Pokémon audited: **${summary.speciesChecked}**`,
    `- Fully matched: **${summary.speciesMatched}**`,
    `- With mismatches: **${summary.speciesWithMismatches}**`,
    `- Failed species audits: **${summary.speciesFailed}**`,
    `- Type mismatches: **${summary.typeMismatches}**`,
    `- Base-stat mismatches: **${summary.statMismatches}**`,
    `- Capture-rate mismatches: **${summary.captureRateMismatches}**`,
    `- Evolution mismatches: **${summary.evolutionMismatches}**`,
    `- Branching families: **${summary.branchingFamilies}**`,
    `- Missing family members: **${summary.missingEvolutionSpecies}**`,
    `- Request failures: **${summary.networkFailures}**`,
    "",
    "> Game-specific habitats, rarity balance, times, movesets, encounter weights, teams, rewards, and quests are intentionally not audited as canonical errors.",
    "",
  ];

  const sections = [
    ["Critical Identity Problems", new Set(["ID_NAME_MISMATCH", "DUPLICATE_ID", "DUPLICATE_NAME", "CANONICAL_DATA_UNAVAILABLE"])],
    ["Type Mismatches", new Set(["PRIMARY_TYPE_MISMATCH", "TYPES_ARRAY_MISMATCH", "FORM_TYPE_MISMATCH"])],
    ["Base Stat Mismatches", new Set(["BASE_STAT_MISMATCH"])],
    ["Capture Rate Mismatches", new Set(["CAPTURE_RATE_MISMATCH"])],
    ["Evolution Mismatches", new Set(["TARGET_MISSING", "TARGET_MISMATCH", "TARGET_EXTRA", "LEVEL_MISMATCH", "METHOD_MISMATCH"])],
    ["Branching Evolutions", new Set(["BRANCHING_MISMATCH"])],
  ];
  sections.forEach(([title, codes]) => lines.push(findingsSection(title, entries, codes)));

  lines.push("## Missing Evolution Family Members", "");
  const families = new Map();
  entries.forEach((entry) => {
    if (!entry.evolution?.chainId || !entry.evolution.missingSpecies.length) return;
    families.set(entry.evolution.chainId, {
      present: entry.evolution.presentSpecies,
      missing: entry.evolution.missingSpecies,
    });
  });
  if (!families.size) lines.push("None.");
  families.forEach((family, chainId) => {
    lines.push(`- Chain ${chainId}: present **${family.present.join(", ") || "none"}**; missing **${family.missing.join(", ")}**.`);
  });
  lines.push("");

  lines.push("## Forms Found", "");
  const formEntries = entries.filter(
    (entry) => entry.forms?.canonicalForms.length || entry.forms?.configuredForms.length,
  );
  if (!formEntries.length) lines.push("None.");
  formEntries.forEach((entry) => {
    lines.push(
      `- **${entry.name}**: canonical ${entry.forms.canonicalForms.map((form) => form.name).join(", ") || "none"}; configured ${entry.forms.configuredForms.map((form) => form.name).join(", ") || "none"}; missing ${entry.forms.missingForms.map((form) => form.name).join(", ") || "none"}.`,
    );
  });
  lines.push("");

  lines.push("## Canonical Evolution Methods", "");
  [
    ["Item", evolutionMethods.item],
    ["Friendship", evolutionMethods.friendship],
    ["Trade", evolutionMethods.trade],
  ].forEach(([label, records]) => {
    lines.push(`### ${label} (${records.length})`, "");
    if (!records.length) lines.push("None.");
    records.forEach((record) => lines.push(`- ${record.from} → ${record.to}: \`${JSON.stringify(record.condition)}\``));
    lines.push("");
  });

  lines.push("## Network / Mapping Failures", "");
  if (!report.networkFailures.length) lines.push("None.");
  report.networkFailures.forEach((failure) => lines.push(`- ${failure.kind} ${failure.identity}: ${failure.error}`));
  lines.push("");
  return `${lines.join("\n")}\n`;
}

async function main() {
  console.log(`[pokeapi:audit] Starting ${refresh ? "refresh" : "cache-first"} audit...`);
  const localPokemon = readPokemonData();
  const idCounts = new Map();
  const nameCounts = new Map();
  localPokemon.forEach((pokemon) => {
    idCounts.set(pokemon.id, (idCounts.get(pokemon.id) || 0) + 1);
    const name = normalizePokemonName(pokemon.name);
    nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
  });
  const duplicates = {
    ids: new Set([...idCounts].filter(([, count]) => count > 1).map(([id]) => id)),
    names: new Set([...nameCounts].filter(([, count]) => count > 1).map(([name]) => name)),
  };
  const uniqueById = [...new Map(localPokemon.map((pokemon) => [pokemon.id, pokemon])).values()];
  const localNameSet = new Set(localPokemon.map((pokemon) => normalizePokemonName(pokemon.name)));

  const baseRecords = await fetchBaseRecords(uniqueById);
  const chainDataByUrl = await fetchEvolutionChains(baseRecords);
  const varietyData = await fetchVarieties(baseRecords);
  const entries = baseRecords.map((record) =>
    auditRecord(record, chainDataByUrl, varietyData, localNameSet, duplicates),
  );
  const evolutionMethods = collectEvolutionMethods(uniqueChains(chainDataByUrl));
  const report = {
    generatedAt: new Date().toISOString(),
    source: "https://pokeapi.co",
    mode: refresh ? "refresh" : "cache-first",
    cache: { ...cacheStats },
    summary: buildSummary(entries, chainDataByUrl),
    duplicateLocalIds: [...duplicates.ids],
    duplicateLocalNames: [...duplicates.names],
    evolutionMethods,
    networkFailures,
    pokemon: entries,
  };

  saveJsonAtomic(jsonReportPath, report);
  fs.mkdirSync(path.dirname(markdownReportPath), { recursive: true });
  const tempMarkdown = `${markdownReportPath}.tmp`;
  fs.writeFileSync(tempMarkdown, buildMarkdown(report));
  fs.renameSync(tempMarkdown, markdownReportPath);

  console.log(
    `[pokeapi:audit] Audited ${report.summary.speciesChecked}: ${report.summary.speciesMatched} matched, ${report.summary.speciesWithMismatches} mismatched, ${report.summary.speciesFailed} failed.`,
  );
  console.log(
    `[pokeapi:audit] Cache hits=${cacheStats.hits}, fetched=${cacheStats.fetched}, failures=${cacheStats.failures}.`,
  );
  console.log(`[pokeapi:audit] Wrote ${path.relative(rootDir, jsonReportPath)} and ${path.relative(rootDir, markdownReportPath)}.`);
}

main().catch((error) => {
  console.error(`[pokeapi:audit] Fatal error: ${error.stack || error.message}`);
  process.exitCode = 1;
});
