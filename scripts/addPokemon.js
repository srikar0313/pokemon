const path = require("path");
const { spawnSync } = require("child_process");
const {
  POKEAPI_BASE_URL,
  loadCachedJson,
  normalizePokemonName,
  readValidJson,
  saveJsonAtomic,
} = require("./pokeApiUtils");

const rootDir = path.join(__dirname, "..");
const dataDir = path.join(rootDir, "data", "pokeapi");
const importsPath = path.join(dataDir, "imports.json");
const cacheRoot = path.join(dataDir, "raw");

function readSpeciesArgument() {
  const inline = process.argv.find((argument) => argument.startsWith("--species="));
  const index = process.argv.indexOf("--species");
  const value = inline?.slice("--species=".length) || (index >= 0 ? process.argv[index + 1] : "");
  return String(value).split(",").map((entry) => entry.trim()).filter(Boolean);
}

async function resolveSpeciesId(identity, speciesMap, cacheStats) {
  const numeric = Number(identity);
  if (Number.isInteger(numeric) && numeric > 0) return numeric;
  const normalized = normalizePokemonName(identity);
  const existing = (speciesMap.species || []).find(
    (entry) =>
      normalizePokemonName(entry.localName) === normalized ||
      normalizePokemonName(entry.canonicalName) === normalized,
  );
  if (existing) return existing.canonicalSpeciesId;
  const result = await loadCachedJson({
    cacheRoot,
    category: "species",
    key: String(identity).toLowerCase(),
    url: `${POKEAPI_BASE_URL}/pokemon-species/${String(identity).toLowerCase()}`,
    cacheStats,
  });
  if (!result.data?.id) {
    throw new Error(`Could not resolve species: ${identity} (${result.error || "not found"})`);
  }
  return result.data.id;
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: rootDir, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}

async function main() {
  const requested = readSpeciesArgument();
  if (!requested.length) throw new Error("Use --species with comma-separated Dex IDs or names");
  const speciesMap = readValidJson(path.join(dataDir, "species-map.json")) || { species: [] };
  const cacheStats = { hits: 0, fetched: 0, failures: 0 };
  const speciesIds = [...new Set(await Promise.all(
    requested.map((identity) => resolveSpeciesId(identity, speciesMap, cacheStats)),
  ))].sort((left, right) => left - right);
  const present = new Set((speciesMap.species || []).map((entry) => entry.canonicalSpeciesId));
  const missing = speciesIds.filter((speciesId) => !present.has(speciesId));
  console.log(`Resolved species: ${speciesIds.join(", ")}`);
  console.log(`New imports: ${missing.length ? missing.join(", ") : "none (already present)"}`);
  if (process.argv.includes("--dry-run") || !missing.length) return;

  const current = readValidJson(importsPath) || { speciesIds: [] };
  saveJsonAtomic(importsPath, {
    speciesIds: [...new Set([...(current.speciesIds || []), ...missing])].sort(
      (left, right) => left - right,
    ),
  });
  run(process.execPath, [path.join(__dirname, "buildCanonicalPokemonData.js")]);
  const expandedMap = readValidJson(path.join(dataDir, "species-map.json")) || {
    species: [],
  };
  const newlyAddedFamily = expandedMap.species
    .map((entry) => entry.canonicalSpeciesId)
    .filter((speciesId) => !present.has(speciesId));
  saveJsonAtomic(importsPath, {
    speciesIds: [
      ...new Set([...(current.speciesIds || []), ...newlyAddedFamily]),
    ].sort((left, right) => left - right),
  });
  run(process.execPath, [path.join(__dirname, "generateObtainability.js")]);
}

main().catch((error) => {
  console.error(`[pokemon:add] ${error.message}`);
  process.exit(1);
});
