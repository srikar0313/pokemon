const { AsyncLocalStorage } = require("async_hooks");

const MIN_TIMEZONE_OFFSET = -14 * 60;
const MAX_TIMEZONE_OFFSET = 14 * 60;
const MAX_CLIENT_CLOCK_DRIFT_MS = 24 * 60 * 60 * 1000;
const playerTimeStorage = new AsyncLocalStorage();

function normalizeTimezoneOffset(value) {
  const offset = Number(value);
  return Number.isInteger(offset) &&
    offset >= MIN_TIMEZONE_OFFSET &&
    offset <= MAX_TIMEZONE_OFFSET
    ? offset
    : null;
}

function normalizeClientTimestamp(value, now = new Date()) {
  const timestamp = new Date(value);
  if (!value || Number.isNaN(timestamp.getTime())) return null;
  return Math.abs(timestamp.getTime() - now.getTime()) <= MAX_CLIENT_CLOCK_DRIFT_MS
    ? timestamp
    : null;
}

function getTimeOfDayForOffset(timestamp, timezoneOffset) {
  const localTime = new Date(timestamp.getTime() - timezoneOffset * 60 * 1000);
  const hour = localTime.getUTCHours();
  return hour >= 6 && hour < 18 ? "day" : "night";
}

function resolvePlayerTime(value = {}, now = new Date()) {
  const timezoneOffset = normalizeTimezoneOffset(value.timezoneOffset);
  const clientTimestamp = normalizeClientTimestamp(value.timestamp, now);
  if (timezoneOffset !== null && clientTimestamp) {
    return {
      timeOfDay: getTimeOfDayForOffset(clientTimestamp, timezoneOffset),
      timezoneOffset,
      source: "client",
    };
  }
  const hour = now.getHours();
  return {
    timeOfDay: hour >= 6 && hour < 18 ? "day" : "night",
    timezoneOffset: null,
    source: "server-fallback",
  };
}

function getRequestTimeInput(req = {}) {
  return {
    timestamp:
      req.headers?.["x-player-timestamp"] || req.body?.timeContext?.timestamp,
    timezoneOffset:
      req.headers?.["x-player-timezone-offset"] ??
      req.body?.timeContext?.timezoneOffset,
  };
}

function createPlayerTimeMiddleware({ now = () => new Date() } = {}) {
  return function playerTimeMiddleware(req, res, next) {
    const context = resolvePlayerTime(getRequestTimeInput(req), now());
    playerTimeStorage.run(context, next);
  };
}

function getPlayerTimeContext(now = new Date()) {
  return playerTimeStorage.getStore() || resolvePlayerTime({}, now);
}

function getPlayerTimeOfDay() {
  return getPlayerTimeContext().timeOfDay;
}

module.exports = {
  MIN_TIMEZONE_OFFSET,
  MAX_TIMEZONE_OFFSET,
  MAX_CLIENT_CLOCK_DRIFT_MS,
  normalizeTimezoneOffset,
  normalizeClientTimestamp,
  getTimeOfDayForOffset,
  resolvePlayerTime,
  createPlayerTimeMiddleware,
  getPlayerTimeContext,
  getPlayerTimeOfDay,
};
