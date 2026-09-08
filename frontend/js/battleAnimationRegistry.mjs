export const BATTLE_TYPES = [
  "Normal",
  "Fire",
  "Water",
  "Electric",
  "Grass",
  "Ice",
  "Fighting",
  "Poison",
  "Ground",
  "Flying",
  "Psychic",
  "Bug",
  "Rock",
  "Ghost",
  "Dragon",
  "Dark",
  "Steel",
  "Fairy",
];

const TYPE_FAMILIES = {
  Normal: "impact",
  Fire: "flame",
  Water: "water",
  Electric: "lightning",
  Grass: "leaves",
  Ice: "ice",
  Fighting: "impact",
  Poison: "poison",
  Ground: "ground",
  Flying: "wind",
  Psychic: "psychic",
  Bug: "swarm",
  Rock: "rock",
  Ghost: "ghost",
  Dragon: "dragon",
  Dark: "dark",
  Steel: "steel",
  Fairy: "fairy",
};

const TYPE_COLORS = {
  Normal: 0xd8d3c7,
  Fire: 0xff682f,
  Water: 0x36a9e8,
  Electric: 0xffdf35,
  Grass: 0x54c66a,
  Ice: 0xa8efff,
  Fighting: 0xd64b3f,
  Poison: 0xa95bd4,
  Ground: 0xc79a5b,
  Flying: 0x9dc9f4,
  Psychic: 0xf06ca9,
  Bug: 0x9ac43c,
  Rock: 0xaa8752,
  Ghost: 0x7957b5,
  Dragon: 0x6176e8,
  Dark: 0x4a4258,
  Steel: 0xaab9c7,
  Fairy: 0xf39ad4,
};

const SPECIAL_MOVE_ANIMATIONS = {
  thunderbolt: { id: "thunderbolt", family: "lightning", archetype: "beam", intensity: 1.35 },
  flamethrower: { id: "flamethrower", family: "flame", archetype: "beam", intensity: 1.35 },
  surf: { id: "surf", family: "water", archetype: "area", intensity: 1.5 },
  earthquake: { id: "earthquake", family: "ground", archetype: "ground", intensity: 1.5 },
  "shadow-ball": { id: "shadow-ball", family: "ghost", archetype: "mystic", intensity: 1.35 },
  "ice-beam": { id: "ice-beam", family: "ice", archetype: "beam", intensity: 1.35 },
  "hyper-beam": { id: "hyper-beam", family: "beam", archetype: "beam", intensity: 1.65 },
};

const BEAM_MOVES = new Set(["aurora-beam", "bubble-beam", "dragon-breath", "signal-beam", "solar-beam"]);
const AREA_MOVES = new Set(["blizzard", "discharge", "eruption", "heat-wave", "razor-wind", "rock-slide"]);
const GROUND_MOVES = new Set(["bulldoze", "magnitude", "mud-shot", "sand-attack"]);

export const TYPE_EFFECT_LAYERS = Object.freeze({
  Normal: ["ring", "impact"], Fire: ["trail", "sparks", "heat"],
  Water: ["stream", "splash", "mist"], Electric: ["arcs", "flash"],
  Grass: ["leaves", "pollen"], Ice: ["shards", "frost"],
  Fighting: ["dash", "impact"], Poison: ["bubbles", "haze"],
  Ground: ["debris", "shockwave", "dust"], Flying: ["gust", "feathers"],
  Psychic: ["rings", "orbs", "distortion"], Bug: ["swarm", "slashes"],
  Rock: ["fragments", "dust"], Ghost: ["wisps", "orb", "fade"],
  Dragon: ["trail", "burst"], Dark: ["slashes", "shadow"],
  Steel: ["sparks", "metal"], Fairy: ["rings", "sparkles"],
});

export function normalizeAnimationKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function resolveMoveAnimation(move = {}) {
  const type = BATTLE_TYPES.includes(move.type) ? move.type : "Normal";
  const category = ["Physical", "Special", "Status"].includes(move.category)
    ? move.category
    : "Physical";
  const special = SPECIAL_MOVE_ANIMATIONS[normalizeAnimationKey(move.name)];
  const key = normalizeAnimationKey(move.name);
  const archetype = special?.archetype ||
    (category === "Status"
      ? "setup"
      : category === "Physical"
        ? "contact"
        : BEAM_MOVES.has(key)
          ? "beam"
          : AREA_MOVES.has(key)
            ? "area"
            : GROUND_MOVES.has(key) || type === "Ground"
              ? "ground"
              : ["Psychic", "Ghost", "Dark", "Fairy"].includes(type)
                ? "mystic"
                : "projectile");
  const motion =
    archetype === "contact"
      ? "lunge"
      : archetype === "setup"
        ? "aura"
        : archetype;

  return {
    id: special?.id || `${type.toLowerCase()}-${motion}`,
    family: special?.family || TYPE_FAMILIES[type],
    type,
    category,
    motion,
    archetype,
    layers: TYPE_EFFECT_LAYERS[type],
    color: TYPE_COLORS[type],
    intensity: special?.intensity || (category === "Status" ? 0.75 : 1),
    duration: special ? 620 : archetype === "contact" ? 390 : archetype === "setup" ? 420 : 520,
    phases: ["anticipation", "buildup", "travel", "impact", "recovery"],
    specific: Boolean(special),
  };
}

export function resolveHitReaction({ damage = 0, maxHp = 1, critical = false, effectiveness = 1 } = {}) {
  if (effectiveness === 0) return { id: "immune", strength: 0, flash: "immune", shake: false };
  const ratio = Math.max(0, Number(damage || 0)) / Math.max(1, Number(maxHp || 1));
  if (critical) return { id: "critical", strength: 1.45, flash: "critical", shake: true };
  if (effectiveness > 1) return { id: "effective", strength: 1.2, flash: "effective", shake: true };
  if (effectiveness < 1) return { id: "resisted", strength: 0.45, flash: "weak", shake: false };
  if (ratio >= 0.3 || damage >= 30) return { id: "heavy", strength: 1, flash: "heavy", shake: true };
  return { id: "light", strength: 0.7, flash: "hit", shake: true };
}

export function resolveBattleIntro(mode = "wild") {
  const intros = {
    wild: { label: "Wild encounter", duration: 420, intensity: 0.55 },
    trainer: { label: "Trainer battle", duration: 620, intensity: 0.75 },
    gym: { label: "Gym challenge", duration: 760, intensity: 0.9 },
    elite: { label: "Elite Four", duration: 820, intensity: 1 },
    champion: { label: "Champion battle", duration: 900, intensity: 1.1 },
    legendary: { label: "Legendary encounter", duration: 920, intensity: 1.15 },
  };
  return intros[mode] || intros.wild;
}

export function normalizeWeatherVisual(weather) {
  const value = String(weather || "clear").toLowerCase();
  if (["sun", "sunny"].includes(value)) return "sun";
  return ["rain", "sandstorm", "snow"].includes(value) ? value : "clear";
}

export function resolveBattlePresentationMode(kind, opponent = {}) {
  if (["legendary", "mythical"].includes(opponent.rarity)) return "legendary";
  if (kind === "champion") return "champion";
  if (kind === "elite") return "elite";
  if (kind === "gym") return "gym";
  if (kind === "npc" || kind === "trainer") return "trainer";
  return "wild";
}

export function getMotionTiming(reducedMotion, requestedDuration = 430) {
  return reducedMotion
    ? { duration: Math.min(120, requestedDuration), camera: false, shake: false }
    : { duration: requestedDuration, camera: true, shake: true };
}

export const SPECIAL_MOVE_NAMES = Object.freeze(
  Object.keys(SPECIAL_MOVE_ANIMATIONS),
);
