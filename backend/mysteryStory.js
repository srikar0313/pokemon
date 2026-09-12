const MYSTERY_ENCOUNTER_ID = "aether-beacon-rayquaza";
const MYSTERY_CONFRONTATION_EVENT_ID = "mystery-rayquaza-confronted";
const MYSTERY_SPECIES = "Rayquaza";
const MYSTERY_LEVEL = 62;

function hasStoryFlag(state = {}, flag) {
  return (state.story?.flags || []).includes(flag);
}

function canStartMysteryEncounter(state = {}) {
  return (
    hasStoryFlag(state, "legendary_approach_ready") &&
    !hasStoryFlag(state, "legendary_confrontation_completed")
  );
}

function createMysteryEncounter({
  state,
  getPokemonTemplateByName,
  createLeveledPokemon,
}) {
  if (!canStartMysteryEncounter(state)) {
    return {
      error: hasStoryFlag(state, "legendary_confrontation_completed")
        ? "The Aether Beacon confrontation is already complete."
        : "The final approach to the Aether Beacon is not ready yet.",
    };
  }
  const template = getPokemonTemplateByName(MYSTERY_SPECIES);
  if (!template) return { error: `${MYSTERY_SPECIES} is missing from Pokemon data.` };
  const pokemon = createLeveledPokemon(template.name, MYSTERY_LEVEL);
  return {
    pokemon: {
      ...pokemon,
      area: "mountain",
      weather: "wind",
      timeOfDay: "night",
      rarity: template.rarity || "legendary",
      legendaryRoll: true,
      poolSize: 1,
      encounterMetadata: {
        area: "mountain",
        weather: "wind",
        timeOfDay: "night",
        rarity: template.rarity || "legendary",
        legendaryRoll: true,
        poolSize: 1,
        story: true,
      },
      storyEncounter: {
        id: MYSTERY_ENCOUNTER_ID,
        speciesId: Number(pokemon.speciesId || template.speciesId),
      },
    },
  };
}

function isMysteryEncounter(pokemon = {}) {
  return (
    pokemon.storyEncounter?.id === MYSTERY_ENCOUNTER_ID &&
    String(pokemon.name || "").toLowerCase() === MYSTERY_SPECIES.toLowerCase()
  );
}

function completeMysteryConfrontation({ state, pokemon, storyEngine }) {
  if (!isMysteryEncounter(pokemon)) return { state, completed: false, events: [] };
  if (!canStartMysteryEncounter(state)) {
    return {
      state,
      completed: false,
      alreadyCompleted: hasStoryFlag(
        state,
        "legendary_confrontation_completed",
      ),
      events: [],
    };
  }
  const result = storyEngine.completeEvent(
    state,
    MYSTERY_CONFRONTATION_EVENT_ID,
  );
  if (result.error) return { state, completed: false, events: [], error: result.error };
  return {
    state: result.state,
    completed: !result.alreadyCompleted,
    events: storyEngine.getEligibleEvents(result.state, "mystery-progress"),
  };
}

function getMysteryNpcDialogue(npc = {}, state = {}) {
  return hasStoryFlag(state, "regional_crisis_resolved") && npc.aftermathDialogue
    ? npc.aftermathDialogue
    : npc.dialogue;
}

module.exports = {
  MYSTERY_ENCOUNTER_ID,
  MYSTERY_CONFRONTATION_EVENT_ID,
  MYSTERY_SPECIES,
  MYSTERY_LEVEL,
  canStartMysteryEncounter,
  createMysteryEncounter,
  isMysteryEncounter,
  completeMysteryConfrontation,
  getMysteryNpcDialogue,
};
