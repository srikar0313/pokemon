const PLAYABLE_AREAS = [
  "forest",
  "cave",
  "volcano",
  "lake",
  "mountain",
  "desert",
  "graveyard",
];

const SUPPORTED_EVOLUTION_METHODS = new Set([
  "level",
  "item",
  "friendship",
  "level-time",
  "level-move",
  "trade",
  "trade-item",
]);

function chooseArea(types = []) {
  const set = new Set(types);
  if (set.has("Ghost")) return "graveyard";
  if (set.has("Fire")) return "volcano";
  if (set.has("Water") || set.has("Ice")) return "lake";
  if (set.has("Ground") && set.has("Dark")) return "desert";
  if (set.has("Ground")) return set.has("Rock") ? "cave" : "desert";
  if (set.has("Rock") || set.has("Steel")) return "cave";
  if (set.has("Dragon") || set.has("Flying")) return "mountain";
  if (set.has("Grass") || set.has("Bug")) return "forest";
  if (set.has("Dark")) return "graveyard";
  if (set.has("Poison")) return "cave";
  if (set.has("Electric")) return "mountain";
  return "forest";
}

function chooseTimes(types = []) {
  const set = new Set(types);
  if (set.has("Ghost") || set.has("Dark")) return ["night"];
  if (set.has("Fire") || set.has("Grass") || set.has("Bug")) return ["day"];
  return ["day", "night"];
}

function chooseRarity(canonical = {}, fallback = false) {
  if (canonical.isLegendary) return "legendary";
  if (canonical.isMythical) return "mythical";
  if (fallback) return "rare";
  const catchRate = Number(canonical.captureRate);
  if (catchRate > 0 && catchRate < 75) return "rare";
  if (catchRate > 0 && catchRate < 150) return "uncommon";
  return "common";
}

function hasUnsupportedCondition(condition = {}, evolutionItems = new Set()) {
  if (!SUPPORTED_EVOLUTION_METHODS.has(condition.method)) return true;
  if (
    condition.minBeauty ||
    condition.location ||
    (condition.heldItem && condition.method !== "trade-item") ||
    condition.tradeSpecies ||
    condition.partySpecies ||
    condition.partyType ||
    condition.needsOverworldRain ||
    condition.turnUpsideDown ||
    condition.requiresFormResolution
  ) {
    return true;
  }
  if (condition.method === "item") return !evolutionItems.has(condition.item);
  if (condition.method === "trade") return !evolutionItems.has("linking-cord");
  if (condition.method === "trade-item") {
    return !evolutionItems.has(condition.heldItem);
  }
  return false;
}

function isSupportedEdge(edge, evolutionItems) {
  return (edge.conditions || []).some(
    (condition) => !hasUnsupportedCondition(condition, evolutionItems),
  );
}

function buildObtainability({ pokemon, canonicalPokemon, speciesMap, evolutions, items, imports }) {
  const canonicalBySpeciesId = new Map(
    (canonicalPokemon?.pokemon || []).map((entry) => [entry.speciesId, entry]),
  );
  const mappingBySpeciesId = new Map(
    (speciesMap?.species || []).map((entry) => [entry.canonicalSpeciesId, entry]),
  );
  const pokemonBySpeciesId = new Map(
    pokemon.map((entry) => {
      const mapping = (speciesMap?.species || []).find(
        (candidate) => candidate.localId === entry.id && candidate.localName === entry.name,
      );
      return [Number(entry.speciesId || mapping?.canonicalSpeciesId), entry];
    }),
  );
  const evolutionItems = new Set(
    Object.values(items || {}).map((item) => item.evolutionItem).filter(Boolean),
  );
  const incoming = new Map();
  (evolutions?.chains || []).forEach((chain) => {
    (chain.edges || []).forEach((edge) => {
      const entries = incoming.get(edge.toSpeciesId) || [];
      entries.push(edge);
      incoming.set(edge.toSpeciesId, entries);
    });
  });

  const entries = new Map();
  const unconfiguredImports = new Set(imports?.speciesIds || []);
  const assignWild = (speciesId, { special = false, fallback = false } = {}) => {
    const canonical = canonicalBySpeciesId.get(speciesId) || {};
    entries.set(speciesId, {
      speciesId,
      status: special ? "special" : "wild",
      areas: [chooseArea(canonical.types || [])],
      times: chooseTimes(canonical.types || []),
      rarity: chooseRarity(canonical, fallback),
      reason: special
        ? "Extremely rare encounter in a matching area"
        : fallback
          ? "Rare wild fallback because its canonical evolution requirement is unavailable"
          : "Wild base-stage encounter",
      fallback,
    });
  };

  pokemonBySpeciesId.forEach((template, speciesId) => {
    const mapping = mappingBySpeciesId.get(speciesId);
    if (!mapping?.existingBeforeExpansion) return;
    const areas = (template.habitats || []).filter((area) => PLAYABLE_AREAS.includes(area));
    if (areas.length) {
      entries.set(speciesId, {
        speciesId,
        status: "wild",
        areas,
        times: template.times || [],
        rarity: template.rarity,
        reason: "Original game encounter",
        fallback: false,
      });
    }
  });

  unconfiguredImports.forEach((speciesId) => {
    if (!pokemonBySpeciesId.has(speciesId)) return;
    entries.set(speciesId, {
      speciesId,
      status: "unavailable",
      areas: [],
      times: [],
      rarity: pokemonBySpeciesId.get(speciesId)?.rarity || "common",
      reason: "Developer import awaiting an intentional world assignment",
      fallback: false,
    });
  });

  pokemonBySpeciesId.forEach((_template, speciesId) => {
    if (entries.has(speciesId) || (incoming.get(speciesId) || []).length) return;
    const canonical = canonicalBySpeciesId.get(speciesId) || {};
    assignWild(speciesId, {
      special: Boolean(canonical.isLegendary || canonical.isMythical),
    });
  });

  let changed = true;
  while (changed) {
    changed = false;
    pokemonBySpeciesId.forEach((_template, speciesId) => {
      if (entries.has(speciesId)) return;
      const reachableEdges = (incoming.get(speciesId) || []).filter(
        (edge) =>
          entries.has(edge.fromSpeciesId) &&
          entries.get(edge.fromSpeciesId).status !== "unavailable" &&
          isSupportedEdge(edge, evolutionItems),
      );
      if (!reachableEdges.length) return;
      entries.set(speciesId, {
        speciesId,
        status: "evolution",
        areas: [],
        times: [],
        rarity: pokemonBySpeciesId.get(speciesId)?.rarity || "common",
        reason: "Obtainable through canonical evolution",
        evolvesFrom: [...new Set(reachableEdges.map((edge) => edge.fromSpeciesId))],
        fallback: false,
      });
      changed = true;
    });
  }

  pokemonBySpeciesId.forEach((_template, speciesId) => {
    if (entries.has(speciesId)) return;
    const canonical = canonicalBySpeciesId.get(speciesId) || {};
    if (canonical.isLegendary || canonical.isMythical) {
      assignWild(speciesId, { special: true });
      return;
    }
    assignWild(speciesId, { fallback: true });
  });

  const list = [...entries.values()].sort((left, right) => left.speciesId - right.speciesId);
  const summary = list.reduce(
    (result, entry) => {
      result[entry.status] += 1;
      return result;
    },
    { wild: 0, evolution: 0, special: 0, unavailable: 0 },
  );
  return {
    version: "obtainability-v1",
    playableAreas: [...PLAYABLE_AREAS],
    summary,
    entries: list,
  };
}

function applyObtainability(template, entry, existingBeforeExpansion) {
  if (!entry) return { ...template };
  const enriched = { ...template, availability: { ...entry } };
  if (
    !existingBeforeExpansion &&
    ["wild", "special"].includes(entry.status)
  ) {
    enriched.habitats = [...entry.areas];
    enriched.times = [...entry.times];
    enriched.rarity = entry.rarity;
    enriched.encounterEnabled = true;
  }
  return enriched;
}

module.exports = {
  PLAYABLE_AREAS,
  applyObtainability,
  buildObtainability,
};
