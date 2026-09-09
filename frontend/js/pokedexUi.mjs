function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

export function getEntrySpeciesId(entry = {}) {
  return Number(entry.speciesId ?? entry.id) || null;
}

export function getPokedexDiscoveryState(entry = {}) {
  if (entry.caught) return "caught";
  if (entry.seen) return "seen";
  return "unseen";
}

export function getPokedexVariantSummary(entry = {}) {
  const forms = Array.isArray(entry.forms) ? entry.forms : [];
  const alternateForms = forms.filter((form) => form.id !== "normal");
  return {
    hasAlternateForms: alternateForms.length > 0,
    discoveredForms: forms.filter((form) => form.seen || form.caught).length,
    discoveredAlternateForms: alternateForms.filter(
      (form) => form.seen || form.caught || form.shinySeen || form.shinyCaught,
    ).length,
    shinySeen: forms.some((form) => form.shinySeen || form.shinyCaught),
    shinyCaught: forms.some((form) => form.shinyCaught),
  };
}

export function matchesPokedexFilters(entry = {}, filters = {}) {
  const state = getPokedexDiscoveryState(entry);
  const variants = getPokedexVariantSummary(entry);
  const status = filters.status || "all";
  if (status === "seen" && !entry.seen) return false;
  if (status === "caught" && !entry.caught) return false;
  if (status === "uncaught" && entry.caught) return false;
  if (status === "unseen" && state !== "unseen") return false;
  if (
    status === "legendary" &&
    !["legendary", "mythical"].includes(normalize(entry.rarity))
  ) return false;

  if (
    filters.habitat &&
    filters.habitat !== "all" &&
    !(entry.habitats || []).includes(filters.habitat)
  ) return false;
  if (
    filters.type &&
    filters.type !== "all" &&
    !(entry.types || []).includes(filters.type)
  ) return false;
  if (
    filters.rarity &&
    filters.rarity !== "all" &&
    entry.rarity !== filters.rarity
  ) return false;
  if (
    filters.availability &&
    filters.availability !== "all" &&
    entry.availability?.status !== filters.availability
  ) return false;
  if (filters.shiny === "seen" && !variants.shinySeen) return false;
  if (filters.shiny === "caught" && !variants.shinyCaught) return false;
  if (filters.forms === "available" && !variants.hasAlternateForms) return false;
  if (filters.forms === "discovered" && variants.discoveredAlternateForms < 1) return false;

  const search = normalize(filters.search);
  if (!search) return true;
  const dexNumber = getEntrySpeciesId(entry);
  const searchable = [
    entry.name,
    entry.rarity,
    dexNumber,
    dexNumber ? String(dexNumber).padStart(3, "0") : "",
    ...(entry.types || []),
    ...(entry.habitats || []),
    entry.availability?.status,
    ...(entry.availability?.areas || []),
  ].map(normalize).join(" ");
  return searchable.includes(search.replace(/^#/, ""));
}

export function getOwnedPokemonMatches(entry, team = [], storage = []) {
  const speciesId = getEntrySpeciesId(entry);
  if (!speciesId) return [];
  return [
    ...team.map((pokemon, index) => ({ pokemon, section: "team", index })),
    ...storage.map((pokemon, index) => ({ pokemon, section: "storage", index })),
  ].filter(({ pokemon }) => Number(pokemon?.speciesId ?? pokemon?.id) === speciesId);
}

export function buildEvolutionLayers(entry = {}) {
  const graph = entry.evolutionGraph || { stages: entry.evolutionChain || [], edges: [] };
  const stages = graph.stages || [];
  const edges = graph.edges || [];
  const targetIds = new Set(edges.map((edge) => edge.toSpeciesId));
  const roots = stages.filter((stage) => !targetIds.has(stage.speciesId));
  const depths = new Map((roots.length ? roots : stages.slice(0, 1)).map((stage) => [stage.speciesId, 0]));
  for (let pass = 0; pass < stages.length; pass += 1) {
    edges.forEach((edge) => {
      const parentDepth = depths.get(edge.fromSpeciesId);
      if (parentDepth === undefined) return;
      depths.set(edge.toSpeciesId, Math.max(depths.get(edge.toSpeciesId) ?? 0, parentDepth + 1));
    });
  }
  const layerDepths = [...new Set(stages.map((stage) => depths.get(stage.speciesId) || 0))]
    .sort((left, right) => left - right);
  return layerDepths.map((depth) => ({
    depth,
    stages: stages.filter((stage) => (depths.get(stage.speciesId) || 0) === depth),
  }));
}
