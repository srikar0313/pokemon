const assert = require("assert");
const { createAuthService, INVALID_LOGIN } = require("../backend/auth/authService");
const { createAuthMiddleware } = require("../backend/auth/authMiddleware");
const {
  hashSessionToken,
  getCookieOptions,
  parseCookies,
} = require("../backend/auth/sessionService");
const { claimLegacyPlayer } = require("../backend/auth/accountRepository");
const { createScopedSessionStore } = require("../backend/auth/scopedSessionStore");

function createAuthPrismaFake() {
  const users = new Map();
  const players = new Map();
  const sessions = new Map();
  const metadata = new Map();
  let transactionCount = 0;

  function findUserByEmail(email) {
    return [...users.values()].find((user) => user.email === email) || null;
  }

  function withPlayer(user) {
    if (!user) return null;
    return {
      ...user,
      player: [...players.values()].find((player) => player.userId === user.id) || null,
    };
  }

  const prisma = {
    user: {
      create: async ({ data }) => {
        if (findUserByEmail(data.email)) {
          const error = new Error("unique email");
          error.code = "P2002";
          throw error;
        }
        const user = { ...data, createdAt: new Date(), updatedAt: new Date() };
        users.set(user.id, user);
        return { ...user };
      },
      findUnique: async ({ where }) => withPlayer(findUserByEmail(where.email)),
    },
    player: {
      update: async ({ where, data }) => {
        const player = { ...players.get(where.id), ...data };
        players.set(where.id, player);
        return { ...player };
      },
      findUnique: async ({ where }) => players.get(where.id) || null,
      delete: async ({ where }) => players.delete(where.id),
    },
    authSession: {
      create: async ({ data }) => {
        const session = { id: `session-${sessions.size + 1}`, ...data };
        sessions.set(session.tokenHash, session);
        return session;
      },
      findUnique: async ({ where }) => {
        const session = sessions.get(where.tokenHash);
        if (!session) return null;
        return { ...session, user: withPlayer(users.get(session.userId)) };
      },
      deleteMany: async ({ where }) => {
        let count = 0;
        for (const [hash, session] of sessions) {
          const matchesHash = !where.tokenHash || where.tokenHash === hash;
          const matchesUser = !where.userId || where.userId === session.userId;
          const matchesExpiry =
            !where.expiresAt?.lte || session.expiresAt <= where.expiresAt.lte;
          if (matchesHash && matchesUser && matchesExpiry) {
            sessions.delete(hash);
            count += 1;
          }
        }
        return { count };
      },
      delete: async ({ where }) => {
        for (const [hash, session] of sessions) {
          if (session.id === where.id) sessions.delete(hash);
        }
      },
    },
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
    state: { users, players, sessions, metadata },
    getTransactionCount: () => transactionCount,
  };
  return prisma;
}

async function testAuthFlow() {
  assert.strictEqual(getCookieOptions({ NODE_ENV: "production" }).secure, true);
  assert.strictEqual(getCookieOptions({ NODE_ENV: "development" }).secure, false);
  assert.strictEqual(getCookieOptions({}).httpOnly, true);
  assert.strictEqual(getCookieOptions({}).sameSite, "lax");
  assert.deepStrictEqual(parseCookies("broken=%E0%A4%A; valid=value"), {
    valid: "value",
  });
  const prisma = createAuthPrismaFake();
  const aggregates = new Map();
  let starterSequence = 0;
  const aggregateRepository = {
    saveWithClient: async (_transaction, aggregate, playerId) => {
      aggregates.set(playerId, JSON.parse(JSON.stringify(aggregate)));
      prisma.state.players.set(playerId, {
        id: playerId,
        trainerName: aggregate.player.trainerName,
        coins: aggregate.player.coins,
        level: aggregate.player.level,
        championDefeated: false,
        userId: null,
      });
    },
  };
  let clock = new Date("2026-09-13T10:00:00.000Z");
  const service = createAuthService({
    prisma,
    aggregateRepository,
    passwordRounds: 4,
    sessionDays: 1,
    now: () => clock,
    createDefaultAggregate: () => {
      starterSequence += 1;
      return {
        player: {
          trainerName: "Player",
          coins: 100,
          level: 1,
          items: { standard: 10 },
          story: { currentAct: 1, flags: [] },
          league: { completed: false, hallOfFame: null },
        },
        team: [{ ownedId: `starter-${starterSequence}`, name: "Pikachu" }],
        storage: [],
      };
    },
  });

  const first = await service.register({
    email: "  TrainerA@Example.com ",
    password: "strong-pass-a",
  });
  assert(first.success && first.account.email === "trainera@example.com");
  const storedUser = [...prisma.state.users.values()][0];
  assert.notStrictEqual(storedUser.passwordHash, "strong-pass-a");
  assert(storedUser.passwordHash.startsWith("$2"));
  assert(prisma.state.sessions.has(hashSessionToken(first.token)));
  assert(!prisma.state.sessions.has(first.token), "raw session token was stored");
  assert.strictEqual((await service.authenticate(first.token)).playerId, first.playerId);

  const duplicate = await service.register({
    email: "TRAINERA@example.com",
    password: "another-password",
  });
  assert.strictEqual(duplicate.status, 409);
  const incorrect = await service.login({
    email: "trainera@example.com",
    password: "wrong-password",
  });
  assert.strictEqual(incorrect.error, INVALID_LOGIN);
  const login = await service.login({
    email: "trainera@example.com",
    password: "strong-pass-a",
  });
  assert(login.success);
  await service.logout(login.token);
  assert.strictEqual(await service.authenticate(login.token), null);

  const second = await service.register({
    email: "trainerb@example.com",
    password: "strong-pass-b",
  });
  assert(second.success && second.playerId !== first.playerId);
  const firstSave = aggregates.get(first.playerId);
  const secondSave = aggregates.get(second.playerId);
  assert.strictEqual(firstSave.team.length, 1);
  assert.strictEqual(firstSave.team[0].name, "Pikachu");
  assert.strictEqual(secondSave.team.length, 1);
  assert.strictEqual(secondSave.team[0].name, "Pikachu");
  firstSave.player.coins = 900;
  firstSave.player.items.standard = 1;
  firstSave.player.story.flags.push("player-a-only");
  firstSave.player.league = { completed: true, hallOfFame: { team: ["A"] } };
  assert.strictEqual(secondSave.player.coins, 100);
  assert.strictEqual(secondSave.player.items.standard, 10);
  assert.deepStrictEqual(secondSave.player.story.flags, []);
  assert.strictEqual(secondSave.player.league.completed, false);
  assert.notStrictEqual(firstSave.team[0].ownedId, secondSave.team[0].ownedId);

  clock = new Date("2026-09-15T10:00:00.000Z");
  assert.strictEqual(await service.authenticate(second.token), null);

  const middleware = createAuthMiddleware({ mode: "postgres", authService: service });
  let status = null;
  let payload = null;
  middleware.requireAuth(
    { auth: null },
    {
      status(code) { status = code; return this; },
      json(body) { payload = body; return this; },
    },
    () => assert.fail("unauthenticated request reached protected API"),
  );
  assert.strictEqual(status, 401);
  assert.strictEqual(payload.error, "Authentication required.");

  const jsonMiddleware = createAuthMiddleware({ mode: "json", authService: null });
  const jsonRequest = {};
  await new Promise((resolve, reject) => {
    jsonMiddleware.resolveAuth(jsonRequest, {}, (error) =>
      error ? reject(error) : resolve(),
    );
  });
  assert.strictEqual(jsonRequest.auth.playerId, "local-player");

  let activePlayerId = first.playerId;
  const battleSessions = createScopedSessionStore(() => activePlayerId);
  battleSessions.set("player", { opponent: "Pikachu" });
  activePlayerId = second.playerId;
  battleSessions.set("player", { opponent: "Bulbasaur" });
  assert.strictEqual(battleSessions.get("player").opponent, "Bulbasaur");
  activePlayerId = first.playerId;
  assert.strictEqual(battleSessions.get("player").opponent, "Pikachu");

  prisma.state.players.set("local-player", {
    id: "local-player",
    trainerName: "Legacy Champion",
    coins: 30000,
    level: 20,
    championDefeated: true,
    userId: null,
  });
  const claim = await claimLegacyPlayer({
    prisma,
    email: "trainera@example.com",
  });
  const repeatClaim = await claimLegacyPlayer({
    prisma,
    email: "trainera@example.com",
  });
  assert(claim.success && claim.playerId === "local-player");
  assert.strictEqual(repeatClaim.error, "The legacy save has already been claimed.");
  assert.strictEqual(prisma.state.players.get("local-player").userId, storedUser.id);
  assert(!prisma.state.players.has(first.playerId));
  assert(prisma.getTransactionCount() >= 5, "account operations were not transactional");
}

async function runPostgresAuthIntegration() {
  if (!process.env.DATABASE_URL) {
    console.log("[auth] PostgreSQL integration skipped: DATABASE_URL is not set.");
    return;
  }
  const { getPrismaClient, disconnectPrisma } = require("../backend/persistence/prismaClient");
  const { createAggregateRepository } = require("../backend/persistence/aggregateRepository");
  const prisma = getPrismaClient();
  const aggregateRepository = createAggregateRepository({ prisma });
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const emails = [`auth-a-${suffix}@example.com`, `auth-b-${suffix}@example.com`];
  let starter = 0;
  const service = createAuthService({
    prisma,
    aggregateRepository,
    passwordRounds: 4,
    createDefaultAggregate: () => ({
      player: {
        trainerName: "Player",
        coins: 100,
        level: 1,
        xp: 0,
        championDefeated: false,
        pokedex: {},
        unlockedAreas: ["forest"],
        unlockedGyms: [1],
        defeatedNpcs: [],
        achievements: [],
        items: { standard: 10 },
        badges: [],
        story: { version: "story-v1", currentAct: 1, currentChapter: "act-1" },
        league: { version: "league-v1", completed: false },
        partyPresets: [],
      },
      team: [{
        ownedId: `auth-starter-${suffix}-${starter += 1}`,
        id: 25,
        speciesId: 25,
        name: "Pikachu",
        level: 1,
        xp: 0,
        currentHp: 35,
        maxHp: 35,
        moves: [],
      }],
      storage: [],
    }),
  });
  try {
    const first = await service.register({ email: emails[0], password: "test-pass-a" });
    const second = await service.register({ email: emails[1], password: "test-pass-b" });
    assert(first.success && second.success);
    const firstSave = await aggregateRepository.loadAggregate(first.playerId);
    const secondSave = await aggregateRepository.loadAggregate(second.playerId);
    firstSave.player.coins = 777;
    await aggregateRepository.saveAggregate(firstSave, first.playerId);
    assert.strictEqual(
      (await aggregateRepository.loadAggregate(second.playerId)).player.coins,
      secondSave.player.coins,
    );
    assert.strictEqual((await service.authenticate(first.token)).userId, first.userId);
    console.log("[auth] PostgreSQL account/isolation integration passed.");
  } finally {
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await disconnectPrisma();
  }
}

async function main() {
  await testAuthFlow();
  console.log("[auth] Registration, sessions, isolation, and legacy claim passed.");
  await runPostgresAuthIntegration();
}

main().catch((error) => {
    console.error("[auth] Test failed:", error);
    process.exitCode = 1;
  });
