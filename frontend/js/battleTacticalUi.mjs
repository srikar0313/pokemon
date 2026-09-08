export const STAGE_LABELS = Object.freeze({
  attack: "ATK",
  defense: "DEF",
  specialAttack: "SP. ATK",
  specialDefense: "SP. DEF",
  speed: "SPE",
  accuracy: "ACC",
  evasion: "EVA",
});

export const WEATHER_HUD = Object.freeze({
  clear: { label: "Clear", icon: "--", description: "No weather modifiers." },
  rain: { label: "Rain", icon: "RA", description: "Water moves are stronger; Fire moves are weaker." },
  sun: { label: "Sun", icon: "SU", description: "Fire moves are stronger; Water moves are weaker." },
  sandstorm: { label: "Sandstorm", icon: "SA", description: "Damages non-Rock, Ground, and Steel Pokemon each turn." },
  snow: { label: "Snow", icon: "SN", description: "Ice Pokemon gain a practical physical defense benefit." },
});

const STATUS_LABELS = Object.freeze({
  burned: "Burn",
  poisoned: "Poison",
  badpoison: "Bad Poison",
  paralyzed: "Paralysis",
  asleep: "Sleep",
  frozen: "Freeze",
});

export function getEffectivenessDisplay(multiplier, damaging = true) {
  if (!damaging) return null;
  const value = Number(multiplier);
  if (value === 0) return { key: "immune", label: "NO EFFECT" };
  if (value > 1) return { key: "super", label: "SUPER EFFECTIVE" };
  if (value > 0 && value < 1) return { key: "resisted", label: "NOT VERY EFFECTIVE" };
  return { key: "effective", label: "EFFECTIVE" };
}

export function describeMoveEffect(move = {}) {
  const effect = move.effect;
  if (!effect) return "No additional effect.";
  const chance = effect.chance != null && effect.chance < 100
    ? ` (${effect.chance}% chance)`
    : "";
  if (effect.type === "status") {
    return `May cause ${STATUS_LABELS[effect.status] || effect.status || "a status condition"}${chance}.`;
  }
  if (effect.type === "statChange") {
    const target = effect.target === "self" ? "the user" : "the target";
    const direction = Number(effect.stages || 0) >= 0 ? "raises" : "lowers";
    return `${direction.charAt(0).toUpperCase() + direction.slice(1)} ${target}'s ${STAGE_LABELS[effect.stat] || effect.stat || "stat"}${chance}.`;
  }
  if (effect.type === "heal") return `Restores ${effect.percent || 50}% of the user's maximum HP.`;
  if (effect.type === "healAndSleep") return "Restores HP and puts the user to sleep.";
  if (effect.type === "recoil") return `The user takes ${effect.percent || 25}% recoil from damage dealt.`;
  if (effect.type === "drain") return `Restores ${effect.percent || 50}% of damage dealt.`;
  if (effect.type === "weather") return `Changes the weather to ${effect.weather || "clear"}.`;
  if (effect.type === "criticalBoost") return "Has an increased critical-hit chance.";
  if (effect.type === "allStatsUp") return `May raise all battle stats${chance}.`;
  if (effect.type === "randomMove") return "Uses a random supported move.";
  return `${String(effect.type || "Unknown")} effect is not implemented yet.`;
}

export function getMoveDisplayData(move = {}, effectiveness = 1) {
  const maxPp = move.maxPp ?? move.pp ?? move.currentPp ?? 0;
  const currentPp = Math.max(0, Math.min(move.currentPp ?? maxPp, maxPp));
  const power = Number(move.power || 0);
  const damaging = move.category !== "Status" && power > 0;
  return {
    name: move.name || "Unknown Move",
    type: move.type || "Normal",
    category: move.category || "Physical",
    categoryKey: String(move.category || "Physical").toLowerCase(),
    power: damaging ? power : 0,
    accuracy: move.accuracy ?? 100,
    priority: Number(move.priority || 0),
    currentPp,
    maxPp,
    effectiveness: getEffectivenessDisplay(effectiveness, damaging),
    effectDescription: describeMoveEffect(move),
  };
}

export function getStageBadges(pokemon = {}) {
  const stages = pokemon.battleState?.stages || {};
  return Object.entries(STAGE_LABELS)
    .map(([stat, label]) => ({ stat, label, value: Number(stages[stat] || 0) }))
    .filter((entry) => entry.value !== 0)
    .map((entry) => ({
      ...entry,
      text: `${entry.label} ${entry.value > 0 ? "+" : ""}${entry.value}`,
      direction: entry.value > 0 ? "up" : "down",
    }));
}

export function getBattleConditions(pokemon = {}) {
  const conditions = [];
  if (pokemon.status && pokemon.status !== "none") {
    conditions.push({ key: pokemon.status, label: STATUS_LABELS[pokemon.status] || pokemon.status });
  }
  const volatile = pokemon.battleState?.volatile || {};
  if (Number(volatile.confusionTurns || 0) > 0) conditions.push({ key: "confused", label: "Confused" });
  if (volatile.flinched) conditions.push({ key: "flinched", label: "Flinched" });
  if (pokemon.battleState?.protected) conditions.push({ key: "protected", label: "Protected" });
  const transform = pokemon.battleState?.transform;
  if (transform?.active) {
    conditions.push({
      key: "transformed",
      label: `${transform.originalName || "Pokemon"} transformed into ${transform.targetName || pokemon.name}`,
    });
  }
  return conditions;
}

export function getCurrentBattleAbility(pokemon = {}) {
  const ability = typeof pokemon.ability === "string" ? pokemon.ability : pokemon.ability?.name;
  const label = String(ability || "Unknown")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return {
    name: ability || null,
    label,
    copied: Boolean(pokemon.battleState?.transform?.active),
  };
}

export function getWeatherDisplay(weather = "clear") {
  const normalized = ["sun", "sunny"].includes(String(weather).toLowerCase())
    ? "sun"
    : String(weather || "clear").toLowerCase();
  return { key: normalized, ...(WEATHER_HUD[normalized] || WEATHER_HUD.clear) };
}
