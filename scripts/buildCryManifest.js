const fs = require("fs");
const path = require("path");

const rootDir = path.join(__dirname, "..");
const criesDir = path.join(rootDir, "assets", "audio", "cries");
const manifestPath = path.join(criesDir, "manifest.json");

fs.mkdirSync(criesDir, { recursive: true });

const cries = Object.fromEntries(
  fs
    .readdirSync(criesDir)
    .filter((name) => /^\d+\.ogg$/i.test(name))
    .sort((left, right) => Number.parseInt(left, 10) - Number.parseInt(right, 10))
    .map((name) => [
      String(Number.parseInt(name, 10)),
      `/assets/audio/cries/${name}`,
    ]),
);

const output = `${JSON.stringify({ version: 1, cries }, null, 2)}\n`;
const temporaryPath = `${manifestPath}.tmp`;
fs.writeFileSync(temporaryPath, output, "utf8");
fs.renameSync(temporaryPath, manifestPath);

console.log(`[cries] Manifest contains ${Object.keys(cries).length} local cry file(s).`);
