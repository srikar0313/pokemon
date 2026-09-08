const battleEffectAbilities = new Set([
  "blaze",
  "dry-skin",
  "filter",
  "flash-fire",
  "heatproof",
  "huge-power",
  "immunity",
  "imposter",
  "insomnia",
  "intimidate",
  "levitate",
  "lightning-rod",
  "limber",
  "magma-armor",
  "motor-drive",
  "overgrow",
  "own-tempo",
  "pure-power",
  "sap-sipper",
  "solid-rock",
  "swarm",
  "technician",
  "thick-fat",
  "torrent",
  "vital-spirit",
  "volt-absorb",
  "water-absorb",
  "water-veil",
]);

function getAbilityName(pokemon) {
  return String(
    typeof pokemon?.ability === "string"
      ? pokemon.ability
      : pokemon?.ability?.name || "",
  ).toLowerCase();
}

function formatAbilityName(ability) {
  return String(ability || "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function healFromAbsorption(pokemon) {
  const maxHp = Math.max(1, pokemon.maxHp || pokemon.hp || 1);
  const healed = Math.min(
    maxHp - pokemon.currentHp,
    Math.max(1, Math.floor(maxHp / 4)),
  );
  pokemon.currentHp += healed;
  return healed;
}

function resolveTypeImmunity(defender, move) {
  const ability = getAbilityName(defender);
  const type = move?.type;
  if (ability === "levitate" && type === "Ground") {
    return { immune: true, message: `${defender.name}'s Levitate made it immune!` };
  }
  const absorptionTypes = {
    "water-absorb": "Water",
    "volt-absorb": "Electric",
    "dry-skin": "Water",
  };
  if (absorptionTypes[ability] === type) {
    const healed = healFromAbsorption(defender);
    return {
      immune: true,
      message: `${defender.name}'s ${formatAbilityName(ability)} absorbed the attack${healed ? ` and restored ${healed} HP` : ""}!`,
    };
  }
  const immunityTypes = {
    "flash-fire": "Fire",
    "lightning-rod": "Electric",
    "motor-drive": "Electric",
    "sap-sipper": "Grass",
  };
  if (immunityTypes[ability] === type) {
    return {
      immune: true,
      message: `${defender.name}'s ${formatAbilityName(ability)} blocked the attack!`,
    };
  }
  return { immune: false };
}

function getDamageModifier(attacker, defender, move, effectiveness) {
  const attackerAbility = getAbilityName(attacker);
  const defenderAbility = getAbilityName(defender);
  let modifier = 1;
  if (["huge-power", "pure-power"].includes(attackerAbility) && move.category === "Physical") {
    modifier *= 2;
  }
  if (attackerAbility === "technician" && Number(move.power || 0) <= 60) {
    modifier *= 1.5;
  }
  if (
    attacker.currentHp <= Math.max(1, attacker.maxHp || attacker.hp || 1) / 3 &&
    { blaze: "Fire", torrent: "Water", overgrow: "Grass", swarm: "Bug" }[
      attackerAbility
    ] === move.type
  ) {
    modifier *= 1.5;
  }
  if (
    ["thick-fat"].includes(defenderAbility) &&
    ["Fire", "Ice"].includes(move.type)
  ) {
    modifier *= 0.5;
  }
  if (defenderAbility === "heatproof" && move.type === "Fire") modifier *= 0.5;
  if (["filter", "solid-rock"].includes(defenderAbility) && effectiveness > 1) {
    modifier *= 0.75;
  }
  return modifier;
}

function canApplyStatus(pokemon, status) {
  const prevention = {
    immunity: ["poisoned", "badpoison"],
    limber: ["paralyzed"],
    insomnia: ["asleep"],
    "vital-spirit": ["asleep"],
    "water-veil": ["burned"],
    "magma-armor": ["frozen"],
    "own-tempo": ["confused"],
  };
  const ability = getAbilityName(pokemon);
  return !(prevention[ability] || []).includes(status);
}

function getStatusPreventionMessage(pokemon) {
  return `${pokemon.name}'s ${formatAbilityName(getAbilityName(pokemon))} prevented the status!`;
}

function applyEntryAbility(entering, opponent, log = []) {
  if (!entering || !opponent || getAbilityName(entering) !== "intimidate") {
    return log;
  }
  opponent.battleState = opponent.battleState || {};
  opponent.battleState.stages = opponent.battleState.stages || {};
  opponent.battleState.stages.attack = Math.max(
    -6,
    Number(opponent.battleState.stages.attack || 0) - 1,
  );
  log.push(`${entering.name}'s Intimidate lowered ${opponent.name}'s Attack!`);
  return log;
}

module.exports = {
  applyEntryAbility,
  battleEffectAbilities,
  canApplyStatus,
  formatAbilityName,
  getAbilityName,
  getDamageModifier,
  getStatusPreventionMessage,
  resolveTypeImmunity,
};
