const { randomUUID } = require("crypto");

const POKEDEX_IDENTITY_VERSION = "species-v1";
const PARTY_PRESET_COUNT = 3;

const defaultPlayerState = {
  trainerName: "Player",
  coins: 100,
  money: 100,
  level: 1,
  xp: 0,
  badges: [],
  championDefeated: false,
  unlockedAreas: ["forest"],
  unlockedGyms: [1],
  items: {
    standard: 10,
    great: 5,
    ultra: 2,
    master: 1,
    potion: 3,
    superPotion: 1,
    hyperPotion: 0,
    maxPotion: 0,
    antidote: 2,
    paralyzeHeal: 2,
    burnHeal: 1,
    iceHeal: 1,
    awakening: 1,
    fullHeal: 1,
    thunderStone: 0,
    fireStone: 0,
    waterStone: 0,
    leafStone: 0,
    moonStone: 0,
    sunStone: 0,
    shinyStone: 0,
    duskStone: 0,
    dawnStone: 0,
    iceStone: 0,
    linkingCord: 0,
    metalCoat: 0,
    dragonScale: 0,
    upgrade: 0,
    dubiousDisc: 0,
    protector: 0,
    electirizer: 0,
    magmarizer: 0,
    kingsRock: 0,
    prismScale: 0,
    reaperCloth: 0,
    deepSeaTooth: 0,
    deepSeaScale: 0,
  },
  pokedex: {
    identityVersion: POKEDEX_IDENTITY_VERSION,
    seen: [],
    caught: [],
    formsSeen: [],
    formsCaught: [],
  },
  questStats: {
    pokemonCaught: 0,
    wildBattlesWon: 0,
    npcBattlesWon: 0,
    gymBattlesWon: 0,
    eliteWins: 0,
    questsCompleted: 0,
  },
  quests: {
    claimed: [],
  },
  partyPresets: Array.from({ length: PARTY_PRESET_COUNT }, (_, index) => ({
    slot: index + 1,
    pokemonIds: [],
  })),
  defeatedNpcs: [],
  achievements: [],
};

const legacyPokemonIdMap = new Map([[246, 94]]);

function uniqueNumbers(values) {
  return [...new Set(values.map(Number).filter(Boolean))];
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean).map(String))];
}

function normalizePartyPresets(presets = []) {
  const presetsBySlot = new Map(
    (Array.isArray(presets) ? presets : [])
      .filter((preset) => Number.isInteger(Number(preset?.slot)))
      .map((preset) => [Number(preset.slot), preset]),
  );
  return Array.from({ length: PARTY_PRESET_COUNT }, (_, index) => {
    const slot = index + 1;
    return {
      slot,
      pokemonIds: uniqueStrings(presetsBySlot.get(slot)?.pokemonIds || []),
    };
  });
}

function createRandomPartySelection(
  team = [],
  storage = [],
  teamLimit = 6,
  random = Math.random,
) {
  const shuffled = [...team, ...storage];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const sample = Number(random());
    const boundedSample = Number.isFinite(sample)
      ? Math.min(Math.max(sample, 0), 0.999999999)
      : 0;
    const randomIndex = Math.floor(boundedSample * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }

  const partySize = Math.min(Math.max(0, teamLimit), shuffled.length);
  return {
    team: shuffled.slice(0, partySize),
    storage: shuffled.slice(partySize),
  };
}

function createGameState({
  inventoryPath,
  storagePath,
  playerStatePath,
  teamLimit,
  gyms,
  areaUnlocks,
  gymUnlocks,
  legacyBadgeMap,
  championBadge,
  readJsonFile,
  writeJsonFile,
  normalizePokemon,
  starterPokemon,
  getStarterPokemon,
  isPokemonOrEvolutionOf,
  getEvolutionFamilyKey,
  getPokemonVariantKey,
  resolvePokemonSpeciesId,
}) {
  function resolvePokedexSpeciesId(identity, pokemon = null) {
    const explicitSpeciesId = Number(pokemon?.speciesId);
    if (Number.isInteger(explicitSpeciesId) && explicitSpeciesId > 0) {
      return explicitSpeciesId;
    }
    const numericIdentity = Number(identity);
    const currentLocalIdentity = Number.isInteger(numericIdentity)
      ? legacyPokemonIdMap.get(numericIdentity) || numericIdentity
      : identity;
    const resolved = Number(
      resolvePokemonSpeciesId?.(pokemon || currentLocalIdentity),
    );
    if (Number.isInteger(resolved) && resolved > 0) return resolved;
    return Number.isInteger(numericIdentity) && numericIdentity > 0
      ? numericIdentity
      : null;
  }

  function migratePokedexIds(values) {
    return uniqueNumbers(
      (values || []).map((identity) =>
        resolvePokedexSpeciesId(identity),
      ),
    );
  }

  function migratePokedexVariantKeys(values) {
    return uniqueStrings(
      (values || []).map((key) => {
        const [identity, ...variantParts] = String(key).split(":");
        const speciesId = resolvePokedexSpeciesId(identity);
        return speciesId && variantParts.length
          ? `${speciesId}:${variantParts.join(":")}`
          : key;
      }),
    );
  }

  function getOwnedPokemonSignature(pokemon) {
    const moveSignature = (pokemon.moves || [])
      .map(
        (move) =>
          `${move.name || move}:${move.currentPp ?? move.maxPp ?? move.pp ?? ""}`,
      )
      .join("|");
    return [
      getEvolutionFamilyKey ? getEvolutionFamilyKey(pokemon) : pokemon.name,
      pokemon.id,
      pokemon.name,
      pokemon.level || 1,
      pokemon.xp || 0,
      pokemon.maxHp || pokemon.hp || 1,
      pokemon.currentHp ?? pokemon.maxHp ?? pokemon.hp ?? 1,
      pokemon.evolvedFrom || "",
      pokemon.form?.id || "normal",
      pokemon.shiny ? "shiny" : "normal",
      typeof pokemon.ability === "string"
        ? pokemon.ability
        : pokemon.ability?.name || "",
      moveSignature,
    ].join("::");
  }

  function removeExactOwnedPokemonClones(team, storage) {
    const seen = new Set();
    const keepUnique = (pokemon) => {
      const signature = getOwnedPokemonSignature(pokemon);
      if (seen.has(signature)) return false;
      seen.add(signature);
      return true;
    };
    return {
      team: team.filter(keepUnique),
      storage: storage.filter(keepUnique),
    };
  }

  function ensureOwnedPokemonIds(team, storage) {
    const usedIds = new Set();
    [...team, ...storage].forEach((pokemon) => {
      let ownedId = String(pokemon.ownedId || "").trim();
      if (!ownedId || usedIds.has(ownedId)) ownedId = randomUUID();
      pokemon.ownedId = ownedId;
      usedIds.add(ownedId);
    });
  }

  function saveTeamAndStorage(team, storage) {
    ensureOwnedPokemonIds(team, storage);
    writeJsonFile(inventoryPath, team.map(normalizePokemon));
    writeJsonFile(storagePath, storage.map(normalizePokemon));
  }

  function loadTeamAndStorage() {
    let team = readJsonFile(inventoryPath, []).map(normalizePokemon);
    let storage = readJsonFile(storagePath, []).map(normalizePokemon);
    ({ team, storage } = removeExactOwnedPokemonClones(team, storage));
    const starter = getStarterPokemon ? getStarterPokemon() : starterPokemon;
    const hasStarterLineage = starter
      ? [...team, ...storage].some((pokemon) =>
          isPokemonOrEvolutionOf
            ? isPokemonOrEvolutionOf(pokemon, starter)
            : pokemon.id === starter.id,
        )
      : false;

    if (!hasStarterLineage && starter) {
      team.unshift(normalizePokemon(starter));
    }

    if (team.length > teamLimit) {
      storage = [...storage, ...team.slice(teamLimit)];
      team = team.slice(0, teamLimit);
    }

    ensureOwnedPokemonIds(team, storage);
    saveTeamAndStorage(team, storage);
    return { team, storage };
  }

  function getAllOwnedPokemon() {
    const { team, storage } = loadTeamAndStorage();
    return [...team, ...storage];
  }

  function normalizePlayerState(state = {}) {
    const coins = state.coins ?? state.money ?? defaultPlayerState.coins;
    const badges = uniqueStrings(
      (state.badges || []).map((badge) => legacyBadgeMap[badge] || badge),
    );
    const championDefeated =
      Boolean(state.championDefeated) || badges.includes(championBadge);
    const validAreas = new Set(Object.keys(areaUnlocks));
    const unlockedAreas = uniqueStrings([
      ...(state.unlockedAreas || defaultPlayerState.unlockedAreas),
      ...Object.entries(areaUnlocks)
        .filter(([, badge]) => !badge || badges.includes(badge))
        .map(([area]) => area),
    ]).filter((area) => validAreas.has(area));
    const unlockedGyms = gyms
      .map((gym) => gym.id)
      .filter(
        (gymId) => !gymUnlocks[gymId] || badges.includes(gymUnlocks[gymId]),
      );
    const pokedexUsesSpeciesIdentity =
      state.pokedex?.identityVersion === POKEDEX_IDENTITY_VERSION;
    return {
      ...defaultPlayerState,
      ...state,
      coins,
      money: coins,
      level: state.level || defaultPlayerState.level,
      xp: state.xp || 0,
      items: {
        ...defaultPlayerState.items,
        ...(state.items || {}),
      },
      pokedex: {
        identityVersion: POKEDEX_IDENTITY_VERSION,
        seen: pokedexUsesSpeciesIdentity
          ? uniqueNumbers(state.pokedex?.seen || [])
          : migratePokedexIds(state.pokedex?.seen || []),
        caught: pokedexUsesSpeciesIdentity
          ? uniqueNumbers(state.pokedex?.caught || [])
          : migratePokedexIds(state.pokedex?.caught || []),
        formsSeen: pokedexUsesSpeciesIdentity
          ? uniqueStrings(state.pokedex?.formsSeen || [])
          : migratePokedexVariantKeys(state.pokedex?.formsSeen || []),
        formsCaught: pokedexUsesSpeciesIdentity
          ? uniqueStrings(state.pokedex?.formsCaught || [])
          : migratePokedexVariantKeys(state.pokedex?.formsCaught || []),
      },
      questStats: {
        ...defaultPlayerState.questStats,
        ...(state.questStats || {}),
      },
      quests: {
        ...defaultPlayerState.quests,
        ...(state.quests || {}),
        claimed: uniqueStrings(state.quests?.claimed || []),
      },
      partyPresets: normalizePartyPresets(state.partyPresets),
      defeatedNpcs: uniqueNumbers(state.defeatedNpcs || []),
      badges,
      championDefeated,
      unlockedAreas,
      unlockedGyms,
      achievements: state.achievements || [],
    };
  }

  function updateAchievements(state) {
    const achievements = new Set(state.achievements);
    const caughtCount = state.pokedex.caught.length;
    const seenCount = state.pokedex.seen.length;

    if (seenCount >= 1) achievements.add("First Encounter");
    if (caughtCount >= 1) achievements.add("First Catch");
    if (caughtCount >= 5) achievements.add("Rookie Collector");
    if (caughtCount >= 10) achievements.add("Pokedex Scout");
    if ((state.coins ?? state.money ?? 0) >= 5000) achievements.add("Big Saver");

    state.achievements = [...achievements];
    return state;
  }

  function loadPlayerState() {
    const state = normalizePlayerState(
      readJsonFile(playerStatePath, defaultPlayerState),
    );
    const ownedPokemon = getAllOwnedPokemon();
    const ownedSpeciesIds = ownedPokemon
      .map((pokemon) => resolvePokedexSpeciesId(pokemon.id, pokemon))
      .filter(Boolean);
    if (ownedSpeciesIds.length > 0) {
      state.pokedex.seen = uniqueNumbers([
        ...state.pokedex.seen,
        ...ownedSpeciesIds,
      ]);
      state.pokedex.caught = uniqueNumbers([
        ...state.pokedex.caught,
        ...ownedSpeciesIds,
      ]);
      if (getPokemonVariantKey) {
        const ownedVariants = ownedPokemon.map(getPokemonVariantKey);
        state.pokedex.formsSeen = uniqueStrings([
          ...state.pokedex.formsSeen,
          ...ownedVariants,
        ]);
        state.pokedex.formsCaught = uniqueStrings([
          ...state.pokedex.formsCaught,
          ...ownedVariants,
        ]);
      }
      updateAchievements(state);
    }
    writeJsonFile(playerStatePath, state);
    return state;
  }

  function savePlayerState(state) {
    const normalized = normalizePlayerState(state);
    writeJsonFile(playerStatePath, normalized);
    return normalized;
  }

  function markPokedexSeen(id, pokemon = null) {
    const state = loadPlayerState();
    const speciesId = resolvePokedexSpeciesId(id, pokemon);
    state.pokedex.seen = uniqueNumbers([...state.pokedex.seen, speciesId]);
    if (pokemon && getPokemonVariantKey) {
      state.pokedex.formsSeen = uniqueStrings([
        ...state.pokedex.formsSeen,
        getPokemonVariantKey(pokemon),
      ]);
    }
    updateAchievements(state);
    return savePlayerState(state);
  }

  function markPokedexCaught(id, pokemon = null) {
    const state = loadPlayerState();
    const speciesId = resolvePokedexSpeciesId(id, pokemon);
    state.pokedex.seen = uniqueNumbers([...state.pokedex.seen, speciesId]);
    state.pokedex.caught = uniqueNumbers([...state.pokedex.caught, speciesId]);
    if (pokemon && getPokemonVariantKey) {
      const variantKey = getPokemonVariantKey(pokemon);
      state.pokedex.formsSeen = uniqueStrings([
        ...state.pokedex.formsSeen,
        variantKey,
      ]);
      state.pokedex.formsCaught = uniqueStrings([
        ...state.pokedex.formsCaught,
        variantKey,
      ]);
    }
    updateAchievements(state);
    return savePlayerState(state);
  }

  function getPartyPresetSlots() {
    const state = loadPlayerState();
    const { team, storage } = loadTeamAndStorage();
    const ownedById = new Map(
      [...team, ...storage].map((pokemon) => [pokemon.ownedId, pokemon]),
    );
    return state.partyPresets.map((preset) => ({
      slot: preset.slot,
      pokemon: preset.pokemonIds
        .map((ownedId) => ownedById.get(ownedId))
        .filter(Boolean),
      missingCount: preset.pokemonIds.filter(
        (ownedId) => !ownedById.has(ownedId),
      ).length,
    }));
  }

  function savePartyPreset(slotNumber) {
    const slot = Number(slotNumber);
    if (!Number.isInteger(slot) || slot < 1 || slot > PARTY_PRESET_COUNT) {
      return { error: "Invalid party slot." };
    }
    const { team } = loadTeamAndStorage();
    const state = loadPlayerState();
    state.partyPresets[slot - 1] = {
      slot,
      pokemonIds: team.map((pokemon) => pokemon.ownedId),
    };
    savePlayerState(state);
    return { success: true, slots: getPartyPresetSlots() };
  }

  function updatePartyPreset(slotNumber, { action, ownedId, position } = {}) {
    const slot = Number(slotNumber);
    if (!Number.isInteger(slot) || slot < 1 || slot > PARTY_PRESET_COUNT) {
      return { error: "Invalid party slot." };
    }

    const state = loadPlayerState();
    const preset = state.partyPresets[slot - 1];
    if (action === "clear") {
      preset.pokemonIds = [];
    } else if (action === "remove") {
      const removeIndex = Number(position);
      if (
        !Number.isInteger(removeIndex) ||
        removeIndex < 0 ||
        removeIndex >= preset.pokemonIds.length
      ) {
        return { error: "Choose a valid Pokemon slot to remove." };
      }
      preset.pokemonIds.splice(removeIndex, 1);
    } else if (action === "add") {
      const normalizedOwnedId = String(ownedId || "").trim();
      const { team, storage } = loadTeamAndStorage();
      const ownedPokemon = [...team, ...storage].find(
        (pokemon) => pokemon.ownedId === normalizedOwnedId,
      );
      if (!ownedPokemon) return { error: "That Pokemon is no longer owned." };
      if (preset.pokemonIds.includes(normalizedOwnedId)) {
        return { error: `${ownedPokemon.name} is already in Party ${slot}.` };
      }
      if (preset.pokemonIds.length >= teamLimit) {
        return { error: `Party ${slot} already has ${teamLimit} Pokemon.` };
      }
      preset.pokemonIds.push(normalizedOwnedId);
    } else {
      return { error: "Invalid party slot action." };
    }

    savePlayerState(state);
    return { success: true, slots: getPartyPresetSlots() };
  }

  function randomizePartyPreset(slotNumber, random = Math.random) {
    const slot = Number(slotNumber);
    if (!Number.isInteger(slot) || slot < 1 || slot > PARTY_PRESET_COUNT) {
      return { error: "Invalid party slot." };
    }
    const { team, storage } = loadTeamAndStorage();
    const randomized = createRandomPartySelection(
      team,
      storage,
      teamLimit,
      random,
    );
    if (!randomized.team.length) {
      return { error: "No owned Pokemon are available." };
    }

    const state = loadPlayerState();
    state.partyPresets[slot - 1] = {
      slot,
      pokemonIds: randomized.team.map((pokemon) => pokemon.ownedId),
    };
    savePlayerState(state);
    return { success: true, slots: getPartyPresetSlots() };
  }

  function loadPartyPreset(slotNumber) {
    const slot = Number(slotNumber);
    if (!Number.isInteger(slot) || slot < 1 || slot > PARTY_PRESET_COUNT) {
      return { error: "Invalid party slot." };
    }
    const state = loadPlayerState();
    const preset = state.partyPresets[slot - 1];
    if (!preset?.pokemonIds.length) return { error: "This party slot is empty." };

    const { team, storage } = loadTeamAndStorage();
    const allOwned = [...team, ...storage];
    const ownedById = new Map(
      allOwned.map((pokemon) => [pokemon.ownedId, pokemon]),
    );
    const selectedTeam = preset.pokemonIds
      .map((ownedId) => ownedById.get(ownedId))
      .filter(Boolean)
      .slice(0, teamLimit);
    if (!selectedTeam.length) {
      return { error: "None of this slot's Pokemon are still owned." };
    }

    const selectedIds = new Set(selectedTeam.map((pokemon) => pokemon.ownedId));
    const nextStorage = allOwned.filter(
      (pokemon) => !selectedIds.has(pokemon.ownedId),
    );
    saveTeamAndStorage(selectedTeam, nextStorage);
    return {
      success: true,
      team: selectedTeam,
      storage: nextStorage,
      missingCount: preset.pokemonIds.length - selectedTeam.length,
    };
  }

  return {
    defaultPlayerState,
    readJsonFile,
    writeJsonFile,
    loadTeamAndStorage,
    saveTeamAndStorage,
    getAllOwnedPokemon,
    uniqueNumbers,
    uniqueStrings,
    normalizePlayerState,
    loadPlayerState,
    savePlayerState,
    markPokedexSeen,
    markPokedexCaught,
    getPartyPresetSlots,
    savePartyPreset,
    updatePartyPreset,
    randomizePartyPreset,
    loadPartyPreset,
    resolvePokedexSpeciesId,
    updateAchievements,
  };
}

module.exports = {
  PARTY_PRESET_COUNT,
  POKEDEX_IDENTITY_VERSION,
  createRandomPartySelection,
  createGameState,
  defaultPlayerState,
  uniqueNumbers,
  uniqueStrings,
};
