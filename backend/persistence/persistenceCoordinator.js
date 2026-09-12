const path = require("path");
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
  const playerId = String(environment.PLAYER_ID || DEFAULT_PLAYER_ID);
  const normalizedPaths = Object.fromEntries(
    Object.entries(paths || {}).map(([key, value]) => [key, path.resolve(value)]),
  );
  let aggregate = { player: null, team: null, storage: null };
  let dirty = false;
  let commitQueue = Promise.resolve();

  function getAggregateKey(filePath) {
    const resolved = path.resolve(filePath);
    return Object.entries(normalizedPaths).find(
      ([, value]) => value === resolved,
    )?.[0];
  }

  async function initialize() {
    if (mode === "json") return { mode };
    const databaseRepository = repository || createAggregateRepository();
    repository = databaseRepository;
    const loaded = await repository.loadAggregate(playerId);
    if (loaded) {
      aggregate = clone(loaded);
      console.log(`[persistence] PostgreSQL player loaded: ${playerId}`);
      return { mode, loaded: true };
    }
    console.warn(
      `[persistence] PostgreSQL has no player '${playerId}'. Starting with game defaults. Run npm run db:import-legacy to import JSON saves.`,
    );
    return { mode, loaded: false };
  }

  function readJsonFile(filePath, fallback) {
    if (mode === "json") return loadJson(filePath, fallback);
    const key = getAggregateKey(filePath);
    if (!key) return loadJson(filePath, fallback);
    return clone(aggregate[key] ?? fallback);
  }

  function writeJsonFile(filePath, value) {
    if (mode === "json") return saveJson(filePath, value);
    const key = getAggregateKey(filePath);
    if (!key) return saveJson(filePath, value);
    aggregate[key] = clone(value);
    dirty = true;
    return value;
  }

  async function commit() {
    if (mode !== "postgres" || !dirty) return;
    const snapshot = clone(aggregate);
    dirty = false;
    commitQueue = commitQueue.then(() =>
      repository.saveAggregate(snapshot, playerId),
    );
    try {
      await commitQueue;
    } catch (error) {
      dirty = true;
      commitQueue = Promise.resolve();
      throw error;
    }
  }

  function createResponseMiddleware() {
    return (req, res, next) => {
      if (mode !== "postgres") return next();
      const sendJson = res.json.bind(res);
      let responseStarted = false;
      res.json = (body) => {
        if (responseStarted) return res;
        responseStarted = true;
        commit()
          .then(() => sendJson(body))
          .catch((error) => {
            console.error("[persistence] Transaction failed:", error);
            if (!res.headersSent) res.status(500);
            sendJson({ error: "Player progress could not be saved" });
          });
        return res;
      };
      next();
    };
  }

  return {
    mode,
    playerId,
    initialize,
    readJsonFile,
    writeJsonFile,
    commit,
    createResponseMiddleware,
    getSnapshot: () => clone(aggregate),
  };
}

module.exports = { createPersistenceCoordinator, resolveMode };
