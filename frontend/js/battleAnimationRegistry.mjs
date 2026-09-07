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
  thunderbolt: { id: "thunderbolt", family: "lightning", intensity: 1.35 },
  flamethrower: { id: "flamethrower", family: "flame", intensity: 1.35 },
  surf: { id: "surf", family: "water", intensity: 1.5 },
  earthquake: { id: "earthquake", family: "ground", intensity: 1.5 },
  "shadow-ball": { id: "shadow-ball", family: "ghost", intensity: 1.35 },
  "ice-beam": { id: "ice-beam", family: "ice", intensity: 1.35 },
  "hyper-beam": { id: "hyper-beam", family: "beam", intensity: 1.65 },
};

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
  const motion =
    category === "Physical"
      ? "lunge"
      : category === "Status"
        ? "aura"
        : "projectile";

  return {
    id: special?.id || `${type.toLowerCase()}-${motion}`,
    family: special?.family || TYPE_FAMILIES[type],
    type,
    category,
    motion,
    color: TYPE_COLORS[type],
    intensity: special?.intensity || (category === "Status" ? 0.75 : 1),
    duration: special ? 520 : category === "Physical" ? 330 : 430,
    specific: Boolean(special),
  };
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
