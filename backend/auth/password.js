const bcrypt = require("bcryptjs");

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return (
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

function validateCredentials(emailValue, passwordValue) {
  const email = normalizeEmail(emailValue);
  const password = String(passwordValue || "");
  if (!isValidEmail(email)) return { error: "Enter a valid email address." };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return { error: `Password must be at most ${MAX_PASSWORD_LENGTH} characters.` };
  }
  return { email, password };
}

async function hashPassword(password, rounds = 12) {
  return bcrypt.hash(password, rounds);
}

async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(String(password || ""), passwordHash);
}

module.exports = {
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
  normalizeEmail,
  isValidEmail,
  validateCredentials,
  hashPassword,
  verifyPassword,
};
