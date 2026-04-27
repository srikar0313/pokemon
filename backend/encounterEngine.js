function createEncounterEngine({ rarityWeights, weatherBoosts, getPokemonTypes }) {
  function getTimeOfDay() {
    const hour = new Date().getHours();
    return hour >= 6 && hour < 18 ? "day" : "night";
  }

  function getCurrentWeather() {
    const roll = Math.random();
    if (roll < 0.5) return "sunny";
    if (roll < 0.8) return "rain";
    if (roll < 0.95) return "snow";
    return "sandstorm";
  }

  function getWeatherMatch(types, weather) {
    return types.some((type) => (weatherBoosts[type] || []).includes(weather));
  }

  function calculateSpawnWeight(pokemon, selectedArea, currentTime, weather) {
    let weight = rarityWeights[pokemon.rarity] || 0;
    const habitats = Array.isArray(pokemon.habitats)
      ? pokemon.habitats
      : pokemon.habitats
        ? [pokemon.habitats]
        : [];
    const times = Array.isArray(pokemon.times)
      ? pokemon.times
      : pokemon.times
        ? [pokemon.times]
        : [];
    const types = getPokemonTypes(pokemon);

    if (habitats.includes(selectedArea)) weight += 30;
    if (times.includes(currentTime)) weight += 15;
    if (getWeatherMatch(types, weather)) weight += 10;
    return Math.max(1, weight);
  }

  function weightedSelection(items) {
    if (!items.length) return null;
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;
    for (const item of items) {
      random -= item.weight;
      if (random <= 0) return item.pokemon;
    }
    return items[0].pokemon;
  }

  function getHabitats(pokemon) {
    if (Array.isArray(pokemon.habitats)) return pokemon.habitats;
    return pokemon.habitats ? [pokemon.habitats] : [];
  }

  function isLegendaryPokemon(pokemon) {
    return pokemon.rarity === "legendary" || pokemon.rarity === "mythical";
  }

  function createWeightedPool(pool, selectedArea, currentTime, weather) {
    return pool.map((pokemon) => ({
      pokemon,
      weight: calculateSpawnWeight(pokemon, selectedArea, currentTime, weather),
    }));
  }

  function selectEncounter(allPokemon, area) {
    const currentTime = getTimeOfDay();
    const weather = getCurrentWeather();
    const selectedArea = String(area).toLowerCase();
    const legendaryRoll = Math.random() < 0.02;
    const areaPool = allPokemon.filter((pokemon) =>
      getHabitats(pokemon).includes(selectedArea),
    );
    const hasAreaPokemon = areaPool.length > 0;
    const biomePool = hasAreaPokemon ? areaPool : allPokemon;
    const areaLegendaryPool = areaPool.filter(isLegendaryPokemon);
    const normalAreaPool = biomePool.filter((pokemon) => !isLegendaryPokemon(pokemon));
    const fallbackPool = normalAreaPool.length ? normalAreaPool : biomePool;
    const spawnPool =
      legendaryRoll && areaLegendaryPool.length ? areaLegendaryPool : fallbackPool;
    const weightedPokemon = createWeightedPool(
      spawnPool,
      selectedArea,
      currentTime,
      weather,
    );
    const selectedPokemon = weightedSelection(weightedPokemon);

    return {
      pokemon: selectedPokemon,
      weather,
      metadata: {
        area: selectedArea,
        weather,
        timeOfDay: currentTime,
        rarity: selectedPokemon?.rarity || null,
        legendaryRoll,
        poolSize: spawnPool.length,
      },
    };
  }

  return {
    getTimeOfDay,
    getCurrentWeather,
    getWeatherMatch,
    calculateSpawnWeight,
    weightedSelection,
    selectEncounter,
  };
}

module.exports = {
  createEncounterEngine,
};
