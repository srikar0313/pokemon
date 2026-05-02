const express = require("express");
const path = require("path");
const { loadGameData, loadJson, saveJson } = require("./dataLoader");
const { createGameState } = require("./gameState");
const { createPokemonUtils } = require("./pokemonUtils");
const { createBattleEngine } = require("./battleEngine");
const { createEncounterEngine } = require("./encounterEngine");
const { createRewardEngine } = require("./rewardEngine");
const app = express();
const port = process.env.PORT || 3000;
const rootDir = path.join(__dirname, "..");
const inventoryPath = path.join(rootDir, "inventory.json");
const storagePath = path.join(rootDir, "storage.json");
const pokemonPath = path.join(rootDir, "pokemon.json");
const playerStatePath = path.join(rootDir, "player_state.json");
const teamLimit = 6;
const coinRewards = {
  wildBattleMin: 80,
  wildBattleMax: 150,
  catch: 50,
};

app.use(express.static("frontend"));
app.use("/assets", express.static(path.join(rootDir, "assets")));
app.use(express.json());

const gameData = loadGameData();
const itemCatalog = gameData.items;
const gyms = gameData.gyms;
const eliteFour = gameData.eliteFour;
const champion = gameData.champion;
const npcs = gameData.npcs;
const npcMaps = gameData.npcMaps;
const areas = gameData.areas;
const areaUnlocks = gameData.areaUnlocks;
const rarityWeights = gameData.rarityWeights;
const weatherBoosts = gameData.weatherBoosts;
const quests = gameData.quests || [];
const pokemonUtils = createPokemonUtils({
  pokemonPath,
  readJsonFile: loadJson,
  moveCatalog: gameData.moves,
});
const {
  getStarterPokemon,
  getPokemonTemplates,
  getPokemonTemplateByName,
  getPokemonTypes,
  normalizePokemon,
  restorePokemon,
  getEvolution,
  createLeveledPokemon,
} = pokemonUtils;

const ballRates = {
  standard: 1.0,
  great: 1.5,
  ultra: 2.0,
  master: 255,
};

const statusModifiers = {
  asleep: 2.0,
  frozen: 2.0,
  paralyzed: 1.5,
  burned: 1.5,
  poisoned: 1.5,
  badpoison: 1.5,
  none: 1.0,
};

const legacyBadgeMap = {
  "Spark Badge": "Volt Badge",
  "Thunder Badge": "Volt Badge",
  "Tide Badge": "Aqua Badge",
  "Cascade Badge": "Aqua Badge",
  "Ember Badge": "Blaze Badge",
  "Volcano Badge": "Blaze Badge",
};

const legacyGymMap = {
  electric: 1,
  water: 2,
  fire: 3,
};

const gymUnlocks = {
  1: null,
  2: "Volt Badge",
  3: "Aqua Badge",
  4: "Blaze Badge",
  5: "Forest Badge",
  6: "Storm Badge",
  7: "Rock Badge",
  8: "Psychic Badge",
};

const activeGymSessions = new Map();
const activeEliteSessions = new Map();
const activeNpcSessions = new Map();

const allGymBadges = gyms.map((gym) => gym.badge);

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const gameState = createGameState({
  inventoryPath,
  storagePath,
  playerStatePath,
  teamLimit,
  gyms,
  areaUnlocks,
  gymUnlocks,
  legacyBadgeMap,
  championBadge: champion.badge,
  readJsonFile: loadJson,
  writeJsonFile: saveJson,
  normalizePokemon,
  getStarterPokemon,
});
const {
  readJsonFile,
  writeJsonFile,
  loadTeamAndStorage,
  saveTeamAndStorage,
  getAllOwnedPokemon,
  uniqueNumbers,
  uniqueStrings,
  loadPlayerState,
  savePlayerState,
  markPokedexSeen,
  updateAchievements,
} = gameState;

const battleEngine = createBattleEngine({ getRandomInt });
const {
  aiDifficulty,
  executeBattleMove,
  applyEndOfTurnStatus,
  chooseBestMove,
  chooseGymAction,
  chooseTrainerAction,
} = battleEngine;

const encounterEngine = createEncounterEngine({
  rarityWeights,
  weatherBoosts,
  getPokemonTypes,
});
const { selectEncounter } = encounterEngine;

function applyBattleEndOfTurnStatus(playerPokemon, opponentPokemon, log) {
  if (playerPokemon?.currentHp > 0) {
    applyEndOfTurnStatus(playerPokemon, log);
  }
  if (opponentPokemon?.currentHp > 0) {
    applyEndOfTurnStatus(opponentPokemon, log);
  }
}

const rewardEngine = createRewardEngine({
  normalizePokemon,
  getEvolution,
  getPokemonTemplateByName,
  updateAchievements,
});
const {
  awardCoins,
  calculateBattleXp,
  applyXpToPokemon,
  applyXpToParticipants,
  appendXpLog,
} = rewardEngine;

function getPokedexEntries(state) {
  const templates = getPokemonTemplates();
  const byName = new Map(templates.map((pokemon) => [pokemon.name, pokemon]));

  function getEvolutionChain(pokemon) {
    const chain = [];
    const visited = new Set();
    let current = pokemon;
    while (current) {
      const key = current.name;
      if (visited.has(key)) break;
      visited.add(key);
      chain.push({
        id: current.id,
        imageId: current.imageId || current.id,
        name: current.name,
        evolveLevel: current.evolveLevel || null,
      });
      current = current.evolvesTo ? byName.get(current.evolvesTo) : null;
    }
    return chain;
  }

  return templates
    .map((pokemon) => {
      const previousStage =
        templates.find((candidate) => candidate.evolvesTo === pokemon.name) ||
        null;
      const seen = state.pokedex.seen.includes(pokemon.id);
      const caught = state.pokedex.caught.includes(pokemon.id);
      return {
        id: pokemon.id,
        imageId: pokemon.imageId || pokemon.id,
        name: pokemon.name,
        type: pokemon.type,
        types: getPokemonTypes(pokemon),
        rarity: pokemon.rarity || "common",
        habitats: pokemon.habitats || [],
        times: pokemon.times || ["day"],
        baseCatchRate: pokemon.baseCatchRate ?? null,
        evolvesTo: pokemon.evolvesTo || null,
        evolveLevel: pokemon.evolveLevel || null,
        previousStage: previousStage
          ? {
              id: previousStage.id,
              imageId: previousStage.imageId || previousStage.id,
              name: previousStage.name,
            }
          : null,
        evolutionChain: previousStage
          ? getEvolutionChain(previousStage)
          : getEvolutionChain(pokemon),
        seen,
        caught,
      };
    })
    .sort((a, b) => a.id - b.id);
}

function incrementQuestStat(state, stat, amount = 1) {
  state.questStats = {
    wildBattlesWon: 0,
    pokemonCaught: 0,
    npcBattlesWon: 0,
    gymBattlesWon: 0,
    eliteWins: 0,
    questsCompleted: 0,
    ...(state.questStats || {}),
  };
  state.questStats[stat] =
    (Number(state.questStats[stat]) || 0) + Math.max(1, Number(amount) || 1);
  return state;
}

function getQuestProgressValue(state, quest) {
  const questStats = state.questStats || {};
  switch (quest.type) {
    case "pokemonCaught":
    case "catch":
      return Math.max(
        Number(questStats.pokemonCaught) || 0,
        state.pokedex?.caught?.length || 0,
      );
    case "pokedexCaught":
      return state.pokedex?.caught?.length || 0;
    case "wildBattlesWon":
      return Number(questStats.wildBattlesWon) || 0;
    case "npcBattlesWon":
      return Math.max(
        Number(questStats.npcBattlesWon) || 0,
        state.defeatedNpcs?.length || 0,
      );
    case "gymBattlesWon":
      return Math.max(
        Number(questStats.gymBattlesWon) || 0,
        (state.badges || []).filter((badge) => allGymBadges.includes(badge))
          .length,
      );
    case "badges":
      return (state.badges || []).filter((badge) => allGymBadges.includes(badge))
        .length;
    case "eliteWins":
      return Math.max(
        Number(questStats.eliteWins) || 0,
        state.championDefeated ? 1 : 0,
      );
    case "championDefeated":
      return state.championDefeated ? 1 : 0;
    default:
      return Number(questStats[quest.type]) || 0;
  }
}

function getQuestView(quest, state) {
  const goal = Math.max(1, Number(quest.goal) || 1);
  const progress = Math.min(goal, getQuestProgressValue(state, quest));
  const claimed = Boolean((state.quests?.claimed || []).includes(quest.id));
  const completed = progress >= goal;
  return {
    ...quest,
    goal,
    progress,
    percent: Math.round((progress / goal) * 100),
    completed,
    claimed,
    claimable: completed && !claimed,
  };
}

function isQuestUnlocked(quest, state) {
  if (!quest.requiresQuest) return true;
  return Boolean((state.quests?.claimed || []).includes(quest.requiresQuest));
}

function getQuestList(state) {
  return quests
    .filter((quest) => isQuestUnlocked(quest, state))
    .map((quest) => getQuestView(quest, state));
}

function getQuestSummary(questList) {
  return {
    total: quests.length,
    available: questList.length,
    hidden: Math.max(0, quests.length - questList.length),
    completed: questList.filter((quest) => quest.completed).length,
    claimable: questList.filter((quest) => quest.claimable).length,
    claimed: questList.filter((quest) => quest.claimed).length,
  };
}

function applyQuestReward(state, reward = {}) {
  const granted = {
    coins: Math.max(0, Number(reward.coins) || 0),
    items: [],
  };

  if (granted.coins > 0) {
    awardCoins(state, granted.coins);
  }

  Object.entries(reward.items || {}).forEach(([itemId, quantity]) => {
    const count = Math.max(1, Number(quantity) || 1);
    state.items[itemId] = (state.items[itemId] || 0) + count;
    granted.items.push({
      id: itemId,
      name: itemCatalog[itemId]?.name || itemId,
      quantity: count,
    });
  });

  return granted;
}

function getGymById(gymId) {
  const normalizedId = legacyGymMap[gymId] || Number(gymId);
  return gyms.find((gym) => gym.id === normalizedId);
}

function getNpcById(npcId) {
  return npcs.find((npc) => npc.id === Number(npcId));
}

function isTrainerDefeated(state, npcId) {
  return (state.defeatedNpcs || []).includes(Number(npcId));
}

function getNpcRewardCoins(npc) {
  if (npc.rewardCoins) return npc.rewardCoins;
  return Math.max(
    150,
    (npc.team || []).reduce(
      (total, member) => total + (member.level || 1) * 25,
      0,
    ),
  );
}

function getNpcView(npc, state) {
  const defeated =
    npc.type === "trainer" ? isTrainerDefeated(state, npc.id) : false;
  return {
    id: npc.id,
    area: npc.area,
    name: npc.name,
    type: npc.type,
    sprite: npc.sprite || npc.type,
    position: npc.position,
    dialogue: npc.dialogue,
    introDialogue: npc.introDialogue || npc.dialogue,
    defeated,
    rewardCoins: npc.type === "trainer" ? getNpcRewardCoins(npc) : 0,
    itemReward: npc.itemReward || null,
    team: npc.type === "trainer" ? npc.team || [] : [],
  };
}

function hasAllGymBadges(state) {
  return allGymBadges.every((badge) => (state.badges || []).includes(badge));
}

function getFirstHealthyPokemonIndex(team) {
  return team.findIndex((pokemon) => pokemon.currentHp > 0);
}

function preparePlayerTeamForGymBattle(team) {
  return team.map((pokemon) => {
    const normalized = normalizePokemon(pokemon);
    return {
      ...normalized,
      moves: (normalized.moves || []).map((move) => ({
        ...move,
        currentPp: Math.min(
          move.currentPp ?? move.maxPp ?? move.pp ?? 10,
          move.maxPp ?? move.pp ?? move.currentPp ?? 10,
        ),
      })),
    };
  });
}

function ensureGymSessionReady(session) {
  if (!session || session.ppPrepared) return;
  session.playerTeam = preparePlayerTeamForGymBattle(session.playerTeam || []);
  session.ppPrepared = true;
}

function getNpcSessionView(session) {
  const playerPokemon = session.playerTeam[session.playerIndex] || null;
  const opponentPokemon = session.opponentTeam[session.opponentIndex] || null;
  return {
    npc: getNpcView(session.npc, loadPlayerState()),
    playerIndex: session.playerIndex,
    opponentIndex: session.opponentIndex,
    playerTeam: session.playerTeam,
    opponentTeam: session.opponentTeam,
    playerPokemon,
    opponentPokemon,
    canCatch: false,
    canRun: false,
    status: session.status,
  };
}

function getGymSessionView(session) {
  const playerPokemon = session.playerTeam[session.playerIndex] || null;
  const gymPokemon = session.gymTeam[session.gymIndex] || null;
  return {
    gym: {
      id: session.gym.id,
      name: session.gym.name,
      leaderName: session.gym.leaderName,
      city: session.gym.city,
      type: session.gym.type,
      difficulty: session.gym.difficulty,
      badge: session.gym.badge,
      rewardCoins: session.gym.rewardCoins,
    },
    playerIndex: session.playerIndex,
    gymIndex: session.gymIndex,
    playerTeam: session.playerTeam,
    gymTeam: session.gymTeam,
    playerPokemon,
    gymPokemon,
    canCatch: false,
    canRun: false,
    status: session.status,
  };
}

function getEliteSessionView(session) {
  const playerPokemon = session.playerTeam[session.playerIndex] || null;
  const opponentPokemon = session.opponentTeam[session.opponentIndex] || null;
  return {
    trainer: {
      id: session.currentTrainer.id,
      name: session.currentTrainer.name,
      type: session.currentTrainer.type,
    },
    isChampion: session.isChampion,
    stageIndex: session.stageIndex,
    totalStages: session.totalStages,
    progressLabel: session.isChampion
      ? "Champion"
      : `Elite Four ${session.stageIndex + 1}/${eliteFour.length}`,
    playerIndex: session.playerIndex,
    opponentIndex: session.opponentIndex,
    playerTeam: session.playerTeam,
    opponentTeam: session.opponentTeam,
    playerPokemon,
    opponentPokemon,
    canCatch: false,
    canRun: false,
    status: session.status,
  };
}

function persistPlayerTeamState(session) {
  const { team, storage } = loadTeamAndStorage();
  const updatedTeam = team.map((pokemon, index) =>
    session.playerTeam[index]
      ? normalizePokemon({
          ...pokemon,
          ...session.playerTeam[index],
        })
      : pokemon,
  );
  saveTeamAndStorage(updatedTeam, storage);
}

function persistGymPlayerTeam(session) {
  persistPlayerTeamState(session);
}

function persistBattlePlayerTeam(session) {
  persistPlayerTeamState(session);
}

function completeNpcBattle(session, log = []) {
  const state = loadPlayerState();
  if (!isTrainerDefeated(state, session.npc.id)) {
    state.defeatedNpcs = [...(state.defeatedNpcs || []), session.npc.id];
    incrementQuestStat(state, "npcBattlesWon");
    const rewardCoins = getNpcRewardCoins(session.npc);
    awardCoins(state, rewardCoins);
    log.push(`You defeated ${session.npc.name}!`);
    log.push(`You earned ${rewardCoins} coins.`);
    if (session.npc.itemReward?.id) {
      const quantity = Math.max(1, session.npc.itemReward.quantity || 1);
      state.items[session.npc.itemReward.id] =
        (state.items[session.npc.itemReward.id] || 0) + quantity;
      const itemName =
        itemCatalog[session.npc.itemReward.id]?.name ||
        session.npc.itemReward.id;
      log.push(
        `${session.npc.name} gave you ${quantity} ${itemName}${quantity > 1 ? "s" : ""}.`,
      );
    }
  } else {
    log.push(`${session.npc.name} has already been defeated.`);
  }

  session.status = "won";
  persistBattlePlayerTeam(session);
  activeNpcSessions.delete("player");
  const savedState = savePlayerState(state);
  return {
    success: true,
    won: true,
    log,
    state: savedState,
    npc: getNpcView(session.npc, savedState),
    session: getNpcSessionView(session),
  };
}

function finishNpcLoss(session, log = []) {
  session.status = "lost";
  persistBattlePlayerTeam(session);
  activeNpcSessions.delete("player");
  log.push(`${session.npc.name} won the battle. Come back after you heal up.`);
  return {
    success: false,
    lost: true,
    log,
    npc: getNpcView(session.npc, loadPlayerState()),
    session: getNpcSessionView(session),
  };
}

function completeGymSession(session, log = []) {
  const state = loadPlayerState();
  incrementQuestStat(state, "gymBattlesWon");
  if (!state.badges.includes(session.gym.badge)) {
    state.badges.push(session.gym.badge);
    awardCoins(state, session.gym.rewardCoins);
    log.push(`You earned the ${session.gym.badge}!`);
    log.push(`You earned ${session.gym.rewardCoins} coins.`);
  } else {
    log.push(`${session.gym.badge} already earned.`);
  }
  session.status = "won";
  persistGymPlayerTeam(session);
  activeGymSessions.delete("player");
  return {
    success: true,
    won: true,
    log,
    state: savePlayerState(state),
    session: getGymSessionView(session),
  };
}

function buildEliteTrainer(stageIndex) {
  if (stageIndex < eliteFour.length) {
    return {
      ...eliteFour[stageIndex],
      rewardCoins: 0,
    };
  }
  return champion;
}

function refreshEliteStage(session) {
  session.currentTrainer = buildEliteTrainer(session.stageIndex);
  session.isChampion = session.stageIndex >= eliteFour.length;
  session.opponentTeam = session.currentTrainer.team.map((member) =>
    createLeveledPokemon(member.name, member.level),
  );
  session.opponentIndex = getFirstHealthyPokemonIndex(session.opponentTeam);
  session.aiItems = {
    potion: session.isChampion ? 2 : 1,
  };
}

function completeEliteSession(session, log = []) {
  const state = loadPlayerState();
  incrementQuestStat(state, "eliteWins");
  if (!state.badges.includes(champion.badge)) {
    state.badges.push(champion.badge);
    state.championDefeated = true;
    awardCoins(state, champion.rewardCoins);
    log.push(`You earned the ${champion.badge}!`);
    log.push(`You earned ${champion.rewardCoins} coins.`);
  } else {
    state.championDefeated = true;
    log.push(`${champion.badge} already earned.`);
  }
  session.status = "won";
  persistBattlePlayerTeam(session);
  activeEliteSessions.delete("player");
  return {
    success: true,
    won: true,
    completed: true,
    log,
    state: savePlayerState(state),
    session: getEliteSessionView(session),
  };
}

function finishEliteLoss(session, log = []) {
  session.status = "lost";
  persistBattlePlayerTeam(session);
  activeEliteSessions.delete("player");
  log.push("The Elite Four run is over. You must restart from Shadow Master.");
  return {
    success: false,
    lost: true,
    log,
    session: getEliteSessionView(session),
  };
}

function calculateCatchProbability(
  wildPokemon,
  pokeball = "standard",
  currentHP,
  status = "none",
) {
  if (pokeball === "master") return 1.0;

  const maxHP = wildPokemon.maxHp || wildPokemon.hp || 1;
  const baseCatchRate = wildPokemon.baseCatchRate || 1;
  const ballRate = ballRates[pokeball] || 1.0;
  const statusRate = statusModifiers[status] || 1.0;
  const captureRate =
    (1 + (3 * maxHP - 2 * currentHP) * baseCatchRate * ballRate * statusRate) /
    (3 * maxHP) /
    256;
  return Math.min(1.0, captureRate);
}

app.get("/api/profile", (req, res) => {
  const state = updateAchievements(loadPlayerState());
  res.json(savePlayerState(state));
});

app.get("/api/player", (req, res) => {
  res.json(loadPlayerState());
});

app.post("/api/reward", (req, res) => {
  const { coins = 0, reason = "Reward" } = req.body;
  const amount = Math.max(0, Number(coins) || 0);
  const state = awardCoins(loadPlayerState(), amount);
  res.json({
    success: true,
    message: `${reason}: earned ${amount} coins.`,
    state: savePlayerState(state),
  });
});

app.post("/api/zone-event/reward", (req, res) => {
  const {
    coins = 0,
    itemId = null,
    quantity = 1,
    reason = "Zone event",
  } = req.body;
  const state = loadPlayerState();
  const amount = Math.max(0, Number(coins) || 0);
  if (amount) awardCoins(state, amount);

  let itemReward = null;
  if (itemId) {
    const item = itemCatalog[itemId];
    if (!item) {
      return res.status(400).json({ error: "Unknown reward item" });
    }
    const count = Math.max(1, Number(quantity) || 1);
    state.items[itemId] = (state.items[itemId] || 0) + count;
    itemReward = { id: itemId, name: item.name, quantity: count };
  }

  res.json({
    success: true,
    message: `${reason}: reward received.`,
    coins: amount,
    item: itemReward,
    state: savePlayerState(state),
  });
});

app.get("/api/pokedex", (req, res) => {
  const state = loadPlayerState();
  const entries = getPokedexEntries(state);
  const caughtCount = entries.filter((entry) => entry.caught).length;
  const seenCount = entries.filter((entry) => entry.seen).length;
  res.json({
    total: entries.length,
    seenCount,
    caughtCount,
    caughtPercent: entries.length
      ? Math.round((caughtCount / entries.length) * 1000) / 10
      : 0,
    seen: seenCount,
    caught: caughtCount,
    entries,
    achievements: state.achievements,
  });
});

app.get("/api/quests", (req, res) => {
  const state = loadPlayerState();
  const questList = getQuestList(state);
  res.json({
    summary: getQuestSummary(questList),
    stats: state.questStats || {},
    claimed: state.quests?.claimed || [],
    quests: questList,
  });
});

app.post("/api/quests/claim", (req, res) => {
  const { questId } = req.body;
  const quest = quests.find((entry) => entry.id === questId);
  if (!quest) return res.status(404).json({ error: "Quest not found" });

  const state = loadPlayerState();
  const questView = getQuestView(quest, state);
  if (questView.claimed) {
    return res.status(400).json({ error: "Quest reward already claimed" });
  }
  if (!questView.completed) {
    return res.status(400).json({ error: "Quest is not complete yet" });
  }

  const reward = applyQuestReward(state, quest.reward);
  state.quests = {
    ...(state.quests || {}),
    claimed: uniqueStrings([...(state.quests?.claimed || []), quest.id]),
  };
  incrementQuestStat(state, "questsCompleted");

  const savedState = savePlayerState(state);
  const questList = getQuestList(savedState);
  res.json({
    success: true,
    message: `${quest.title} complete! Reward claimed.`,
    reward,
    state: savedState,
    summary: getQuestSummary(questList),
    quests: questList,
  });
});

app.get("/api/gyms", (req, res) => {
  const state = loadPlayerState();
  res.json(
    gyms.map((gym) => ({
      id: gym.id,
      name: gym.name,
      leaderName: gym.leaderName,
      city: gym.city,
      type: gym.type,
      difficulty: gym.difficulty,
      badge: gym.badge,
      requiresBadge: gymUnlocks[gym.id] || null,
      rewardCoins: gym.rewardCoins,
      team: gym.team,
      unlocked: (state.unlockedGyms || []).map(Number).includes(gym.id),
      defeated: (state.badges || []).includes(gym.badge),
    })),
  );
});

app.get("/api/elitefour", (req, res) => {
  const state = loadPlayerState();
  const unlocked = hasAllGymBadges(state);
  const progress = activeEliteSessions.get("player");
  res.json({
    unlocked,
    completed: Boolean(
      state.championDefeated || (state.badges || []).includes(champion.badge),
    ),
    active: Boolean(progress && progress.status === "active"),
    session: progress ? getEliteSessionView(progress) : null,
    stages: [
      ...eliteFour.map((trainer, index) => ({
        id: trainer.id,
        name: trainer.name,
        type: trainer.type,
        team: trainer.team,
        unlocked,
        progress:
          progress?.status === "active" && progress.stageIndex === index,
      })),
      {
        id: champion.id,
        name: champion.name,
        type: champion.type,
        team: champion.team,
        unlocked,
        progress: progress?.status === "active" && progress.isChampion,
      },
    ],
  });
});

app.post("/api/gym/start", (req, res) => {
  const { gymId } = req.body;
  const gym = getGymById(gymId);
  if (!gym) return res.status(404).json({ error: "Gym not found" });
  if (activeNpcSessions.get("player")?.status === "active") {
    return res.status(400).json({ error: "Finish your trainer battle first" });
  }
  if (activeEliteSessions.get("player")?.status === "active") {
    return res.status(400).json({ error: "Finish your Elite Four run first" });
  }
  const currentSession = activeGymSessions.get("player");
  if (currentSession?.status === "active") {
    ensureGymSessionReady(currentSession);
    return res.json({
      success: true,
      log: [
        currentSession.gym.id === gym.id
          ? "Gym battle resumed."
          : `Finish your ${currentSession.gym.name} battle before starting another gym.`,
      ],
      session: getGymSessionView(currentSession),
    });
  }

  const state = loadPlayerState();
  if (!(state.unlockedGyms || []).map(Number).includes(gym.id)) {
    return res.status(403).json({ error: "This gym is locked" });
  }

  const { team } = loadTeamAndStorage();
  const gymReadyTeam = preparePlayerTeamForGymBattle(team);
  const playerIndex = getFirstHealthyPokemonIndex(gymReadyTeam);
  if (playerIndex < 0) {
    return res
      .status(400)
      .json({ error: "Heal your team before the gym battle" });
  }

  const session = {
    gym,
    playerTeam: gymReadyTeam,
    gymTeam: gym.team.map((member) =>
      createLeveledPokemon(member.name, member.level),
    ),
    playerIndex,
    participantIndexes: [playerIndex],
    gymIndex: 0,
    aiItems: {
      potion: gym.difficulty,
    },
    ppPrepared: true,
    status: "active",
  };
  activeGymSessions.set("player", session);

  res.json({
    success: true,
    log: [
      `${gym.leaderName} of the ${gym.name} challenged you!`,
      "Catching and running are disabled in gym battles.",
    ],
    session: getGymSessionView(session),
  });
});

app.post("/api/elite/start", (req, res) => {
  const state = loadPlayerState();
  if (!hasAllGymBadges(state)) {
    return res
      .status(403)
      .json({ error: "Defeat every gym before challenging the Elite Four" });
  }
  if (activeNpcSessions.get("player")?.status === "active") {
    return res.status(400).json({ error: "Finish your trainer battle first" });
  }
  if (activeGymSessions.get("player")?.status === "active") {
    return res.status(400).json({ error: "Finish your gym battle first" });
  }
  const currentSession = activeEliteSessions.get("player");
  if (currentSession?.status === "active") {
    return res.json({
      success: true,
      log: ["Elite Four battle resumed."],
      session: getEliteSessionView(currentSession),
    });
  }

  const { team } = loadTeamAndStorage();
  const playerIndex = getFirstHealthyPokemonIndex(team);
  if (playerIndex < 0) {
    return res
      .status(400)
      .json({ error: "Heal your team before challenging the Elite Four" });
  }

  const session = {
    stageIndex: 0,
    totalStages: eliteFour.length + 1,
    playerTeam: team,
    playerIndex,
    participantIndexes: [playerIndex],
    opponentIndex: 0,
    opponentTeam: [],
    currentTrainer: eliteFour[0],
    isChampion: false,
    status: "active",
    aiItems: {
      potion: 1,
    },
  };
  refreshEliteStage(session);
  activeEliteSessions.set("player", session);

  res.json({
    success: true,
    log: [
      "The Elite Four challenge begins.",
      `${session.currentTrainer.name} stepped into the arena!`,
      "No healing between battles. Catching and running are disabled.",
    ],
    session: getEliteSessionView(session),
  });
});

app.post("/api/gym/move", (req, res) => {
  const { moveName, pokemonIndex, action } = req.body;
  const session = activeGymSessions.get("player");
  if (!session || session.status !== "active") {
    return res.status(400).json({ error: "No active gym battle" });
  }
  ensureGymSessionReady(session);

  const log = [];
  if (action === "switch") {
    const nextIndex = Number(pokemonIndex);
    if (!session.playerTeam[nextIndex]) {
      return res.status(400).json({ error: "Invalid Pokemon" });
    }
    if (session.playerTeam[nextIndex].currentHp <= 0) {
      return res
        .status(400)
        .json({ error: "Cannot switch to a fainted Pokemon" });
    }
    session.playerIndex = nextIndex;
    session.participantIndexes = [
      ...new Set([...(session.participantIndexes || []), nextIndex]),
    ];
    log.push(`Go, ${session.playerTeam[nextIndex].name}!`);
    persistGymPlayerTeam(session);
    return res.json({
      success: true,
      log,
      session: getGymSessionView(session),
    });
  }

  const playerPokemon = session.playerTeam[session.playerIndex];
  const gymPokemon = session.gymTeam[session.gymIndex];
  if (!playerPokemon || playerPokemon.currentHp <= 0) {
    return res.status(400).json({ error: "Choose a healthy Pokemon first" });
  }
  if (!gymPokemon) {
    return res.json(completeGymSession(session, ["Gym battle complete."]));
  }

  const playerTurn = executeBattleMove(
    playerPokemon,
    gymPokemon,
    moveName,
    "Gym ",
  );
  log.push(...playerTurn.log);
  if (playerTurn.error) {
    return res.status(400).json({
      error: playerTurn.error,
      log,
      session: getGymSessionView(session),
    });
  }

  if (gymPokemon.currentHp <= 0) {
    const xpAward = calculateBattleXp(gymPokemon, 3.25);
    const xpResult = applyXpToParticipants(
      session.playerTeam,
      session.participantIndexes || [session.playerIndex],
      xpAward,
    );
    session.playerTeam = xpResult.team;
    log.push(`Gym ${gymPokemon.name} fainted!`);
    appendXpLog(log, xpResult.results);
    session.participantIndexes = [session.playerIndex];
    session.gymIndex += 1;
    if (session.gymIndex >= session.gymTeam.length) {
      return res.json(completeGymSession(session, log));
    }
    log.push(
      `${session.gym.name} sent out ${session.gymTeam[session.gymIndex].name}!`,
    );
    persistGymPlayerTeam(session);
    return res.json({
      success: true,
      log,
      session: getGymSessionView(session),
    });
  }

  const gymAction = chooseGymAction(session, playerPokemon) || { type: "none" };
  let gymActed = false;
  if (gymAction.type === "switch") {
    const outgoing = session.gymTeam[session.gymIndex];
    const incoming = session.gymTeam[gymAction.index];
    if (incoming && outgoing) {
      session.gymTeam[gymAction.index] = session.gymTeam[session.gymIndex];
      session.gymTeam[session.gymIndex] = incoming;
      log.push(
        `${session.gym.leaderName} withdrew ${outgoing.name} and sent out ${incoming.name}!`,
      );
      gymActed = true;
    }
  } else if (gymAction.type === "item") {
    const healAmount = 50;
    const healed = Math.min(
      healAmount,
      gymPokemon.maxHp - gymPokemon.currentHp,
    );
    gymPokemon.currentHp += healed;
    session.aiItems.potion -= 1;
    log.push(
      `${session.gym.leaderName} used a Potion. ${gymPokemon.name} recovered ${healed} HP.`,
    );
    gymActed = true;
  } else if (gymAction.move) {
    log.push(`${session.gym.leaderName}'s turn:`);
    log.push(
      ...executeBattleMove(gymPokemon, playerPokemon, gymAction.move.name).log,
    );
    gymActed = true;
  }

  if (!gymActed) {
    const fallbackMove = (gymPokemon.moves || []).find(
      (move) => (move.currentPp ?? 0) > 0,
    );
    if (fallbackMove) {
      log.push(`${session.gym.leaderName}'s turn:`);
      log.push(
        ...executeBattleMove(gymPokemon, playerPokemon, fallbackMove.name).log,
      );
    } else {
      log.push(
        `${session.gym.leaderName}'s ${gymPokemon.name} has no moves left!`,
      );
    }
  }

  const activeGymPokemon = session.gymTeam[session.gymIndex];
  applyBattleEndOfTurnStatus(playerPokemon, activeGymPokemon, log);

  if (activeGymPokemon?.currentHp <= 0) {
    const xpAward = calculateBattleXp(activeGymPokemon, 3.25);
    const xpResult = applyXpToParticipants(
      session.playerTeam,
      session.participantIndexes || [session.playerIndex],
      xpAward,
    );
    session.playerTeam = xpResult.team;
    log.push(`Gym ${activeGymPokemon.name} fainted!`);
    appendXpLog(log, xpResult.results);
    session.participantIndexes = [session.playerIndex];
    session.gymIndex += 1;
    if (session.gymIndex >= session.gymTeam.length) {
      return res.json(completeGymSession(session, log));
    }
    log.push(
      `${session.gym.name} sent out ${session.gymTeam[session.gymIndex].name}!`,
    );
    persistGymPlayerTeam(session);
    return res.json({
      success: true,
      log,
      session: getGymSessionView(session),
    });
  }

  if (playerPokemon.currentHp <= 0) {
    log.push(`${playerPokemon.name} fainted!`);
    const nextIndex = getFirstHealthyPokemonIndex(session.playerTeam);
    if (nextIndex < 0) {
      session.status = "lost";
      persistGymPlayerTeam(session);
      activeGymSessions.delete("player");
      log.push("You lost the gym battle. Heal up and try again.");
      return res.json({
        success: false,
        lost: true,
        log,
        session: getGymSessionView(session),
      });
    }
    session.playerIndex = nextIndex;
    session.participantIndexes = [
      ...new Set([...(session.participantIndexes || []), nextIndex]),
    ];
    log.push("Choose another Pokemon to continue.");
  }

  persistGymPlayerTeam(session);
  res.json({
    success: true,
    log,
    session: getGymSessionView(session),
  });
});

app.post("/api/elite/move", (req, res) => {
  const { moveName, pokemonIndex, action } = req.body;
  const session = activeEliteSessions.get("player");
  if (!session || session.status !== "active") {
    return res.status(400).json({ error: "No active Elite Four battle" });
  }

  const log = [];
  if (action === "switch") {
    const nextIndex = Number(pokemonIndex);
    if (!session.playerTeam[nextIndex]) {
      return res.status(400).json({ error: "Invalid Pokemon" });
    }
    if (session.playerTeam[nextIndex].currentHp <= 0) {
      return res
        .status(400)
        .json({ error: "Cannot switch to a fainted Pokemon" });
    }
    session.playerIndex = nextIndex;
    session.participantIndexes = [
      ...new Set([...(session.participantIndexes || []), nextIndex]),
    ];
    log.push(`Go, ${session.playerTeam[nextIndex].name}!`);
    persistBattlePlayerTeam(session);
    return res.json({
      success: true,
      log,
      session: getEliteSessionView(session),
    });
  }

  const playerPokemon = session.playerTeam[session.playerIndex];
  const opponentPokemon = session.opponentTeam[session.opponentIndex];
  if (!playerPokemon || playerPokemon.currentHp <= 0) {
    return res.status(400).json({ error: "Choose a healthy Pokemon first" });
  }
  if (!opponentPokemon) {
    return res.status(400).json({ error: "Elite battle is already finished" });
  }

  const playerTurn = executeBattleMove(
    playerPokemon,
    opponentPokemon,
    moveName,
    "Elite ",
  );
  log.push(...playerTurn.log);
  if (playerTurn.error) {
    return res.status(400).json({
      error: playerTurn.error,
      log,
      session: getEliteSessionView(session),
    });
  }

  if (opponentPokemon.currentHp <= 0) {
    const xpAward = calculateBattleXp(opponentPokemon, session.isChampion ? 4.5 : 4);
    const xpResult = applyXpToParticipants(
      session.playerTeam,
      session.participantIndexes || [session.playerIndex],
      xpAward,
    );
    session.playerTeam = xpResult.team;
    log.push(`${opponentPokemon.name} fainted!`);
    appendXpLog(log, xpResult.results);
    session.participantIndexes = [session.playerIndex];
    session.opponentIndex = getFirstHealthyPokemonIndex(session.opponentTeam);
    if (session.opponentIndex < 0) {
      if (session.isChampion) {
        log.push(`${champion.name} has been defeated!`);
        return res.json(completeEliteSession(session, log));
      }

      session.stageIndex += 1;
      refreshEliteStage(session);
      log.push(`${session.currentTrainer.name} entered the arena!`);
      if (session.isChampion) {
        log.push(`${champion.name} awaits as the final battle!`);
      } else {
        log.push(
          `Elite Four progress: ${session.stageIndex}/${eliteFour.length}`,
        );
      }
      log.push(
        `${session.currentTrainer.name} sent out ${session.opponentTeam[session.opponentIndex].name}!`,
      );
      persistBattlePlayerTeam(session);
      return res.json({
        success: true,
        stageCleared: true,
        log,
        session: getEliteSessionView(session),
      });
    }

    log.push(
      `${session.currentTrainer.name} sent out ${session.opponentTeam[session.opponentIndex].name}!`,
    );
    persistBattlePlayerTeam(session);
    return res.json({
      success: true,
      log,
      session: getEliteSessionView(session),
    });
  }

  const eliteAction = chooseTrainerAction(
    session.opponentTeam,
    session.opponentIndex,
    session.aiItems,
    playerPokemon,
    session.currentTrainer.name,
  );
  if (eliteAction.type === "switch") {
    const incoming = session.opponentTeam[eliteAction.index];
    if (incoming) {
      session.opponentTeam[eliteAction.index] =
        session.opponentTeam[session.opponentIndex];
      session.opponentTeam[session.opponentIndex] = incoming;
      log.push(`${session.currentTrainer.name} switched to ${incoming.name}!`);
    }
  } else if (eliteAction.type === "item") {
    const healAmount = 50;
    const healed = Math.min(
      healAmount,
      opponentPokemon.maxHp - opponentPokemon.currentHp,
    );
    opponentPokemon.currentHp += healed;
    session.aiItems.potion -= 1;
    log.push(
      `${session.currentTrainer.name} used a Potion. ${opponentPokemon.name} recovered ${healed} HP.`,
    );
  } else if (eliteAction.move) {
    log.push(
      ...executeBattleMove(
        opponentPokemon,
        playerPokemon,
        eliteAction.move.name,
      ).log,
    );
  }

  const activeOpponentPokemon = session.opponentTeam[session.opponentIndex];
  applyBattleEndOfTurnStatus(playerPokemon, activeOpponentPokemon, log);

  if (activeOpponentPokemon?.currentHp <= 0) {
    const xpAward = calculateBattleXp(
      activeOpponentPokemon,
      session.isChampion ? 4.5 : 4,
    );
    const xpResult = applyXpToParticipants(
      session.playerTeam,
      session.participantIndexes || [session.playerIndex],
      xpAward,
    );
    session.playerTeam = xpResult.team;
    log.push(`${activeOpponentPokemon.name} fainted!`);
    appendXpLog(log, xpResult.results);
    session.participantIndexes = [session.playerIndex];
    session.opponentIndex = getFirstHealthyPokemonIndex(session.opponentTeam);
    if (session.opponentIndex < 0) {
      if (session.isChampion) {
        log.push(`${champion.name} has been defeated!`);
        return res.json(completeEliteSession(session, log));
      }

      session.stageIndex += 1;
      refreshEliteStage(session);
      log.push(`${session.currentTrainer.name} entered the arena!`);
      if (session.isChampion) {
        log.push(`${champion.name} awaits as the final battle!`);
      } else {
        log.push(`Elite Four progress: ${session.stageIndex}/${eliteFour.length}`);
      }
      log.push(
        `${session.currentTrainer.name} sent out ${session.opponentTeam[session.opponentIndex].name}!`,
      );
      persistBattlePlayerTeam(session);
      return res.json({
        success: true,
        stageCleared: true,
        log,
        session: getEliteSessionView(session),
      });
    }

    log.push(
      `${session.currentTrainer.name} sent out ${session.opponentTeam[session.opponentIndex].name}!`,
    );
    persistBattlePlayerTeam(session);
    return res.json({
      success: true,
      log,
      session: getEliteSessionView(session),
    });
  }

  if (playerPokemon.currentHp <= 0) {
    log.push(`${playerPokemon.name} fainted!`);
    const nextIndex = getFirstHealthyPokemonIndex(session.playerTeam);
    if (nextIndex < 0) {
      return res.json(finishEliteLoss(session, log));
    }
    session.playerIndex = nextIndex;
    log.push("Choose another Pokemon to continue.");
  }

  persistBattlePlayerTeam(session);
  res.json({
    success: true,
    log,
    session: getEliteSessionView(session),
  });
});

app.post("/api/gym/end", (req, res) => {
  const session = activeGymSessions.get("player");
  if (session) {
    persistGymPlayerTeam(session);
    activeGymSessions.delete("player");
  }
  res.json({ success: true, message: "Gym battle ended." });
});

app.post("/api/gym/battle", (req, res) => {
  res.status(410).json({
    error: "Use /api/gym/start and /api/gym/move for turn-based gym battles.",
  });
});

app.get("/api/shop", (req, res) => {
  const state = loadPlayerState();
  res.json({
    coins: state.coins,
    money: state.coins,
    items: state.items,
    catalog: Object.entries(itemCatalog).map(([id, item]) => ({
      id,
      ...item,
    })),
  });
});

function buyItemHandler(req, res) {
  const { itemId, quantity = 1 } = req.body;
  const item = itemCatalog[itemId];
  const count = Math.max(1, Number(quantity) || 1);
  if (!item) {
    return res.status(400).json({ error: "Unknown shop item" });
  }

  const state = loadPlayerState();
  const cost = item.price * count;
  if (state.coins < cost) {
    return res.status(400).json({ error: "Not enough money" });
  }

  state.coins -= cost;
  state.money = state.coins;
  state.items[itemId] = (state.items[itemId] || 0) + count;
  updateAchievements(state);
  res.json({
    success: true,
    message: `Bought ${count} ${item.name}${count > 1 ? "s" : ""}.`,
    state: savePlayerState(state),
  });
}

app.post("/api/buy", buyItemHandler);
app.post("/api/shop/buy", buyItemHandler);

app.post("/api/use-item", (req, res) => {
  const { itemId, pokemonIndex } = req.body;
  const item = itemCatalog[itemId];
  if (!item || !["healing", "status"].includes(item.category)) {
    return res.status(400).json({ error: "That item cannot be used here" });
  }

  const state = loadPlayerState();
  if ((state.items[itemId] || 0) <= 0) {
    return res.status(400).json({ error: "You do not have that item" });
  }

  const { team, storage } = loadTeamAndStorage();
  if (pokemonIndex < 0 || pokemonIndex >= team.length) {
    return res.status(400).json({ error: "Invalid Pokemon index" });
  }

  const pokemon = team[pokemonIndex];
  let message = "";
  if (item.category === "healing") {
    if (pokemon.currentHp >= pokemon.maxHp) {
      return res
        .status(400)
        .json({ error: `${pokemon.name} is already healthy` });
    }
    const healed = Math.min(item.healAmount, pokemon.maxHp - pokemon.currentHp);
    pokemon.currentHp += healed;
    message = `${pokemon.name} recovered ${healed} HP.`;
  } else {
    if (!item.cures.includes(pokemon.status)) {
      return res.status(400).json({
        error: `${item.name} does not help ${pokemon.name} right now`,
      });
    }
    pokemon.status = "none";
    message = `${pokemon.name}'s status was cured.`;
  }

  state.items[itemId] -= 1;
  team[pokemonIndex] = pokemon;
  saveTeamAndStorage(team, storage);
  res.json({
    success: true,
    message,
    inventory: team,
    team,
    storage,
    state: savePlayerState(state),
  });
});

app.get("/api/areas", (req, res) => {
  const state = loadPlayerState();
  res.json(
    areas.map((area) => ({
      ...area,
      unlocked:
        !area.requiresBadge ||
        (state.badges || []).includes(area.requiresBadge) ||
        (state.unlockedAreas || []).includes(area.id),
    })),
  );
});

app.get("/api/npcs", (req, res) => {
  const state = loadPlayerState();
  const area = String(req.query.area || "").toLowerCase();
  const areaMap = npcMaps[area];
  if (!area || !areaMap) {
    return res.status(400).json({ error: "Valid area is required" });
  }

  return res.json({
    area,
    map: areaMap,
    npcs: npcs
      .filter((npc) => npc.area === area)
      .map((npc) => getNpcView(npc, state)),
  });
});

app.post("/api/npc/interact", (req, res) => {
  const { npcId } = req.body;
  const npc = getNpcById(npcId);
  if (!npc) {
    return res.status(404).json({ error: "NPC not found" });
  }
  if (activeNpcSessions.get("player")?.status === "active") {
    return res
      .status(400)
      .json({ error: "Finish your current trainer battle first" });
  }
  if (activeGymSessions.get("player")?.status === "active") {
    return res.status(400).json({ error: "Finish your gym battle first" });
  }
  if (activeEliteSessions.get("player")?.status === "active") {
    return res
      .status(400)
      .json({ error: "Finish your Elite Four battle first" });
  }

  const state = loadPlayerState();
  const npcView = getNpcView(npc, state);
  if (npc.type === "trainer") {
    if (isTrainerDefeated(state, npc.id)) {
      return res.json({
        success: true,
        action: "dialogue",
        npc: npcView,
        dialogue: npc.dialogue,
      });
    }

    const { team } = loadTeamAndStorage();
    const playerIndex = getFirstHealthyPokemonIndex(team);
    if (playerIndex < 0) {
      return res
        .status(400)
        .json({ error: "Heal your team before battling trainers" });
    }

    const session = {
      npc,
      playerTeam: team,
      playerIndex,
      participantIndexes: [playerIndex],
      opponentTeam: (npc.team || []).map((member) =>
        createLeveledPokemon(member.name, member.level),
      ),
      opponentIndex: 0,
      aiItems: {
        potion: npc.team && npc.team.length > 1 ? 1 : 0,
      },
      status: "active",
    };
    activeNpcSessions.set("player", session);

    return res.json({
      success: true,
      action: "battle",
      dialogue: npc.introDialogue || "Let's battle!",
      log: [
        npc.introDialogue || `${npc.name} wants to battle!`,
        `${npc.name} sent out ${session.opponentTeam[0].name}!`,
        "Trainer battles do not allow catching or running.",
      ],
      npc: npcView,
      session: getNpcSessionView(session),
    });
  }

  if (npc.type === "shop") {
    return res.json({
      success: true,
      action: "shop",
      npc: npcView,
      dialogue: npc.dialogue,
    });
  }

  if (npc.type === "healer") {
    const { team, storage } = loadTeamAndStorage();
    const healedTeam = team.map(restorePokemon);
    const healedStorage = storage.map(restorePokemon);
    saveTeamAndStorage(healedTeam, healedStorage);
    return res.json({
      success: true,
      action: "heal",
      npc: npcView,
      dialogue: npc.dialogue,
      message: `${npc.name} healed every Pokemon in your team and storage.`,
      team: healedTeam,
      storage: healedStorage,
    });
  }

  return res.json({
    success: true,
    action: "dialogue",
    npc: npcView,
    dialogue: npc.dialogue,
  });
});

app.post("/api/npc/move", (req, res) => {
  const { moveName, pokemonIndex, action } = req.body;
  const session = activeNpcSessions.get("player");
  if (!session || session.status !== "active") {
    return res.status(400).json({ error: "No active NPC battle" });
  }

  const log = [];
  if (action === "switch") {
    const nextIndex = Number(pokemonIndex);
    if (!session.playerTeam[nextIndex]) {
      return res.status(400).json({ error: "Invalid Pokemon" });
    }
    if (session.playerTeam[nextIndex].currentHp <= 0) {
      return res
        .status(400)
        .json({ error: "Cannot switch to a fainted Pokemon" });
    }
    session.playerIndex = nextIndex;
    session.participantIndexes = [
      ...new Set([...(session.participantIndexes || []), nextIndex]),
    ];
    persistBattlePlayerTeam(session);
    log.push(`Go, ${session.playerTeam[nextIndex].name}!`);
    return res.json({
      success: true,
      log,
      session: getNpcSessionView(session),
    });
  }

  const playerPokemon = session.playerTeam[session.playerIndex];
  const opponentPokemon = session.opponentTeam[session.opponentIndex];
  if (!playerPokemon || playerPokemon.currentHp <= 0) {
    return res.status(400).json({ error: "Choose a healthy Pokemon first" });
  }
  if (!opponentPokemon) {
    return res.status(400).json({ error: "NPC battle is already finished" });
  }

  const playerTurn = executeBattleMove(
    playerPokemon,
    opponentPokemon,
    moveName,
    `${session.npc.name}'s `,
  );
  log.push(...playerTurn.log);
  if (playerTurn.error) {
    return res.status(400).json({
      error: playerTurn.error,
      log,
      session: getNpcSessionView(session),
    });
  }

  if (opponentPokemon.currentHp <= 0) {
    const xpAward = calculateBattleXp(opponentPokemon, 2.75);
    const xpResult = applyXpToParticipants(
      session.playerTeam,
      session.participantIndexes || [session.playerIndex],
      xpAward,
    );
    session.playerTeam = xpResult.team;
    log.push(`${session.npc.name}'s ${opponentPokemon.name} fainted!`);
    appendXpLog(log, xpResult.results);
    session.participantIndexes = [session.playerIndex];
    session.opponentIndex = getFirstHealthyPokemonIndex(session.opponentTeam);
    if (session.opponentIndex < 0) {
      return res.json(completeNpcBattle(session, log));
    }
    log.push(
      `${session.npc.name} sent out ${session.opponentTeam[session.opponentIndex].name}!`,
    );
    persistBattlePlayerTeam(session);
    return res.json({
      success: true,
      log,
      session: getNpcSessionView(session),
    });
  }

  const npcAction = chooseTrainerAction(
    session.opponentTeam,
    session.opponentIndex,
    session.aiItems,
    playerPokemon,
    session.npc.name,
    aiDifficulty.MEDIUM,
  );
  if (npcAction.type === "switch") {
    const incoming = session.opponentTeam[npcAction.index];
    if (incoming) {
      session.opponentTeam[npcAction.index] =
        session.opponentTeam[session.opponentIndex];
      session.opponentTeam[session.opponentIndex] = incoming;
      log.push(`${session.npc.name} switched to ${incoming.name}!`);
    }
  } else if (npcAction.type === "item") {
    const healAmount = 50;
    const healed = Math.min(
      healAmount,
      opponentPokemon.maxHp - opponentPokemon.currentHp,
    );
    opponentPokemon.currentHp += healed;
    session.aiItems.potion -= 1;
    log.push(
      `${session.npc.name} used a Potion. ${opponentPokemon.name} recovered ${healed} HP.`,
    );
  } else if (npcAction.move) {
    log.push(
      ...executeBattleMove(opponentPokemon, playerPokemon, npcAction.move.name)
        .log,
    );
  }

  const activeNpcPokemon = session.opponentTeam[session.opponentIndex];
  applyBattleEndOfTurnStatus(playerPokemon, activeNpcPokemon, log);

  if (activeNpcPokemon?.currentHp <= 0) {
    const xpAward = calculateBattleXp(activeNpcPokemon, 2.75);
    const xpResult = applyXpToParticipants(
      session.playerTeam,
      session.participantIndexes || [session.playerIndex],
      xpAward,
    );
    session.playerTeam = xpResult.team;
    log.push(`${session.npc.name}'s ${activeNpcPokemon.name} fainted!`);
    appendXpLog(log, xpResult.results);
    session.participantIndexes = [session.playerIndex];
    session.opponentIndex = getFirstHealthyPokemonIndex(session.opponentTeam);
    if (session.opponentIndex < 0) {
      return res.json(completeNpcBattle(session, log));
    }
    log.push(
      `${session.npc.name} sent out ${session.opponentTeam[session.opponentIndex].name}!`,
    );
    persistBattlePlayerTeam(session);
    return res.json({
      success: true,
      log,
      session: getNpcSessionView(session),
    });
  }

  if (playerPokemon.currentHp <= 0) {
    log.push(`${playerPokemon.name} fainted!`);
    const nextIndex = getFirstHealthyPokemonIndex(session.playerTeam);
    if (nextIndex < 0) {
      return res.json(finishNpcLoss(session, log));
    }
    session.playerIndex = nextIndex;
    log.push("Choose another Pokemon to continue.");
  }

  persistBattlePlayerTeam(session);
  return res.json({
    success: true,
    log,
    session: getNpcSessionView(session),
  });
});

app.post("/api/npc/end", (req, res) => {
  activeNpcSessions.delete("player");
  res.json({ success: true, message: "NPC interaction ended." });
});

app.get("/api/pokeballs", (req, res) => {
  res.json(Object.entries(ballRates).map(([type, rate]) => ({ type, rate })));
});

app.get("/api/pokemon", (req, res) => {
  try {
    res.json(getPokemonTemplates());
  } catch (error) {
    res.status(500).json({ error: "Failed to read Pokemon data" });
  }
});

app.post("/api/encounter", (req, res) => {
  const { area } = req.body;
  if (!area) {
    return res.status(400).json({ error: "Area is required" });
  }
  if (activeNpcSessions.get("player")?.status === "active") {
    return res.status(400).json({ error: "Finish your trainer battle first" });
  }

  try {
    const allPokemon = getPokemonTemplates();
    const { pokemon, weather, metadata } = selectEncounter(allPokemon, area);
    if (!pokemon) {
      return res.status(404).json({ error: "No Pokemon available for this area" });
    }
    const encountered = normalizePokemon(pokemon);
    const shiny = Math.random() < 1 / 4096;
    const encounterData = {
      ...encountered,
      currentHp: encountered.maxHp || encountered.hp,
      area,
      level: encountered.level || 1,
      weather,
      timeOfDay: metadata.timeOfDay,
      rarity: metadata.rarity,
      legendaryRoll: metadata.legendaryRoll,
      poolSize: metadata.poolSize,
      encounterMetadata: metadata,
      shiny,
      moves: encountered.moves.map((m) => ({
        ...m,
        currentPp: m.maxPp ?? m.pp,
      })),
    };
    markPokedexSeen(encounterData.id);
    res.json(encounterData);
  } catch (error) {
    res.status(500).json({ error: "Failed to create encounter" });
  }
});

app.post("/api/battle", (req, res) => {
  const {
    pokemonIndex,
    playerId,
    wild,
    moveName,
    playerHP,
    wildHP,
    playerStatus = "none",
    wildStatus = "none",
    participantIndexes = [],
  } = req.body;

  try {
    const { team, storage } = loadTeamAndStorage();
    let inventory = team;
    const playerIndex =
      Number.isInteger(pokemonIndex) && inventory[pokemonIndex]
        ? pokemonIndex
        : inventory.findIndex((p) => p.id === playerId);
    if (playerIndex < 0) {
      return res.status(404).json({ error: "Player Pokémon not found" });
    }

    const playerPokemon = inventory[playerIndex];
    const wildPokemon = normalizePokemon(wild || {});
    if (!wildPokemon.id) {
      return res.status(400).json({ error: "Wild Pokémon is required" });
    }

    playerPokemon.currentHp = Math.max(0, playerHP);
    wildPokemon.currentHp = Math.max(0, wildHP);
    playerPokemon.status = playerStatus;
    wildPokemon.status = wildStatus;
    let winner = null;
    const log = [];

    const playerTurn = executeBattleMove(
      playerPokemon,
      wildPokemon,
      moveName,
      "Wild ",
    );
    log.push(...playerTurn.log);
    if (playerTurn.error) {
      return res.status(400).json({ error: playerTurn.error, log });
    }

    if (wildPokemon.currentHp <= 0) {
      winner = "player";
      log.push(`Wild ${wildPokemon.name} fainted!`);
    }

    if (!winner) {
      const availableMoves = wildPokemon.moves.filter((m) => m.currentPp > 0);
      if (availableMoves.length === 0) {
        winner = "player";
        log.push(`Wild ${wildPokemon.name} has no moves left!`);
      } else {
        const wildMove =
          chooseBestMove(wildPokemon, playerPokemon) ||
          availableMoves[Math.floor(Math.random() * availableMoves.length)];
        const wildTurn = executeBattleMove(
          wildPokemon,
          playerPokemon,
          wildMove.name,
        );
        log.push(...wildTurn.log);
      }
    }

    if (!winner) {
      applyBattleEndOfTurnStatus(playerPokemon, wildPokemon, log);
      if (wildPokemon.currentHp <= 0) {
        winner = "player";
        log.push(`Wild ${wildPokemon.name} fainted!`);
      }
    }

    if (playerPokemon.currentHp <= 0) {
      winner = "wild";
      log.push(`${playerPokemon.name} fainted!`);
    }

    let moneyReward = 0;
    if (winner === "player") {
      moneyReward = getRandomInt(
        coinRewards.wildBattleMin,
        coinRewards.wildBattleMax,
      );
      const state = loadPlayerState();
      awardCoins(state, moneyReward);
      incrementQuestStat(state, "wildBattlesWon");
      savePlayerState(state);
      log.push(`You earned ${moneyReward} coins.`);
    }

    const xpAward =
      winner === "player" ? calculateBattleXp(wildPokemon, 2.5) : 0;

    inventory[playerIndex] = playerPokemon;
    let xpResult = null;
    if (xpAward > 0) {
      const participants = [...new Set([...participantIndexes, playerIndex])];
      xpResult = applyXpToParticipants(inventory, participants, xpAward);
      inventory = xpResult.team;
      appendXpLog(log, xpResult.results);
    }

    saveTeamAndStorage(inventory, storage);

    res.json({
      playerHP: playerPokemon.currentHp,
      wildHP: wildPokemon.currentHp,
      winner,
      log,
      playerStatus: playerPokemon.status,
      wildStatus: wildPokemon.status,
      moneyReward,
      xpAward,
      xpResult: xpResult
        ? {
            xpEach: xpResult.xpEach,
            results: xpResult.results,
          }
        : null,
      playerMoves: inventory[playerIndex].moves,
      playerPokemon: inventory[playerIndex],
      wild: wildPokemon,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to process battle" });
  }
});

app.post("/api/catch", (req, res) => {
  if (activeNpcSessions.get("player")?.status === "active") {
    return res
      .status(400)
      .json({ error: "You cannot catch Pokemon during a trainer battle." });
  }
  if (activeGymSessions.get("player")?.status === "active") {
    return res
      .status(400)
      .json({ error: "You cannot catch Pokemon during a gym battle." });
  }
  if (activeEliteSessions.get("player")?.status === "active") {
    return res
      .status(400)
      .json({ error: "You cannot catch Pokemon during an Elite Four battle." });
  }

  const {
    id,
    pokeball = "standard",
    wildHPPercent = 1.0,
    status = "none",
  } = req.body;

  try {
    const pokemon = getPokemonTemplates();
    const target = normalizePokemon(pokemon.find((p) => p.id === id) || {});
    if (!target.id) {
      return res.status(404).json({ error: "Pokemon not found" });
    }
    const isLegendary =
      target.rarity === "legendary" || target.rarity === "mythical";
    const ownedIds = getAllOwnedPokemon().map((pokemon) => pokemon.id);
    if (isLegendary && ownedIds.includes(target.id)) {
      return res
        .status(400)
        .json({ error: `You already caught ${target.name}.` });
    }

    const currentHP = Math.max(
      1,
      Math.round((target.maxHp || target.hp) * wildHPPercent),
    );
    const catchProbability = calculateCatchProbability(
      target,
      pokeball,
      currentHP,
      status,
    );
    const success = catchProbability >= 1 || Math.random() < catchProbability;
    const state = loadPlayerState();
    if ((state.items[pokeball] || 0) <= 0) {
      return res.status(400).json({ error: "You do not have that ball" });
    }
    state.items[pokeball] -= 1;

    if (success) {
      const { team, storage } = loadTeamAndStorage();
      const caughtPokemon = {
        ...target,
        currentHp: currentHP,
        level: target.level || 1,
        xp: target.xp || 0,
        shiny: !!req.body.shiny,
        status: "none",
        moves: target.moves.map((m) => ({
          ...m,
          currentPp: m.maxPp ?? m.pp,
        })),
      };
      const catchDestination =
        team.length < teamLimit ? "your team" : "storage";
      if (team.length < teamLimit) {
        team.push(caughtPokemon);
      } else {
        storage.push(caughtPokemon);
      }
      state.pokedex.seen = uniqueNumbers([...state.pokedex.seen, target.id]);
      state.pokedex.caught = uniqueNumbers([
        ...state.pokedex.caught,
        target.id,
      ]);
      awardCoins(state, coinRewards.catch);
      incrementQuestStat(state, "pokemonCaught");

      saveTeamAndStorage(team, storage);
      savePlayerState(state);
      return res.json({
        success: true,
        message: `Caught ${target.name}! Sent to ${catchDestination}. Earned ${coinRewards.catch} coins.`,
        pokemon: caughtPokemon,
        catchRate: Math.round(catchProbability * 100),
        state,
        destination: catchDestination,
      });
    }

    savePlayerState(state);
    res.json({
      success: false,
      message: "Pokemon escaped!",
      catchRate: Math.round(catchProbability * 100),
      state,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to catch Pokemon" });
  }
});

app.get("/api/inventory", (req, res) => {
  try {
    res.json(loadTeamAndStorage());
  } catch (error) {
    res.status(500).json({ error: "Failed to read inventory" });
  }
});

app.post("/api/heal", (req, res) => {
  try {
    const { team, storage } = loadTeamAndStorage();
    const healedTeam = team.map(restorePokemon);
    const healedStorage = storage.map(restorePokemon);
    saveTeamAndStorage(healedTeam, healedStorage);
    res.json({
      success: true,
      message: "Every Pokemon in your team and storage was fully healed.",
      team: healedTeam,
      storage: healedStorage,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to heal Pokemon" });
  }
});

app.post("/api/xp", (req, res) => {
  const { pokemonIndex, xpAmount } = req.body;
  try {
    const { team, storage } = loadTeamAndStorage();
    if (pokemonIndex < 0 || pokemonIndex >= team.length) {
      return res.status(400).json({ error: "Invalid Pokemon index" });
    }

    const xpResult = applyXpToPokemon(team, pokemonIndex, xpAmount);
    const updatedTeam = xpResult.team;
    saveTeamAndStorage(updatedTeam, storage);

    res.json({
      success: true,
      pokemon: updatedTeam[pokemonIndex],
      leveledUp: xpResult.leveledUp,
      evolved: xpResult.evolved,
      evolvedFrom: xpResult.evolvedFrom,
      evolvedTo: xpResult.evolvedTo,
      statGains: xpResult.statGains,
      learnedMoves: xpResult.learnedMoves,
      pendingMove: xpResult.pendingMove,
      messages: xpResult.messages,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to save experience" });
  }
});

app.post("/api/learn-move", (req, res) => {
  const { section = "team", pokemonIndex, replaceIndex = null, skip = false } = req.body;

  try {
    const { team, storage } = loadTeamAndStorage();
    const list = section === "storage" ? storage : team;
    const index = Number(pokemonIndex);
    if (index < 0 || index >= list.length) {
      return res.status(400).json({ error: "Invalid Pokemon index" });
    }

    const pokemon = normalizePokemon(list[index]);
    if (!pokemon.pendingMove) {
      return res.status(400).json({ error: "No pending move to learn" });
    }

    const pendingMove = pokemon.pendingMove;
    let message = `${pokemon.name} did not learn ${pendingMove.name}.`;
    if (!skip) {
      const moveIndex = Number(replaceIndex);
      if (moveIndex < 0 || moveIndex >= (pokemon.moves || []).length) {
        return res.status(400).json({ error: "Choose a move to replace" });
      }
      const oldMove = pokemon.moves[moveIndex];
      pokemon.moves[moveIndex] = pendingMove;
      message = `${pokemon.name} forgot ${oldMove.name} and learned ${pendingMove.name}!`;
    }

    delete pokemon.pendingMove;
    list[index] = pokemon;
    saveTeamAndStorage(team, storage);
    res.json({
      success: true,
      message,
      team,
      storage,
      pokemon,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to update moves" });
  }
});

app.post("/api/release", (req, res) => {
  const { pokemonIndex } = req.body;

  try {
    const { team, storage } = loadTeamAndStorage();
    const allCount = team.length + storage.length;
    if (pokemonIndex < 0 || pokemonIndex >= allCount) {
      return res.status(400).json({ error: "Invalid Pokemon index" });
    }
    if (allCount <= 1) {
      return res.status(400).json({ error: "You need at least one Pokemon" });
    }

    const releasedPokemon =
      pokemonIndex < team.length
        ? team.splice(pokemonIndex, 1)[0]
        : storage.splice(pokemonIndex - team.length, 1)[0];

    if (team.length < teamLimit && storage.length > 0) {
      team.push(storage.shift());
    }

    saveTeamAndStorage(team, storage);
    res.json({
      success: true,
      message: `${releasedPokemon.name} was released.`,
      team,
      storage,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to save inventory" });
  }
});

app.post("/api/swap-storage", (req, res) => {
  const { teamIndex, storageIndex } = req.body;

  try {
    const { team, storage } = loadTeamAndStorage();
    if (storageIndex < 0 || storageIndex >= storage.length) {
      return res.status(400).json({ error: "Invalid storage Pokemon" });
    }

    const storedPokemon = storage.splice(storageIndex, 1)[0];
    const targetTeamIndex = Number.isInteger(teamIndex)
      ? teamIndex
      : team.length;

    if (team.length < teamLimit && targetTeamIndex >= team.length) {
      team.push(storedPokemon);
    } else {
      if (targetTeamIndex < 0 || targetTeamIndex >= team.length) {
        storage.splice(storageIndex, 0, storedPokemon);
        return res.status(400).json({ error: "Invalid team Pokemon" });
      }
      const teamPokemon = team[targetTeamIndex];
      team[targetTeamIndex] = storedPokemon;
      storage.push(teamPokemon);
    }

    saveTeamAndStorage(team, storage);
    res.json({
      success: true,
      message: `${storedPokemon.name} joined your team.`,
      team,
      storage,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to swap Pokemon" });
  }
});

app.post("/api/heal-pokemon", (req, res) => {
  const { pokemonIndex } = req.body;

  try {
    const { team, storage } = loadTeamAndStorage();
    if (pokemonIndex < 0 || pokemonIndex >= team.length) {
      return res.status(400).json({ error: "Invalid Pokemon index" });
    }

    const pokemon = restorePokemon(team[pokemonIndex]);
    team[pokemonIndex] = pokemon;
    saveTeamAndStorage(team, storage);
    res.json({
      success: true,
      message: `${pokemon.name} was fully healed.`,
      inventory: team,
      team,
      storage,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to heal Pokemon" });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
