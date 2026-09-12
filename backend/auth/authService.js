const { randomUUID } = require("crypto");
const {
  validateCredentials,
  normalizeEmail,
  hashPassword,
  verifyPassword,
} = require("./password");
const {
  createSessionToken,
  hashSessionToken,
  getSessionExpiry,
} = require("./sessionService");

const INVALID_LOGIN = "Incorrect email or password.";

function safeAccount(user, player) {
  return {
    email: user.email,
    trainerName: player.trainerName,
    level: player.level,
    coins: player.coins,
    championDefeated: player.championDefeated,
  };
}

function createAuthService({
  prisma,
  aggregateRepository,
  createDefaultAggregate,
  passwordRounds = 12,
  sessionDays,
  now = () => new Date(),
} = {}) {
  async function register({ email: emailValue, password: passwordValue }) {
    const credentials = validateCredentials(emailValue, passwordValue);
    if (credentials.error) return { error: credentials.error, status: 400 };
    const passwordHash = await hashPassword(credentials.password, passwordRounds);
    const token = createSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = getSessionExpiry(now(), sessionDays);
    const userId = randomUUID();
    const playerId = randomUUID();
    const aggregate = createDefaultAggregate();
    try {
      const result = await prisma.$transaction(async (transaction) => {
        const user = await transaction.user.create({
          data: { id: userId, email: credentials.email, passwordHash },
        });
        await aggregateRepository.saveWithClient(
          transaction,
          aggregate,
          playerId,
        );
        const player = await transaction.player.update({
          where: { id: playerId },
          data: { userId },
        });
        await transaction.authSession.create({
          data: { userId, tokenHash, expiresAt },
        });
        return { user, player };
      });
      return {
        success: true,
        userId,
        playerId,
        token,
        expiresAt,
        account: safeAccount(result.user, result.player),
      };
    } catch (error) {
      if (error?.code === "P2002") {
        return { error: "An account with that email already exists.", status: 409 };
      }
      throw error;
    }
  }

  async function login({ email: emailValue, password: passwordValue }) {
    const email = normalizeEmail(emailValue);
    const password = String(passwordValue || "");
    const user = email
      ? await prisma.user.findUnique({ where: { email }, include: { player: true } })
      : null;
    const valid = user && (await verifyPassword(password, user.passwordHash));
    if (!valid || !user.player) return { error: INVALID_LOGIN, status: 401 };
    const token = createSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = getSessionExpiry(now(), sessionDays);
    await prisma.$transaction(async (transaction) => {
      await transaction.authSession.deleteMany({
        where: { userId: user.id, expiresAt: { lte: now() } },
      });
      await transaction.authSession.create({
        data: { userId: user.id, tokenHash, expiresAt },
      });
    });
    return {
      success: true,
      userId: user.id,
      playerId: user.player.id,
      token,
      expiresAt,
      account: safeAccount(user, user.player),
    };
  }

  async function authenticate(token) {
    if (!token) return null;
    const tokenHash = hashSessionToken(token);
    const session = await prisma.authSession.findUnique({
      where: { tokenHash },
      include: { user: { include: { player: true } } },
    });
    if (!session) return null;
    if (session.expiresAt <= now()) {
      await prisma.authSession.delete({ where: { id: session.id } }).catch(() => {});
      return null;
    }
    if (!session.user?.player) return null;
    return {
      userId: session.userId,
      playerId: session.user.player.id,
      account: safeAccount(session.user, session.user.player),
    };
  }

  async function logout(token) {
    if (!token) return;
    await prisma.authSession.deleteMany({
      where: { tokenHash: hashSessionToken(token) },
    });
  }

  return { register, login, authenticate, logout };
}

module.exports = { INVALID_LOGIN, safeAccount, createAuthService };
