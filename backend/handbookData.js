const { battleEffectAbilities } = require("./abilityEngine");
const { typeChart } = require("./battleEngine");
const { supportedEvolutionMethods } = require("./evolutionEngine");

const abilityGuide = [
  { names: ["levitate"], support: "active", description: "Makes the Pokemon immune to Ground-type moves." },
  { names: ["water-absorb", "volt-absorb"], support: "active", description: "Blocks the matching Water or Electric move and restores up to one quarter of maximum HP." },
  { names: ["intimidate"], support: "active", description: "Lowers the opposing Pokemon's Attack by one stage when entering battle." },
  { names: ["imposter"], support: "active", description: "Transforms into the opposing Pokemon on entry, including its battle moves and ability." },
  { names: ["huge-power", "pure-power"], support: "active", description: "Doubles damage from Physical moves." },
  { names: ["technician"], support: "active", description: "Boosts moves with 60 power or less by 50%." },
  { names: ["blaze", "torrent", "overgrow", "swarm"], support: "active", description: "Boosts the matching Fire, Water, Grass, or Bug moves by 50% at one-third HP or lower." },
  { names: ["thick-fat"], support: "active", description: "Halves incoming Fire- and Ice-type damage." },
  { names: ["filter", "solid-rock"], support: "active", description: "Reduces super-effective damage by 25%." },
  { names: ["immunity"], support: "active", description: "Prevents poison and bad poison." },
  { names: ["limber"], support: "active", description: "Prevents paralysis." },
  { names: ["insomnia", "vital-spirit"], support: "active", description: "Prevents sleep." },
  { names: ["water-veil"], support: "active", description: "Prevents burns." },
  { names: ["magma-armor"], support: "active", description: "Prevents freezing." },
  { names: ["own-tempo"], support: "active", description: "Prevents confusion." },
  { names: ["dry-skin"], support: "partial", description: "Currently blocks Water moves and restores HP. Its other franchise effects are not simulated." },
  { names: ["flash-fire"], support: "partial", description: "Currently blocks Fire moves. The follow-up Fire power boost is not simulated." },
  { names: ["lightning-rod", "motor-drive"], support: "partial", description: "Currently blocks Electric moves. Their usual stat boosts are not simulated." },
  { names: ["sap-sipper"], support: "partial", description: "Currently blocks Grass moves. Its usual Attack boost is not simulated." },
  { names: ["heatproof"], support: "partial", description: "Currently halves Fire-type damage." },
];

const statuses = [
  { name: "Burn", key: "burned", effect: "Deals 1/16 max HP after each turn and halves damage from Physical moves.", turnLoss: "No", hpLoss: "Yes", statEffect: "Physical damage x0.5" },
  { name: "Poison", key: "poisoned", effect: "Deals 1/8 max HP after each turn.", turnLoss: "No", hpLoss: "Yes", statEffect: "None" },
  { name: "Bad Poison", key: "badpoison", effect: "Deals increasing damage after each turn. Its counter resets after switching.", turnLoss: "No", hpLoss: "Yes", statEffect: "None" },
  { name: "Paralysis", key: "paralyzed", effect: "Cuts effective Speed in half and gives a 25% chance to lose the move that turn.", turnLoss: "Sometimes", hpLoss: "No", statEffect: "Speed x0.5" },
  { name: "Sleep", key: "asleep", effect: "Prevents moves for a finite number of turns. Remaining sleep turns survive switching.", turnLoss: "Yes, while asleep", hpLoss: "No", statEffect: "None" },
  { name: "Freeze", key: "frozen", effect: "Prevents moves until the Pokemon thaws. Each attempted move has a 20% thaw chance.", turnLoss: "Yes, until thawed", hpLoss: "No", statEffect: "None" },
  { name: "Confusion", key: "confused", effect: "A temporary condition lasting 2-5 turns. Each turn has a one-third chance to cause self-damage instead of moving.", turnLoss: "Sometimes", hpLoss: "Sometimes", statEffect: "None" },
];

const weather = [
  { name: "Rain", key: "rain", effect: "Water moves deal 50% more damage; Fire moves deal half damage.", boosted: ["Water"], reduced: ["Fire"], passive: "None" },
  { name: "Sun", key: "sun", effect: "Fire moves deal 50% more damage; Water moves deal half damage.", boosted: ["Fire"], reduced: ["Water"], passive: "None" },
  { name: "Sandstorm", key: "sandstorm", effect: "Deals 1/16 max HP after each turn to Pokemon that are not Rock, Ground, or Steel type.", boosted: [], reduced: [], passive: "Rock, Ground, and Steel are immune to the chip damage." },
  { name: "Snow", key: "snow", effect: "Ice-type Pokemon receive a 50% Defense benefit against Physical moves.", boosted: ["Ice Defense"], reduced: [], passive: "No HP damage" },
];

const glossary = [
  { term: "STAB", definition: "Same-Type Attack Bonus. A move matching one of the user's types deals 50% more damage." },
  { term: "Super effective", definition: "The move has a type advantage and deals multiplied damage." },
  { term: "Not very effective", definition: "The defending type resists the move, reducing its damage." },
  { term: "Immunity", definition: "The move deals no damage because of a type matchup or supported ability." },
  { term: "PP", definition: "Power Points. Using a move spends 1 PP; a move at 0 PP cannot be selected." },
  { term: "Accuracy", definition: "The move's chance to hit, adjusted by battle-only Accuracy and Evasion stages." },
  { term: "Priority", definition: "Moves with higher priority act first. Speed decides order when priority is equal." },
  { term: "Critical hit", definition: "A lucky hit that deals 50% more damage in this game." },
];

function formatAbilityName(name) {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getMoveExample(moves, name) {
  const move = moves[name];
  if (!move) return null;
  return {
    name: move.name,
    type: move.type,
    category: move.category,
    power: move.power,
    accuracy: move.accuracy,
  };
}

function createHandbookData(moves = {}) {
  const abilities = abilityGuide.flatMap((entry) =>
    entry.names
      .filter((name) => battleEffectAbilities.has(name))
      .map((name) => ({
        name: formatAbilityName(name),
        key: name,
        support: entry.support,
        description: entry.description,
      })),
  );
  return {
    typeChart,
    moveCategories: [
      { name: "Physical", formula: "Attack vs Defense", description: "Deals direct damage using Attack and the target's Defense.", example: getMoveExample(moves, "Tackle") },
      { name: "Special", formula: "Sp. Attack vs Sp. Defense", description: "Deals direct damage using Sp. Attack and the target's Sp. Defense.", example: getMoveExample(moves, "Thunderbolt") },
      { name: "Status", formula: "Effects instead of direct damage", description: "Applies status, healing, weather, or battle-only stat changes.", example: getMoveExample(moves, "Thunder Wave") },
    ],
    statuses,
    abilities,
    abilitySummary: {
      active: abilities.filter((entry) => entry.support === "active").length,
      partial: abilities.filter((entry) => entry.support === "partial").length,
      displayOnly: "Other canonical abilities can appear in Pokemon details but do not receive invented battle effects.",
    },
    weather,
    catching: [
      "Lower the wild Pokemon's HP before throwing a ball.",
      "Sleep and Freeze provide the largest status bonus; Paralysis, Burn, and Poison also help.",
      "Great Balls and Ultra Balls improve the catch multiplier. A Master Ball always succeeds.",
      "Legendary and mythical Pokemon have very low base catch rates, so stronger balls and status matter much more.",
    ],
    evolution: {
      supportedMethods: [...supportedEvolutionMethods],
      supportedText: [
        "Level: evolve after reaching the canonical required level.",
        "Evolution item: use a compatible stone or item from Pokemon details; wrong items are not consumed.",
        "Friendship and time: friendship-based day or night evolutions use the current game time.",
        "Known move, move type, gender, and relative Attack/Defense requirements are checked when canonical data requests them.",
        "Trade equivalents: Linking Cord handles plain trade evolutions; trade-item evolutions use their required item directly.",
      ],
      unsupportedText: "Beauty, unavailable locations, special device orientation, unsupported weather, and party-composition requirements remain blocked instead of being guessed.",
    },
    glossary,
  };
}

module.exports = { createHandbookData };
