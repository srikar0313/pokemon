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
  },
  pokedex: {
    seen: [],
    caught: [],
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
  defeatedNpcs: [],
  achievements: [],
};

function uniqueNumbers(values) {
  return [...new Set(values.map(Number).filter(Boolean))];
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean).map(String))];
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
}) {
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

  function saveTeamAndStorage(team, storage) {
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
    const unlockedAreas = uniqueStrings([
      ...(state.unlockedAreas || defaultPlayerState.unlockedAreas),
      ...Object.entries(areaUnlocks)
        .filter(([, badge]) => !badge || badges.includes(badge))
        .map(([area]) => area),
    ]);
    const unlockedGyms = gyms
      .map((gym) => gym.id)
      .filter(
        (gymId) => !gymUnlocks[gymId] || badges.includes(gymUnlocks[gymId]),
      );
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
        seen: uniqueNumbers(state.pokedex?.seen || []),
        caught: uniqueNumbers(state.pokedex?.caught || []),
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
    const inventoryIds = getAllOwnedPokemon().map((pokemon) => pokemon.id);
    if (inventoryIds.length > 0) {
      state.pokedex.seen = uniqueNumbers([
        ...state.pokedex.seen,
        ...inventoryIds,
      ]);
      state.pokedex.caught = uniqueNumbers([
        ...state.pokedex.caught,
        ...inventoryIds,
      ]);
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

  function markPokedexSeen(id) {
    const state = loadPlayerState();
    state.pokedex.seen = uniqueNumbers([...state.pokedex.seen, id]);
    updateAchievements(state);
    return savePlayerState(state);
  }

  function markPokedexCaught(id) {
    const state = loadPlayerState();
    state.pokedex.seen = uniqueNumbers([...state.pokedex.seen, id]);
    state.pokedex.caught = uniqueNumbers([...state.pokedex.caught, id]);
    updateAchievements(state);
    return savePlayerState(state);
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
    updateAchievements,
  };
}

module.exports = {
  createGameState,
  defaultPlayerState,
  uniqueNumbers,
  uniqueStrings,
};
