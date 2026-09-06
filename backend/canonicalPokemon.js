function normalizeCanonicalName(value) {
  return String(value || "")
    .replace(/♀/g, "f")
    .replace(/♂/g, "m")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function getCanonicalEntries(canonicalData) {
  if (Array.isArray(canonicalData)) return canonicalData;
  return Array.isArray(canonicalData?.pokemon) ? canonicalData.pokemon : [];
}

function createCanonicalPokemonLookup(canonicalData = {}) {
  const entries = getCanonicalEntries(canonicalData);
  const byLocalId = new Map();
  const bySpeciesId = new Map();
  const byName = new Map();

  entries.forEach((entry) => {
    if (Number.isInteger(entry?.localId)) byLocalId.set(entry.localId, entry);
    if (Number.isInteger(entry?.speciesId)) {
      bySpeciesId.set(entry.speciesId, entry);
    }
    [entry?.localName, entry?.canonicalName].forEach((name) => {
      const key = normalizeCanonicalName(name);
      if (key) byName.set(key, entry);
    });
  });

  function getCanonicalPokemonByLocalId(localId) {
    return byLocalId.get(Number(localId)) || null;
  }

  function getCanonicalPokemonBySpeciesId(speciesId) {
    return bySpeciesId.get(Number(speciesId)) || null;
  }

  function getCanonicalPokemonByName(name) {
    return byName.get(normalizeCanonicalName(name)) || null;
  }

  function getCanonicalPokemon(pokemon = {}) {
    const byPokemonName = getCanonicalPokemonByName(pokemon.name);
    if (byPokemonName) return byPokemonName;

    const byPokemonLocalId = getCanonicalPokemonByLocalId(pokemon.id);
    if (byPokemonLocalId) return byPokemonLocalId;

    return getCanonicalPokemonBySpeciesId(pokemon.speciesId);
  }

  return {
    entries,
    getCanonicalPokemon,
    getCanonicalPokemonByLocalId,
    getCanonicalPokemonBySpeciesId,
    getCanonicalPokemonByName,
  };
}

module.exports = {
  createCanonicalPokemonLookup,
  getCanonicalEntries,
  normalizeCanonicalName,
};
