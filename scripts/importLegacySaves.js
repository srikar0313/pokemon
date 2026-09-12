require("dotenv/config");

const path = require("path");
const { randomUUID } = require("crypto");
const { loadJson } = require("../backend/dataLoader");
const {
  createAggregateRepository,
  DEFAULT_PLAYER_ID,
} = require("../backend/persistence/aggregateRepository");
const { disconnectPrisma } = require("../backend/persistence/prismaClient");

const rootDir = path.join(__dirname, "..");

function ensureOwnedIds(team, storage) {
  const used = new Set();
  for (const pokemon of [...team, ...storage]) {
    let ownedId = String(pokemon.ownedId || "").trim();
    if (!ownedId || used.has(ownedId)) ownedId = randomUUID();
    pokemon.ownedId = ownedId;
    used.add(ownedId);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for legacy save import");
  }
  const playerId = String(process.env.PLAYER_ID || DEFAULT_PLAYER_ID);
  const player = loadJson(path.join(rootDir, "player_state.json"), {});
  const team = loadJson(path.join(rootDir, "inventory.json"), []);
  const storage = loadJson(path.join(rootDir, "storage.json"), []);
  ensureOwnedIds(team, storage);
  const repository = createAggregateRepository();
  const result = await repository.importLegacy(
    { player, team, storage },
    { playerId },
  );
  if (!result.imported) {
    console.log(`[db:import-legacy] '${playerId}' was already imported; no changes made.`);
    return;
  }
  console.log(
    `[db:import-legacy] Imported player '${playerId}' with ${team.length} party and ${storage.length} storage Pokemon.`,
  );
}

main()
  .catch((error) => {
    console.error(`[db:import-legacy] ${error.message}`);
    process.exitCode = 1;
  })
  .finally(disconnectPrisma);
