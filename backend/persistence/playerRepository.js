function asArray(value) {
  return Array.isArray(value) ? value : [];
}

async function loadPlayer(client, playerId) {
  return client.player.findUnique({ where: { id: playerId } });
}

async function savePlayer(client, playerId, state = {}) {
  const knownKeys = new Set([
    "trainerName", "coins", "money", "level", "xp", "championDefeated",
    "pokedex", "unlockedAreas", "unlockedGyms", "defeatedNpcs",
    "achievements", "items", "badges", "story", "league", "partyPresets",
  ]);
  const data = {
    trainerName: String(state.trainerName || "Player"),
    coins: Number(state.coins ?? state.money ?? 100) || 0,
    level: Math.max(1, Number(state.level) || 1),
    xp: Math.max(0, Number(state.xp) || 0),
    championDefeated: Boolean(state.championDefeated),
    pokedex: state.pokedex || {},
    unlockedAreas: asArray(state.unlockedAreas).map(String),
    unlockedGyms: asArray(state.unlockedGyms).map(Number).filter(Number.isFinite),
    defeatedNpcs: asArray(state.defeatedNpcs).map(Number).filter(Number.isFinite),
    achievements: asArray(state.achievements).map(String),
    extraState: Object.fromEntries(
      Object.entries(state).filter(([key]) => !knownKeys.has(key)),
    ),
  };
  return client.player.upsert({
    where: { id: playerId },
    create: { id: playerId, ...data },
    update: data,
  });
}

module.exports = { loadPlayer, savePlayer };
