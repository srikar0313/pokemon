const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();
const port = process.env.PORT || 3000;
const rootDir = path.join(__dirname, "..");
const inventoryPath = path.join(rootDir, "inventory.json");
const storagePath = path.join(rootDir, "storage.json");
const pokemonPath = path.join(rootDir, "pokemon.json");
const playerStatePath = path.join(rootDir, "player_state.json");
const teamLimit = 7;
const coinRewards = {
  wildBattleMin: 300,
  wildBattleMax: 600,
  catch: 250,
};

app.use(express.static("frontend"));
app.use("/assets", express.static(path.join(rootDir, "assets")));
app.use(express.json());

const rarityWeights = {
  common: 60,
  uncommon: 25,
  rare: 10,
  legendary: 3,
  mythical: 2,
};

const weatherBoosts = {
  Fire: ["sunny"],
  Water: ["rain"],
  Electric: ["rain"],
  Ice: ["snow"],
  Rock: ["sandstorm"],
  Ground: ["sandstorm"],
  Grass: ["rain", "sunny"],
};

const ballRates = {
  standard: 1.0,
  great: 1.5,
  ultra: 2.0,
  master: 4.0,
};

const itemCatalog = {
  standard: {
    name: "Poke Ball",
    category: "ball",
    price: 20,
    icon: "standard",
    description: "A basic ball for catching wild Pokemon.",
  },
  great: {
    name: "Great Ball",
    category: "ball",
    price: 50,
    icon: "great",
    description: "A better ball with improved catch odds.",
  },
  ultra: {
    name: "Ultra Ball",
    category: "ball",
    price: 100,
    icon: "ultra",
    description: "A high-performance ball for tough catches.",
  },
  potion: {
    name: "Potion",
    category: "healing",
    price: 30,
    icon: "potion",
    healAmount: 50,
    description: "Restores 50 HP.",
  },
  superPotion: {
    name: "Super Potion",
    category: "healing",
    price: 700,
    icon: "potion",
    healAmount: 50,
    description: "Restores 50 HP.",
  },
  antidote: {
    name: "Antidote",
    category: "status",
    price: 100,
    icon: "poisoned",
    cures: ["poisoned", "badpoison"],
    description: "Cures poison.",
  },
  paralyzeHeal: {
    name: "Paralyze Heal",
    category: "status",
    price: 200,
    icon: "paralyzed",
    cures: ["paralyzed"],
    description: "Cures paralysis.",
  },
  burnHeal: {
    name: "Burn Heal",
    category: "status",
    price: 250,
    icon: "burned",
    cures: ["burned"],
    description: "Cures burns.",
  },
  iceHeal: {
    name: "Ice Heal",
    category: "status",
    price: 250,
    icon: "frozen",
    cures: ["frozen"],
    description: "Cures freeze.",
  },
  awakening: {
    name: "Awakening",
    category: "status",
    price: 250,
    icon: "asleep",
    cures: ["asleep"],
    description: "Wakes a sleeping Pokemon.",
  },
  fullHeal: {
    name: "Full Heal",
    category: "status",
    price: 600,
    icon: "potion",
    cures: [
      "asleep",
      "frozen",
      "paralyzed",
      "burned",
      "poisoned",
      "badpoison",
      "confused",
    ],
    description: "Cures any major status condition.",
  },
};

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
  defeatedNpcs: [],
  achievements: [],
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

const gyms = [
  {
    id: 1,
    name: "Volt Gym",
    leaderName: "Spark",
    city: "Volt City",
    type: "Electric",
    difficulty: 1,
    rewardCoins: 1500,
    badge: "Volt Badge",
    team: [
      { name: "Pichu", level: 10 },
      { name: "Pikachu", level: 12 },
      { name: "Voltorb", level: 14 },
    ],
  },
  {
    id: 2,
    name: "Aqua Gym",
    leaderName: "Mistyra",
    city: "Aqua Harbor",
    type: "Water",
    difficulty: 2,
    rewardCoins: 2500,
    badge: "Aqua Badge",
    team: [
      { name: "Squirtle", level: 16 },
      { name: "Psyduck", level: 18 },
      { name: "Lapras", level: 20 },
    ],
  },
  {
    id: 3,
    name: "Blaze Gym",
    leaderName: "Flint",
    city: "Blaze Town",
    type: "Fire",
    difficulty: 3,
    rewardCoins: 4000,
    badge: "Blaze Badge",
    team: [
      { name: "Charmander", level: 20 },
      { name: "Cyndaquil", level: 21 },
      { name: "Growlithe", level: 22 },
    ],
  },
  {
    id: 4,
    name: "Forest Gym",
    leaderName: "Verdia",
    city: "Verdant Grove",
    type: "Grass",
    difficulty: 4,
    rewardCoins: 5000,
    badge: "Forest Badge",
    team: [
      { name: "Bulbasaur", level: 24 },
      { name: "Bellsprout", level: 25 },
      { name: "Chikorita", level: 26 },
    ],
  },
  {
    id: 5,
    name: "Storm Gym",
    leaderName: "Zephyr",
    city: "Storm Peak",
    type: "Flying",
    difficulty: 5,
    rewardCoins: 6000,
    badge: "Storm Badge",
    team: [
      { name: "Spearow", level: 28 },
      { name: "Scyther", level: 30 },
      { name: "Pidgeot", level: 32 },
    ],
  },
  {
    id: 6,
    name: "Rock Gym",
    leaderName: "Garnet",
    city: "Garnet Ridge",
    type: "Rock",
    difficulty: 6,
    rewardCoins: 7000,
    badge: "Rock Badge",
    team: [
      { name: "Geodude", level: 34 },
      { name: "Onix", level: 36 },
      { name: "Cubone", level: 38 },
    ],
  },
  {
    id: 7,
    name: "Psychic Gym",
    leaderName: "Lunara",
    city: "Moonveil City",
    type: "Psychic",
    difficulty: 7,
    rewardCoins: 8000,
    badge: "Psychic Badge",
    team: [
      { name: "Girafarig", level: 40 },
      { name: "Mew", level: 42 },
      { name: "Mewtwo", level: 44 },
    ],
  },
  {
    id: 8,
    name: "Ice Gym",
    leaderName: "Glacius",
    city: "Glacier Bay",
    type: "Ice",
    difficulty: 8,
    rewardCoins: 9000,
    badge: "Ice Badge",
    team: [
      { name: "Sneasel", level: 46 },
      { name: "Lapras", level: 48 },
      { name: "Snorlax", level: 50 },
    ],
  },
];

const eliteFour = [
  {
    id: 1,
    name: "Noctis",
    type: "Dark",
    team: [
      { name: "Sneasel", level: 40 },
      { name: "Gengar", level: 45 },
    ],
  },
  {
    id: 2,
    name: "Pyra",
    type: "Fire",
    team: [
      { name: "Growlithe", level: 45 },
      { name: "Charizard", level: 50 },
    ],
  },
  {
    id: 3,
    name: "Marinus",
    type: "Water",
    team: [
      { name: "Lapras", level: 48 },
      { name: "Blastoise", level: 52 },
    ],
  },
  {
    id: 4,
    name: "Drakon",
    type: "Dragon",
    team: [
      { name: "Dratini", level: 50 },
      { name: "Dragonite", level: 55 },
    ],
  },
];

const champion = {
  id: 5,
  name: "Champion Aurelius",
  type: "Legendary",
  badge: "Champion Badge",
  rewardCoins: 1000,
  team: [
    { name: "Mewtwo", level: 60 },
    { name: "Rayquaza", level: 62 },
    { name: "Mew", level: 64 },
  ],
};

const eliteBossTemplates = [
  {
    id: 6,
    name: "Charizard",
    type: "Fire",
    types: ["Fire", "Flying"],
    rarity: "legendary",
    hp: 78,
    maxHp: 78,
    attack: 84,
    defense: 78,
    specialAttack: 109,
    specialDefense: 85,
    moves: [
      { name: "Flamethrower", type: "Fire", category: "Special", power: 90, accuracy: 100, pp: 15, maxPp: 15, effect: { type: "status", status: "burned", chance: 10 } },
      { name: "Air Slash", type: "Flying", category: "Special", power: 75, accuracy: 95, pp: 15, maxPp: 15 },
      { name: "Dragon Breath", type: "Dragon", category: "Special", power: 60, accuracy: 100, pp: 20, maxPp: 20, effect: { type: "status", status: "paralyzed", chance: 30 } },
      { name: "Slash", type: "Normal", category: "Physical", power: 70, accuracy: 100, pp: 20, maxPp: 20, effect: { type: "criticalBoost", chance: 20 } },
    ],
  },
  {
    id: 9,
    name: "Blastoise",
    type: "Water",
    types: ["Water"],
    rarity: "legendary",
    hp: 79,
    maxHp: 79,
    attack: 83,
    defense: 100,
    specialAttack: 85,
    specialDefense: 105,
    moves: [
      { name: "Water Pulse", type: "Water", category: "Special", power: 60, accuracy: 100, pp: 20, maxPp: 20, effect: { type: "status", status: "confused", chance: 20 } },
      { name: "Bite", type: "Dark", category: "Physical", power: 60, accuracy: 100, pp: 25, maxPp: 25 },
      { name: "Ice Beam", type: "Ice", category: "Special", power: 90, accuracy: 100, pp: 10, maxPp: 10, effect: { type: "status", status: "frozen", chance: 10 } },
      { name: "Protect", type: "Normal", category: "Status", power: 0, accuracy: 100, pp: 10, maxPp: 10, effect: { type: "statChange", target: "self", stat: "defense", stages: 1, chance: 100 } },
    ],
  },
  {
    id: 94,
    name: "Gengar",
    type: "Ghost",
    types: ["Ghost", "Poison"],
    rarity: "legendary",
    hp: 60,
    maxHp: 60,
    attack: 65,
    defense: 60,
    specialAttack: 130,
    specialDefense: 75,
    moves: [
      { name: "Shadow Ball", type: "Ghost", category: "Special", power: 80, accuracy: 100, pp: 15, maxPp: 15, effect: { type: "statChange", target: "opponent", stat: "specialDefense", stages: -1, chance: 20 } },
      { name: "Hypnosis", type: "Psychic", category: "Status", power: 0, accuracy: 60, pp: 20, maxPp: 20, effect: { type: "status", status: "asleep", chance: 100 } },
      { name: "Dream Eater", type: "Psychic", category: "Special", power: 100, accuracy: 100, pp: 15, maxPp: 15 },
      { name: "Sludge Bomb", type: "Poison", category: "Special", power: 90, accuracy: 100, pp: 10, maxPp: 10, effect: { type: "status", status: "poisoned", chance: 30 } },
    ],
  },
  {
    id: 149,
    name: "Dragonite",
    type: "Dragon",
    types: ["Dragon", "Flying"],
    rarity: "legendary",
    hp: 91,
    maxHp: 91,
    attack: 134,
    defense: 95,
    specialAttack: 100,
    specialDefense: 100,
    moves: [
      { name: "Dragon Breath", type: "Dragon", category: "Special", power: 60, accuracy: 100, pp: 20, maxPp: 20, effect: { type: "status", status: "paralyzed", chance: 30 } },
      { name: "Wing Attack", type: "Flying", category: "Physical", power: 60, accuracy: 100, pp: 35, maxPp: 35 },
      { name: "Aqua Tail", type: "Water", category: "Physical", power: 90, accuracy: 90, pp: 10, maxPp: 10 },
      { name: "Hyper Beam", type: "Normal", category: "Special", power: 120, accuracy: 90, pp: 5, maxPp: 5 },
    ],
  },
  {
    id: 384,
    name: "Rayquaza",
    type: "Dragon",
    types: ["Dragon", "Flying"],
    rarity: "legendary",
    hp: 105,
    maxHp: 105,
    attack: 150,
    defense: 90,
    specialAttack: 150,
    specialDefense: 90,
    moves: [
      { name: "Twister", type: "Dragon", category: "Special", power: 40, accuracy: 100, pp: 20, maxPp: 20 },
      { name: "Dragon Breath", type: "Dragon", category: "Special", power: 60, accuracy: 100, pp: 20, maxPp: 20, effect: { type: "status", status: "paralyzed", chance: 30 } },
      { name: "Air Slash", type: "Flying", category: "Special", power: 75, accuracy: 95, pp: 15, maxPp: 15 },
      { name: "Hyper Beam", type: "Normal", category: "Special", power: 120, accuracy: 90, pp: 5, maxPp: 5 },
    ],
  },
];

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

const areaUnlocks = {
  forest: null,
  lake: "Aqua Badge",
  cave: "Volt Badge",
  ocean: "Aqua Badge",
  volcano: "Blaze Badge",
  mountain: "Rock Badge",
  desert: "Rock Badge",
  graveyard: "Psychic Badge",
};

const areas = [
  { id: "forest", name: "Forest", requiresBadge: null },
  { id: "cave", name: "Cave", requiresBadge: "Volt Badge" },
  { id: "volcano", name: "Volcano", requiresBadge: "Blaze Badge" },
  { id: "ocean", name: "Ocean", requiresBadge: "Aqua Badge" },
  { id: "lake", name: "Lake", requiresBadge: "Aqua Badge" },
  { id: "mountain", name: "Mountain", requiresBadge: "Rock Badge" },
  { id: "desert", name: "Desert", requiresBadge: "Rock Badge" },
  { id: "graveyard", name: "Graveyard", requiresBadge: "Psychic Badge" },
];

const npcMaps = {
  forest: { width: 8, height: 6, theme: "forest" },
  cave: { width: 8, height: 6, theme: "cave" },
  ocean: { width: 8, height: 6, theme: "ocean" },
  lake: { width: 8, height: 6, theme: "lake" },
  volcano: { width: 8, height: 6, theme: "volcano" },
  mountain: { width: 8, height: 6, theme: "mountain" },
  desert: { width: 8, height: 6, theme: "desert" },
  graveyard: { width: 8, height: 6, theme: "graveyard" },
};

const npcs = [
  {
    id: 1,
    area: "forest",
    name: "Trainer John",
    type: "trainer",
    sprite: "trainer",
    position: { x: 5, y: 3 },
    dialogue: "You already beat me. Keep your guard up in the cave ahead.",
    introDialogue: "Hey! Let's battle!",
    team: [{ name: "Pikachu", level: 10 }],
    rewardCoins: 320,
    itemReward: { id: "potion", quantity: 1 },
  },
  {
    id: 2,
    area: "forest",
    name: "Guide Maple",
    type: "guide",
    sprite: "guide",
    position: { x: 2, y: 2 },
    dialogue:
      "Routes open up fast once you grab badges. The cave responds to the Volt Badge.",
  },
  {
    id: 3,
    area: "forest",
    name: "Merchant Nia",
    type: "shop",
    sprite: "shop",
    position: { x: 1, y: 5 },
    dialogue: "Travel light, battle hard. Need supplies?",
  },
  {
    id: 4,
    area: "forest",
    name: "Nurse Hana",
    type: "healer",
    sprite: "healer",
    position: { x: 7, y: 5 },
    dialogue: "Take a breath. I'll heal your whole team.",
  },
  {
    id: 5,
    area: "lake",
    name: "Trainer Marina",
    type: "trainer",
    sprite: "trainer-water",
    position: { x: 5, y: 2 },
    dialogue: "That was a clean battle. Water types still have my heart.",
    introDialogue: "The water's calm. Perfect for a battle!",
    team: [
      { name: "Psyduck", level: 12 },
      { name: "Marill", level: 11 },
    ],
    rewardCoins: 460,
  },
  {
    id: 6,
    area: "cave",
    name: "Hiker Rex",
    type: "trainer",
    sprite: "trainer-rock",
    position: { x: 6, y: 3 },
    dialogue: "Solid win. You're ready for deeper tunnels now.",
    introDialogue: "This cave is my training ground!",
    team: [
      { name: "Geodude", level: 14 },
      { name: "Onix", level: 16 },
    ],
    rewardCoins: 650,
    itemReward: { id: "great", quantity: 1 },
  },
  {
    id: 7,
    area: "ocean",
    name: "Captain Finn",
    type: "guide",
    sprite: "guide-sailor",
    position: { x: 3, y: 4 },
    dialogue: "Gym victories open sea lanes. Water specialists like to stack status moves.",
  },
  {
    id: 8,
    area: "volcano",
    name: "Medic Ember",
    type: "healer",
    sprite: "healer-fire",
    position: { x: 2, y: 4 },
    dialogue: "The heat is brutal out here. Let me patch up your team.",
  },
];

const allGymBadges = gyms.map((gym) => gym.badge);

const defaultMoves = [
  {
    name: "Tackle",
    type: "Normal",
    category: "Physical",
    power: 40,
    accuracy: 100,
    pp: 35,
  },
  {
    name: "Growl",
    type: "Normal",
    category: "Status",
    power: null,
    accuracy: 100,
    pp: 40,
    effect: "lower_attack",
  },
  {
    name: "Quick Attack",
    type: "Normal",
    category: "Physical",
    power: 40,
    accuracy: 100,
    pp: 30,
  },
  {
    name: "Tail Whip",
    type: "Normal",
    category: "Status",
    power: null,
    accuracy: 100,
    pp: 30,
    effect: "lower_defense",
  },
];

const starterPikachu = {
  id: 25,
  name: "Pikachu",
  type: "Electric",
  rarity: "uncommon",
  hp: 35,
  maxHp: 35,
  attack: 55,
  defense: 40,
  specialAttack: 50,
  specialDefense: 50,
  xpYield: 112,
  habitats: ["forest"],
  times: ["day"],
  baseCatchRate: 190,
  level: 1,
  xp: 0,
  currentHp: 35,
  types: ["Electric"],
  shiny: false,
  moves: [
    {
      name: "Thunderbolt",
      type: "Electric",
      category: "Special",
      power: 90,
      accuracy: 100,
      pp: 15,
    },
    {
      name: "Quick Attack",
      type: "Normal",
      category: "Physical",
      power: 40,
      accuracy: 100,
      pp: 30,
    },
    {
      name: "Growl",
      type: "Normal",
      category: "Status",
      power: null,
      accuracy: 100,
      pp: 40,
      effect: "lower_attack",
    },
    {
      name: "Thunder Wave",
      type: "Electric",
      category: "Status",
      power: null,
      accuracy: 90,
      pp: 20,
      effect: "paralyze",
    },
  ],
};

let pokemonTemplateCache = null;

function getPokemonTemplates() {
  if (!pokemonTemplateCache) {
    try {
      const storedTemplates = JSON.parse(fs.readFileSync(pokemonPath, "utf8"));
      const missingBossTemplates = eliteBossTemplates.filter(
        (boss) => !storedTemplates.some((pokemon) => pokemon.name === boss.name),
      );
      pokemonTemplateCache = [...storedTemplates, ...missingBossTemplates];
    } catch (error) {
      pokemonTemplateCache = [...eliteBossTemplates];
    }
  }
  return pokemonTemplateCache;
}

function getPokemonTemplate(id) {
  return getPokemonTemplates().find((pokemon) => pokemon.id === id) || {};
}

function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return fallback;
  }
}

function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function loadTeamAndStorage() {
  let team = readJsonFile(inventoryPath, []).map(normalizePokemon);
  let storage = readJsonFile(storagePath, []).map(normalizePokemon);
  const hasPikachu = [...team, ...storage].some((p) => p.id === 25);

  if (!hasPikachu) {
    team.unshift(normalizePokemon(starterPikachu));
  }

  if (team.length > teamLimit) {
    storage = [...storage, ...team.slice(teamLimit)];
    team = team.slice(0, teamLimit);
  }

  saveTeamAndStorage(team, storage);
  return { team, storage };
}

function saveTeamAndStorage(team, storage) {
  writeJsonFile(inventoryPath, team.map(normalizePokemon));
  writeJsonFile(storagePath, storage.map(normalizePokemon));
}

function getAllOwnedPokemon() {
  const { team, storage } = loadTeamAndStorage();
  return [...team, ...storage];
}

function uniqueNumbers(values) {
  return [...new Set(values.map(Number).filter(Boolean))];
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean).map(String))];
}

function normalizePlayerState(state = {}) {
  const coins = state.coins ?? state.money ?? defaultPlayerState.coins;
  const badges = uniqueStrings(
    (state.badges || []).map((badge) => legacyBadgeMap[badge] || badge),
  );
  const championDefeated =
    Boolean(state.championDefeated) || badges.includes(champion.badge);
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
    defeatedNpcs: uniqueNumbers(state.defeatedNpcs || []),
    badges,
    championDefeated,
    unlockedAreas,
    unlockedGyms,
    achievements: state.achievements || [],
  };
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

function awardCoins(state, amount) {
  state.coins = (state.coins ?? state.money ?? 0) + amount;
  state.money = state.coins;
  state.xp = (state.xp || 0) + Math.max(1, Math.floor(amount / 10));
  state.level = Math.max(1, Math.floor((state.xp || 0) / 100) + 1);
  updateAchievements(state);
  return state;
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

function getPokedexEntries(state) {
  return getPokemonTemplates().map((pokemon) => ({
    id: pokemon.id,
    name: pokemon.name,
    type: pokemon.type,
    types: getPokemonTypes(pokemon),
    seen: state.pokedex.seen.includes(pokemon.id),
    caught: state.pokedex.caught.includes(pokemon.id),
  }));
}

const typeChart = {
  Normal: { Rock: 0.5, Ghost: 0, Steel: 0.5 },
  Fire: {
    Fire: 0.5,
    Water: 0.5,
    Grass: 2,
    Ice: 2,
    Bug: 2,
    Rock: 0.5,
    Dragon: 0.5,
    Steel: 2,
  },
  Water: { Fire: 2, Water: 0.5, Grass: 0.5, Ground: 2, Rock: 2, Dragon: 0.5 },
  Electric: {
    Water: 2,
    Electric: 0.5,
    Grass: 0.5,
    Ground: 0,
    Flying: 2,
    Dragon: 0.5,
  },
  Grass: {
    Fire: 0.5,
    Water: 2,
    Grass: 0.5,
    Poison: 0.5,
    Ground: 2,
    Flying: 0.5,
    Bug: 0.5,
    Rock: 2,
    Dragon: 0.5,
    Steel: 0.5,
  },
  Ice: {
    Fire: 0.5,
    Water: 0.5,
    Grass: 2,
    Ice: 0.5,
    Ground: 2,
    Flying: 2,
    Dragon: 2,
    Steel: 0.5,
  },
  Fighting: {
    Normal: 2,
    Ice: 2,
    Rock: 2,
    Dark: 2,
    Steel: 2,
    Poison: 0.5,
    Flying: 0.5,
    Psychic: 0.5,
    Bug: 0.5,
    Fairy: 0.5,
    Ghost: 0,
  },
  Poison: {
    Grass: 2,
    Fairy: 2,
    Poison: 0.5,
    Ground: 0.5,
    Rock: 0.5,
    Ghost: 0.5,
    Steel: 0,
  },
  Ground: {
    Fire: 2,
    Electric: 2,
    Grass: 0.5,
    Poison: 2,
    Flying: 0,
    Bug: 0.5,
    Rock: 2,
    Steel: 2,
  },
  Flying: {
    Grass: 2,
    Fighting: 2,
    Bug: 2,
    Electric: 0.5,
    Rock: 0.5,
    Steel: 0.5,
  },
  Psychic: { Fighting: 2, Poison: 2, Psychic: 0.5, Steel: 0.5, Dark: 0 },
  Bug: {
    Grass: 2,
    Psychic: 2,
    Dark: 2,
    Fire: 0.5,
    Fighting: 0.5,
    Poison: 0.5,
    Flying: 0.5,
    Ghost: 0.5,
    Steel: 0.5,
    Fairy: 0.5,
    Rock: 1,
  },
  Rock: {
    Fire: 2,
    Ice: 2,
    Flying: 2,
    Bug: 2,
    Fighting: 0.5,
    Ground: 0.5,
    Steel: 0.5,
  },
  Ghost: { Psychic: 2, Ghost: 2, Normal: 0, Dark: 0.5 },
  Dragon: { Dragon: 2, Steel: 0.5, Fairy: 0 },
  Dark: { Psychic: 2, Ghost: 2, Fighting: 0.5, Dark: 0.5, Fairy: 0.5 },
  Steel: {
    Ice: 2,
    Rock: 2,
    Fairy: 2,
    Fire: 0.5,
    Water: 0.5,
    Electric: 0.5,
    Steel: 0.5,
  },
  Fairy: {
    Fighting: 2,
    Dragon: 2,
    Dark: 2,
    Fire: 0.5,
    Poison: 0.5,
    Steel: 0.5,
  },
};

function getTimeOfDay() {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 18 ? "day" : "night";
}

function getCurrentWeather() {
  const roll = Math.random();
  if (roll < 0.5) return "sunny";
  if (roll < 0.8) return "rain";
  if (roll < 0.95) return "snow";
  return "sandstorm";
}

function getPokemonTypes(pokemon) {
  if (Array.isArray(pokemon.types) && pokemon.types.length > 0) {
    return pokemon.types;
  }
  return pokemon.type ? [pokemon.type] : [];
}

function getTypeEffectiveness(attackerType, defenderType) {
  if (!attackerType || !defenderType) return 1;
  return typeChart[attackerType]?.[defenderType] ?? 1;
}

function getCombinedTypeEffectiveness(attackerType, defenderTypes) {
  const types = Array.isArray(defenderTypes) ? defenderTypes : [defenderTypes];
  return types.reduce(
    (multiplier, type) => multiplier * getTypeEffectiveness(attackerType, type),
    1,
  );
}

function normalizeMove(move) {
  const maxPp = move.maxPp ?? move.pp ?? move.currentPp ?? 10;
  return {
    ...move,
    category: move.category || "Physical",
    accuracy: move.accuracy ?? 100,
    power: move.power ?? 0,
    pp: move.pp ?? maxPp,
    maxPp,
    currentPp: Math.min(move.currentPp ?? maxPp, maxPp),
  };
}

function normalizePokemon(pokemon) {
  const template = getPokemonTemplate(pokemon.id);
  const merged = {
    ...template,
    ...pokemon,
  };
  const hasGenericSavedType =
    pokemon.type === "Normal" &&
    Array.isArray(pokemon.types) &&
    pokemon.types.length === 1 &&
    pokemon.types[0] === "Normal" &&
    template.type &&
    template.type !== "Normal";

  if (hasGenericSavedType) {
    merged.type = template.type;
    merged.types = template.types || [template.type];
  }

  const types = getPokemonTypes(merged);
  const templateMoves =
    Array.isArray(template.moves) && template.moves.length > 0
      ? template.moves
      : null;
  const savedMoves = Array.isArray(pokemon.moves) ? pokemon.moves : [];
  const moves = (templateMoves || savedMoves.length ? templateMoves || savedMoves : defaultMoves).map(
    (move) => {
      const savedMove = savedMoves.find((saved) => saved.name === move.name);
      return {
        ...move,
        currentPp: savedMove?.currentPp ?? move.currentPp ?? move.maxPp ?? move.pp,
      };
    },
  );

  return {
    ...merged,
    type: merged.type || types[0] || "Normal",
    types: types.length > 0 ? types : [merged.type || "Normal"],
    level: merged.level || 1,
    xp: merged.xp || 0,
    maxHp: merged.maxHp || merged.hp || 1,
    currentHp: merged.currentHp ?? merged.maxHp ?? merged.hp ?? 1,
    specialAttack: merged.specialAttack ?? merged.attack ?? 1,
    specialDefense: merged.specialDefense ?? merged.defense ?? 1,
    status: merged.status || "none",
    moves: moves.map(normalizeMove),
  };
}

function restorePokemon(pokemon) {
  const normalized = normalizePokemon(pokemon);
  return {
    ...normalized,
    currentHp: normalized.maxHp,
    status: "none",
    moves: normalized.moves.map((move) => ({
      ...move,
      currentPp: move.maxPp ?? move.pp,
    })),
  };
}

function getWeatherMatch(types, weather) {
  return types.some((type) => (weatherBoosts[type] || []).includes(weather));
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function calculateSpawnWeight(pokemon, selectedArea, currentTime, weather) {
  let weight = rarityWeights[pokemon.rarity] || 0;
  const habitats = Array.isArray(pokemon.habitats)
    ? pokemon.habitats
    : pokemon.habitats
      ? [pokemon.habitats]
      : [];
  const times = Array.isArray(pokemon.times)
    ? pokemon.times
    : pokemon.times
      ? [pokemon.times]
      : [];
  const types = getPokemonTypes(pokemon);

  if (habitats.includes(selectedArea)) weight += 30;
  if (times.includes(currentTime)) weight += 15;
  if (getWeatherMatch(types, weather)) weight += 10;
  return Math.max(1, weight);
}

function weightedSelection(items) {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;
  for (let item of items) {
    random -= item.weight;
    if (random <= 0) return item.pokemon;
  }
  return items[0].pokemon;
}

function calculateDamage(
  { attack, defense, specialAttack, specialDefense, types, level, status },
  { defense: defStat, specialDefense: defSpDef, types: oppTypes },
  movePower,
  category,
  moveType,
) {
  let atkStat, defStatUsed;
  if (category === "Physical") {
    atkStat = attack || 1;
    defStatUsed = defStat || 1;
  } else if (category === "Special") {
    atkStat = specialAttack || attack || 1;
    defStatUsed = defSpDef || defStat || 1;
  } else {
    return { damage: 0, effectiveness: 1, critical: false, burnReduced: false }; // status move
  }

  const stab = types.includes(moveType) ? 1.5 : 1;
  const effectiveness = getCombinedTypeEffectiveness(moveType, oppTypes);
  const randomFactor = getRandomInt(85, 100) / 100;
  const critical = Math.random() < 0.0625 ? 1.5 : 1;
  const burnReduction = status === "burned" ? 0.5 : 1;

  const base = (((2 * level) / 5 + 2) * atkStat * movePower) / defStatUsed;
  const damage = Math.floor(
    (base / 50 + 2) *
      stab *
      effectiveness *
      randomFactor *
      critical *
      burnReduction,
  );
  return {
    damage: Math.max(1, damage),
    effectiveness,
    critical: critical > 1,
    burnReduced: burnReduction < 1,
  };
}

function getMoveByName(pokemon, moveName) {
  return (pokemon.moves || []).find((move) => move.name === moveName);
}

function checkAccuracy(move) {
  return Math.random() * 100 < (move.accuracy ?? 100);
}

function changeStat(target, stat, stages) {
  if (!stat || !Number.isFinite(stages)) return false;
  const current = target[stat] ?? 1;
  const multiplier = stages > 0 ? 1 + stages * 0.25 : 1 / (1 + Math.abs(stages) * 0.25);
  target[stat] = Math.max(1, Math.floor(current * multiplier));
  return true;
}

function applyMoveEffect(move, attacker, defender) {
  const effect = move.effect;
  const log = [];
  if (!effect || Math.random() * 100 >= (effect.chance ?? 100)) {
    return log;
  }

  const target = effect.target === "self" ? attacker : defender;
  const targetName = target === attacker ? attacker.name : defender.name;

  if (effect.type === "status") {
    if (!target.status || target.status === "none") {
      target.status = effect.status;
      log.push(`${targetName} was ${formatStatusForLog(effect.status)}!`);
    }
  } else if (effect.type === "statChange") {
    if (changeStat(target, effect.stat, effect.stages)) {
      const direction = effect.stages > 0 ? "rose" : "fell";
      log.push(`${targetName}'s ${formatStatForLog(effect.stat)} ${direction}!`);
    }
  } else if (effect.type === "heal" || effect.type === "healAndSleep") {
    const maxHp = attacker.maxHp || attacker.hp || 1;
    const healed = Math.min(
      maxHp - attacker.currentHp,
      Math.max(1, Math.floor(maxHp * ((effect.percent || 50) / 100))),
    );
    attacker.currentHp += healed;
    log.push(`${attacker.name} recovered ${healed} HP.`);
    if (effect.type === "healAndSleep") {
      attacker.status = effect.status || "asleep";
      log.push(`${attacker.name} fell asleep!`);
    }
  } else if (effect.type === "allStatsUp") {
    ["attack", "defense", "specialAttack", "specialDefense", "speed"].forEach(
      (stat) => changeStat(attacker, stat, effect.stages || 1),
    );
    log.push(`${attacker.name}'s stats rose!`);
  } else if (effect.type === "randomMove") {
    log.push("A mysterious power sparked, but nothing happened.");
  }

  return log;
}

function calculateMoveDamage(attacker, defender, move) {
  const baseResult = calculateDamage(
    attacker,
    defender,
    move.power || 0,
    move.category,
    move.type,
  );
  const boostedCritical =
    move.effect?.type === "criticalBoost" &&
    Math.random() * 100 < (move.effect.chance ?? 0);
  const hits = Math.max(1, move.hits || 1);
  const criticalMultiplier = boostedCritical && !baseResult.critical ? 1.5 : 1;
  return {
    ...baseResult,
    damage: Math.max(1, Math.floor(baseResult.damage * criticalMultiplier)) * hits,
    hits,
    critical: baseResult.critical || boostedCritical,
  };
}

function formatStatusForLog(status) {
  const labels = {
    asleep: "put to sleep",
    burned: "burned",
    confused: "confused",
    frozen: "frozen",
    paralyzed: "paralyzed",
    poisoned: "poisoned",
  };
  return labels[status] || status;
}

function formatStatForLog(stat) {
  return String(stat || "")
    .replace(/([A-Z])/g, " $1")
    .toLowerCase();
}

function executeBattleMove(attacker, defender, moveName, defenderPrefix = "") {
  const log = [];
  const move = getMoveByName(attacker, moveName);
  if (!move) return { error: "Move not found", log };
  if (move.currentPp <= 0) {
    log.push("No PP left for this move!");
    return { error: "No PP left for this move", log };
  }

  if (attacker.status === "paralyzed" && Math.random() < 0.25) {
    log.push(`${attacker.name} is paralyzed and cannot move!`);
    return { move, log };
  }
  if (attacker.status === "asleep" || attacker.status === "frozen") {
    log.push(`${attacker.name} is ${attacker.status} and cannot move!`);
    return { move, log };
  }

  move.currentPp -= 1;
  log.push(`${attacker.name} used ${move.name}!`);

  if (!checkAccuracy(move)) {
    log.push("The attack missed!");
    return { move, log };
  }

  if (move.category !== "Status" && (move.power || 0) > 0) {
    const damageResult = calculateMoveDamage(attacker, defender, move);
    defender.currentHp = Math.max(0, defender.currentHp - damageResult.damage);
    if (damageResult.critical) log.push("A critical hit!");
    if (damageResult.effectiveness > 1) log.push("It's super effective!");
    if (damageResult.effectiveness < 1 && damageResult.effectiveness > 0) {
      log.push("It's not very effective...");
    }
    if (damageResult.effectiveness === 0) log.push("It had no effect!");
    if (damageResult.hits > 1) log.push(`Hit ${damageResult.hits} times!`);
    log.push(`${defenderPrefix}${defender.name} took ${damageResult.damage} damage.`);
  }

  log.push(...applyMoveEffect(move, attacker, defender));
  return { move, log };
}

const aiDifficulty = {
  EASY: "easy",
  MEDIUM: "medium",
  HARD: "hard",
};

function getAvailableMoves(pokemon) {
  return (pokemon.moves || []).filter((move) => move.currentPp > 0);
}

function isDamagingMove(move) {
  return move.category !== "Status" && (move.power || 0) > 0;
}

function estimateMoveDamage(attacker, defender, move) {
  if (!isDamagingMove(move)) return 0;
  const attackStat =
    move.category === "Special"
      ? attacker.specialAttack || attacker.attack || 1
      : attacker.attack || 1;
  const defenseStat =
    move.category === "Special"
      ? defender.specialDefense || defender.defense || 1
      : defender.defense || 1;
  const stab = (attacker.types || []).includes(move.type) ? 1.5 : 1;
  const effectiveness = getCombinedTypeEffectiveness(move.type, defender.types);
  const base =
    ((((2 * (attacker.level || 1)) / 5 + 2) * attackStat * (move.power || 0)) /
      defenseStat) /
      50 +
    2;
  return Math.max(0, Math.floor(base * stab * effectiveness));
}

function isUsefulStatusMove(move, defender) {
  const effect = move.effect;
  if (!effect) return false;
  if (effect.type === "status") {
    const usefulStatuses = ["paralyzed", "burned", "asleep", "frozen", "confused", "poisoned"];
    return (
      usefulStatuses.includes(effect.status) &&
      (!defender.status || defender.status === "none")
    );
  }
  return ["statChange", "heal", "healAndSleep", "allStatsUp"].includes(effect.type);
}

function scoreMove(attacker, defender, move) {
  if (move.currentPp <= 0) return -Infinity;
  let score = 100;
  const effectiveness = isDamagingMove(move)
    ? getCombinedTypeEffectiveness(move.type, defender.types)
    : 1;

  if (isDamagingMove(move)) {
    if (effectiveness === 0) return -Infinity;
    if (effectiveness > 1) score += 80;
    if (effectiveness < 1) score -= 40;
    if ((attacker.types || []).includes(move.type)) score += 30;
    score += (move.power || 0) / 2;
    if (estimateMoveDamage(attacker, defender, move) >= defender.currentHp) {
      score += 100;
    }
    if (move.priority && defender.currentHp / Math.max(1, defender.maxHp) <= 0.25) {
      score += 40;
    }
  } else {
    if (!isUsefulStatusMove(move, defender)) return -Infinity;
    score += move.effect?.type === "status" ? 35 : 20;
  }

  const randomFactor = 0.9 + Math.random() * 0.2;
  return score * randomFactor;
}

function chooseAiMove(attacker, defender, difficulty = aiDifficulty.MEDIUM) {
  const moves = getAvailableMoves(attacker);
  if (moves.length === 0) return null;

  if (difficulty === aiDifficulty.EASY && Math.random() < 0.75) {
    return moves[Math.floor(Math.random() * moves.length)];
  }
  if (difficulty === aiDifficulty.MEDIUM && Math.random() < 0.3) {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  const scoredMoves = moves
    .map((move) => ({ move, score: scoreMove(attacker, defender, move) }))
    .filter((entry) => entry.score > -Infinity)
    .sort((a, b) => b.score - a.score);

  return scoredMoves[0]?.move || moves[Math.floor(Math.random() * moves.length)];
}

function chooseBestMove(attacker, defender) {
  return chooseAiMove(attacker, defender, aiDifficulty.MEDIUM);
}

function chooseGymMove(attacker, defender) {
  return chooseAiMove(attacker, defender, aiDifficulty.HARD);
}

function isWeakToOpponent(currentPokemon, opponent) {
  const opponentMoves = getAvailableMoves(opponent).filter(isDamagingMove);
  return opponentMoves.some(
    (move) => getCombinedTypeEffectiveness(move.type, currentPokemon.types) > 1,
  );
}

function hasAdvantageAgainst(candidate, opponent) {
  return getAvailableMoves(candidate)
    .filter(isDamagingMove)
    .some((move) => getCombinedTypeEffectiveness(move.type, opponent.types) > 1);
}

function chooseAiSwitch(team, currentIndex, opponent) {
  const currentPokemon = team[currentIndex];
  if (!currentPokemon || !isWeakToOpponent(currentPokemon, opponent)) return null;
  return team.findIndex(
    (pokemon, index) =>
      index !== currentIndex &&
      pokemon.currentHp > 0 &&
      hasAdvantageAgainst(pokemon, opponent),
  );
}

function chooseGymAction(session, opponent) {
  const current = session.gymTeam[session.gymIndex];
  if (!current) return { type: "none" };

  const lowHp = current.currentHp / Math.max(1, current.maxHp) < 0.3;
  if (lowHp && (session.aiItems?.potion || 0) > 0) {
    return { type: "item", itemId: "potion" };
  }
  if (lowHp) {
    const defensiveMove = getAvailableMoves(current).find(
      (move) =>
        move.category === "Status" &&
        (move.effect?.target === "self" ||
          move.effect?.type === "heal" ||
          move.effect?.type === "healAndSleep" ||
          (move.effect?.type === "statChange" && move.effect?.target === "self")),
    );
    if (defensiveMove) return { type: "move", move: defensiveMove };
  }

  const switchIndex = chooseAiSwitch(session.gymTeam, session.gymIndex, opponent);
  if (switchIndex >= 0) return { type: "switch", index: switchIndex };

  return { type: "move", move: chooseGymMove(current, opponent) };
}

function chooseTrainerAction(
  team,
  currentIndex,
  aiItems,
  opponent,
  trainerName,
  difficulty = aiDifficulty.HARD,
) {
  const current = team[currentIndex];
  if (!current) return { type: "none" };

  const lowHp = current.currentHp / Math.max(1, current.maxHp) < 0.3;
  if (lowHp && (aiItems?.potion || 0) > 0) {
    return { type: "item", itemId: "potion", trainerName };
  }
  if (lowHp) {
    const defensiveMove = getAvailableMoves(current).find(
      (move) =>
        move.category === "Status" &&
        (move.effect?.target === "self" ||
          move.effect?.type === "heal" ||
          move.effect?.type === "healAndSleep" ||
          (move.effect?.type === "statChange" && move.effect?.target === "self")),
    );
    if (defensiveMove) return { type: "move", move: defensiveMove };
  }

  const switchIndex = chooseAiSwitch(team, currentIndex, opponent);
  if (switchIndex >= 0) return { type: "switch", index: switchIndex };

  return { type: "move", move: chooseAiMove(current, opponent, difficulty) };
}

function createLeveledPokemon(name, level) {
  const template = normalizePokemon(
    getPokemonTemplates().find((pokemon) => pokemon.name === name) || {},
  );
  const multiplier = 1 + Math.max(0, level - 1) * 0.08;
  return {
    ...template,
    level,
    maxHp: Math.floor(template.maxHp * multiplier),
    currentHp: Math.floor(template.maxHp * multiplier),
    attack: Math.floor(template.attack * multiplier),
    defense: Math.floor(template.defense * multiplier),
    specialAttack: Math.floor(template.specialAttack * multiplier),
    specialDefense: Math.floor(template.specialDefense * multiplier),
    status: "none",
    moves: template.moves.map((move) => ({
      ...move,
      currentPp: move.maxPp ?? move.pp,
    })),
  };
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
    (npc.team || []).reduce((total, member) => total + (member.level || 1) * 25, 0),
  );
}

function getNpcView(npc, state) {
  const defeated = npc.type === "trainer" ? isTrainerDefeated(state, npc.id) : false;
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

function persistGymPlayerTeam(session) {
  const { team, storage } = loadTeamAndStorage();
  const updatedTeam = team.map((pokemon, index) => ({
    ...pokemon,
    currentHp: session.playerTeam[index]?.currentHp ?? pokemon.currentHp,
    status: session.playerTeam[index]?.status ?? pokemon.status,
    moves: session.playerTeam[index]?.moves ?? pokemon.moves,
  }));
  saveTeamAndStorage(updatedTeam, storage);
}

function persistBattlePlayerTeam(session) {
  const { team, storage } = loadTeamAndStorage();
  const updatedTeam = team.map((pokemon, index) => ({
    ...pokemon,
    currentHp: session.playerTeam[index]?.currentHp ?? pokemon.currentHp,
    status: session.playerTeam[index]?.status ?? pokemon.status,
    moves: session.playerTeam[index]?.moves ?? pokemon.moves,
  }));
  saveTeamAndStorage(updatedTeam, storage);
}

function completeNpcBattle(session, log = []) {
  const state = loadPlayerState();
  if (!isTrainerDefeated(state, session.npc.id)) {
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
        itemCatalog[session.npc.itemReward.id]?.name || session.npc.itemReward.id;
      log.push(`${session.npc.name} gave you ${quantity} ${itemName}${quantity > 1 ? "s" : ""}.`);
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

function calculateBattleXp(defeatedPokemon, trainerMultiplier = 1) {
  const baseYield = defeatedPokemon?.xpYield || 50;
  const level = defeatedPokemon?.level || 1;
  return Math.max(50, Math.floor(baseYield * Math.max(1, level / 2) * trainerMultiplier));
}

function applyXpToPokemon(team, pokemonIndex, xpAmount) {
  if (!team[pokemonIndex] || xpAmount <= 0) {
    return {
      team,
      pokemon: team[pokemonIndex] || null,
      leveledUp: false,
      evolved: false,
      evolvedFrom: null,
      evolvedTo: null,
    };
  }

  const updatedTeam = team.map((pokemon, index) =>
    index === pokemonIndex ? normalizePokemon({ ...pokemon }) : pokemon,
  );
  const pokemon = updatedTeam[pokemonIndex];
  pokemon.xp = (pokemon.xp || 0) + xpAmount;
  let leveledUp = false;
  let evolved = false;
  let evolvedFrom = null;

  while (pokemon.xp >= Math.max(50, (pokemon.level || 1) * 60)) {
    const xpNeeded = Math.max(50, (pokemon.level || 1) * 60);
    pokemon.xp -= xpNeeded;
    pokemon.level = (pokemon.level || 1) + 1;
    pokemon.maxHp = Math.floor((pokemon.maxHp || pokemon.hp || 1) * 1.15);
    pokemon.attack = Math.floor((pokemon.attack || 1) * 1.12);
    pokemon.defense = Math.floor((pokemon.defense || 1) * 1.12);
    pokemon.specialAttack = Math.floor((pokemon.specialAttack || 1) * 1.12);
    pokemon.specialDefense = Math.floor((pokemon.specialDefense || 1) * 1.12);
    pokemon.currentHp = pokemon.maxHp;
    leveledUp = true;
  }

  const evolution = getEvolution(pokemon);
  if (evolution && pokemon.level >= evolution.level) {
    evolvedFrom = pokemon.name;
    pokemon.name = evolution.name;
    pokemon.type = evolution.type || pokemon.type;
    pokemon.types = [pokemon.type];
    pokemon.attack = Math.floor(pokemon.attack * 1.05);
    pokemon.defense = Math.floor(pokemon.defense * 1.05);
    pokemon.maxHp = Math.floor(pokemon.maxHp * 1.05);
    pokemon.specialAttack = Math.floor(pokemon.specialAttack * 1.05);
    pokemon.specialDefense = Math.floor(pokemon.specialDefense * 1.05);
    pokemon.currentHp = pokemon.maxHp;
    pokemon.evolvesTo = null;
    pokemon.evolveLevel = null;
    pokemon.evolvedFrom = evolvedFrom;
    evolved = true;
  }

  return {
    team: updatedTeam,
    pokemon,
    leveledUp,
    evolved,
    evolvedFrom,
    evolvedTo: evolved ? pokemon.name : null,
  };
}

function completeGymSession(session, log = []) {
  const state = loadPlayerState();
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

function runGymBattle(playerTeam, gym) {
  const log = [`${gym.name} battle started!`];
  const team = playerTeam.map(restorePokemon);
  const gymTeam = gym.team.map((member) =>
    createLeveledPokemon(member.name, member.level),
  );
  let playerIndex = 0;
  let gymIndex = 0;
  let turns = 0;

  while (playerIndex < team.length && gymIndex < gymTeam.length && turns < 80) {
    turns += 1;
    const player = team[playerIndex];
    const opponent = gymTeam[gymIndex];
    const playerMove = chooseBestMove(player, opponent);
    if (!playerMove) {
      player.currentHp = 0;
    } else {
      log.push(...executeBattleMove(player, opponent, playerMove.name, "Gym ").log);
    }
    if (opponent.currentHp <= 0) {
      log.push(`Gym ${opponent.name} fainted!`);
      gymIndex += 1;
      continue;
    }

    const gymMove = chooseBestMove(opponent, player);
    if (gymMove) {
      log.push(...executeBattleMove(opponent, player, gymMove.name).log);
    }
    if (player.currentHp <= 0) {
      log.push(`${player.name} fainted!`);
      playerIndex += 1;
    }
  }

  return {
    won: gymIndex >= gymTeam.length,
    log,
    team,
  };
}

function calculateCatchProbability(
  wildPokemon,
  pokeball = "standard",
  currentHP,
  status = "none",
) {
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

app.get("/api/pokedex", (req, res) => {
  const state = loadPlayerState();
  const entries = getPokedexEntries(state);
  res.json({
    seen: state.pokedex.seen.length,
    caught: state.pokedex.caught.length,
    total: entries.length,
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
    completed: Boolean(state.championDefeated || (state.badges || []).includes(champion.badge)),
    active: Boolean(progress && progress.status === "active"),
    session: progress ? getEliteSessionView(progress) : null,
    stages: [
      ...eliteFour.map((trainer, index) => ({
        id: trainer.id,
        name: trainer.name,
        type: trainer.type,
        team: trainer.team,
        unlocked,
        progress: progress?.status === "active" && progress.stageIndex === index,
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

  const state = loadPlayerState();
  if (!(state.unlockedGyms || []).map(Number).includes(gym.id)) {
    return res.status(403).json({ error: "This gym is locked" });
  }

  const { team } = loadTeamAndStorage();
  const playerIndex = getFirstHealthyPokemonIndex(team);
  if (playerIndex < 0) {
    return res.status(400).json({ error: "Heal your team before the gym battle" });
  }

  const session = {
    gym,
    playerTeam: team,
    gymTeam: gym.team.map((member) =>
      createLeveledPokemon(member.name, member.level),
    ),
    playerIndex,
    gymIndex: 0,
    aiItems: {
      potion: gym.difficulty,
    },
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
    return res.status(403).json({ error: "Defeat every gym before challenging the Elite Four" });
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
    return res.status(400).json({ error: "Heal your team before challenging the Elite Four" });
  }

  const session = {
    stageIndex: 0,
    totalStages: eliteFour.length + 1,
    playerTeam: team,
    playerIndex,
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

  const log = [];
  if (action === "switch") {
    const nextIndex = Number(pokemonIndex);
    if (!session.playerTeam[nextIndex]) {
      return res.status(400).json({ error: "Invalid Pokemon" });
    }
    if (session.playerTeam[nextIndex].currentHp <= 0) {
      return res.status(400).json({ error: "Cannot switch to a fainted Pokemon" });
    }
    session.playerIndex = nextIndex;
    log.push(`Go, ${session.playerTeam[nextIndex].name}!`);
    return res.json({ success: true, log, session: getGymSessionView(session) });
  }

  const playerPokemon = session.playerTeam[session.playerIndex];
  const gymPokemon = session.gymTeam[session.gymIndex];
  if (!playerPokemon || playerPokemon.currentHp <= 0) {
    return res.status(400).json({ error: "Choose a healthy Pokemon first" });
  }
  if (!gymPokemon) {
    return res.json(completeGymSession(session, ["Gym battle complete."]));
  }

  const playerTurn = executeBattleMove(playerPokemon, gymPokemon, moveName, "Gym ");
  log.push(...playerTurn.log);
  if (playerTurn.error) {
    return res.status(400).json({ error: playerTurn.error, log, session: getGymSessionView(session) });
  }

  if (gymPokemon.currentHp <= 0) {
    const xpAward = calculateBattleXp(gymPokemon, 2.5);
    const xpResult = applyXpToPokemon(session.playerTeam, session.playerIndex, xpAward);
    session.playerTeam = xpResult.team;
    log.push(`Gym ${gymPokemon.name} fainted!`);
    log.push(`${xpResult.pokemon.name} gained ${xpAward} XP.`);
    if (xpResult.leveledUp) {
      log.push(`${xpResult.pokemon.name} leveled up to ${xpResult.pokemon.level}!`);
    }
    if (xpResult.evolved) {
      log.push(`${xpResult.evolvedFrom || "Your Pokemon"} evolved into ${xpResult.evolvedTo || xpResult.pokemon.name}!`);
    }
    session.gymIndex += 1;
    if (session.gymIndex >= session.gymTeam.length) {
      return res.json(completeGymSession(session, log));
    }
    log.push(`${session.gym.name} sent out ${session.gymTeam[session.gymIndex].name}!`);
    return res.json({ success: true, log, session: getGymSessionView(session) });
  }

  const gymAction = chooseGymAction(session, playerPokemon);
  if (gymAction.type === "switch") {
    const incoming = session.gymTeam[gymAction.index];
    if (incoming) {
      session.gymTeam[gymAction.index] = session.gymTeam[session.gymIndex];
      session.gymTeam[session.gymIndex] = incoming;
      log.push(`${session.gym.name} switched to ${incoming.name}!`);
    }
  } else if (gymAction.type === "item") {
    const healAmount = 50;
    const healed = Math.min(
      healAmount,
      gymPokemon.maxHp - gymPokemon.currentHp,
    );
    gymPokemon.currentHp += healed;
    session.aiItems.potion -= 1;
    log.push(`${session.gym.name} used a Potion. ${gymPokemon.name} recovered ${healed} HP.`);
  } else if (gymAction.move) {
    log.push(...executeBattleMove(gymPokemon, playerPokemon, gymAction.move.name).log);
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
      return res.status(400).json({ error: "Cannot switch to a fainted Pokemon" });
    }
    session.playerIndex = nextIndex;
    log.push(`Go, ${session.playerTeam[nextIndex].name}!`);
    persistBattlePlayerTeam(session);
    return res.json({ success: true, log, session: getEliteSessionView(session) });
  }

  const playerPokemon = session.playerTeam[session.playerIndex];
  const opponentPokemon = session.opponentTeam[session.opponentIndex];
  if (!playerPokemon || playerPokemon.currentHp <= 0) {
    return res.status(400).json({ error: "Choose a healthy Pokemon first" });
  }
  if (!opponentPokemon) {
    return res.status(400).json({ error: "Elite battle is already finished" });
  }

  const playerTurn = executeBattleMove(playerPokemon, opponentPokemon, moveName, "Elite ");
  log.push(...playerTurn.log);
  if (playerTurn.error) {
    return res.status(400).json({ error: playerTurn.error, log, session: getEliteSessionView(session) });
  }

  if (opponentPokemon.currentHp <= 0) {
    log.push(`${opponentPokemon.name} fainted!`);
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
      log.push(`${session.currentTrainer.name} sent out ${session.opponentTeam[session.opponentIndex].name}!`);
      persistBattlePlayerTeam(session);
      return res.json({ success: true, stageCleared: true, log, session: getEliteSessionView(session) });
    }

    log.push(`${session.currentTrainer.name} sent out ${session.opponentTeam[session.opponentIndex].name}!`);
    persistBattlePlayerTeam(session);
    return res.json({ success: true, log, session: getEliteSessionView(session) });
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
      session.opponentTeam[eliteAction.index] = session.opponentTeam[session.opponentIndex];
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
    log.push(`${session.currentTrainer.name} used a Potion. ${opponentPokemon.name} recovered ${healed} HP.`);
  } else if (eliteAction.move) {
    log.push(...executeBattleMove(opponentPokemon, playerPokemon, eliteAction.move.name).log);
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
  activeGymSessions.delete("player");
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

  const inventory = readJsonFile(inventoryPath, []).map(normalizePokemon);
  if (pokemonIndex < 0 || pokemonIndex >= inventory.length) {
    return res.status(400).json({ error: "Invalid Pokemon index" });
  }

  const pokemon = inventory[pokemonIndex];
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
      return res
        .status(400)
        .json({
          error: `${item.name} does not help ${pokemon.name} right now`,
        });
    }
    pokemon.status = "none";
    message = `${pokemon.name}'s status was cured.`;
  }

  state.items[itemId] -= 1;
  inventory[pokemonIndex] = pokemon;
  writeJsonFile(inventoryPath, inventory);
  res.json({
    success: true,
    message,
    inventory,
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
    return res.status(400).json({ error: "Finish your current trainer battle first" });
  }
  if (activeGymSessions.get("player")?.status === "active") {
    return res.status(400).json({ error: "Finish your gym battle first" });
  }
  if (activeEliteSessions.get("player")?.status === "active") {
    return res.status(400).json({ error: "Finish your Elite Four battle first" });
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
      return res.status(400).json({ error: "Heal your team before battling trainers" });
    }

    const session = {
      npc,
      playerTeam: team,
      playerIndex,
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
      return res.status(400).json({ error: "Cannot switch to a fainted Pokemon" });
    }
    session.playerIndex = nextIndex;
    persistBattlePlayerTeam(session);
    log.push(`Go, ${session.playerTeam[nextIndex].name}!`);
    return res.json({ success: true, log, session: getNpcSessionView(session) });
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
    const xpAward = calculateBattleXp(opponentPokemon, 2);
    const xpResult = applyXpToPokemon(session.playerTeam, session.playerIndex, xpAward);
    session.playerTeam = xpResult.team;
    log.push(`${session.npc.name}'s ${opponentPokemon.name} fainted!`);
    log.push(`${xpResult.pokemon.name} gained ${xpAward} XP.`);
    if (xpResult.leveledUp) {
      log.push(`${xpResult.pokemon.name} leveled up to ${xpResult.pokemon.level}!`);
    }
    if (xpResult.evolved) {
      log.push(
        `${xpResult.evolvedFrom || "Your Pokemon"} evolved into ${xpResult.evolvedTo || xpResult.pokemon.name}!`,
      );
    }
    session.opponentIndex = getFirstHealthyPokemonIndex(session.opponentTeam);
    if (session.opponentIndex < 0) {
      return res.json(completeNpcBattle(session, log));
    }
    log.push(`${session.npc.name} sent out ${session.opponentTeam[session.opponentIndex].name}!`);
    persistBattlePlayerTeam(session);
    return res.json({ success: true, log, session: getNpcSessionView(session) });
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
      session.opponentTeam[npcAction.index] = session.opponentTeam[session.opponentIndex];
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
    log.push(`${session.npc.name} used a Potion. ${opponentPokemon.name} recovered ${healed} HP.`);
  } else if (npcAction.move) {
    log.push(...executeBattleMove(opponentPokemon, playerPokemon, npcAction.move.name).log);
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
  fs.readFile(
    path.join(__dirname, "..", "pokemon.json"),
    "utf8",
    (err, data) => {
      if (err) {
        res.status(500).json({ error: "Failed to read Pokemon data" });
      } else {
        res.json(JSON.parse(data));
      }
    },
  );
});

app.post("/api/encounter", (req, res) => {
  const { area } = req.body;
  if (!area) {
    return res.status(400).json({ error: "Area is required" });
  }
  if (activeNpcSessions.get("player")?.status === "active") {
    return res.status(400).json({ error: "Finish your trainer battle first" });
  }

  fs.readFile(
    path.join(__dirname, "..", "pokemon.json"),
    "utf8",
    (err, data) => {
      if (err) {
        return res.status(500).json({ error: "Failed to read Pokemon data" });
      }

      const allPokemon = JSON.parse(data);
      const currentTime = getTimeOfDay();
      const weather = getCurrentWeather();
      const selectedArea = area === "ocean" ? "lake" : area;
      const legendaryRoll = Math.random() < 0.02;
      const spawnPool = allPokemon.filter((pokemon) => {
        const isLegendary =
          pokemon.rarity === "legendary" || pokemon.rarity === "mythical";
        return legendaryRoll ? isLegendary : !isLegendary;
      });

      const weightedPokemon = (spawnPool.length ? spawnPool : allPokemon).map((pokemon) => ({
        pokemon,
        weight: calculateSpawnWeight(pokemon, selectedArea, currentTime, weather),
      }));

      const encountered = normalizePokemon(weightedSelection(weightedPokemon));
      const shiny = Math.random() < 1 / 4096;
      const encounterData = {
        ...encountered,
        currentHp: encountered.maxHp || encountered.hp,
        area,
        level: encountered.level || 1,
        weather,
        shiny,
        moves: encountered.moves.map((m) => ({
          ...m,
          currentPp: m.maxPp ?? m.pp,
        })),
      };
      markPokedexSeen(encounterData.id);
      res.json(encounterData);
    },
  );
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
  } = req.body;

  fs.readFile(
    path.join(__dirname, "..", "inventory.json"),
    "utf8",
    (err, invData) => {
      if (err) {
        return res.status(500).json({ error: "Failed to read inventory" });
      }

      const inventory = JSON.parse(invData).map(normalizePokemon);
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

      const playerTurn = executeBattleMove(playerPokemon, wildPokemon, moveName, "Wild ");
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
          const wildTurn = executeBattleMove(wildPokemon, playerPokemon, wildMove.name);
          log.push(...wildTurn.log);
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
        savePlayerState(state);
        log.push(`You earned ${moneyReward} coins.`);
      }

      const xpAward =
        winner === "player" ? calculateBattleXp(wildPokemon, 1.75) : 0;

      inventory[playerIndex] = playerPokemon;

      fs.writeFile(
        path.join(__dirname, "..", "inventory.json"),
        JSON.stringify(inventory, null, 2),
        (writeErr) => {
          if (writeErr) {
            return res.status(500).json({ error: "Failed to save inventory" });
          }

          res.json({
            playerHP: playerPokemon.currentHp,
            wildHP: wildPokemon.currentHp,
            winner,
            log,
            playerStatus: playerPokemon.status,
            wildStatus: wildPokemon.status,
            moneyReward,
            xpAward,
            playerMoves: playerPokemon.moves,
            wild: wildPokemon,
          });
        },
      );
    },
  );
});

app.post("/api/catch", (req, res) => {
  if (activeNpcSessions.get("player")?.status === "active") {
    return res.status(400).json({ error: "You cannot catch Pokemon during a trainer battle." });
  }
  if (activeGymSessions.get("player")?.status === "active") {
    return res.status(400).json({ error: "You cannot catch Pokemon during a gym battle." });
  }
  if (activeEliteSessions.get("player")?.status === "active") {
    return res.status(400).json({ error: "You cannot catch Pokemon during an Elite Four battle." });
  }

  const {
    id,
    pokeball = "standard",
    wildHPPercent = 1.0,
    status = "none",
  } = req.body;

  fs.readFile(
    path.join(__dirname, "..", "pokemon.json"),
    "utf8",
    (err, data) => {
      if (err) {
        return res.status(500).json({ error: "Failed to read Pokemon data" });
      }

      const pokemon = JSON.parse(data);
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
        fs.readFile(inventoryPath, "utf8", (err2, invData) => {
          if (err2) {
            return res.status(500).json({ error: "Failed to read inventory" });
          }

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
          state.pokedex.seen = uniqueNumbers([
            ...state.pokedex.seen,
            target.id,
          ]);
          state.pokedex.caught = uniqueNumbers([
            ...state.pokedex.caught,
            target.id,
          ]);
          awardCoins(state, coinRewards.catch);

          try {
            saveTeamAndStorage(team, storage);
            savePlayerState(state);
            res.json({
              success: true,
              message: `Caught ${target.name}! Sent to ${catchDestination}. Earned ${coinRewards.catch} coins.`,
              pokemon: caughtPokemon,
              catchRate: Math.round(catchProbability * 100),
              state,
              destination: catchDestination,
            });
          } catch (writeError) {
            res.status(500).json({ error: "Failed to save inventory" });
          }
        });
      } else {
        savePlayerState(state);
        res.json({
          success: false,
          message: "Pokemon escaped!",
          catchRate: Math.round(catchProbability * 100),
          state,
        });
      }
    },
  );
});

app.get("/api/inventory", (req, res) => {
  try {
    res.json(loadTeamAndStorage());
  } catch (error) {
    res.status(500).json({ error: "Failed to read inventory" });
  }
});

const evolutionTriggers = {
  Pichu: { level: 8, name: "Pikachu", type: "Electric" },
  Pikachu: { level: 12, name: "Raichu", type: "Electric" },
  Bulbasaur: { level: 16, name: "Ivysaur", type: "Grass" },
  Charmander: { level: 16, name: "Charmeleon", type: "Fire" },
  Squirtle: { level: 16, name: "Wartortle", type: "Water" },
  Chikorita: { level: 16, name: "Bayleef", type: "Grass" },
  Cyndaquil: { level: 16, name: "Quilava", type: "Fire" },
  Totodile: { level: 16, name: "Croconaw", type: "Water" },
  Eevee: { level: 16, name: "Vaporeon", type: "Water" },
};

function getEvolution(pokemon) {
  if (pokemon.evolvesTo && pokemon.evolveLevel) {
    return {
      level: pokemon.evolveLevel,
      name: pokemon.evolvesTo,
      type: pokemon.evolveType || pokemon.type,
    };
  }
  return evolutionTriggers[pokemon.name];
}

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

  fs.readFile(
    path.join(__dirname, "..", "inventory.json"),
    "utf8",
    (err, invData) => {
      if (err) {
        return res.status(500).json({ error: "Failed to read inventory" });
      }

      const inventory = JSON.parse(invData).map(normalizePokemon);
      if (pokemonIndex < 0 || pokemonIndex >= inventory.length) {
        return res.status(400).json({ error: "Invalid Pokemon index" });
      }

      const xpResult = applyXpToPokemon(inventory, pokemonIndex, xpAmount);
      const updatedInventory = xpResult.team;

      fs.writeFile(
        path.join(__dirname, "..", "inventory.json"),
        JSON.stringify(updatedInventory, null, 2),
        (err3) => {
          if (err3) {
            return res.status(500).json({ error: "Failed to save inventory" });
          }
          res.json({
            success: true,
            pokemon: updatedInventory[pokemonIndex],
            leveledUp: xpResult.leveledUp,
            evolved: xpResult.evolved,
            evolvedFrom: xpResult.evolvedFrom,
            evolvedTo: xpResult.evolvedTo,
          });
        },
      );
    },
  );
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
    const targetTeamIndex = Number.isInteger(teamIndex) ? teamIndex : team.length;

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

  fs.readFile(
    path.join(__dirname, "..", "inventory.json"),
    "utf8",
    (err, invData) => {
      if (err) {
        return res.status(500).json({ error: "Failed to read inventory" });
      }

      const inventory = JSON.parse(invData).map(normalizePokemon);
      if (pokemonIndex < 0 || pokemonIndex >= inventory.length) {
        return res.status(400).json({ error: "Invalid Pokemon index" });
      }

      const pokemon = inventory[pokemonIndex];
      pokemon.currentHp = pokemon.maxHp;
      pokemon.status = "none";
      pokemon.moves = pokemon.moves.map((move) => ({
        ...move,
        currentPp: move.maxPp ?? move.pp,
      }));

      fs.writeFile(
        path.join(__dirname, "..", "inventory.json"),
        JSON.stringify(inventory, null, 2),
        (err3) => {
          if (err3) {
            return res.status(500).json({ error: "Failed to save inventory" });
          }
          res.json({
            success: true,
            message: `${pokemon.name} was fully healed.`,
            inventory,
          });
        },
      );
    },
  );
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
