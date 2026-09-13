const POST_GAME_STATE_VERSION = "post-game-v1";

function uniqueStrings(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean).map(String))];
}

function hasFlag(state, flag) {
  return (state.story?.flags || []).includes(flag);
}

function meetsPostGameRequirements(state = {}) {
  return Boolean(
    state.championDefeated &&
      state.league?.completed &&
      Number(state.league?.completionCount) >= 1 &&
      hasFlag(state, "main_story_completed") &&
      hasFlag(state, "champion_defeated"),
  );
}

function normalizePostGameState(state = {}, config = {}) {
  state.story ||= {};
  state.story.flags = uniqueStrings(state.story.flags);
  const unlocked = meetsPostGameRequirements(state);
  if (unlocked) state.story.flags = uniqueStrings([...state.story.flags, "post_game_unlocked"]);
  const existing = state.postGame && typeof state.postGame === "object" ? state.postGame : {};
  const research = existing.research && typeof existing.research === "object"
    ? existing.research
    : {};
  const eligibleAreas = new Set(config.research?.eligibleAreas || []);
  state.postGame = {
    version: POST_GAME_STATE_VERSION,
    unlocked,
    specialEvent: {
      completed: Boolean(existing.specialEvent?.completed),
      completedAt: existing.specialEvent?.completedAt || null,
      result: existing.specialEvent?.result || null,
    },
    research: {
      visitedAreas: uniqueStrings(research.visitedAreas).filter((area) => eligibleAreas.has(area)),
      rewardClaimed: Boolean(research.rewardClaimed),
      completedAt: research.completedAt || null,
    },
  };
  return state;
}

function createPostGameEngine({ config = {}, pokemon = [], itemCatalog = {} } = {}) {
  const templatesByName = new Map(pokemon.map((entry) => [entry.name, entry]));
  const templatesBySpeciesId = new Map(
    pokemon.map((entry) => [Number(entry.speciesId || entry.id), entry]),
  );
  const special = config.specialEvent || {};
  const researchConfig = config.research || {};

  function normalize(state) {
    return normalizePostGameState(state, config);
  }

  function getRareCaughtCount(state) {
    const eligible = new Set(researchConfig.eligibleRarities || []);
    return new Set(
      (state.pokedex?.caught || [])
        .map((id) => templatesBySpeciesId.get(Number(id)))
        .filter((entry) => entry && eligible.has(entry.rarity))
        .map((entry) => Number(entry.speciesId || entry.id)),
    ).size;
  }

  function getResearchProgress(state) {
    normalize(state);
    const areasVisited = state.postGame.research.visitedAreas.length;
    const rareCaught = getRareCaughtCount(state);
    const requiredAreas = Math.max(1, Number(researchConfig.requiredAreas) || 3);
    const requiredRareSpecies = Math.max(1, Number(researchConfig.requiredRareSpecies) || 10);
    return {
      title: researchConfig.title || "Post-game research",
      areasVisited,
      requiredAreas,
      rareCaught,
      requiredRareSpecies,
      complete: areasVisited >= requiredAreas && rareCaught >= requiredRareSpecies,
      rewardClaimed: state.postGame.research.rewardClaimed,
    };
  }

  function recordAreaVisit(state, area) {
    normalize(state);
    if (!state.postGame.unlocked) return { state, changed: false };
    if (!(researchConfig.eligibleAreas || []).includes(area)) return { state, changed: false };
    const before = state.postGame.research.visitedAreas.length;
    state.postGame.research.visitedAreas = uniqueStrings([
      ...state.postGame.research.visitedAreas,
      area,
    ]);
    return { state, changed: state.postGame.research.visitedAreas.length !== before };
  }

  function applyItems(state, entries = []) {
    state.items ||= {};
    return entries.flatMap((entry) => {
      const item = itemCatalog[entry.id];
      if (!item) return [];
      const quantity = Math.max(1, Number(entry.quantity) || 1);
      state.items[entry.id] = (Number(state.items[entry.id]) || 0) + quantity;
      return [{ id: entry.id, name: item.name, quantity }];
    });
  }

  function claimResearchReward(state) {
    normalize(state);
    if (!state.postGame.unlocked) return { error: "Become Champion to unlock post-game research." };
    const progress = getResearchProgress(state);
    if (progress.rewardClaimed) return { error: "Professor Lumen's research reward was already claimed." };
    if (!progress.complete) return { error: "The Champion Survey is not complete yet.", progress };
    const coins = Math.max(0, Number(researchConfig.reward?.coins) || 0);
    state.coins = (Number(state.coins ?? state.money) || 0) + coins;
    state.money = state.coins;
    const items = applyItems(state, researchConfig.reward?.items);
    state.postGame.research.rewardClaimed = true;
    state.postGame.research.completedAt = new Date().toISOString();
    return { state, reward: { coins, items }, progress: getResearchProgress(state) };
  }

  function createSpecialEncounter(state, createLeveledPokemon) {
    normalize(state);
    if (!state.postGame.unlocked) return { error: "Become Champion before investigating this signal." };
    if (state.postGame.specialEvent.completed) return { error: "The moonlit signal has already been resolved." };
    if (!hasFlag(state, "post_game_special_discovered")) return { error: "Investigate the moonlit signal first." };
    const template = templatesByName.get(special.species);
    if (!template) return { error: `${special.species || "Special Pokemon"} is missing from Pokemon data.` };
    const pokemonInstance = createLeveledPokemon(template.name, special.level || 70);
    return {
      pokemon: {
        ...pokemonInstance,
        area: special.area,
        weather: special.weather || "clear",
        timeOfDay: special.timeOfDay || "night",
        rarity: template.rarity,
        legendaryRoll: true,
        poolSize: 1,
        encounterMetadata: {
          area: special.area,
          weather: special.weather || "clear",
          timeOfDay: special.timeOfDay || "night",
          rarity: template.rarity,
          legendaryRoll: true,
          poolSize: 1,
          postGame: true,
        },
        postGameEncounter: { id: special.id },
      },
    };
  }

  function completeSpecialEncounter(state, pokemonInstance, result) {
    normalize(state);
    if (
      !state.postGame.unlocked ||
      !hasFlag(state, "post_game_special_discovered") ||
      pokemonInstance?.postGameEncounter?.id !== special.id ||
      String(pokemonInstance?.name || "").toLowerCase() !==
        String(special.species || "").toLowerCase()
    ) {
      return { state, completed: false };
    }
    if (state.postGame.specialEvent.completed) {
      return { state, completed: false, alreadyCompleted: true };
    }
    state.postGame.specialEvent = {
      completed: true,
      completedAt: new Date().toISOString(),
      result,
    };
    state.story.flags = uniqueStrings([...state.story.flags, "post_game_special_completed"]);
    return { state, completed: true };
  }

  function getSnapshot(state, recurringCharacterEngine = null) {
    normalize(state);
    const rhea = state.story?.characters?.[config.rheaRematch?.characterId || "rhea-vale"] || {};
    const rematchId = config.rheaRematch?.id;
    const rematchNpc = recurringCharacterEngine?.getNpcById(state, config.rheaRematch?.npcId);
    return {
      unlocked: state.postGame.unlocked,
      champion: {
        defeated: Boolean(state.championDefeated),
        completionCount: Number(state.league?.completionCount) || 0,
      },
      rheaRematch: {
        npcId: config.rheaRematch?.npcId || null,
        available: Boolean(rematchNpc),
        completed: (rhea.completedBattleIds || []).includes(rematchId),
        rewardClaimed: (rhea.rewardedEncounterIds || []).includes(rematchId),
      },
      leagueRematchAvailable: Boolean(state.postGame.unlocked),
      specialEvent: {
        id: special.id,
        name: special.name,
        area: special.area,
        completed: state.postGame.specialEvent.completed,
        result: state.postGame.specialEvent.result,
      },
      research: getResearchProgress(state),
    };
  }

  return {
    normalize,
    recordAreaVisit,
    claimResearchReward,
    createSpecialEncounter,
    completeSpecialEncounter,
    getResearchProgress,
    getSnapshot,
  };
}

function extendCharacterData(characterData = {}, config = {}) {
  const rematch = config.rheaRematch;
  if (!rematch) return characterData;
  return {
    ...characterData,
    characters: (characterData.characters || []).map((character) =>
      character.id === rematch.characterId
        ? { ...character, encounters: [...(character.encounters || []), rematch] }
        : character,
    ),
  };
}

module.exports = {
  POST_GAME_STATE_VERSION,
  meetsPostGameRequirements,
  normalizePostGameState,
  createPostGameEngine,
  extendCharacterData,
};
