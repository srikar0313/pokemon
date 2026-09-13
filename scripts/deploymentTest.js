const assert = require("assert");
const { createHealthHandler, getHealthStatus } = require("../backend/health");
const {
  createPersistenceCoordinator,
  resolveMode,
} = require("../backend/persistence/persistenceCoordinator");

async function main() {
  assert.throws(
    () => resolveMode({ NODE_ENV: "production", PERSISTENCE_MODE: "json" }),
    /Production requires PERSISTENCE_MODE=postgres/,
  );
  assert.throws(
    () => resolveMode({ NODE_ENV: "production", PERSISTENCE_MODE: "postgres" }),
    /requires DATABASE_URL/,
  );
  assert.strictEqual(
    resolveMode({
      NODE_ENV: "production",
      PERSISTENCE_MODE: "postgres",
      DATABASE_URL: "postgresql://example.invalid/game",
    }),
    "postgres",
  );

  const jsonHealth = await getHealthStatus({ mode: "json", prisma: null });
  assert.strictEqual(jsonHealth.httpStatus, 200);
  assert.strictEqual(jsonHealth.body.database.status, "not-applicable");

  const postgresHealth = await getHealthStatus({
    mode: "postgres",
    prisma: { $queryRawUnsafe: async () => [{ connected: 1 }] },
  });
  assert.strictEqual(postgresHealth.httpStatus, 200);
  assert.strictEqual(postgresHealth.body.database.status, "connected");

  const unavailableHealth = await getHealthStatus({
    mode: "postgres",
    prisma: {
      $queryRawUnsafe: async () => {
        throw new Error("database unavailable with secret details");
      },
    },
  });
  assert.strictEqual(unavailableHealth.httpStatus, 503);
  assert.deepStrictEqual(unavailableHealth.body, {
    status: "degraded",
    persistenceMode: "postgres",
    database: { required: true, status: "unavailable" },
  });

  const coordinator = createPersistenceCoordinator({
    environment: {
      NODE_ENV: "production",
      PERSISTENCE_MODE: "postgres",
      DATABASE_URL: "postgresql://example.invalid/game",
    },
    paths: {},
    loadJson: () => null,
    saveJson: () => null,
    repository: {
      connect: async () => {
        throw new Error("database unavailable");
      },
    },
  });
  await assert.rejects(coordinator.initialize(), /database unavailable/);

  let endpointStatus = null;
  let endpointBody = null;
  const response = {
    status(status) {
      endpointStatus = status;
      return this;
    },
    json(body) {
      endpointBody = body;
      return this;
    },
  };
  await createHealthHandler({ mode: "json", prisma: null })(null, response);
  assert.strictEqual(endpointStatus, 200);
  assert.strictEqual(endpointBody.status, "ok");
  assert.strictEqual(endpointBody.persistenceMode, "json");
  assert.strictEqual(endpointBody.database.status, "not-applicable");

  process.env.NODE_ENV = "development";
  process.env.PERSISTENCE_MODE = "json";
  const { app } = require("../backend/server");
  const publicRoutes = app._router.stack
    .filter((layer) => layer.route)
    .map((layer) => layer.route.path);
  assert(publicRoutes.includes("/api/health"));

  console.log("[deployment] Production mode, health, and startup failure checks passed.");
}

main().catch((error) => {
  console.error(`[deployment] Failed: ${error.message}`);
  process.exitCode = 1;
});
