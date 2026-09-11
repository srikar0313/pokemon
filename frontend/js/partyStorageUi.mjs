function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

export function matchesStorageFilters(pokemon = {}, filters = {}) {
  const search = normalize(filters.search).replace(/^#/, "");
  const speciesId = Number(pokemon.speciesId ?? pokemon.id) || null;
  if (search) {
    const searchable = [
      pokemon.name,
      speciesId,
      speciesId ? String(speciesId).padStart(3, "0") : "",
      ...(pokemon.types || [pokemon.type]).filter(Boolean),
    ].map(normalize).join(" ");
    if (!searchable.includes(search)) return false;
  }
  const types = pokemon.types || [pokemon.type];
  if (filters.type && filters.type !== "all" && !types.includes(filters.type)) return false;
  if (filters.rarity && filters.rarity !== "all" && pokemon.rarity !== filters.rarity) return false;
  const formCategory = pokemon.form?.category || "normal";
  if (filters.form && filters.form !== "all" && formCategory !== filters.form) return false;
  if (filters.shiny === "shiny" && !pokemon.shiny) return false;
  if (filters.shiny === "non-shiny" && pokemon.shiny) return false;
  const level = Number(pokemon.level) || 1;
  if (filters.level === "1-19" && (level < 1 || level > 19)) return false;
  if (filters.level === "20-39" && (level < 20 || level > 39)) return false;
  if (filters.level === "40-59" && (level < 40 || level > 59)) return false;
  if (filters.level === "60+" && level < 60) return false;
  return true;
}

export function getPokemonComparison(incoming = {}, current = {}) {
  const stat = (pokemon, key, fallback = 0) =>
    Number(pokemon[key] ?? fallback) || 0;
  return [
    { key: "level", label: "Lv", incoming: stat(incoming, "level", 1), current: stat(current, "level", 1) },
    { key: "hp", label: "HP", incoming: stat(incoming, "maxHp", incoming.hp), current: stat(current, "maxHp", current.hp) },
    { key: "attack", label: "ATK", incoming: stat(incoming, "attack"), current: stat(current, "attack") },
    { key: "defense", label: "DEF", incoming: stat(incoming, "defense"), current: stat(current, "defense") },
    { key: "specialAttack", label: "SP.ATK", incoming: stat(incoming, "specialAttack", incoming.attack), current: stat(current, "specialAttack", current.attack) },
    { key: "specialDefense", label: "SP.DEF", incoming: stat(incoming, "specialDefense", incoming.defense), current: stat(current, "specialDefense", current.defense) },
  ].map((entry) => ({ ...entry, difference: entry.incoming - entry.current }));
}
