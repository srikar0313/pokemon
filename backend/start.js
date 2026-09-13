const { disconnectPrisma } = require("./persistence/prismaClient");

async function main() {
  try {
    const { startServer, installShutdownHandlers } = require("./server");
    const server = await startServer();
    installShutdownHandlers(server);
  } catch (error) {
    const port = Number(process.env.PORT) || 3000;
    const detail =
      error?.code === "EADDRINUSE"
        ? `Port ${port} is already in use. Stop the existing server or set PORT to another value.`
        : error?.message || "Unknown startup error.";
    console.error(`[startup] Failed: ${detail}`);
    await disconnectPrisma().catch(() => {});
    process.exitCode = 1;
  }
}

main();
