const path = require("path");
const { AsyncLocalStorage } = require("async_hooks");
const {
  createAggregateRepository,
  DEFAULT_PLAYER_ID,
} = require("./aggregateRepository");

const SUPPORTED_MODES = new Set(["json", "postgres"]);

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function resolveMode(environment = process.env) {
  const requested = String(environment.PERSISTENCE_MODE || "json").toLowerCase();
  if (!SUPPORTED_MODES.has(requested)) {
    throw new Error(`Unsupported PERSISTENCE_MODE: ${requested}`);
  }
  if (requested === "postgres" && !environment.DATABASE_URL) {
    console.warn(
      "[persistence] DATABASE_URL is missing; using JSON persistence instead.",
    );
    return "json";
  }
  return requested;
}

function createPersistenceCoordinator({
  environment = process.env,
  paths,
  loadJson,
  saveJson,
  repository,
} = {}) {
  const mode = resolveMode(environment);
  const localPlayerId = String(environment.PLAYER_ID || DEFAULT_PLAYER_ID);
  const context = new AsyncLocalStorage();
  const normalizedPaths = Object.fromEntries(
    Object.entries(paths || {}).map(([key, value]) => [key, path.resolve(value)]),
  );
  const aggregates = new Map();
  const dirtyPlayers = new Set();
  const commitQueues = new Map();

  function getAggregateKey(filePath) {
    const resolved = path.resolve(filePath);
    return Object.entries(normalizedPaths).find(
      ([, value]) => value === resolved,
    )?.[0];
  }

  function getCurrentPlayerId() {
    if (mode === "json") return localPlayerId;
    const playerId = context.getStore()?.playerId;
    if (!playerId) {
      throw new Error("PostgreSQL game state requires authenticated player context");
    }
    return playerId;
  }

  function getCurrentAggregate() {
    const playerId = getCurrentPlayerId();
    if (!aggregates.has(playerId)) {
      aggregates.set(playerId, { player: null, team: null, storage: null });
    }
    return aggregates.get(playerId);
  }

  async function initialize() {
    if (mode === "postgres") repository ||= createAggregateRepository();
    if (mode === "postgres") await repository.connect?.();
    return { mode };
  }

  async function ensurePlayerLoaded(playerId) {
    if (mode !== "postgres" || aggregates.has(playerId)) return;
    const loaded = await repository.loadAggregate(playerId);
    if (!loaded) throw new Error(`Player save '${playerId}' does not exist`);
    aggregates.set(playerId, clone(loaded));
  }

  function readJsonFile(filePath, fallback) {
    if (mode === "json") return loadJson(filePath, fallback);
    const key = getAggregateKey(filePath);
    if (!key) return loadJson(filePath, fallback);
    return clone(getCurrentAggregate()[key] ?? fallback);
  }

  function writeJsonFile(filePath, value) {
    if (mode === "json") return saveJson(filePath, value);
    const key = getAggregateKey(filePath);
    if (!key) return saveJson(filePath, value);
    const playerId = getCurrentPlayerId();
    getCurrentAggregate()[key] = clone(value);
    dirtyPlayers.add(playerId);
    return value;
  }

  async function commit(playerId = getCurrentPlayerId()) {
    if (mode !== "postgres" || !dirtyPlayers.has(playerId)) return;
    const snapshot = clone(aggregates.get(playerId));
    dirtyPlayers.delete(playerId);
    const previous = commitQueues.get(playerId) || Promise.resolve();
    const next = previous.then(() => repository.saveAggregate(snapshot, playerId));
    commitQueues.set(playerId, next);
    try {
      await next;
    } catch (error) {
      dirtyPlayers.add(playerId);
      commitQueues.set(playerId, Promise.resolve());
      throw error;
    }
  }

  function createRequestMiddleware() {
    return async (req, res, next) => {
      if (mode !== "postgres") return next();
      const playerId = req.auth?.playerId;
      if (!playerId) return res.status(401).json({ error: "Authentication required." });
      try {
        await ensurePlayerLoaded(playerId);
      } catch (error) {
        return next(error);
      }
      context.run({ playerId }, () => {
        const sendJson = res.json.bind(res);
        let responseStarted = false;
        res.json = (body) => {
          if (responseStarted) return res;
          responseStarted = true;
          commit(playerId)
            .then(() => sendJson(body))
            .catch((error) => {
              console.error("[persistence] Transaction failed:", error);
              if (!res.headersSent) res.status(500);
              sendJson({ error: "Player progress could not be saved" });
            });
          return res;
        };
        next();
      });
    };
  }

  function invalidatePlayer(playerId) {
    aggregates.delete(playerId);
    dirtyPlayers.delete(playerId);
    commitQueues.delete(playerId);
  }

  return {
    mode,
    playerId: localPlayerId,
    initialize,
    ensurePlayerLoaded,
    readJsonFile,
    writeJsonFile,
    commit,
    createRequestMiddleware,
    getCurrentPlayerId,
    invalidatePlayer,
    runWithPlayer: (playerId, callback) => context.run({ playerId }, callback),
    getSnapshot: (playerId = getCurrentPlayerId()) => clone(aggregates.get(playerId)),
  };
}

module.exports = { createPersistenceCoordinator, resolveMode };
