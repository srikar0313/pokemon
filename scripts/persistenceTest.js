const assert = require("assert");
const path = require("path");
const {
  createPersistenceCoordinator,
  resolveMode,
} = require("../backend/persistence/persistenceCoordinator");

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function createMemoryRepository(initial = null) {
  let stored = initial ? copy(initial) : null;
  let saveCount = 0;
  return {
    async loadAggregate() {
      return stored ? copy(stored) : null;
    },
    async saveAggregate(aggregate) {
      saveCount += 1;
      stored = copy(aggregate);
    },
    getStored: () => copy(stored),
    getSaveCount: () => saveCount,
  };
}

function createPrismaTransactionFake() {
  const metadata = new Map();
  let transactionCount = 0;
  const noResult = async () => ({});
  const model = {
    deleteMany: noResult,
    createMany: noResult,
    create: noResult,
    upsert: noResult,
  };
  const prisma = {
    player: model,
    playerPokemon: model,
    inventoryItem: model,
    badge: model,
    storyState: model,
    recurringCharacterProgress: model,
    leagueState: model,
    partyPresetPokemon: model,
    partyPreset: model,
    persistenceMetadata: {
      findUnique: async ({ where }) => metadata.get(where.key) || null,
      create: async ({ data }) => {
        metadata.set(data.key, data);
        return data;
      },
    },
    async $transaction(callback) {
      transactionCount += 1;
      return callback(prisma);
    },
    getTransactionCount: () => transactionCount,
  };
  return prisma;
}

async function runRepositoryTransactionTests() {
  const { createAggregateRepository } = require("../backend/persistence/aggregateRepository");
  const prisma = createPrismaTransactionFake();
  const repository = createAggregateRepository({ prisma });
  const aggregate = {
    player: {
      trainerName: "Transaction Tester",
      items: {},
      badges: [],
      story: {},
      league: {},
      partyPresets: [],
    },
    team: [],
    storage: [],
  };
  await repository.saveAggregate(aggregate, "transaction-player");
  assert.strictEqual(prisma.getTransactionCount(), 1);
  const firstImport = await repository.importLegacy(aggregate, {
    playerId: "import-player",
    importKey: "legacy-json:import-player",
  });
  const secondImport = await repository.importLegacy(aggregate, {
    playerId: "import-player",
    importKey: "legacy-json:import-player",
  });
  assert(firstImport.imported && !secondImport.imported);
  assert.strictEqual(secondImport.reason, "already-imported");
}

async function runCoordinatorTests() {
  const paths = {
    player: path.resolve("player_state.json"),
    team: path.resolve("inventory.json"),
    storage: path.resolve("storage.json"),
  };
  const initial = {
    player: {
      trainerName: "Persistence Tester",
      coins: 1234,
      badges: ["Volt Badge"],
      items: { thunderStone: 1 },
      story: {
        currentAct: 3,
        characters: {
          "rhea-vale": { playerWins: 2, playerLosses: 1 },
        },
      },
      league: {
        completed: true,
        completionCount: 1,
        hallOfFame: { team: [{ speciesId: 25, shiny: true }] },
      },
      partyPresets: [{ slot: 1, pokemonIds: ["owned-pikachu"] }],
    },
    team: [
      {
        ownedId: "owned-pikachu",
        id: 25,
        speciesId: 25,
        name: "Pikachu",
        shiny: true,
        form: { id: "base" },
        moves: [{ name: "Thunderbolt", currentPp: 7, maxPp: 15 }],
      },
    ],
    storage: [
      {
        ownedId: "owned-pidgeot",
        id: 16,
        speciesId: 18,
        name: "Pidgeot",
        moves: [{ name: "Gust", currentPp: 20, maxPp: 35 }],
      },
    ],
  };
  const repository = createMemoryRepository(initial);
  const coordinator = createPersistenceCoordinator({
    environment: {
      PERSISTENCE_MODE: "postgres",
      DATABASE_URL: "postgresql://test.invalid/test",
      PLAYER_ID: "test-player",
    },
    paths,
    loadJson: () => {
      throw new Error("PostgreSQL mode unexpectedly read mutable JSON");
    },
    saveJson: () => {
      throw new Error("PostgreSQL mode unexpectedly wrote mutable JSON");
    },
    repository,
  });
  await coordinator.initialize();
  const loadedTeam = coordinator.readJsonFile(paths.team, []);
  const loadedStorage = coordinator.readJsonFile(paths.storage, []);
  const loadedPlayer = coordinator.readJsonFile(paths.player, {});
  assert.strictEqual(loadedTeam[0].ownedId, "owned-pikachu");
  assert.strictEqual(loadedTeam[0].moves[0].currentPp, 7);
  assert.strictEqual(loadedStorage[0].id, 16);
  assert.strictEqual(loadedStorage[0].speciesId, 18);
  assert.strictEqual(loadedPlayer.story.characters["rhea-vale"].playerWins, 2);
  assert.strictEqual(loadedPlayer.league.hallOfFame.team[0].shiny, true);

  loadedPlayer.coins += 100;
  loadedPlayer.items.thunderStone = 0;
  coordinator.writeJsonFile(paths.player, loadedPlayer);
  coordinator.writeJsonFile(paths.team, [...loadedTeam, loadedStorage[0]]);
  coordinator.writeJsonFile(paths.storage, []);
  await coordinator.commit();
  assert.strictEqual(repository.getSaveCount(), 1, "changes were not committed once");

  const restarted = createPersistenceCoordinator({
    environment: {
      PERSISTENCE_MODE: "postgres",
      DATABASE_URL: "postgresql://test.invalid/test",
      PLAYER_ID: "test-player",
    },
    paths,
    loadJson: () => null,
    saveJson: () => null,
    repository,
  });
  await restarted.initialize();
  assert.strictEqual(restarted.readJsonFile(paths.player, {}).coins, 1334);
  assert.strictEqual(restarted.readJsonFile(paths.team, []).length, 2);
  assert.strictEqual(restarted.readJsonFile(paths.storage, []).length, 0);
  assert.strictEqual(resolveMode({ PERSISTENCE_MODE: "json" }), "json");
  assert.strictEqual(resolveMode({ PERSISTENCE_MODE: "postgres" }), "json");
}

async function runPostgresIntegration() {
  if (!process.env.DATABASE_URL) {
    console.log("[persistence] PostgreSQL integration skipped: DATABASE_URL is not set.");
    return;
  }
  const { createAggregateRepository } = require("../backend/persistence/aggregateRepository");
  const { getPrismaClient, disconnectPrisma } = require("../backend/persistence/prismaClient");
  const prisma = getPrismaClient();
  const repository = createAggregateRepository({ prisma });
  const playerId = `persistence-test-${Date.now()}`;
  const importKey = `legacy-json:${playerId}`;
  const aggregate = {
    player: {
      trainerName: "Database Tester",
      coins: 500,
      level: 4,
      xp: 20,
      championDefeated: false,
      pokedex: { seen: [25], caught: [25] },
      unlockedAreas: ["forest"],
      unlockedGyms: [1],
      defeatedNpcs: [],
      achievements: [],
      items: { standard: 4 },
      badges: [],
      story: { version: "story-v1", currentAct: 1, currentChapter: "act-1" },
      league: { version: "league-v1", completed: false },
      partyPresets: [],
    },
    team: [{
      ownedId: `${playerId}-starter`, id: 25, speciesId: 25, name: "Pikachu",
      level: 4, xp: 20, currentHp: 35, maxHp: 35, moves: [],
    }],
    storage: [],
  };
  try {
    const first = await repository.importLegacy(aggregate, { playerId, importKey });
    const second = await repository.importLegacy(aggregate, { playerId, importKey });
    const loaded = await repository.loadAggregate(playerId);
    assert(first.imported && !second.imported, "legacy import was not idempotent");
    assert.strictEqual(loaded.team[0].ownedId, `${playerId}-starter`);
    loaded.player.coins = 750;
    await repository.saveAggregate(loaded, playerId);
    assert.strictEqual((await repository.loadAggregate(playerId)).player.coins, 750);
    console.log("[persistence] PostgreSQL integration passed.");
  } finally {
    await prisma.persistenceMetadata.deleteMany({ where: { key: importKey } });
    await prisma.player.deleteMany({ where: { id: playerId } });
    await disconnectPrisma();
  }
}

async function main() {
  await runCoordinatorTests();
  console.log("[persistence] Coordinator and restart tests passed.");
  await runRepositoryTransactionTests();
  console.log("[persistence] Transaction and idempotent-import tests passed.");
  await runPostgresIntegration();
}

main().catch((error) => {
  console.error("[persistence] Test failed:", error);
  process.exitCode = 1;
});
