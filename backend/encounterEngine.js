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
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;
    for (const item of items) {
      random -= item.weight;
      if (random <= 0) return item.pokemon;
    }
    return items[0].pokemon;
  }

  function selectEncounter(allPokemon, area) {
    const currentTime = getTimeOfDay();
    const weather = getCurrentWeather();
    const selectedArea = String(area).toLowerCase();
    const legendaryRoll = Math.random() < 0.02;
    const areaPool = allPokemon.filter((pokemon) => {
      const habitats = Array.isArray(pokemon.habitats)
        ? pokemon.habitats
        : pokemon.habitats
          ? [pokemon.habitats]
          : [];
      return habitats.includes(selectedArea);
    });
    const biomePool = areaPool.length ? areaPool : allPokemon;
    const spawnPool = biomePool.filter((pokemon) => {
      const isLegendary =
        pokemon.rarity === "legendary" || pokemon.rarity === "mythical";
      return legendaryRoll ? isLegendary : !isLegendary;
    });

    const weightedPokemon = (spawnPool.length ? spawnPool : biomePool).map(
      (pokemon) => ({
        pokemon,
        weight: calculateSpawnWeight(
          pokemon,
          selectedArea,
          currentTime,
          weather,
        ),
      }),
    );

    return {
      pokemon: weightedSelection(weightedPokemon),
      weather,
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
