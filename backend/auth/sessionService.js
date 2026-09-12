const crypto = require("crypto");

const SESSION_COOKIE = "pokemon_session";
const DEFAULT_SESSION_DAYS = 30;

function createSessionToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function hashSessionToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function parseCookies(header = "") {
  return String(header)
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separator = part.indexOf("=");
      if (separator < 1) return cookies;
      try {
        const key = decodeURIComponent(part.slice(0, separator));
        const value = decodeURIComponent(part.slice(separator + 1));
        cookies[key] = value;
      } catch {
        // Ignore malformed cookie fragments instead of failing the request.
      }
      return cookies;
    }, {});
}

function getSessionToken(req) {
  return parseCookies(req.headers?.cookie)[SESSION_COOKIE] || null;
}

function getSessionExpiry(now = new Date(), days = DEFAULT_SESSION_DAYS) {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

function getCookieOptions(environment = process.env, expiresAt = null) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: environment.NODE_ENV === "production",
    path: "/",
    ...(expiresAt ? { expires: expiresAt } : {}),
  };
}

module.exports = {
  SESSION_COOKIE,
  DEFAULT_SESSION_DAYS,
  createSessionToken,
  hashSessionToken,
  parseCookies,
  getSessionToken,
  getSessionExpiry,
  getCookieOptions,
};
