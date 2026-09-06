const fs = require("fs");
const path = require("path");

const POKEAPI_BASE_URL = "https://pokeapi.co/api/v2";
const EVOLUTION_DETAIL_FIELDS = [
  ["trigger", "trigger"],
  ["min_level", "minLevel"],
  ["item", "item"],
  ["held_item", "heldItem"],
  ["min_happiness", "minHappiness"],
  ["min_affection", "minAffection"],
  ["min_beauty", "minBeauty"],
  ["known_move", "knownMove"],
  ["known_move_type", "knownMoveType"],
  ["location", "location"],
  ["time_of_day", "timeOfDay"],
  ["gender", "gender"],
  ["trade_species", "tradeSpecies"],
  ["relative_physical_stats", "relativePhysicalStats"],
  ["party_species", "partySpecies"],
  ["party_type", "partyType"],
  ["needs_overworld_rain", "needsOverworldRain"],
  ["turn_upside_down", "turnUpsideDown"],
];

function normalizePokemonName(value) {
  return String(value || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function toPokeApiSpeciesSlug(value) {
  return String(value || "")
    .replace(/♀/g, "-f")
    .replace(/♂/g, "-m")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.'’]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function toDisplayName(value) {
  return String(value || "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getResourceName(resource) {
  return resource?.name || null;
}

function getResourceId(url) {
  const match = String(url || "").match(/\/(\d+)\/?$/);
  return match ? Number(match[1]) : null;
}

function sanitizeCacheKey(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]/g, "-");
}

function readValidJson(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (_error) {
    return null;
  }
}

function saveJsonAtomic(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(data, null, 2)}\n`);
  fs.renameSync(tempPath, filePath);
}

async function fetchJson(url, { timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "srikar0313-pokemon-data-audit/1.0",
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    if (!data || typeof data !== "object") {
      throw new Error("response was not a JSON object");
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function loadCachedJson({
  cacheRoot,
  category,
  key,
  url,
  refresh = false,
  cacheStats,
}) {
  const cachePath = path.join(
    cacheRoot,
    category,
    `${sanitizeCacheKey(key)}.json`,
  );
  if (!refresh) {
    const cached = readValidJson(cachePath);
    if (cached) {
      cacheStats.hits += 1;
      return { data: cached, source: "cache", cachePath };
    }
  }

  try {
    const data = await fetchJson(url);
    saveJsonAtomic(cachePath, data);
    cacheStats.fetched += 1;
    return { data, source: "network", cachePath };
  } catch (error) {
    cacheStats.failures += 1;
    return {
      data: null,
      source: "failure",
      cachePath,
      error: error.name === "AbortError" ? "request timed out" : error.message,
    };
  }
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => runWorker()),
  );
  return results;
}

function normalizeEvolutionDetail(detail = {}) {
  const normalized = {};
  EVOLUTION_DETAIL_FIELDS.forEach(([sourceKey, targetKey]) => {
    const value = detail[sourceKey];
    const normalizedValue =
      value && typeof value === "object" ? getResourceName(value) : value;
    if (
      normalizedValue !== null &&
      normalizedValue !== undefined &&
      normalizedValue !== "" &&
      normalizedValue !== false
    ) {
      normalized[targetKey] = normalizedValue;
    }
  });
  return normalized;
}

function normalizeEvolutionDetailComplete(detail = {}) {
  return Object.fromEntries(
    EVOLUTION_DETAIL_FIELDS.map(([sourceKey, targetKey]) => {
      const value = detail[sourceKey];
      const normalizedValue =
        value && typeof value === "object" ? getResourceName(value) : value;
      return [
        targetKey,
        normalizedValue === undefined || normalizedValue === ""
          ? ["needsOverworldRain", "turnUpsideDown"].includes(targetKey)
            ? false
            : null
          : normalizedValue,
      ];
    }),
  );
}

function flattenEvolutionChain(chainRoot) {
  const nodes = [];
  const edges = [];

  function visit(node) {
    if (!node?.species?.name) return;
    const from = node.species.name;
    nodes.push(from);
    (node.evolves_to || []).forEach((child) => {
      edges.push({
        from,
        to: child.species?.name || "unknown",
        conditions: (child.evolution_details || []).map(normalizeEvolutionDetail),
      });
      visit(child);
    });
  }

  visit(chainRoot);
  return { nodes: [...new Set(nodes)], edges };
}

function flattenEvolutionChainGraph(chainRoot) {
  const species = [];
  const edges = [];

  function visit(node) {
    if (!node?.species?.name) return;
    const fromSpeciesId = getResourceId(node.species.url);
    species.push({
      speciesId: fromSpeciesId,
      name: node.species.name,
    });
    (node.evolves_to || []).forEach((child) => {
      edges.push({
        fromSpeciesId,
        from: node.species.name,
        toSpeciesId: getResourceId(child.species?.url),
        to: child.species?.name || null,
        conditions: (child.evolution_details || []).map(
          normalizeEvolutionDetailComplete,
        ),
      });
      visit(child);
    });
  }

  visit(chainRoot);
  return {
    species: [
      ...new Map(
        species.map((entry) => [entry.speciesId || entry.name, entry]),
      ).values(),
    ],
    edges,
  };
}

function getConfiguredFormSlug(speciesName, formId) {
  const suffixes = {
    alolan: "alola",
    galarian: "galar",
    hisuian: "hisui",
    paldean: "paldea",
  };
  return `${String(speciesName).toLowerCase()}-${suffixes[formId] || formId}`;
}

module.exports = {
  POKEAPI_BASE_URL,
  fetchJson,
  flattenEvolutionChain,
  flattenEvolutionChainGraph,
  getConfiguredFormSlug,
  getResourceId,
  getResourceName,
  loadCachedJson,
  mapLimit,
  normalizePokemonName,
  readValidJson,
  saveJsonAtomic,
  toDisplayName,
  toPokeApiSpeciesSlug,
};
