async function getHealthStatus({ mode, prisma }) {
  const database = {
    required: mode === "postgres",
    status: mode === "postgres" ? "checking" : "not-applicable",
  };

  if (mode === "postgres") {
    try {
      await prisma.$queryRawUnsafe("SELECT 1");
      database.status = "connected";
    } catch {
      database.status = "unavailable";
    }
  }

  const healthy = database.status !== "unavailable";
  return {
    httpStatus: healthy ? 200 : 503,
    body: {
      status: healthy ? "ok" : "degraded",
      persistenceMode: mode,
      database,
    },
  };
}

function createHealthHandler(dependencies) {
  return async (req, res) => {
    const result = await getHealthStatus(dependencies);
    return res.status(result.httpStatus).json(result.body);
  };
}

module.exports = { createHealthHandler, getHealthStatus };
