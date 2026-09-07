const path = require("path");
const { loadJson } = require("../backend/dataLoader");
const { buildObtainability, PLAYABLE_AREAS } = require("../backend/obtainability");
const { getOriginalConfig, loadInputs } = require("./generateObtainability");

const rootDir = path.join(__dirname, "..");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function main() {
  const inputs = loadInputs();
  const generated = buildObtainability(inputs);
  const saved = loadJson(path.join(rootDir, "data", "obtainability.json"), {});
  const baseline = loadJson(
    path.join(rootDir, "data", "pokeapi", "original-134-config.json"),
    [],
  );
  assert(JSON.stringify(saved) === JSON.stringify(generated), "obtainability.json is stale");
  assert(generated.entries.length === 491, `expected 491 entries, got ${generated.entries.length}`);
  assert(generated.summary.unavailable === 0, "catalog has unavailable species");
  assert(
    generated.entries.every((entry) => entry.areas.every((area) => PLAYABLE_AREAS.includes(area))),
    "an obtainability entry references a non-playable area",
  );
  assert(
    JSON.stringify(getOriginalConfig(inputs)) === JSON.stringify(baseline),
    "original 134 habitat/rarity/time/catch/form configuration changed",
  );
  console.log(`Obtainability audit passed: ${JSON.stringify(generated.summary)}`);
  console.log("Original 134 configuration delta: 0");
}

main();
