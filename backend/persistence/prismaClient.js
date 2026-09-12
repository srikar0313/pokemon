let prismaClient = null;

function getPrismaClient() {
  if (prismaClient) return prismaClient;
  const { PrismaClient } = require("@prisma/client");
  prismaClient = new PrismaClient();
  return prismaClient;
}

async function disconnectPrisma() {
  if (!prismaClient) return;
  await prismaClient.$disconnect();
  prismaClient = null;
}

module.exports = { getPrismaClient, disconnectPrisma };
