function createRateLimiter({ windowMs = 15 * 60 * 1000, max = 10 } = {}) {
  const attempts = new Map();
  return function rateLimit(req, res, next) {
    const now = Date.now();
    const key = `${req.ip || req.socket?.remoteAddress || "unknown"}:${req.path}`;
    const current = attempts.get(key);
    if (!current || current.resetAt <= now) {
      attempts.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    current.count += 1;
    if (current.count > max) {
      res.set("Retry-After", String(Math.ceil((current.resetAt - now) / 1000)));
      return res.status(429).json({ error: "Too many attempts. Try again later." });
    }
    next();
  };
}

module.exports = { createRateLimiter };
