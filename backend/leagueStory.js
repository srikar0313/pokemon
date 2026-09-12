const LEAGUE_STATE_VERSION = "league-v1";

function uniqueStrings(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean).map(String))];
}

function sanitizeHallPokemon(pokemon = {}) {
  return {
    ownedId: pokemon.ownedId || null,
    id: Number(pokemon.id) || null,
    speciesId: Number(pokemon.speciesId) || null,
    imageId: Number(pokemon.imageId || pokemon.speciesId || pokemon.id) || null,
    name: String(pokemon.name || "Unknown Pokemon"),
    level: Math.max(1, Number(pokemon.level) || 1),
    types: Array.isArray(pokemon.types)
      ? pokemon.types.map(String)
      : [pokemon.type || "Normal"],
    shiny: Boolean(pokemon.shiny),
    form: pokemon.form?.id
      ? {
          id: String(pokemon.form.id),
          name: String(pokemon.form.name || pokemon.form.id),
          imageId: Number(pokemon.form.imageId) || null,
          shinyImageId: Number(pokemon.form.shinyImageId) || null,
        }
      : null,
  };
}

function normalizeHallOfFame(value) {
  if (!value || typeof value !== "object") return null;
  return {
    completedAt: value.completedAt ? String(value.completedAt) : null,
    trainerName: String(value.trainerName || "Player"),
    team: (Array.isArray(value.team) ? value.team : []).map(sanitizeHallPokemon),
  };
}

function normalizeLeagueState(value = {}, { championDefeated = false } = {}) {
  const existing = value && typeof value === "object" ? value : {};
  return {
    version: LEAGUE_STATE_VERSION,
    completed: Boolean(existing.completed || championDefeated),
    completionCount: Math.max(
      championDefeated ? 1 : 0,
      Number(existing.completionCount) || 0,
    ),
    completedAt: existing.completedAt ? String(existing.completedAt) : null,
    hallOfFame: normalizeHallOfFame(existing.hallOfFame),
  };
}

function addChampionStoryFlags(state) {
  state.story ||= {};
  state.story.flags = uniqueStrings([
    ...(state.story.flags || []),
    "league_challenge_completed",
    "champion_defeated",
    "main_story_completed",
  ]);
  return state;
}

function migrateLegacyChampionState(
  state,
  { legacy = state.league?.version !== LEAGUE_STATE_VERSION } = {},
) {
  state.league = normalizeLeagueState(state.league, {
    championDefeated: state.championDefeated,
  });
  if (!state.championDefeated) return state;
  addChampionStoryFlags(state);
  if (legacy) {
    state.story.completedEventIds = uniqueStrings([
      ...(state.story.completedEventIds || []),
      "league-champion-ending",
    ]);
  }
  return state;
}

function recordLeagueVictory(
  state,
  team,
  { firstVictory, completedAt = new Date().toISOString() } = {},
) {
  state.league = normalizeLeagueState(state.league, { championDefeated: true });
  addChampionStoryFlags(state);
  if (!firstVictory) {
    state.league.completionCount += 1;
    return { state, firstCompletion: false, hallOfFame: state.league.hallOfFame };
  }
  const hallOfFame = {
    completedAt,
    trainerName: String(state.trainerName || "Player"),
    team: (team || []).slice(0, 6).map(sanitizeHallPokemon),
  };
  state.league = {
    ...state.league,
    completed: true,
    completionCount: Math.max(1, state.league.completionCount),
    completedAt,
    hallOfFame,
  };
  return { state, firstCompletion: true, hallOfFame };
}

module.exports = {
  LEAGUE_STATE_VERSION,
  normalizeLeagueState,
  migrateLegacyChampionState,
  recordLeagueVictory,
  sanitizeHallPokemon,
};
