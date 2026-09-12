const express = require("express");
const path = require("path");
const { loadGameData, loadJson, saveJson } = require("./dataLoader");
const { createGameState } = require("./gameState");
const { createPokemonUtils } = require("./pokemonUtils");
const { createBattleEngine } = require("./battleEngine");
const { createEncounterEngine } = require("./encounterEngine");
const { createRewardEngine } = require("./rewardEngine");
const { createEvolutionEngine } = require("./evolutionEngine");
const { createHandbookData } = require("./handbookData");
const { createStoryEngine } = require("./storyEngine");
const {
  MYSTERY_ENCOUNTER_ID,
  createMysteryEncounter,
  completeMysteryConfrontation,
  getMysteryNpcDialogue,
} = require("./mysteryStory");
const { recordLeagueVictory } = require("./leagueStory");
const { createRecurringCharacterEngine } = require("./recurringCharacterEngine");
const {
  createGymStoryEvents,
  getGymStoryContext,
  getGymStorySummary,
} = require("./gymStory");
const {
  reorderParty,
  sendPartyPokemonToStorage,
} = require("./partyManager");
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
const wildLevelRanges = {
  default: { min: 1, max: 20 },
  legendary: { min: 50, max: 70 },
  mythical: { min: 60, max: 80 },
};

app.use(express.static("frontend"));
app.use("/assets", express.static(path.join(rootDir, "assets")));
app.use(
  "/vendor/three",
  express.static(path.join(rootDir, "node_modules", "three", "build")),
);
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
const legendaryRollChance = gameData.legendaryRollChance;
const shinyRollChance = gameData.shinyRollChance;
const formEncounterChance = gameData.formEncounterChance;
const speciesEncounterBoosts = gameData.speciesEncounterBoosts;
const weatherBoosts = gameData.weatherBoosts;
const recurringCharacterEngine = createRecurringCharacterEngine({
  characterData: gameData.characters,
  itemCatalog,
});
const storyEngine = createStoryEngine({
  storyData: {
    ...gameData.story,
    events: [
      ...(gameData.story.events || []),
      ...createGymStoryEvents(gyms),
    ],
  },
  itemCatalog,
  normalizeCharacters: recurringCharacterEngine.normalizeCharacterState,
});
const pokemonUtils = createPokemonUtils({
  pokemonPath,
  readJsonFile: loadJson,
  moveCatalog: gameData.moves,
  canonicalPokemon: gameData.canonicalPokemon,
  evolutionData: gameData.evolutions,
  obtainability: gameData.obtainability,
  speciesMap: gameData.speciesMap,
});
const {
  getStarterPokemon,
  getPokemonTemplates,
  getPokemonTemplateByName,
  getPokemonTypes,
  getPokemonSpeciesId,
  getPokemonVariantKey,
  getPokedexEvolutionGraph,
  applyPokemonForm,
  normalizeMove,
  normalizePokemon,
  restorePokemon,
  isPokemonOrEvolutionOf,
  getEvolutionFamilyKey,
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

function randomIntBetween(min, max) {
  const low = Math.ceil(min);
  const high = Math.floor(max);
  return Math.floor(Math.random() * (high - low + 1)) + low;
}

function getWildEncounterLevel(pokemon) {
  const rarity = pokemon?.rarity;
  const range = wildLevelRanges[rarity] || wildLevelRanges.default;
  return randomIntBetween(range.min, range.max);
}

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
  isPokemonOrEvolutionOf,
  getEvolutionFamilyKey,
  getPokemonVariantKey,
  resolvePokemonSpeciesId: getPokemonSpeciesId,
  normalizeStoryState: storyEngine.normalizeStoryState,
});
const {
  readJsonFile,
  writeJsonFile,
  loadTeamAndStorage,
  saveTeamAndStorage,
  uniqueNumbers,
  uniqueStrings,
  loadPlayerState,
  savePlayerState,
  markPokedexSeen,
  updateAchievements,
  getPartyPresetSlots,
  savePartyPreset,
  updatePartyPreset,
  randomizePartyPreset,
  loadPartyPreset,
} = gameState;

const battleEngine = createBattleEngine({ getRandomInt });
const {
  aiDifficulty,
  getMoveByName,
  executeBattleMove,
  applyEndOfTurnStatus,
  chooseBestMove,
  chooseGymMove,
  chooseGymAction,
  chooseTrainerAction,
  applyEntryAbility,
  ensureBattleState,
  rehydrateTransformation,
  resetSwitchState,
  executeUtilityTurn,
  resolveForcedSwitch,
  resolveTurnOrder,
} = battleEngine;

function applyBattleEntryAbilities(playerPokemon, opponentPokemon, log = []) {
  applyEntryAbility(playerPokemon, opponentPokemon, log);
  applyEntryAbility(opponentPokemon, playerPokemon, log);
  return log;
}

function hasImposter(pokemon) {
  return String(
    typeof pokemon?.ability === "string"
      ? pokemon.ability
      : pokemon?.ability?.name || "",
  ).toLowerCase() === "imposter";
}

const encounterEngine = createEncounterEngine({
  rarityWeights,
  legendaryRollChance,
  weatherBoosts,
  getPokemonTypes,
  formEncounterChance,
  speciesEncounterBoosts,
});
const { selectEncounter, getTimeOfDay } = encounterEngine;
const shinyRateOverride = Number(process.env.SHINY_RATE_OVERRIDE);
const SHINY_RATE = Number.isFinite(shinyRateOverride)
  ? Math.max(0, Math.min(1, shinyRateOverride))
  : shinyRollChance;

const evolutionEngine = createEvolutionEngine({
  evolutionData: gameData.evolutions,
  getPokemonSpeciesId,
  getPokemonTemplateBySpeciesId: pokemonUtils.getPokemonTemplateBySpeciesId,
  getPokemonFormDefinition: pokemonUtils.getPokemonFormDefinition,
});
const {
  getEvolutionOptions,
  getAvailableEvolutions,
  canEvolve,
} = evolutionEngine;

function applyBattleEndOfTurnStatus(playerPokemon, opponentPokemon, log, weather = "clear") {
  const effects = [];
  if (playerPokemon?.currentHp > 0) {
    const hpBefore = playerPokemon.currentHp;
    applyEndOfTurnStatus(playerPokemon, log, weather);
    if (playerPokemon.currentHp !== hpBefore) {
      effects.push({ side: "player", hpChange: playerPokemon.currentHp - hpBefore });
    }
  }
  if (opponentPokemon?.currentHp > 0) {
    const hpBefore = opponentPokemon.currentHp;
    applyEndOfTurnStatus(opponentPokemon, log, weather);
    if (opponentPokemon.currentHp !== hpBefore) {
      effects.push({ side: "opponent", hpChange: opponentPokemon.currentHp - hpBefore });
    }
  }
  return { weather, effects };
}

function executeOrderedMoveTurn({
  playerPokemon,
  opponentPokemon,
  playerMoveName,
  opponentMove,
  opponentLabel = "Opponent",
  opponentPrefix = "",
  battle,
  log,
}) {
  const playerMove = getMoveByName(playerPokemon, playerMoveName);
  if (!playerMove) return { error: "Move not found" };
  if ((playerMove.currentPp ?? 0) <= 0) {
    log.push("No PP left for this move!");
    return { error: "No PP left for this move" };
  }

  const actions = [
    { side: "player", type: "move", pokemon: playerPokemon, move: playerMove },
  ];
  if (opponentMove) {
    actions.push({
      side: "opponent",
      type: "move",
      pokemon: opponentPokemon,
      move: opponentMove,
    });
  }

  const orderedActions = resolveTurnOrder(actions);
  const metadata = { order: orderedActions.map((entry) => entry.side), turns: [] };
  for (const action of orderedActions) {
    const attacker = action.side === "player" ? playerPokemon : opponentPokemon;
    const defender = action.side === "player" ? opponentPokemon : playerPokemon;
    if (attacker.currentHp <= 0 || defender.currentHp <= 0) continue;
    if (action.side === "opponent") log.push(`${opponentLabel}'s turn:`);
    const result = executeBattleMove(
      attacker,
      defender,
      action.move.name,
      action.side === "player" ? opponentPrefix : "",
      { battle },
    );
    log.push(...result.log);
    metadata.turns.push({
      side: action.side,
      move: action.move.name,
      ...result.metadata,
    });
    if (action.side === "player" && result.error) {
      return { error: result.error, metadata };
    }
  }
  return { metadata };
}

function consumeBattleItem(itemId, pokemon) {
  const item = itemCatalog[itemId];
  if (!item || !["healing", "status"].includes(item.category)) {
    return { error: "That item cannot be used during battle" };
  }
  const state = loadPlayerState();
  if ((state.items[itemId] || 0) <= 0) {
    return { error: "You do not have that item" };
  }

  let message;
  if (item.category === "healing") {
    if (pokemon.currentHp >= pokemon.maxHp) {
      return { error: `${pokemon.name} is already healthy` };
    }
    const healed = Math.min(item.healAmount, pokemon.maxHp - pokemon.currentHp);
    pokemon.currentHp += healed;
    message = `${pokemon.name} recovered ${healed} HP.`;
  } else {
    if (!item.cures.includes(pokemon.status)) {
      return { error: `${item.name} does not help ${pokemon.name} right now` };
    }
    pokemon.status = "none";
    if (pokemon.battleState?.volatile) {
      delete pokemon.battleState.volatile.sleepTurns;
    }
    message = `${pokemon.name}'s status was cured.`;
  }

  state.items[itemId] -= 1;
  return { item, message, state: savePlayerState(state) };
}

const rewardEngine = createRewardEngine({
  normalizePokemon,
  getEvolutionOptions,
  getAvailableEvolutions,
  getPokemonTemplateByName,
  getPokemonFormDefinition: pokemonUtils.getPokemonFormDefinition,
  reconcileEvolutionMoves: pokemonUtils.reconcileEvolutionMoves,
  getTargetEvolutionMoves: pokemonUtils.getTargetEvolutionMoves,
  getTimeOfDay,
  updateAchievements,
});
const {
  awardCoins,
  calculateBattleXp,
  applyXpToPokemon,
  applyXpToParty,
  appendXpLog,
  performEvolution,
} = rewardEngine;

function calculateBattleEffortXp(opponentPokemon, battleMultiplier = 1) {
  return Math.max(
    1,
    Math.floor(calculateBattleXp(opponentPokemon, battleMultiplier) * 0.05),
  );
}

function applyBattleXpToParty(team, xpAward) {
  const transientStates = team.map((pokemon) =>
    pokemon.battleState
      ? JSON.parse(JSON.stringify(pokemon.battleState))
      : null,
  );
  const xpResult = applyXpToParty(team, xpAward);
  xpResult.team.forEach((pokemon, index) => {
    if (transientStates[index]) pokemon.battleState = transientStates[index];
  });
  return xpResult;
}

function applyBattleEffortXp(
  team,
  opponentPokemon,
  battleMultiplier,
  log,
) {
  if (!opponentPokemon || opponentPokemon.currentHp <= 0) {
    return { team, xpResult: null, xpAward: 0 };
  }
  const xpAward = calculateBattleEffortXp(opponentPokemon, battleMultiplier);
  const xpResult = applyBattleXpToParty(team, xpAward);
  appendXpLog(log, xpResult.results);
  return {
    team: xpResult.team,
    xpResult,
    xpAward,
  };
}

function getPokedexEntries(state) {
  const templates = getPokemonTemplates();
  const formsSeen = new Set(state.pokedex.formsSeen || []);
  const formsCaught = new Set(state.pokedex.formsCaught || []);
  const seenSpecies = new Set(state.pokedex.seen || []);
  const caughtSpecies = new Set(state.pokedex.caught || []);

  return templates
    .map((pokemon) => {
      const speciesId = getPokemonSpeciesId(pokemon);
      const graph = getPokedexEvolutionGraph(pokemon);
      const evolutionStages = graph.stages.map((stage) => ({
        ...stage,
        seen: seenSpecies.has(stage.speciesId),
        caught: caughtSpecies.has(stage.speciesId),
      }));
      const currentEvolutionStage = evolutionStages.find(
        (stage) => stage.speciesId === speciesId,
      );
      const previousEdge = graph.edges.find(
        (edge) => edge.toSpeciesId === speciesId,
      );
      const previousStage = previousEdge
        ? evolutionStages.find(
            (stage) => stage.speciesId === previousEdge.fromSpeciesId,
          )
        : null;
      const seen = seenSpecies.has(speciesId);
      const caught = caughtSpecies.has(speciesId);
      const variantPrefix = `${speciesId}:`;
      const hasSeenVariant = [...formsSeen].some((key) =>
        key.startsWith(variantPrefix),
      );
      const hasCaughtVariant = [...formsCaught].some((key) =>
        key.startsWith(variantPrefix),
      );
      const getFormStatus = (form = null) => {
        const normalKey = getPokemonVariantKey({
          ...pokemon,
          form,
          shiny: false,
        });
        const shinyKey = getPokemonVariantKey({
          ...pokemon,
          form,
          shiny: true,
        });
        const isNormalForm = !form;
        return {
          id: form?.id || "normal",
          name: form?.name || "Normal Form",
          category: form?.category || "normal",
          types: form?.types || getPokemonTypes(pokemon),
          imageId: form?.imageId || pokemon.imageId || pokemon.id,
          artwork: form?.artwork || (!form ? pokemon.artwork : null),
          habitats: form?.habitats || pokemon.habitats || [],
          seen:
            formsSeen.has(normalKey) ||
            (isNormalForm && seen && !hasSeenVariant),
          caught:
            formsCaught.has(normalKey) ||
            (isNormalForm && caught && !hasCaughtVariant),
          shinySeen: formsSeen.has(shinyKey),
          shinyCaught: formsCaught.has(shinyKey),
        };
      };
      return {
        id: pokemon.id,
        speciesId,
        imageId: pokemon.imageId || pokemon.id,
        name: pokemon.name,
        canonicalName: pokemon.canonicalName,
        artwork: pokemon.artwork,
        isLegendary: Boolean(pokemon.isLegendary),
        isMythical: Boolean(pokemon.isMythical),
        type: pokemon.type,
        types: getPokemonTypes(pokemon),
        rarity: pokemon.rarity || "common",
        habitats: pokemon.habitats || [],
        times: pokemon.times || ["day"],
        baseCatchRate: pokemon.baseCatchRate ?? null,
        hp: pokemon.hp ?? pokemon.maxHp ?? null,
        maxHp: pokemon.maxHp ?? pokemon.hp ?? null,
        attack: pokemon.attack ?? null,
        defense: pokemon.defense ?? null,
        specialAttack: pokemon.specialAttack ?? pokemon.attack ?? null,
        specialDefense: pokemon.specialDefense ?? pokemon.defense ?? null,
        speed: pokemon.speed ?? null,
        abilities: (pokemon.abilities || []).map((ability) => ({ ...ability })),
        moves: (pokemon.moves || []).map((move) => normalizeMove(move)),
        learnset: (pokemon.learnset || []).map((entry) => ({
          level: entry.level,
          move: typeof entry.move === "string" ? entry.move : entry.move?.name,
        })),
        learnsetVersionGroup: pokemon.learnsetVersionGroup || null,
        evolvesTo: currentEvolutionStage?.evolvesTo || null,
        evolveLevel: currentEvolutionStage?.evolveLevel || null,
        previousStage: previousStage
          ? {
              id: previousStage.id,
              speciesId: previousStage.speciesId,
              imageId: previousStage.imageId || previousStage.id,
              name: previousStage.name,
              artwork: previousStage.artwork,
            }
          : null,
        evolutionChain: evolutionStages,
        evolutionGraph: {
          chainId: graph.chainId,
          stages: evolutionStages,
          edges: graph.edges,
        },
        forms: [getFormStatus(), ...(pokemon.forms || []).map(getFormStatus)],
        seen,
        caught,
        availability: pokemon.availability || {
          status: "unavailable",
          areas: [],
          reason: "Availability has not been assigned",
        },
      };
    })
    .sort((a, b) => (a.speciesId ?? a.id) - (b.speciesId ?? b.id));
}

function getEvolutionOptionView(option) {
  const target = option.target || null;
  return {
    targetSpeciesId: option.targetSpeciesId,
    targetName: option.targetName,
    supported: option.supported,
    satisfied: option.satisfied,
    requirements: option.requirements || [],
    requirementOptions: option.requirementOptions || [],
    unsupportedRequirements: option.unsupportedRequirements || [],
    items: [
      ...new Set(
        (option.requirementOptions || [])
          .map((requirement) => requirement.item)
          .filter(Boolean),
      ),
    ],
    targetPokemon: target
      ? {
          id: target.id,
          speciesId: target.speciesId || option.targetSpeciesId,
          imageId: target.imageId || target.speciesId || option.targetSpeciesId,
          name: target.name || option.targetName,
          type: target.type,
          types: getPokemonTypes(target),
          artwork: target.artwork || null,
        }
      : {
          speciesId: option.targetSpeciesId,
          imageId: option.targetSpeciesId,
          name: option.targetName,
        },
  };
}

function addEvolutionOptions(pokemon) {
  return {
    ...pokemon,
    evolutionOptions: getEvolutionOptions(pokemon, {
      timeOfDay: getTimeOfDay(),
    }).map(getEvolutionOptionView),
  };
}

function markOwnedPokemonCaught(state, pokemon) {
  const speciesId = getPokemonSpeciesId(pokemon);
  if (!speciesId) return state;
  state.pokedex.seen = uniqueNumbers([...state.pokedex.seen, speciesId]);
  state.pokedex.caught = uniqueNumbers([...state.pokedex.caught, speciesId]);
  const variantKey = getPokemonVariantKey(pokemon);
  state.pokedex.formsSeen = uniqueStrings([
    ...(state.pokedex.formsSeen || []),
    variantKey,
  ]);
  state.pokedex.formsCaught = uniqueStrings([
    ...(state.pokedex.formsCaught || []),
    variantKey,
  ]);
  updateAchievements(state);
  return state;
}

function markOwnedTeamCaught(state, team) {
  (team || []).forEach((pokemon) => markOwnedPokemonCaught(state, pokemon));
  return state;
}

function getGymById(gymId) {
  const normalizedId = legacyGymMap[gymId] || Number(gymId);
  return gyms.find((gym) => gym.id === normalizedId);
}

function getNpcById(npcId, state = loadPlayerState()) {
  return (
    npcs.find((npc) => npc.id === Number(npcId)) ||
    recurringCharacterEngine.getNpcById(state, npcId)
  );
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
    dialogue:
      state.championDefeated && npc.championDialogue
        ? npc.championDialogue
        : getMysteryNpcDialogue(npc, state),
    introDialogue: npc.introDialogue || npc.dialogue,
    defeated,
    rewardCoins: npc.type === "trainer" ? getNpcRewardCoins(npc) : 0,
    itemReward: npc.itemReward || null,
    team: npc.type === "trainer" ? npc.team || [] : [],
    role: npc.role || null,
    title: npc.title || null,
    characterId: npc.characterId || null,
    encounterId: npc.encounterId || null,
    recurringCharacter: Boolean(npc.recurringCharacter),
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
  if (!session) return;
  session.aiItems = {};
  if (session.ppPrepared) return;
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
    weather: session.weather || "clear",
    turnMetadata: session.lastTurn || null,
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
      story: getGymStorySummary(session.gym),
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
    weather: session.weather || "clear",
    turnMetadata: session.lastTurn || null,
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
      story: session.currentTrainer.story || null,
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
    weather: session.weather || "clear",
    turnMetadata: session.lastTurn || null,
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
  let recurringResult = null;
  if (session.npc.recurringCharacter) {
    recurringResult = recurringCharacterEngine.recordBattleResult(
      state,
      session.npc.encounterId,
      "won",
    );
    log.push(`You defeated rival ${session.npc.name}!`);
    if (recurringResult.reward?.coins) {
      log.push(`You earned ${recurringResult.reward.coins} coins.`);
    }
    (recurringResult.reward?.items || []).forEach((item) => {
      log.push(`${session.npc.name} gave you ${item.name} x${item.quantity}.`);
    });
  } else if (!isTrainerDefeated(state, session.npc.id)) {
    state.defeatedNpcs = [...(state.defeatedNpcs || []), session.npc.id];
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
  markOwnedTeamCaught(state, session.playerTeam);
  activeNpcSessions.delete("player");
  const savedState = savePlayerState(state);
  return {
    success: true,
    won: true,
    log,
    state: savedState,
    npc: getNpcView(session.npc, savedState),
    session: getNpcSessionView(session),
    storyEvents: recurringResult?.storyEvents || [],
  };
}

function finishNpcLoss(session, log = []) {
  session.status = "lost";
  persistBattlePlayerTeam(session);
  activeNpcSessions.delete("player");
  log.push(`${session.npc.name} won the battle. Come back after you heal up.`);
  const state = loadPlayerState();
  const recurringResult = session.npc.recurringCharacter
    ? recurringCharacterEngine.recordBattleResult(
        state,
        session.npc.encounterId,
        "lost",
      )
    : null;
  const savedState = recurringResult ? savePlayerState(state) : state;
  return {
    success: false,
    lost: true,
    log,
    state: savedState,
    npc: getNpcView(session.npc, savedState),
    session: getNpcSessionView(session),
    storyEvents: recurringResult?.storyEvents || [],
  };
}

function completeGymSession(session, log = []) {
  const state = loadPlayerState();
  const firstVictory = !state.badges.includes(session.gym.badge);
  if (firstVictory) {
    state.badges.push(session.gym.badge);
    awardCoins(state, session.gym.rewardCoins);
    log.push(`You earned the ${session.gym.badge}!`);
    log.push(`You earned ${session.gym.rewardCoins} coins.`);
  } else {
    log.push(`${session.gym.badge} already earned.`);
  }
  session.status = "won";
  persistGymPlayerTeam(session);
  markOwnedTeamCaught(state, session.playerTeam);
  activeGymSessions.delete("player");
  const savedState = savePlayerState(state);
  return {
    success: true,
    won: true,
    log,
    state: savedState,
    storyEvents: firstVictory
      ? storyEngine.getEligibleEvents(savedState, "badge-earned", {
          badge: session.gym.badge,
        })
      : [],
    session: getGymSessionView(session),
  };
}

function finishGymLoss(session, log = []) {
  session.status = "lost";
  persistGymPlayerTeam(session);
  activeGymSessions.delete("player");
  log.push("You lost the gym battle. Heal up and try again.");
  return {
    success: false,
    lost: true,
    log,
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
  session.aiItems = {};
}

function appendEliteTrainerEntrance(session, log) {
  const story = session.currentTrainer.story || {};
  log.push(`${session.currentTrainer.name} entered the arena!`);
  if (story.introDialogue) log.push(story.introDialogue);
  if (story.battleLine) log.push(story.battleLine);
}

function appendEliteTrainerVictoryLine(session, log) {
  const line = session.currentTrainer.story?.postVictoryLine;
  if (line) log.push(`${session.currentTrainer.name}: ${line}`);
}

function completeEliteSession(session, log = []) {
  const state = loadPlayerState();
  const hasChampionBadge = state.badges.includes(champion.badge);
  const firstVictory = !state.championDefeated && !hasChampionBadge;
  appendEliteTrainerVictoryLine(session, log);
  if (firstVictory) {
    state.badges.push(champion.badge);
    state.championDefeated = true;
    awardCoins(state, champion.rewardCoins);
    log.push(`You earned the ${champion.badge}!`);
    log.push(`You earned ${champion.rewardCoins} coins.`);
  } else {
    if (!hasChampionBadge) state.badges.push(champion.badge);
    state.championDefeated = true;
    log.push(`${champion.badge} already earned.`);
  }
  session.status = "won";
  persistBattlePlayerTeam(session);
  markOwnedTeamCaught(state, session.playerTeam);
  activeEliteSessions.delete("player");
  const leagueResult = recordLeagueVictory(state, session.playerTeam, {
    firstVictory,
  });
  const savedState = savePlayerState(leagueResult.state);
  return {
    success: true,
    won: true,
    completed: true,
    log,
    state: savedState,
    session: getEliteSessionView(session),
    hallOfFame: leagueResult.hallOfFame,
    storyEvents: firstVictory
      ? storyEngine.getEligibleEvents(savedState, "league-complete")
      : [],
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

function replaceFaintedPlayer(session, log) {
  const faintedPokemon = session.playerTeam[session.playerIndex];
  if (!faintedPokemon || faintedPokemon.currentHp > 0) return { replaced: false };
  log.push(`${faintedPokemon.name} fainted!`);
  const nextIndex = resolveForcedSwitch(session.playerTeam);
  if (nextIndex < 0) return { replaced: false, lost: true };
  session.playerIndex = nextIndex;
  session.participantIndexes = [
    ...new Set([...(session.participantIndexes || []), nextIndex]),
  ];
  log.push(`Go, ${session.playerTeam[nextIndex].name}!`);
  return { replaced: true, nextIndex };
}

function advanceGymOpponent(session, faintedPokemon, log) {
  if (!faintedPokemon || faintedPokemon.currentHp > 0) return null;
  const xpAward = calculateBattleXp(faintedPokemon, 3.25);
  const xpResult = applyBattleXpToParty(session.playerTeam, xpAward);
  session.playerTeam = xpResult.team;
  log.push(`Gym ${faintedPokemon.name} fainted!`);
  appendXpLog(log, xpResult.results);
  session.participantIndexes = [session.playerIndex];
  session.gymIndex += 1;
  if (session.gymIndex >= session.gymTeam.length) {
    return completeGymSession(session, log);
  }
  const nextOpponent = session.gymTeam[session.gymIndex];
  resetSwitchState(nextOpponent);
  log.push(`${session.gym.name} sent out ${nextOpponent.name}!`);
  applyEntryAbility(nextOpponent, session.playerTeam[session.playerIndex], log);
  persistGymPlayerTeam(session);
  return {
    success: true,
    log,
    session: getGymSessionView(session),
  };
}

function advanceNpcOpponent(session, faintedPokemon, log) {
  if (!faintedPokemon || faintedPokemon.currentHp > 0) return null;
  const xpAward = calculateBattleXp(faintedPokemon, 2.75);
  const xpResult = applyBattleXpToParty(session.playerTeam, xpAward);
  session.playerTeam = xpResult.team;
  log.push(`${session.npc.name}'s ${faintedPokemon.name} fainted!`);
  appendXpLog(log, xpResult.results);
  session.participantIndexes = [session.playerIndex];
  session.opponentIndex = getFirstHealthyPokemonIndex(session.opponentTeam);
  if (session.opponentIndex < 0) return completeNpcBattle(session, log);
  const nextOpponent = session.opponentTeam[session.opponentIndex];
  resetSwitchState(nextOpponent);
  log.push(`${session.npc.name} sent out ${nextOpponent.name}!`);
  applyEntryAbility(nextOpponent, session.playerTeam[session.playerIndex], log);
  persistBattlePlayerTeam(session);
  return {
    success: true,
    log,
    session: getNpcSessionView(session),
  };
}

function advanceEliteOpponent(session, faintedPokemon, log) {
  if (!faintedPokemon || faintedPokemon.currentHp > 0) return null;
  const xpAward = calculateBattleXp(
    faintedPokemon,
    session.isChampion ? 4.5 : 4,
  );
  const xpResult = applyBattleXpToParty(session.playerTeam, xpAward);
  session.playerTeam = xpResult.team;
  log.push(`${faintedPokemon.name} fainted!`);
  appendXpLog(log, xpResult.results);
  session.participantIndexes = [session.playerIndex];
  session.opponentIndex = getFirstHealthyPokemonIndex(session.opponentTeam);
  if (session.opponentIndex < 0) {
    if (session.isChampion) {
      log.push(`${champion.name} has been defeated!`);
      return completeEliteSession(session, log);
    }
    appendEliteTrainerVictoryLine(session, log);
    session.stageIndex += 1;
    refreshEliteStage(session);
    appendEliteTrainerEntrance(session, log);
    if (session.isChampion) {
      log.push(`${champion.name} awaits as the final battle!`);
    } else {
      log.push(`Elite Four progress: ${session.stageIndex}/${eliteFour.length}`);
    }
    const nextOpponent = session.opponentTeam[session.opponentIndex];
    resetSwitchState(nextOpponent);
    log.push(`${session.currentTrainer.name} sent out ${nextOpponent.name}!`);
    applyEntryAbility(nextOpponent, session.playerTeam[session.playerIndex], log);
    persistBattlePlayerTeam(session);
    return {
      success: true,
      stageCleared: true,
      log,
      session: getEliteSessionView(session),
    };
  }
  const nextOpponent = session.opponentTeam[session.opponentIndex];
  resetSwitchState(nextOpponent);
  log.push(`${session.currentTrainer.name} sent out ${nextOpponent.name}!`);
  applyEntryAbility(nextOpponent, session.playerTeam[session.playerIndex], log);
  persistBattlePlayerTeam(session);
  return {
    success: true,
    log,
    session: getEliteSessionView(session),
  };
}

function finishTrainerUtilityTurn({
  session,
  playerPokemon,
  opponentPokemon,
  log,
  battleMultiplier,
  advanceOpponent,
  finishLoss,
  persist,
  getSessionView,
}) {
  session.lastTurn.endOfTurn = applyBattleEndOfTurnStatus(
    playerPokemon,
    opponentPokemon,
    log,
    session.weather,
  );

  const replacement = replaceFaintedPlayer(session, log);
  if (replacement.lost) return finishLoss(session, log);

  const opponentResult = advanceOpponent(session, opponentPokemon, log);
  if (opponentResult) return opponentResult;

  const effortResult = applyBattleEffortXp(
    session.playerTeam,
    opponentPokemon,
    battleMultiplier,
    log,
  );
  session.playerTeam = effortResult.team;
  persist(session);
  return {
    success: true,
    log,
    session: getSessionView(session),
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

app.get("/api/story", (req, res) => {
  const state = loadPlayerState();
  res.json({
    ...storyEngine.getStorySnapshot(state),
    events: [
      ...storyEngine.getEligibleEvents(state, "resume"),
      ...recurringCharacterEngine.getPendingScenes(state),
    ],
  });
});

app.post("/api/story/trigger", (req, res) => {
  const trigger = String(req.body?.trigger || "");
  const supportedTriggers = new Set([
    "startup",
    "resume",
    "area-enter",
    "badge-earned",
    "gym-challenge",
    "mystery-progress",
    "league-entry",
  ]);
  if (!supportedTriggers.has(trigger)) {
    return res.status(400).json({ error: "Unknown story trigger" });
  }
  const state = loadPlayerState();
  const context = {
    area: req.body?.context?.area
      ? String(req.body.context.area).toLowerCase()
      : null,
    badge: req.body?.context?.badge
      ? String(req.body.context.badge)
      : null,
    gymId: req.body?.context?.gymId
      ? Number(req.body.context.gymId)
      : null,
  };
  if (trigger === "area-enter") {
    if (!areas.some((area) => area.id === context.area)) {
      return res.status(400).json({ error: "Unknown story area" });
    }
    if (!(state.unlockedAreas || []).includes(context.area)) {
      return res.status(403).json({ error: "That area is still locked" });
    }
  }
  if (trigger === "gym-challenge" && !getGymById(context.gymId)) {
    return res.status(400).json({ error: "Unknown story gym" });
  }
  return res.json({
    success: true,
    events: [
      ...storyEngine.getEligibleEvents(state, trigger, context),
      ...(trigger === "resume"
        ? recurringCharacterEngine.getPendingScenes(state)
        : []),
    ],
    story: storyEngine.getStorySnapshot(state),
  });
});

app.post("/api/story/complete", (req, res) => {
  const state = loadPlayerState();
  const context = {
    area: req.body?.context?.area
      ? String(req.body.context.area).toLowerCase()
      : null,
    badge: req.body?.context?.badge
      ? String(req.body.context.badge)
      : null,
    gymId: req.body?.context?.gymId
      ? Number(req.body.context.gymId)
      : null,
  };
  const eventId = req.body?.eventId;
  const result = storyEngine.hasEvent(eventId)
    ? storyEngine.completeEvent(state, eventId, context)
    : recurringCharacterEngine.hasScene(eventId)
      ? recurringCharacterEngine.completeScene(state, eventId)
      : { error: "Unknown story event" };
  if (result.error) return res.status(400).json(result);
  const savedState = savePlayerState(result.state);
  return res.json({
    success: true,
    alreadyCompleted: result.alreadyCompleted,
    event: result.event,
    reward: result.reward,
    state: savedState,
    story: storyEngine.getStorySnapshot(savedState),
    nextAction: result.nextAction || null,
    followUpTrigger: result.event?.followUpTrigger || null,
  });
});

app.post("/api/story/legendary/start", (req, res) => {
  if (req.body?.encounterId !== MYSTERY_ENCOUNTER_ID) {
    return res.status(400).json({ error: "Unknown story encounter" });
  }
  if (activeNpcSessions.get("player")?.status === "active") {
    return res.status(400).json({ error: "Finish your trainer battle first" });
  }
  if (activeGymSessions.get("player")?.status === "active") {
    return res.status(400).json({ error: "Finish your gym battle first" });
  }
  if (activeEliteSessions.get("player")?.status === "active") {
    return res.status(400).json({ error: "Finish your Elite Four run first" });
  }
  const { team } = loadTeamAndStorage();
  if (!team.some((pokemon) => pokemon.currentHp > 0)) {
    return res
      .status(400)
      .json({ error: "Heal your party before the final approach." });
  }
  const state = loadPlayerState();
  const result = createMysteryEncounter({
    state,
    getPokemonTemplateByName,
    createLeveledPokemon,
  });
  if (result.error) return res.status(409).json(result);
  markPokedexSeen(result.pokemon.speciesId, result.pokemon);
  return res.json(result.pokemon);
});

app.get("/api/handbook", (req, res) => {
  res.json(createHandbookData(gameData.moves));
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
      story: getGymStorySummary(gym),
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
    hallOfFame: state.league?.hallOfFame || null,
    completionCount: state.league?.completionCount || 0,
    session: progress ? getEliteSessionView(progress) : null,
    stages: [
      ...eliteFour.map((trainer, index) => ({
        id: trainer.id,
        name: trainer.name,
        type: trainer.type,
        team: trainer.team,
        story: trainer.story || null,
        unlocked,
        progress:
          progress?.status === "active" && progress.stageIndex === index,
      })),
      {
        id: champion.id,
        name: champion.name,
        type: champion.type,
        team: champion.team,
        story: champion.story || null,
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
  const storyContext = getGymStoryContext(gym);
  const storyEvents = storyEngine.getEligibleEvents(
    state,
    "gym-challenge",
    storyContext,
  );
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
    aiItems: {},
    ppPrepared: true,
    status: "active",
    weather: "clear",
  };
  activeGymSessions.set("player", session);

  const log = [
    `${gym.leaderName} of the ${gym.name} challenged you!`,
    "Catching and running are disabled in gym battles.",
  ];
  applyBattleEntryAbilities(
    session.playerTeam[session.playerIndex],
    session.gymTeam[session.gymIndex],
    log,
  );

  res.json({
    success: true,
    log,
    session: getGymSessionView(session),
    storyEvents,
    storyContext,
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
    aiItems: {},
    weather: "clear",
  };
  refreshEliteStage(session);
  activeEliteSessions.set("player", session);

  const log = [
    "The Elite Four challenge begins.",
    "No healing between battles. Catching and running are disabled.",
  ];
  appendEliteTrainerEntrance(session, log);
  applyBattleEntryAbilities(
    session.playerTeam[session.playerIndex],
    session.opponentTeam[session.opponentIndex],
    log,
  );

  res.json({
    success: true,
    log,
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
    if (nextIndex === session.playerIndex) {
      return res.status(400).json({ error: "That Pokemon is already active" });
    }
    if (session.playerTeam[nextIndex].currentHp <= 0) {
      return res
        .status(400)
        .json({ error: "Cannot switch to a fainted Pokemon" });
    }
    resetSwitchState(session.playerTeam[session.playerIndex]);
    resetSwitchState(session.playerTeam[nextIndex]);
    session.playerIndex = nextIndex;
    session.lastTurn = {
      order: ["player"],
      turns: [{ side: "player", action: "switch" }],
    };
    session.participantIndexes = [
      ...new Set([...(session.participantIndexes || []), nextIndex]),
    ];
    log.push(`Go, ${session.playerTeam[nextIndex].name}!`);
    applyEntryAbility(
      session.playerTeam[nextIndex],
      session.gymTeam[session.gymIndex],
      log,
    );
    const playerPokemon = session.playerTeam[nextIndex];
    const gymPokemon = session.gymTeam[session.gymIndex];
    const gymMove = chooseGymMove(
      gymPokemon,
      playerPokemon,
      session.weather,
    );
    session.lastTurn = executeUtilityTurn({
      actionType: "switch",
      playerPokemon,
      opponentPokemon: gymPokemon,
      opponentMove: gymMove,
      opponentLabel: session.gym.leaderName,
      battle: session,
      log,
    }).metadata;
    return res.json(
      finishTrainerUtilityTurn({
        session,
        playerPokemon,
        opponentPokemon: gymPokemon,
        log,
        battleMultiplier: 3.25,
        advanceOpponent: advanceGymOpponent,
        finishLoss: finishGymLoss,
        persist: persistGymPlayerTeam,
        getSessionView: getGymSessionView,
      }),
    );
  }

  const playerPokemon = session.playerTeam[session.playerIndex];
  const gymPokemon = session.gymTeam[session.gymIndex];
  if (!playerPokemon || playerPokemon.currentHp <= 0) {
    return res.status(400).json({ error: "Choose a healthy Pokemon first" });
  }
  if (!gymPokemon) {
    return res.json(completeGymSession(session, ["Gym battle complete."]));
  }

  if (action === "item") {
    const hpBeforeItem = playerPokemon.currentHp;
    const itemResult = consumeBattleItem(req.body.itemId, playerPokemon);
    if (itemResult.error) return res.status(400).json({ error: itemResult.error });
    log.push(itemResult.message);
    const gymMove = chooseGymMove(
      gymPokemon,
      playerPokemon,
      session.weather,
    );
    session.lastTurn = executeUtilityTurn({
      actionType: "item",
      playerPokemon,
      opponentPokemon: gymPokemon,
      opponentMove: gymMove,
      opponentLabel: session.gym.leaderName,
      battle: session,
      log,
      playerActionMetadata: {
        itemId: req.body.itemId,
        hpChange: playerPokemon.currentHp - hpBeforeItem,
      },
    }).metadata;
    const payload = finishTrainerUtilityTurn({
      session,
      playerPokemon,
      opponentPokemon: gymPokemon,
      log,
      battleMultiplier: 3.25,
      advanceOpponent: advanceGymOpponent,
      finishLoss: finishGymLoss,
      persist: persistGymPlayerTeam,
      getSessionView: getGymSessionView,
    });
    payload.state = itemResult.state;
    return res.json(payload);
  }

  const selectedMove = getMoveByName(playerPokemon, moveName);
  if (!selectedMove || (selectedMove.currentPp ?? 0) <= 0) {
    if (selectedMove) log.push("No PP left for this move!");
    return res.status(400).json({
      error: selectedMove ? "No PP left for this move" : "Move not found",
      log,
      session: getGymSessionView(session),
    });
  }

  const gymAction = chooseGymAction(session, playerPokemon) || { type: "none" };
  let activeGymPokemon = gymPokemon;
  let gymMove = gymAction.move || null;
  if (gymAction.type === "switch") {
    const outgoing = session.gymTeam[session.gymIndex];
    const incoming = session.gymTeam[gymAction.index];
    if (incoming && outgoing) {
      resetSwitchState(outgoing);
      resetSwitchState(incoming);
      incoming.battleState.volatile.switchCooldown = 2;
      session.gymTeam[gymAction.index] = outgoing;
      session.gymTeam[session.gymIndex] = incoming;
      activeGymPokemon = incoming;
      gymMove = null;
      log.push(
        `${session.gym.leaderName} withdrew ${outgoing.name} and sent out ${incoming.name}!`,
      );
      applyEntryAbility(incoming, playerPokemon, log);
    }
  }
  if (!gymMove && gymAction.type !== "switch") {
    gymMove = (activeGymPokemon.moves || []).find(
      (move) => (move.currentPp ?? 0) > 0,
    );
  }

  const orderedTurn = executeOrderedMoveTurn({
    playerPokemon,
    opponentPokemon: activeGymPokemon,
    playerMoveName: moveName,
    opponentMove: gymMove,
    opponentLabel: session.gym.leaderName,
    opponentPrefix: "Gym ",
    battle: session,
    log,
  });
  session.lastTurn = orderedTurn.metadata;
  if (orderedTurn.error) {
    return res.status(400).json({
      error: orderedTurn.error,
      log,
      session: getGymSessionView(session),
    });
  }

  if (activeGymPokemon.currentHp <= 0) {
    const xpAward = calculateBattleXp(activeGymPokemon, 3.25);
    const xpResult = applyBattleXpToParty(session.playerTeam, xpAward);
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
    applyEntryAbility(
      session.gymTeam[session.gymIndex],
      session.playerTeam[session.playerIndex],
      log,
    );
    persistGymPlayerTeam(session);
    return res.json({
      success: true,
      log,
      session: getGymSessionView(session),
    });
  }

  session.lastTurn.endOfTurn = applyBattleEndOfTurnStatus(
    playerPokemon,
    activeGymPokemon,
    log,
    session.weather,
  );

  if (activeGymPokemon?.currentHp <= 0) {
    const xpAward = calculateBattleXp(activeGymPokemon, 3.25);
    const xpResult = applyBattleXpToParty(session.playerTeam, xpAward);
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
    applyEntryAbility(
      session.gymTeam[session.gymIndex],
      session.playerTeam[session.playerIndex],
      log,
    );
    persistGymPlayerTeam(session);
    return res.json({
      success: true,
      log,
      session: getGymSessionView(session),
    });
  }

  const effortResult = applyBattleEffortXp(
    session.playerTeam,
    activeGymPokemon,
    3.25,
    log,
  );
  session.playerTeam = effortResult.team;

  const replacement = replaceFaintedPlayer(session, log);
  if (replacement.lost) return res.json(finishGymLoss(session, log));

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
    if (nextIndex === session.playerIndex) {
      return res.status(400).json({ error: "That Pokemon is already active" });
    }
    if (session.playerTeam[nextIndex].currentHp <= 0) {
      return res
        .status(400)
        .json({ error: "Cannot switch to a fainted Pokemon" });
    }
    resetSwitchState(session.playerTeam[session.playerIndex]);
    resetSwitchState(session.playerTeam[nextIndex]);
    session.playerIndex = nextIndex;
    session.lastTurn = {
      order: ["player"],
      turns: [{ side: "player", action: "switch" }],
    };
    session.participantIndexes = [
      ...new Set([...(session.participantIndexes || []), nextIndex]),
    ];
    log.push(`Go, ${session.playerTeam[nextIndex].name}!`);
    applyEntryAbility(
      session.playerTeam[nextIndex],
      session.opponentTeam[session.opponentIndex],
      log,
    );
    const playerPokemon = session.playerTeam[nextIndex];
    const opponentPokemon = session.opponentTeam[session.opponentIndex];
    const opponentMove = chooseGymMove(
      opponentPokemon,
      playerPokemon,
      session.weather,
    );
    session.lastTurn = executeUtilityTurn({
      actionType: "switch",
      playerPokemon,
      opponentPokemon,
      opponentMove,
      opponentLabel: session.currentTrainer.name,
      battle: session,
      log,
    }).metadata;
    return res.json(
      finishTrainerUtilityTurn({
        session,
        playerPokemon,
        opponentPokemon,
        log,
        battleMultiplier: session.isChampion ? 4.5 : 4,
        advanceOpponent: advanceEliteOpponent,
        finishLoss: finishEliteLoss,
        persist: persistBattlePlayerTeam,
        getSessionView: getEliteSessionView,
      }),
    );
  }

  const playerPokemon = session.playerTeam[session.playerIndex];
  const opponentPokemon = session.opponentTeam[session.opponentIndex];
  if (!playerPokemon || playerPokemon.currentHp <= 0) {
    return res.status(400).json({ error: "Choose a healthy Pokemon first" });
  }
  if (!opponentPokemon) {
    return res.status(400).json({ error: "Elite battle is already finished" });
  }

  if (action === "item") {
    const hpBeforeItem = playerPokemon.currentHp;
    const itemResult = consumeBattleItem(req.body.itemId, playerPokemon);
    if (itemResult.error) return res.status(400).json({ error: itemResult.error });
    log.push(itemResult.message);
    const opponentMove = chooseGymMove(
      opponentPokemon,
      playerPokemon,
      session.weather,
    );
    session.lastTurn = executeUtilityTurn({
      actionType: "item",
      playerPokemon,
      opponentPokemon,
      opponentMove,
      opponentLabel: session.currentTrainer.name,
      battle: session,
      log,
      playerActionMetadata: {
        itemId: req.body.itemId,
        hpChange: playerPokemon.currentHp - hpBeforeItem,
      },
    }).metadata;
    const payload = finishTrainerUtilityTurn({
      session,
      playerPokemon,
      opponentPokemon,
      log,
      battleMultiplier: session.isChampion ? 4.5 : 4,
      advanceOpponent: advanceEliteOpponent,
      finishLoss: finishEliteLoss,
      persist: persistBattlePlayerTeam,
      getSessionView: getEliteSessionView,
    });
    payload.state = itemResult.state;
    return res.json(payload);
  }

  const selectedMove = getMoveByName(playerPokemon, moveName);
  if (!selectedMove || (selectedMove.currentPp ?? 0) <= 0) {
    if (selectedMove) log.push("No PP left for this move!");
    return res.status(400).json({
      error: selectedMove ? "No PP left for this move" : "Move not found",
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
    aiDifficulty.HARD,
    session.weather,
  );
  let activeOpponentPokemon = opponentPokemon;
  let opponentMove = eliteAction.move || null;
  if (eliteAction.type === "switch") {
    const incoming = session.opponentTeam[eliteAction.index];
    if (incoming) {
      resetSwitchState(opponentPokemon);
      resetSwitchState(incoming);
      incoming.battleState.volatile.switchCooldown = 2;
      session.opponentTeam[eliteAction.index] = opponentPokemon;
      session.opponentTeam[session.opponentIndex] = incoming;
      activeOpponentPokemon = incoming;
      opponentMove = null;
      log.push(`${session.currentTrainer.name} switched to ${incoming.name}!`);
      applyEntryAbility(incoming, playerPokemon, log);
    }
  } else if (eliteAction.type === "item") {
    const healed = Math.min(
      50,
      opponentPokemon.maxHp - opponentPokemon.currentHp,
    );
    opponentPokemon.currentHp += healed;
    session.aiItems.potion -= 1;
    opponentMove = null;
    log.push(
      `${session.currentTrainer.name} used a Potion. ${opponentPokemon.name} recovered ${healed} HP.`,
    );
  } else if (!opponentMove) {
    opponentMove = (activeOpponentPokemon.moves || []).find(
      (move) => (move.currentPp ?? 0) > 0,
    );
  }

  const orderedTurn = executeOrderedMoveTurn({
    playerPokemon,
    opponentPokemon: activeOpponentPokemon,
    playerMoveName: moveName,
    opponentMove,
    opponentLabel: session.currentTrainer.name,
    opponentPrefix: "Elite ",
    battle: session,
    log,
  });
  session.lastTurn = orderedTurn.metadata;
  if (orderedTurn.error) {
    return res.status(400).json({
      error: orderedTurn.error,
      log,
      session: getEliteSessionView(session),
    });
  }

  if (activeOpponentPokemon.currentHp <= 0) {
    const xpAward = calculateBattleXp(activeOpponentPokemon, session.isChampion ? 4.5 : 4);
    const xpResult = applyBattleXpToParty(session.playerTeam, xpAward);
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

      appendEliteTrainerVictoryLine(session, log);
      session.stageIndex += 1;
      refreshEliteStage(session);
      appendEliteTrainerEntrance(session, log);
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
      applyEntryAbility(
        session.opponentTeam[session.opponentIndex],
        session.playerTeam[session.playerIndex],
        log,
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
    applyEntryAbility(
      session.opponentTeam[session.opponentIndex],
      session.playerTeam[session.playerIndex],
      log,
    );
    persistBattlePlayerTeam(session);
    return res.json({
      success: true,
      log,
      session: getEliteSessionView(session),
    });
  }

  session.lastTurn.endOfTurn = applyBattleEndOfTurnStatus(
    playerPokemon,
    activeOpponentPokemon,
    log,
    session.weather,
  );

  if (activeOpponentPokemon?.currentHp <= 0) {
    const xpAward = calculateBattleXp(
      activeOpponentPokemon,
      session.isChampion ? 4.5 : 4,
    );
    const xpResult = applyBattleXpToParty(session.playerTeam, xpAward);
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

      appendEliteTrainerVictoryLine(session, log);
      session.stageIndex += 1;
      refreshEliteStage(session);
      appendEliteTrainerEntrance(session, log);
      if (session.isChampion) {
        log.push(`${champion.name} awaits as the final battle!`);
      } else {
        log.push(`Elite Four progress: ${session.stageIndex}/${eliteFour.length}`);
      }
      log.push(
        `${session.currentTrainer.name} sent out ${session.opponentTeam[session.opponentIndex].name}!`,
      );
      applyEntryAbility(
        session.opponentTeam[session.opponentIndex],
        session.playerTeam[session.playerIndex],
        log,
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
    applyEntryAbility(
      session.opponentTeam[session.opponentIndex],
      session.playerTeam[session.playerIndex],
      log,
    );
    persistBattlePlayerTeam(session);
    return res.json({
      success: true,
      log,
      session: getEliteSessionView(session),
    });
  }

  const eliteEffortResult = applyBattleEffortXp(
    session.playerTeam,
    activeOpponentPokemon,
    session.isChampion ? 4.5 : 4,
    log,
  );
  session.playerTeam = eliteEffortResult.team;

  const replacement = replaceFaintedPlayer(session, log);
  if (replacement.lost) return res.json(finishEliteLoss(session, log));

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
  const {
    itemId,
    pokemonIndex,
    section = "team",
    targetSpeciesId = null,
  } = req.body;
  const item = itemCatalog[itemId];
  if (!item || !["healing", "status", "evolution"].includes(item.category)) {
    return res.status(400).json({ error: "That item cannot be used here" });
  }

  const state = loadPlayerState();
  if ((state.items[itemId] || 0) <= 0) {
    return res.status(400).json({ error: "You do not have that item" });
  }

  const { team, storage } = loadTeamAndStorage();
  const list = section === "storage" ? storage : team;
  const index = Number(pokemonIndex);
  if (!Number.isInteger(index) || index < 0 || index >= list.length) {
    return res.status(400).json({ error: "Invalid Pokemon index" });
  }

  let pokemon = normalizePokemon(list[index]);
  let message = "";
  let evolution = null;
  if (item.category === "healing") {
    if (pokemon.currentHp >= pokemon.maxHp) {
      return res
        .status(400)
        .json({ error: `${pokemon.name} is already healthy` });
    }
    const healed = Math.min(item.healAmount, pokemon.maxHp - pokemon.currentHp);
    pokemon.currentHp += healed;
    message = `${pokemon.name} recovered ${healed} HP.`;
  } else if (item.category === "status") {
    if (!item.cures.includes(pokemon.status)) {
      return res.status(400).json({
        error: `${item.name} does not help ${pokemon.name} right now`,
      });
    }
    pokemon.status = "none";
    message = `${pokemon.name}'s status was cured.`;
  } else {
    const context = {
      trigger: "use-item",
      item: item.evolutionItem,
      timeOfDay: getTimeOfDay(),
      targetSpeciesId,
    };
    const assessment = canEvolve(pokemon, context);
    const matchingItemOptions = assessment.options.filter((option) =>
      (option.requirementOptions || []).some(
        (requirement) => requirement.item === item.evolutionItem,
      ),
    );
    if (!assessment.canEvolve) {
      if (matchingItemOptions.length) {
        const unavailable = [
          ...new Set(
            matchingItemOptions.flatMap(
              (option) => option.unsupportedRequirements || [],
            ),
          ),
        ];
        const unmet = [
          ...new Set(
            matchingItemOptions.flatMap((option) =>
              (option.requirementOptions || [])
                .filter(
                  (requirement) =>
                    requirement.item === item.evolutionItem &&
                    requirement.supported,
                )
                .flatMap((requirement) =>
                  (requirement.checks || [])
                    .filter((check) => !check.satisfied)
                    .map((check) => check.label),
                ),
            ),
          ),
        ];
        const requirements = [...unavailable, ...unmet];
        return res.status(400).json({
          error: `${pokemon.name} cannot use ${item.name} yet${requirements.length ? `: ${requirements.join(", ")}` : ""}.`,
        });
      }
      return res.status(400).json({
        error: `${item.name} cannot evolve ${pokemon.name}.`,
      });
    }

    evolution = performEvolution(pokemon, context);
    if (evolution.requiresChoice) {
      return res.status(409).json({
        error: evolution.message,
        requiresEvolutionChoice: true,
        options: evolution.options,
      });
    }
    if (!evolution.evolved) {
      return res.status(400).json({ error: evolution.message });
    }
    pokemon = evolution.pokemon;
    message = evolution.message;
    markOwnedPokemonCaught(state, pokemon);
  }

  state.items[itemId] -= 1;
  list[index] = pokemon;
  saveTeamAndStorage(team, storage);
  res.json({
    success: true,
    message,
    inventory: team,
    team,
    storage,
    state: savePlayerState(state),
    evolved: Boolean(evolution?.evolved),
    evolvedFrom: evolution?.evolvedFrom || null,
    evolvedTo: evolution?.evolvedTo || null,
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
    npcs: [
      ...npcs.filter((npc) => npc.area === area),
      ...recurringCharacterEngine.getAreaNpcs(state, area),
    ].map((npc) => getNpcView(npc, state)),
  });
});

app.post("/api/npc/interact", (req, res) => {
  const { npcId, beginBattle = false } = req.body;
  const state = loadPlayerState();
  const npc = getNpcById(npcId, state);
  if (!npc) {
    return res.status(404).json({ error: "NPC not found" });
  }
  const activeNpcSession = activeNpcSessions.get("player");
  if (
    activeNpcSession?.status === "active" &&
    activeNpcSession.npc?.id === npc.id
  ) {
    return res.json({
      success: true,
      action: "battle",
      dialogue: `Your battle with ${npc.name} is still in progress.`,
      log: [`Battle with ${npc.name} resumed.`],
      npc: getNpcView(npc, loadPlayerState()),
      session: getNpcSessionView(activeNpcSession),
      resumed: true,
    });
  }
  if (activeNpcSession?.status === "active") {
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

  const npcView = getNpcView(npc, state);
  if (npc.type === "trainer") {
    const introScene = npc.recurringCharacter
      ? recurringCharacterEngine.getIntroScene(state, npc.encounterId)
      : null;
    if (introScene && !beginBattle) {
      return res.json({
        success: true,
        action: "story",
        npc: npcView,
        event: introScene,
      });
    }
    if (introScene && beginBattle) {
      return res.status(409).json({ error: "Finish the rival introduction first" });
    }
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
        potion: npc.recurringCharacter
          ? 0
          : npc.team && npc.team.length > 1
            ? 1
            : 0,
      },
      aiDifficulty: npc.aiDifficulty || "MEDIUM",
      status: "active",
      weather: "clear",
    };
    activeNpcSessions.set("player", session);

    const log = [
      npc.introDialogue || `${npc.name} wants to battle!`,
      `${npc.name} sent out ${session.opponentTeam[0].name}!`,
      "Trainer battles do not allow catching or running.",
    ];
    applyBattleEntryAbilities(
      session.playerTeam[session.playerIndex],
      session.opponentTeam[session.opponentIndex],
      log,
    );

    return res.json({
      success: true,
      action: "battle",
      dialogue: npc.introDialogue || "Let's battle!",
      log,
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
    if (nextIndex === session.playerIndex) {
      return res.status(400).json({ error: "That Pokemon is already active" });
    }
    if (session.playerTeam[nextIndex].currentHp <= 0) {
      return res
        .status(400)
        .json({ error: "Cannot switch to a fainted Pokemon" });
    }
    resetSwitchState(session.playerTeam[session.playerIndex]);
    resetSwitchState(session.playerTeam[nextIndex]);
    session.playerIndex = nextIndex;
    session.lastTurn = {
      order: ["player"],
      turns: [{ side: "player", action: "switch" }],
    };
    session.participantIndexes = [
      ...new Set([...(session.participantIndexes || []), nextIndex]),
    ];
    log.push(`Go, ${session.playerTeam[nextIndex].name}!`);
    applyEntryAbility(
      session.playerTeam[nextIndex],
      session.opponentTeam[session.opponentIndex],
      log,
    );
    const playerPokemon = session.playerTeam[nextIndex];
    const opponentPokemon = session.opponentTeam[session.opponentIndex];
    const opponentMove = chooseBestMove(
      opponentPokemon,
      playerPokemon,
      session.weather,
    );
    session.lastTurn = executeUtilityTurn({
      actionType: "switch",
      playerPokemon,
      opponentPokemon,
      opponentMove,
      opponentLabel: session.npc.name,
      battle: session,
      log,
    }).metadata;
    return res.json(
      finishTrainerUtilityTurn({
        session,
        playerPokemon,
        opponentPokemon,
        log,
        battleMultiplier: 2.75,
        advanceOpponent: advanceNpcOpponent,
        finishLoss: finishNpcLoss,
        persist: persistBattlePlayerTeam,
        getSessionView: getNpcSessionView,
      }),
    );
  }

  const playerPokemon = session.playerTeam[session.playerIndex];
  const opponentPokemon = session.opponentTeam[session.opponentIndex];
  if (!playerPokemon || playerPokemon.currentHp <= 0) {
    return res.status(400).json({ error: "Choose a healthy Pokemon first" });
  }
  if (!opponentPokemon) {
    return res.status(400).json({ error: "NPC battle is already finished" });
  }

  if (action === "item") {
    const hpBeforeItem = playerPokemon.currentHp;
    const itemResult = consumeBattleItem(req.body.itemId, playerPokemon);
    if (itemResult.error) return res.status(400).json({ error: itemResult.error });
    log.push(itemResult.message);
    const opponentMove = chooseBestMove(
      opponentPokemon,
      playerPokemon,
      session.weather,
    );
    session.lastTurn = executeUtilityTurn({
      actionType: "item",
      playerPokemon,
      opponentPokemon,
      opponentMove,
      opponentLabel: session.npc.name,
      battle: session,
      log,
      playerActionMetadata: {
        itemId: req.body.itemId,
        hpChange: playerPokemon.currentHp - hpBeforeItem,
      },
    }).metadata;
    const payload = finishTrainerUtilityTurn({
      session,
      playerPokemon,
      opponentPokemon,
      log,
      battleMultiplier: 2.75,
      advanceOpponent: advanceNpcOpponent,
      finishLoss: finishNpcLoss,
      persist: persistBattlePlayerTeam,
      getSessionView: getNpcSessionView,
    });
    payload.state = itemResult.state;
    return res.json(payload);
  }

  const selectedMove = getMoveByName(playerPokemon, moveName);
  if (!selectedMove || (selectedMove.currentPp ?? 0) <= 0) {
    if (selectedMove) log.push("No PP left for this move!");
    return res.status(400).json({
      error: selectedMove ? "No PP left for this move" : "Move not found",
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
    aiDifficulty[session.aiDifficulty] || aiDifficulty.MEDIUM,
    session.weather,
  );
  let activeNpcPokemon = opponentPokemon;
  let opponentMove = npcAction.move || null;
  if (npcAction.type === "switch") {
    const incoming = session.opponentTeam[npcAction.index];
    if (incoming) {
      resetSwitchState(opponentPokemon);
      resetSwitchState(incoming);
      incoming.battleState.volatile.switchCooldown = 2;
      session.opponentTeam[npcAction.index] = opponentPokemon;
      session.opponentTeam[session.opponentIndex] = incoming;
      activeNpcPokemon = incoming;
      opponentMove = null;
      log.push(`${session.npc.name} switched to ${incoming.name}!`);
      applyEntryAbility(incoming, playerPokemon, log);
    }
  } else if (npcAction.type === "item") {
    const healed = Math.min(
      50,
      opponentPokemon.maxHp - opponentPokemon.currentHp,
    );
    opponentPokemon.currentHp += healed;
    session.aiItems.potion -= 1;
    opponentMove = null;
    log.push(
      `${session.npc.name} used a Potion. ${opponentPokemon.name} recovered ${healed} HP.`,
    );
  } else if (!opponentMove) {
    opponentMove = (activeNpcPokemon.moves || []).find(
      (move) => (move.currentPp ?? 0) > 0,
    );
  }

  const orderedTurn = executeOrderedMoveTurn({
    playerPokemon,
    opponentPokemon: activeNpcPokemon,
    playerMoveName: moveName,
    opponentMove,
    opponentLabel: session.npc.name,
    opponentPrefix: `${session.npc.name}'s `,
    battle: session,
    log,
  });
  session.lastTurn = orderedTurn.metadata;
  if (orderedTurn.error) {
    return res.status(400).json({
      error: orderedTurn.error,
      log,
      session: getNpcSessionView(session),
    });
  }

  if (activeNpcPokemon.currentHp <= 0) {
    const xpAward = calculateBattleXp(activeNpcPokemon, 2.75);
    const xpResult = applyBattleXpToParty(session.playerTeam, xpAward);
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
    applyEntryAbility(
      session.opponentTeam[session.opponentIndex],
      session.playerTeam[session.playerIndex],
      log,
    );
    persistBattlePlayerTeam(session);
    return res.json({
      success: true,
      log,
      session: getNpcSessionView(session),
    });
  }

  session.lastTurn.endOfTurn = applyBattleEndOfTurnStatus(
    playerPokemon,
    activeNpcPokemon,
    log,
    session.weather,
  );

  if (activeNpcPokemon?.currentHp <= 0) {
    const xpAward = calculateBattleXp(activeNpcPokemon, 2.75);
    const xpResult = applyBattleXpToParty(session.playerTeam, xpAward);
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
    applyEntryAbility(
      session.opponentTeam[session.opponentIndex],
      session.playerTeam[session.playerIndex],
      log,
    );
    persistBattlePlayerTeam(session);
    return res.json({
      success: true,
      log,
      session: getNpcSessionView(session),
    });
  }

  const npcEffortResult = applyBattleEffortXp(
    session.playerTeam,
    activeNpcPokemon,
    2.75,
    log,
  );
  session.playerTeam = npcEffortResult.team;

  const replacement = replaceFaintedPlayer(session, log);
  if (replacement.lost) return res.json(finishNpcLoss(session, log));

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
  const selectedArea = String(area).toLowerCase();
  if (!areas.some((entry) => entry.id === selectedArea)) {
    return res.status(400).json({ error: "Valid area is required" });
  }
  if (activeNpcSessions.get("player")?.status === "active") {
    return res.status(400).json({ error: "Finish your trainer battle first" });
  }
  if (activeGymSessions.get("player")?.status === "active") {
    return res.status(400).json({ error: "Finish your gym battle first" });
  }
  if (activeEliteSessions.get("player")?.status === "active") {
    return res
      .status(400)
      .json({ error: "Finish your Elite Four run first" });
  }

  try {
    const allPokemon = getPokemonTemplates();
    const { pokemon, form, weather, metadata } = selectEncounter(
      allPokemon,
      selectedArea,
    );
    if (!pokemon) {
      return res.status(404).json({ error: "No Pokemon available for this area" });
    }
    const encounterLevel = getWildEncounterLevel(pokemon);
    const baseEncounter = createLeveledPokemon(pokemon.name, encounterLevel);
    const encountered = form
      ? applyPokemonForm(baseEncounter, form.id)
      : baseEncounter;
    const shiny = Math.random() < SHINY_RATE;
    const encounterData = {
      ...encountered,
      currentHp: encountered.maxHp || encountered.hp,
      area: selectedArea,
      level: encounterLevel,
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
    markPokedexSeen(encounterData.speciesId, encounterData);
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
    playerBattleState = null,
    action = "move",
    itemId = null,
    outgoingPokemonIndex = null,
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
    if (playerBattleState && typeof playerBattleState === "object") {
      playerPokemon.battleState = JSON.parse(JSON.stringify(playerBattleState));
      ensureBattleState(playerPokemon);
      rehydrateTransformation(playerPokemon);
    }
    const incomingWildBattleState = wild?.battleState;
    const wildPokemon = normalizePokemon(wild || {});
    if (incomingWildBattleState && typeof incomingWildBattleState === "object") {
      wildPokemon.battleState = JSON.parse(JSON.stringify(incomingWildBattleState));
      ensureBattleState(wildPokemon);
      rehydrateTransformation(wildPokemon);
    }
    if (!wildPokemon.id) {
      return res.status(400).json({ error: "Wild Pokémon is required" });
    }

    playerPokemon.currentHp = Math.max(0, playerHP);
    wildPokemon.currentHp = Math.max(0, wildHP);
    playerPokemon.status = playerStatus;
    wildPokemon.status = wildStatus;
    let winner = null;
    const log = [];
    let itemState = null;

    const playerState = ensureBattleState(playerPokemon);
    const opponentState = ensureBattleState(wildPokemon);
    const playerWasTransformed = Boolean(playerState.transform?.active);
    if (action === "switch" || action === "forced-switch") {
      resetSwitchState(playerPokemon);
      if (hasImposter(playerPokemon)) {
        applyEntryAbility(playerPokemon, wildPokemon, log);
      }
      playerPokemon.battleState.entryAbilityApplied = true;
    } else if (!playerState.entryAbilityApplied || !opponentState.entryAbilityApplied) {
      if (hasImposter(playerPokemon)) {
        applyEntryAbility(playerPokemon, wildPokemon, log);
      }
      if (hasImposter(wildPokemon)) {
        applyEntryAbility(wildPokemon, playerPokemon, log);
      }
      playerPokemon.battleState.entryAbilityApplied = true;
      wildPokemon.battleState.entryAbilityApplied = true;
    }
    const playerAutoTransformed =
      !playerWasTransformed &&
      playerPokemon.battleState?.transform?.source === "imposter";

    const availableMoves = wildPokemon.moves.filter((m) => m.currentPp > 0);
    const wildMove =
      chooseBestMove(wildPokemon, playerPokemon, wildPokemon.weather) ||
      availableMoves[Math.floor(Math.random() * availableMoves.length)];
    let orderedTurn;
    if (action === "switch" || action === "forced-switch") {
      const previousIndex = Number(outgoingPokemonIndex);
      if (
        Number.isInteger(previousIndex) &&
        previousIndex >= 0 &&
        previousIndex < inventory.length &&
        previousIndex !== playerIndex
      ) {
        resetSwitchState(inventory[previousIndex]);
      }
      log.push(`Go, ${playerPokemon.name}!`);
      orderedTurn = executeUtilityTurn({
        actionType: action,
        playerPokemon,
        opponentPokemon: wildPokemon,
        opponentMove: action === "forced-switch" ? null : wildMove,
        opponentLabel: `Wild ${wildPokemon.name}`,
        battle: wildPokemon,
        log,
      });
    } else if (action === "item") {
      const hpBeforeItem = playerPokemon.currentHp;
      const itemResult = consumeBattleItem(itemId, playerPokemon);
      if (itemResult.error) {
        return res.status(400).json({ error: itemResult.error, log });
      }
      itemState = itemResult.state;
      log.push(itemResult.message);
      orderedTurn = executeUtilityTurn({
        actionType: "item",
        playerPokemon,
        opponentPokemon: wildPokemon,
        opponentMove: wildMove,
        opponentLabel: `Wild ${wildPokemon.name}`,
        battle: wildPokemon,
        log,
        playerActionMetadata: {
          itemId,
          hpChange: playerPokemon.currentHp - hpBeforeItem,
        },
      });
    } else if (
      playerAutoTransformed &&
      !getMoveByName(playerPokemon, moveName)
    ) {
      orderedTurn = {
        metadata: {
          order: [],
          turns: [],
          entryOnly: true,
          transformation: {
            side: "player",
            ...playerPokemon.battleState.transform,
          },
        },
      };
    } else {
      orderedTurn = executeOrderedMoveTurn({
        playerPokemon,
        opponentPokemon: wildPokemon,
        playerMoveName: moveName,
        opponentMove: wildMove,
        opponentLabel: `Wild ${wildPokemon.name}`,
        opponentPrefix: "Wild ",
        battle: wildPokemon,
        log,
      });
    }
    if (orderedTurn.error) {
      return res.status(400).json({ error: orderedTurn.error, log });
    }

    if (action === "forced-switch") {
      inventory[playerIndex] = playerPokemon;
      saveTeamAndStorage(inventory, storage);
      return res.json({
        playerHP: playerPokemon.currentHp,
        wildHP: wildPokemon.currentHp,
        winner: null,
        log,
        playerStatus: playerPokemon.status,
        wildStatus: wildPokemon.status,
        moneyReward: 0,
        xpAward: 0,
        xpResult: null,
        playerMoves: playerPokemon.moves,
        playerPokemon,
        wild: wildPokemon,
        turnMetadata: orderedTurn.metadata,
        state: null,
      });
    }

    if (wildPokemon.currentHp <= 0) {
      winner = "player";
      log.push(`Wild ${wildPokemon.name} fainted!`);
    } else if (availableMoves.length === 0) {
      winner = "player";
      log.push(`Wild ${wildPokemon.name} has no moves left!`);
    }

    if (!winner && action !== "forced-switch" && !orderedTurn.metadata.entryOnly) {
      orderedTurn.metadata.endOfTurn = applyBattleEndOfTurnStatus(
        playerPokemon,
        wildPokemon,
        log,
        wildPokemon.weather,
      );
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
    let storyEvents = [];
    if (winner === "player") {
      moneyReward = getRandomInt(
        coinRewards.wildBattleMin,
        coinRewards.wildBattleMax,
      );
      let state = loadPlayerState();
      awardCoins(state, moneyReward);
      const mysteryResult = completeMysteryConfrontation({
        state,
        pokemon: wildPokemon,
        storyEngine,
      });
      state = mysteryResult.state;
      storyEvents = mysteryResult.events;
      savePlayerState(state);
      log.push(`You earned ${moneyReward} coins.`);
    }

    inventory[playerIndex] = playerPokemon;
    let xpResult = null;
    let xpAward = 0;
    if (winner === "player") {
      xpAward = calculateBattleXp(wildPokemon, 2.5);
      xpResult = applyXpToParty(inventory, xpAward);
      inventory = xpResult.team;
      appendXpLog(log, xpResult.results);
    } else {
      const effort = applyBattleEffortXp(
        inventory,
        wildPokemon,
        2.5,
        log,
      );
      inventory = effort.team;
      xpResult = effort.xpResult;
      xpAward = effort.xpAward;
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
      turnMetadata: orderedTurn.metadata,
      state: itemState,
      storyEvents,
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
    const wildPokemon =
      req.body.pokemon && req.body.pokemon.id === id ? req.body.pokemon : null;
    const target = normalizePokemon(
      wildPokemon || pokemon.find((p) => p.id === id) || {},
    );
    if (!target.id) {
      return res.status(404).json({ error: "Pokemon not found" });
    }
    const targetVariant = {
      ...target,
      shiny: Boolean(req.body.shiny ?? target.shiny),
    };

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
        shiny: targetVariant.shiny,
        status: "none",
        moves: target.moves.map((m) => ({
          ...m,
          currentPp: m.currentPp ?? m.maxPp ?? m.pp,
        })),
      };
      delete caughtPokemon.storyEncounter;
      const catchDestination =
        team.length < teamLimit ? "your team" : "storage";
      if (team.length < teamLimit) {
        team.push(caughtPokemon);
      } else {
        storage.push(caughtPokemon);
      }
      const caughtSpeciesId = getPokemonSpeciesId(caughtPokemon);
      state.pokedex.seen = uniqueNumbers([
        ...state.pokedex.seen,
        caughtSpeciesId,
      ]);
      state.pokedex.caught = uniqueNumbers([
        ...state.pokedex.caught,
        caughtSpeciesId,
      ]);
      const variantKey = getPokemonVariantKey(caughtPokemon);
      state.pokedex.formsSeen = uniqueStrings([
        ...(state.pokedex.formsSeen || []),
        variantKey,
      ]);
      state.pokedex.formsCaught = uniqueStrings([
        ...(state.pokedex.formsCaught || []),
        variantKey,
      ]);
      awardCoins(state, coinRewards.catch);

      const mysteryResult = completeMysteryConfrontation({
        state,
        pokemon: target,
        storyEngine,
      });
      saveTeamAndStorage(team, storage);
      savePlayerState(mysteryResult.state);
      return res.json({
        success: true,
        message: `Caught ${target.name}! Sent to ${catchDestination}. Earned ${coinRewards.catch} coins.`,
        pokemon: caughtPokemon,
        catchRate: Math.round(catchProbability * 100),
        state: mysteryResult.state,
        destination: catchDestination,
        storyEvents: mysteryResult.events,
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
    const { team, storage } = loadTeamAndStorage();
    res.json({
      team: team.map(addEvolutionOptions),
      storage: storage.map(addEvolutionOptions),
      partyPresets: getPartyPresetSlots(),
    });
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

app.post("/api/evolve", (req, res) => {
  const { section = "team", pokemonIndex, targetSpeciesId } = req.body;

  try {
    const { team, storage } = loadTeamAndStorage();
    const list = section === "storage" ? storage : team;
    const index = Number(pokemonIndex);
    const requestedTarget = Number(targetSpeciesId);
    if (!Number.isInteger(index) || index < 0 || index >= list.length) {
      return res.status(400).json({ error: "Invalid Pokemon index" });
    }
    if (!Number.isInteger(requestedTarget)) {
      return res.status(400).json({ error: "Choose an evolution target" });
    }

    const pokemon = normalizePokemon(list[index]);
    const pendingOptions = pokemon.pendingEvolution?.options || [];
    if (
      pokemon.pendingEvolution?.trigger !== "level-up" ||
      !pendingOptions.some(
        (option) => Number(option.targetSpeciesId) === requestedTarget,
      )
    ) {
      return res.status(400).json({ error: "That evolution is not pending" });
    }

    const result = performEvolution(pokemon, {
      trigger: "level-up",
      timeOfDay: pokemon.pendingEvolution.timeOfDay || getTimeOfDay(),
      targetSpeciesId: requestedTarget,
    });
    if (!result.evolved) {
      return res.status(400).json({ error: result.message });
    }

    list[index] = result.pokemon;
    saveTeamAndStorage(team, storage);
    const state = markOwnedPokemonCaught(loadPlayerState(), result.pokemon);
    savePlayerState(state);
    return res.json({
      success: true,
      message: result.message,
      pokemon: result.pokemon,
      team,
      storage,
      evolved: true,
      evolvedFrom: result.evolvedFrom,
      evolvedTo: result.evolvedTo,
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to evolve Pokemon" });
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

app.post("/api/party/reorder", (req, res) => {
  if (
    activeNpcSessions.get("player")?.status === "active" ||
    activeGymSessions.get("player")?.status === "active" ||
    activeEliteSessions.get("player")?.status === "active"
  ) {
    return res.status(400).json({ error: "Finish the current battle before reordering your party." });
  }
  try {
    const { team, storage } = loadTeamAndStorage();
    const result = reorderParty(team, req.body?.fromIndex, req.body?.toIndex);
    if (result.error) return res.status(400).json(result);
    saveTeamAndStorage(result.team, storage);
    return res.json({
      success: true,
      message: `${result.team[req.body.toIndex].name} moved to party slot ${req.body.toIndex + 1}.`,
      team: result.team,
      storage,
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to reorder party" });
  }
});

app.post("/api/party/send-to-storage", (req, res) => {
  if (
    activeNpcSessions.get("player")?.status === "active" ||
    activeGymSessions.get("player")?.status === "active" ||
    activeEliteSessions.get("player")?.status === "active"
  ) {
    return res.status(400).json({ error: "Finish the current battle before editing your party." });
  }
  try {
    const { team, storage } = loadTeamAndStorage();
    const result = sendPartyPokemonToStorage(team, storage, req.body?.teamIndex);
    if (result.error) return res.status(400).json(result);
    saveTeamAndStorage(result.team, result.storage);
    return res.json({
      success: true,
      message: `${result.pokemon.name} was sent to PC Storage.`,
      team: result.team,
      storage: result.storage,
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to move Pokemon to storage" });
  }
});

app.post("/api/party/randomize", (req, res) => {
  if (
    activeNpcSessions.get("player")?.status === "active" ||
    activeGymSessions.get("player")?.status === "active" ||
    activeEliteSessions.get("player")?.status === "active"
  ) {
    return res.status(400).json({
      error: "Finish the current battle before editing a party slot.",
    });
  }

  try {
    const result = randomizePartyPreset(req.body?.slot);
    return result.error ? res.status(400).json(result) : res.json(result);
  } catch (error) {
    return res.status(500).json({ error: "Failed to randomize the party slot" });
  }
});

app.post("/api/party-presets/save", (req, res) => {
  if (
    activeNpcSessions.get("player")?.status === "active" ||
    activeGymSessions.get("player")?.status === "active" ||
    activeEliteSessions.get("player")?.status === "active"
  ) {
    return res.status(400).json({
      error: "Finish the current battle before saving a party slot.",
    });
  }
  const result = savePartyPreset(req.body?.slot);
  return result.error ? res.status(400).json(result) : res.json(result);
});

app.post("/api/party-presets/update", (req, res) => {
  if (
    activeNpcSessions.get("player")?.status === "active" ||
    activeGymSessions.get("player")?.status === "active" ||
    activeEliteSessions.get("player")?.status === "active"
  ) {
    return res.status(400).json({
      error: "Finish the current battle before editing a party slot.",
    });
  }
  const result = updatePartyPreset(req.body?.slot, req.body);
  return result.error ? res.status(400).json(result) : res.json(result);
});

app.post("/api/party-presets/load", (req, res) => {
  if (
    activeNpcSessions.get("player")?.status === "active" ||
    activeGymSessions.get("player")?.status === "active" ||
    activeEliteSessions.get("player")?.status === "active"
  ) {
    return res.status(400).json({
      error: "Finish the current battle before loading a party slot.",
    });
  }
  const result = loadPartyPreset(req.body?.slot);
  return result.error ? res.status(400).json(result) : res.json(result);
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
