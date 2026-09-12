require("dotenv/config");

const { getPrismaClient, disconnectPrisma } = require("../backend/persistence/prismaClient");
const { claimLegacyPlayer } = require("../backend/auth/accountRepository");

function getArgument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : null;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const email = getArgument("email");
  if (!email) {
    throw new Error("Usage: npm run db:claim-legacy -- --email user@example.com");
  }
  const result = await claimLegacyPlayer({
    prisma: getPrismaClient(),
    email,
    legacyPlayerId: process.env.PLAYER_ID || "local-player",
  });
  if (result.error) throw new Error(result.error);
  console.log(
    `[db:claim-legacy] Attached '${result.playerId}' to the requested account.`,
  );
}

main()
  .catch((error) => {
    console.error(`[db:claim-legacy] ${error.message}`);
    process.exitCode = 1;
  })
  .finally(disconnectPrisma);
