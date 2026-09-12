const { getSessionToken } = require("./sessionService");

function createAuthMiddleware({ mode, authService }) {
  async function resolveAuth(req, res, next) {
    if (mode !== "postgres") {
      req.auth = { mode: "json", userId: null, playerId: "local-player" };
      return next();
    }
    try {
      req.auth = await authService.authenticate(getSessionToken(req));
      next();
    } catch (error) {
      next(error);
    }
  }

  function requireAuth(req, res, next) {
    if (mode !== "postgres" || req.auth?.playerId) return next();
    return res.status(401).json({ error: "Authentication required." });
  }

  return { resolveAuth, requireAuth };
}

module.exports = { createAuthMiddleware };
