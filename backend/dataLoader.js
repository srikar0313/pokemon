const fs = require("fs");
const path = require("path");
const { typeChart } = require("./battleEngine");
const {
  createCanonicalPokemonLookup,
  normalizeCanonicalName,
} = require("./canonicalPokemon");

const rootDir = path.join(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const validRarities = new Set([
  "common",
  "uncommon",
  "rare",
  "legendary",
  "mythical",
]);
const validTimes = new Set(["day", "night"]);
const validMoveCategories = new Set(["Physical", "Special", "Status"]);
const validFormCategories = new Set(["regional", "special"]);
const supportedEffectTypes = new Set([
  "status",
  "statChange",
  "heal",
  "healAndSleep",
  "allStatsUp",
  "randomMove",
  "criticalBoost",
  "weather",
  "trap",
]);
const requiredRarityWeights = [
  "common",
  "uncommon",
  "rare",
  "legendary",
  "mythical",
];

function loadJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    console.warn(`[dataLoader] Could not load ${filePath}: ${error.message}`);
    return fallback;
  }
}

function saveJson(filePath, data) {
  const directory = path.dirname(filePath);
  const tempPath = `${filePath}.tmp`;
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
  fs.renameSync(tempPath, filePath);
}

function createWarningGroups() {
  return {
    pokemonWarnings: [],
    moveWarnings: [],
    teamWarnings: [],
    encounterWarnings: [],
  };
}

function addWarning(groups, category, warning) {
  groups[category].push(warning);
}

function isPositiveNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function getKnownTypes() {
  const types = new Set(Object.keys(typeChart));
  Object.values(typeChart).forEach((matchups) => {
    Object.keys(matchups || {}).forEach((type) => types.add(type));
  });
  return types;
}

function getMoveName(move) {
  return typeof move === "string" ? move : move?.name;
}

function addDuplicateWarnings(values, label, groups, category) {
  const seen = new Set();
  const warned = new Set();
  values.forEach((value) => {
    if (value === undefined || value === null || value === "") return;
    if (seen.has(value) && !warned.has(value)) {
      addWarning(groups, category, `Duplicate ${label}: ${value}`);
      warned.add(value);
    }
    seen.add(value);
  });
}

function validateMoveDefinition(label, move, groups, knownTypes) {
  if (!move || typeof move !== "object") {
    addWarning(groups, "moveWarnings", `${label} is not a valid move object`);
    return;
  }
  if (!move.name) addWarning(groups, "moveWarnings", `${label} has no name`);
  if (!move.type) {
    addWarning(groups, "moveWarnings", `${label} has no type`);
  } else if (!knownTypes.has(move.type)) {
    addWarning(groups, "moveWarnings", `${label} has invalid type: ${move.type}`);
  }
  if (!move.category) {
    addWarning(groups, "moveWarnings", `${label} has no category`);
  } else if (!validMoveCategories.has(move.category)) {
    addWarning(
      groups,
      "moveWarnings",
      `${label} has invalid category: ${move.category}`,
    );
  }
  if (move.accuracy === undefined) {
    addWarning(groups, "moveWarnings", `${label} has no accuracy`);
  }
  if (move.pp === undefined) addWarning(groups, "moveWarnings", `${label} has no pp`);
  if (move.maxPp === undefined) {
    addWarning(groups, "moveWarnings", `${label} has no maxPp`);
  }
  if (move.effect) {
    if (!supportedEffectTypes.has(move.effect.type)) {
      addWarning(
        groups,
        "moveWarnings",
        `${label} has unsupported effect type: ${move.effect.type}`,
      );
    }
    if (
      typeof move.effect.amount === "string" &&
      move.effect.amount.trim().endsWith("%")
    ) {
      addWarning(
        groups,
        "moveWarnings",
        `${label} uses effect.amount as a percentage string: ${move.effect.amount}`,
      );
    }
  }
}

function validatePokemonEntry(pokemon, context) {
  const { groups, pokemonNames, moveNames, validAreaIds, knownTypes } = context;
  const label = pokemon?.name || pokemon?.id || "Unknown Pokemon";
  if (!pokemon?.id) addWarning(groups, "pokemonWarnings", `${label} has no id`);
  if (!pokemon?.name) {
    addWarning(groups, "pokemonWarnings", `Pokemon id ${pokemon?.id || "unknown"} has no name`);
  }
  if (!pokemon?.type && !pokemon?.types?.length) {
    addWarning(groups, "pokemonWarnings", `${label} has no type/types`);
  }
  if (pokemon?.type && !knownTypes.has(pokemon.type)) {
    addWarning(groups, "pokemonWarnings", `${label} has invalid type: ${pokemon.type}`);
  }
  if (!Array.isArray(pokemon?.types) || pokemon.types.length === 0) {
    addWarning(groups, "pokemonWarnings", `${label} has no types array`);
  } else {
    pokemon.types.forEach((type) => {
      if (!knownTypes.has(type)) {
        addWarning(groups, "pokemonWarnings", `${label} has invalid type: ${type}`);
      }
    });
  }
  if (!pokemon?.rarity) {
    addWarning(groups, "pokemonWarnings", `${label} has no rarity`);
  } else if (!validRarities.has(pokemon.rarity)) {
    addWarning(groups, "pokemonWarnings", `${label} has invalid rarity: ${pokemon.rarity}`);
  }
  ["hp", "maxHp"].forEach((stat) => {
    if (pokemon?.[stat] === undefined) {
      addWarning(groups, "pokemonWarnings", `${label} has no ${stat}`);
    }
  });
  ["attack", "defense", "specialAttack", "specialDefense"].forEach((stat) => {
    if (pokemon?.[stat] === undefined) {
      addWarning(groups, "pokemonWarnings", `${label} has no ${stat}`);
    }
  });
  if (pokemon?.speed === undefined) {
    addWarning(groups, "pokemonWarnings", `${label} has no speed`);
  }
  if (pokemon?.xpYield === undefined) {
    addWarning(groups, "pokemonWarnings", `${label} has no xpYield`);
  }
  if (pokemon?.baseCatchRate === undefined) {
    addWarning(groups, "pokemonWarnings", `${label} has no baseCatchRate`);
  }
  if (
    (!Array.isArray(pokemon?.habitats) || pokemon.habitats.length === 0) &&
    !pokemon?.catalogOnly
  ) {
    addWarning(groups, "pokemonWarnings", `${label} has no habitats`);
  } else if (Array.isArray(pokemon?.habitats)) {
    pokemon.habitats.forEach((habitat) => {
      if (!validAreaIds.has(habitat)) {
        addWarning(
          groups,
          "pokemonWarnings",
          `${label} has invalid habitat: ${habitat}`,
        );
      }
    });
  }
  if (
    (!Array.isArray(pokemon?.times) || pokemon.times.length === 0) &&
    !pokemon?.catalogOnly
  ) {
    addWarning(groups, "pokemonWarnings", `${label} has no times`);
  } else if (Array.isArray(pokemon?.times)) {
    pokemon.times.forEach((time) => {
      if (!validTimes.has(time)) {
        addWarning(groups, "pokemonWarnings", `${label} has invalid time: ${time}`);
      }
    });
  }
  if (!pokemon?.imageId) {
    addWarning(groups, "pokemonWarnings", `${label} has no imageId`);
  }
  if (pokemon?.evolvesTo) {
    if (!pokemonNames.has(pokemon.evolvesTo)) {
      addWarning(
        groups,
        "pokemonWarnings",
        `${label} evolvesTo missing Pokemon: ${pokemon.evolvesTo}`,
      );
    }
    if (!isPositiveNumber(pokemon.evolveLevel)) {
      addWarning(
        groups,
        "pokemonWarnings",
        `${label} has invalid evolveLevel for ${pokemon.evolvesTo}`,
      );
    }
  }
  if (!Array.isArray(pokemon?.moves) || pokemon.moves.length === 0) {
    addWarning(groups, "pokemonWarnings", `${label} has no moves`);
  } else {
    pokemon.moves.forEach((move) => {
      if (typeof move === "string") {
        if (!moveNames.has(move)) {
          addWarning(groups, "moveWarnings", `${label} references missing move: ${move}`);
        }
      } else {
        validateMoveDefinition(`${label} inline move ${getMoveName(move) || "unknown"}`, move, groups, knownTypes);
      }
    });
  }
  (pokemon?.learnset || []).forEach((entry) => {
    if (!isPositiveNumber(entry.level)) {
      addWarning(groups, "moveWarnings", `${label} learnset has invalid level`);
    }
    const moveName = getMoveName(entry.move);
    if (!moveName || !moveNames.has(moveName)) {
      addWarning(
        groups,
        "moveWarnings",
        `${label} learnset references missing move: ${moveName || "unknown"}`,
      );
    }
  });
  const formIds = new Set();
  (pokemon?.forms || []).forEach((form) => {
    const formLabel = `${label} form ${form?.id || "unknown"}`;
    if (!form?.id) {
      addWarning(groups, "pokemonWarnings", `${label} has form without id`);
    } else if (formIds.has(form.id)) {
      addWarning(
        groups,
        "pokemonWarnings",
        `${label} has duplicate form id: ${form.id}`,
      );
    } else {
      formIds.add(form.id);
    }
    if (!validFormCategories.has(form?.category)) {
      addWarning(
        groups,
        "pokemonWarnings",
        `${formLabel} has invalid category: ${form?.category || "missing"}`,
      );
    }
    if (!Array.isArray(form?.types) || !form.types.length) {
      addWarning(groups, "pokemonWarnings", `${formLabel} has no type overrides`);
    } else {
      form.types.forEach((type) => {
        if (!knownTypes.has(type)) {
          addWarning(
            groups,
            "pokemonWarnings",
            `${formLabel} has invalid type: ${type}`,
          );
        }
      });
    }
    if (!isPositiveNumber(form?.imageId) && !form?.artwork?.normal) {
      addWarning(
        groups,
        "pokemonWarnings",
        `${formLabel} has invalid artwork metadata`,
      );
    }
    (form?.habitats || []).forEach((habitat) => {
      if (!validAreaIds.has(habitat)) {
        addWarning(
          groups,
          "pokemonWarnings",
          `${formLabel} has invalid habitat: ${habitat}`,
        );
      }
    });
    (form?.moves || []).forEach((move) => {
      const moveName = getMoveName(move);
      if (!moveName || !moveNames.has(moveName)) {
        addWarning(
          groups,
          "moveWarnings",
          `${formLabel} references missing move: ${moveName || "unknown"}`,
        );
      }
    });
  });
}

function validateTeam(label, team, pokemonNames, groups) {
  (team || []).forEach((member) => {
    if (!pokemonNames.has(member.name)) {
      addWarning(
        groups,
        "teamWarnings",
        `${label} references missing Pokemon: ${member.name}`,
      );
    }
    if (!isPositiveNumber(member.level)) {
      addWarning(
        groups,
        "teamWarnings",
        `${label} has invalid level for ${member.name || "unknown"}`,
      );
    }
  });
}

function validateEvolutionRelationships(pokemonList, groups) {
  const byName = new Map(
    pokemonList
      .filter((pokemon) => pokemon?.name)
      .map((pokemon) => [pokemon.name, pokemon]),
  );
  const sourcesByTarget = new Map();

  pokemonList.forEach((pokemon) => {
    const label = pokemon?.name || pokemon?.id || "Unknown Pokemon";
    if (pokemon?.evolveLevel !== undefined && !pokemon.evolvesTo) {
      addWarning(
        groups,
        "pokemonWarnings",
        `${label} has evolveLevel without evolvesTo`,
      );
    }
    if (pokemon?.evolveType && !pokemon.evolvesTo) {
      addWarning(
        groups,
        "pokemonWarnings",
        `${label} has evolveType without evolvesTo`,
      );
    }
    if (!pokemon?.evolvesTo) return;
    if (typeof pokemon.evolvesTo !== "string") {
      addWarning(groups, "pokemonWarnings", `${label} has malformed evolvesTo`);
      return;
    }
    if (pokemon.evolvesTo === pokemon.name) {
      addWarning(groups, "pokemonWarnings", `${label} evolves into itself`);
    }
    const target = byName.get(pokemon.evolvesTo);
    if (
      target &&
      (!isPositiveNumber(target.id) || !isPositiveNumber(target.imageId))
    ) {
      addWarning(
        groups,
        "pokemonWarnings",
        `${label} evolution target ${target.name} has invalid id/imageId`,
      );
    }
    const sources = sourcesByTarget.get(pokemon.evolvesTo) || [];
    sources.push(pokemon.name);
    sourcesByTarget.set(pokemon.evolvesTo, sources);
  });

  pokemonList.forEach((pokemon) => {
    (pokemon.forms || []).forEach((form) => {
      if (form.species && !byName.has(form.species)) {
        addWarning(
          groups,
          "pokemonWarnings",
          `${pokemon.name} form ${form.id} references missing species: ${form.species}`,
        );
      }
      if (!form.evolvesToForm) return;
      const targetSpecies = byName.get(pokemon.evolvesTo);
      const targetForm = targetSpecies?.forms?.find(
        (candidate) => candidate.id === form.evolvesToForm,
      );
      if (!targetForm) {
        addWarning(
          groups,
          "pokemonWarnings",
          `${pokemon.name} form ${form.id} evolves to missing form: ${form.evolvesToForm}`,
        );
      }
    });
  });

  sourcesByTarget.forEach((sources, target) => {
    if (sources.length > 1) {
      addWarning(
        groups,
        "pokemonWarnings",
        `Multiple evolution sources target ${target}: ${sources.join(", ")}`,
      );
    }
  });

  const reportedCycles = new Set();
  pokemonList.forEach((pokemon) => {
    const path = [];
    const pathIndexes = new Map();
    let current = pokemon;
    while (current?.name && current.evolvesTo) {
      if (pathIndexes.has(current.name)) {
        const cycle = [...path.slice(pathIndexes.get(current.name)), current.name];
        const key = [...new Set(cycle)].sort().join("|");
        if (!reportedCycles.has(key)) {
          reportedCycles.add(key);
          addWarning(
            groups,
            "pokemonWarnings",
            `Cyclic evolution chain: ${cycle.join(" -> ")}`,
          );
        }
        break;
      }
      pathIndexes.set(current.name, path.length);
      path.push(current.name);
      current = byName.get(current.evolvesTo);
    }
  });
}

function validateGameData(gameData) {
  const groups = createWarningGroups();
  const pokemonList = gameData.pokemon || [];
  const pokemonIds = pokemonList.map((pokemon) => pokemon.id);
  const pokemonNameList = pokemonList.map((pokemon) => pokemon.name);
  const pokemonNames = new Set(pokemonNameList.filter(Boolean));
  const moveNames = new Set(Object.keys(gameData.moves || {}));
  const knownTypes = getKnownTypes();
  const validAreaIds = new Set([
    ...(gameData.areas || []).map((area) => area.id),
    ...Object.keys(gameData.areaUnlocks || {}),
    ...Object.keys(gameData.npcMaps || {}),
  ]);

  addDuplicateWarnings(pokemonIds, "Pokemon id", groups, "pokemonWarnings");
  addDuplicateWarnings(pokemonNameList, "Pokemon name", groups, "pokemonWarnings");

  const canonicalLookup = createCanonicalPokemonLookup(gameData.canonicalPokemon);
  const canonicalEntries = canonicalLookup.entries;
  const speciesMappings = gameData.speciesMap?.species || [];
  const nationalDexCoverage = new Set(
    speciesMappings
      .map((mapping) => mapping.canonicalSpeciesId)
      .filter((speciesId) => speciesId >= 1 && speciesId <= 400),
  );
  if (
    pokemonList.length !== speciesMappings.length ||
    canonicalEntries.length !== speciesMappings.length
  ) {
    addWarning(
      groups,
      "pokemonWarnings",
      `Catalog counts differ: ${pokemonList.length} game, ${canonicalEntries.length} canonical, ${speciesMappings.length} mappings`,
    );
  }
  if (nationalDexCoverage.size !== 400) {
    addWarning(
      groups,
      "pokemonWarnings",
      `National Dex coverage is ${nationalDexCoverage.size}/400`,
    );
  }
  if (
    speciesMappings.filter(
      (mapping) =>
        mapping.existingBeforeExpansion && mapping.canonicalSpeciesId > 400,
    ).length !== 26
  ) {
    addWarning(
      groups,
      "pokemonWarnings",
      "Existing species above National Dex #400 were not fully preserved",
    );
  }
  const evolutionSpecies = gameData.evolutions?.species || [];
  evolutionSpecies.forEach((species) => {
    if (!species.presentInGame || !Number.isInteger(species.localId)) {
      addWarning(
        groups,
        "pokemonWarnings",
        `Evolution-family species is missing from the runtime catalog: ${species.name || species.speciesId}`,
      );
    }
  });
  const canonicalSpeciesOwners = new Map();
  pokemonList.forEach((pokemon) => {
    const canonical = canonicalLookup.getCanonicalPokemon(pokemon);
    const label = pokemon?.name || pokemon?.id || "Unknown Pokemon";
    if (!canonical) {
      addWarning(
        groups,
        "pokemonWarnings",
        `${label} does not resolve to canonical Pokemon data`,
      );
      return;
    }
    if (!Number.isInteger(canonical.speciesId) || canonical.speciesId <= 0) {
      addWarning(groups, "pokemonWarnings", `${label} has invalid canonical speciesId`);
    }
    if (!Array.isArray(canonical.types) || canonical.types.length === 0) {
      addWarning(groups, "pokemonWarnings", `${label} has no canonical types`);
    }
    [
      "hp",
      "attack",
      "defense",
      "specialAttack",
      "specialDefense",
      "speed",
    ].forEach((stat) => {
      if (!isPositiveNumber(canonical.baseStats?.[stat])) {
        addWarning(
          groups,
          "pokemonWarnings",
          `${label} has invalid canonical base stat: ${stat}`,
        );
      }
    });
    if (Number(canonical.localId) !== Number(pokemon.id)) {
      addWarning(
        groups,
        "pokemonWarnings",
        `${label} canonical localId ${canonical.localId} does not match game id ${pokemon.id}`,
      );
    }
    if (!canonical.artwork?.normal && !pokemon.imageId) {
      addWarning(groups, "pokemonWarnings", `${label} has no safe artwork fallback`);
    }

    const existingOwner = canonicalSpeciesOwners.get(canonical.speciesId);
    const currentOwner = normalizeCanonicalName(pokemon.name);
    if (existingOwner && existingOwner !== currentOwner) {
      addWarning(
        groups,
        "pokemonWarnings",
        `${label} and another game Pokemon resolve to speciesId ${canonical.speciesId}`,
      );
    } else {
      canonicalSpeciesOwners.set(canonical.speciesId, currentOwner);
    }
  });

  pokemonList.forEach((pokemon) =>
    validatePokemonEntry(pokemon, {
      groups,
      pokemonNames,
      moveNames,
      validAreaIds,
      knownTypes,
    }),
  );
  validateEvolutionRelationships(pokemonList, groups);

  Object.entries(gameData.moves || {}).forEach(([name, move]) =>
    validateMoveDefinition(`Move ${name}`, move, groups, knownTypes),
  );

  (gameData.gyms || []).forEach((gym) =>
    validateTeam(`Gym ${gym.name}`, gym.team, pokemonNames, groups),
  );
  (gameData.eliteFour || []).forEach((trainer) =>
    validateTeam(`Elite Four ${trainer.name}`, trainer.team, pokemonNames, groups),
  );
  validateTeam(
    `Champion ${gameData.champion?.name || ""}`,
    gameData.champion?.team,
    pokemonNames,
    groups,
  );
  (gameData.npcs || [])
    .filter((npc) => npc.type === "trainer" || npc.team?.length)
    .forEach((npc) => validateTeam(`NPC ${npc.name}`, npc.team, pokemonNames, groups));

  requiredRarityWeights.forEach((rarity) => {
    if (gameData.rarityWeights?.[rarity] === undefined) {
      addWarning(
        groups,
        "encounterWarnings",
        `rarityWeights missing ${rarity}`,
      );
    }
  });
  if (
    typeof gameData.formEncounterChance !== "number" ||
    gameData.formEncounterChance < 0 ||
    gameData.formEncounterChance > 1
  ) {
    addWarning(
      groups,
      "encounterWarnings",
      `formEncounterChance must be a number from 0 to 1; received ${gameData.formEncounterChance}`,
    );
  }
  pokemonList.forEach((pokemon) => {
    (pokemon.habitats || []).forEach((habitat) => {
      if (!validAreaIds.has(habitat)) {
        addWarning(
          groups,
          "encounterWarnings",
          `${pokemon.name || pokemon.id} uses habitat not present in areas: ${habitat}`,
        );
      }
    });
    if (
      ["legendary", "mythical"].includes(pokemon.rarity) &&
      pokemon.baseCatchRate > 10
    ) {
      addWarning(
        groups,
        "encounterWarnings",
        `${pokemon.name} is ${pokemon.rarity} but baseCatchRate is ${pokemon.baseCatchRate}`,
      );
    }
  });

  return groups;
}

function getWarningCount(groups) {
  return Object.values(groups).reduce((total, warnings) => total + warnings.length, 0);
}

function logValidationGroups(groups, prefix = "game-data") {
  const total = getWarningCount(groups);
  if (!total) {
    console.log(`[${prefix}] Validation passed.`);
    return;
  }

  console.warn(`[${prefix}] ${total} validation warning(s):`);
  [
    ["Pokemon warnings", groups.pokemonWarnings],
    ["Move warnings", groups.moveWarnings],
    ["Team warnings", groups.teamWarnings],
    ["Encounter warnings", groups.encounterWarnings],
  ].forEach(([label, warnings]) => {
    console.warn(`\n${label}:`);
    if (!warnings.length) {
      console.warn("- none");
      return;
    }
    warnings.forEach((warning) => console.warn(`- ${warning}`));
  });
}

function loadGameData(options = {}) {
  const shouldValidate = options.validate !== false;
  const eliteData = loadJson(path.join(dataDir, "elite_four.json"), {});
  const npcData = loadJson(path.join(dataDir, "npcs.json"), {});
  const encounterData = loadJson(path.join(dataDir, "encounters.json"), {});
  const areaData = loadJson(path.join(dataDir, "areas.json"), {});
  const gameData = {
    pokemon: loadJson(path.join(rootDir, "pokemon.json"), []),
    canonicalPokemon: loadJson(
      path.join(dataDir, "pokeapi", "canonical-pokemon.json"),
      { pokemon: [] },
    ),
    speciesMap: loadJson(
      path.join(dataDir, "pokeapi", "species-map.json"),
      { species: [] },
    ),
    evolutions: loadJson(
      path.join(dataDir, "pokeapi", "evolutions.json"),
      { chains: [], species: [] },
    ),
    moves: loadJson(path.join(dataDir, "moves.json"), {}),
    items: loadJson(path.join(dataDir, "items.json"), {}),
    gyms: loadJson(path.join(dataDir, "gyms.json"), []),
    eliteFour: eliteData.eliteFour || [],
    champion: eliteData.champion || {},
    npcs: npcData.npcs || [],
    npcMaps: npcData.npcMaps || {},
    areas: areaData.areas || [],
    areaUnlocks: areaData.areaUnlocks || {},
    rarityWeights: encounterData.rarityWeights || {},
    legendaryRollChance: encounterData.legendaryRollChance ?? 0.02,
    formEncounterChance: encounterData.formEncounterChance ?? 0.02,
    weatherBoosts: encounterData.weatherBoosts || {},
    quests: loadJson(path.join(dataDir, "quests.json"), []),
  };
  if (shouldValidate) {
    logValidationGroups(validateGameData(gameData));
  }
  return gameData;
}

module.exports = {
  loadJson,
  saveJson,
  loadGameData,
  validateGameData,
  logValidationGroups,
  getWarningCount,
};
