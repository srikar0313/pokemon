function createScopedSessionStore(resolvePlayerId) {
  const sessions = new Map();
  return {
    get: () => sessions.get(resolvePlayerId()),
    set: (_legacyKey, value) => sessions.set(resolvePlayerId(), value),
    delete: () => sessions.delete(resolvePlayerId()),
    clearPlayer: (playerId) => sessions.delete(playerId),
  };
}

module.exports = { createScopedSessionStore };
