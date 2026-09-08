export function buildTypeGuide(typeChart = {}) {
  const types = Object.keys(typeChart);
  return types.map((type) => ({
    name: type,
    strongAgainst: types.filter((target) => (typeChart[type]?.[target] ?? 1) > 1),
    resistedBy: types.filter((target) => {
      const value = typeChart[type]?.[target] ?? 1;
      return value > 0 && value < 1;
    }),
    noEffectAgainst: types.filter((target) => (typeChart[type]?.[target] ?? 1) === 0),
    weakAgainst: types.filter((attacker) => (typeChart[attacker]?.[type] ?? 1) > 1),
  }));
}

export function matchesHandbookSearch(entry = {}, query = "") {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return JSON.stringify(entry).toLowerCase().includes(normalized);
}

export function filterHandbookEntries(entries = [], query = "") {
  return entries.filter((entry) => matchesHandbookSearch(entry, query));
}

export function getTypeMultiplier(typeChart = {}, attacker, defender) {
  return typeChart[attacker]?.[defender] ?? 1;
}
