const express = require("express");
const { createRateLimiter } = require("./rateLimiter");
const {
  SESSION_COOKIE,
  getSessionToken,
  getCookieOptions,
} = require("./sessionService");

function createAuthRouter({ mode, authService, resolveAuth, environment = process.env }) {
  const router = express.Router();
  const authLimiter = createRateLimiter({ max: 10 });

  router.get("/me", resolveAuth, (req, res) => {
    if (mode !== "postgres") {
      return res.json({
        authRequired: false,
        authenticated: true,
        mode: "json",
        account: { trainerName: "Local Player" },
      });
    }
    if (!req.auth) {
      return res.status(401).json({
        authRequired: true,
        authenticated: false,
      });
    }
    return res.json({
      authRequired: true,
      authenticated: true,
      mode: "postgres",
      account: req.auth.account,
    });
  });

  router.post("/register", authLimiter, async (req, res, next) => {
    if (mode !== "postgres") {
      return res.status(400).json({ error: "Accounts require PostgreSQL mode." });
    }
    try {
      const result = await authService.register(req.body || {});
      if (result.error) return res.status(result.status).json({ error: result.error });
      await authService.logout(getSessionToken(req));
      res.cookie(
        SESSION_COOKIE,
        result.token,
        getCookieOptions(environment, result.expiresAt),
      );
      return res.status(201).json({ success: true, account: result.account });
    } catch (error) {
      next(error);
    }
  });

  router.post("/login", authLimiter, async (req, res, next) => {
    if (mode !== "postgres") {
      return res.status(400).json({ error: "Accounts require PostgreSQL mode." });
    }
    try {
      const result = await authService.login(req.body || {});
      if (result.error) return res.status(result.status).json({ error: result.error });
      await authService.logout(getSessionToken(req));
      res.cookie(
        SESSION_COOKIE,
        result.token,
        getCookieOptions(environment, result.expiresAt),
      );
      return res.json({ success: true, account: result.account });
    } catch (error) {
      next(error);
    }
  });

  router.post("/logout", resolveAuth, async (req, res, next) => {
    try {
      if (mode === "postgres") await authService.logout(getSessionToken(req));
      res.clearCookie(SESSION_COOKIE, getCookieOptions(environment));
      return res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { createAuthRouter };
