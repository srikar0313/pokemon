function createRewardEngine({ normalizePokemon, getEvolution, updateAchievements }) {
  function awardCoins(state, amount) {
    state.coins = (state.coins ?? state.money ?? 0) + amount;
    state.money = state.coins;
    state.xp = (state.xp || 0) + Math.max(1, Math.floor(amount / 10));
    state.level = Math.max(1, Math.floor((state.xp || 0) / 100) + 1);
    updateAchievements(state);
    return state;
  }

  function calculateBattleXp(defeatedPokemon, trainerMultiplier = 1) {
    const baseYield = defeatedPokemon?.xpYield || 50;
    const level = defeatedPokemon?.level || 1;
    return Math.max(
      50,
      Math.floor(baseYield * Math.max(1, level / 2) * trainerMultiplier),
    );
  }

  function applyXpToPokemon(team, pokemonIndex, xpAmount) {
    if (!team[pokemonIndex] || xpAmount <= 0) {
      return {
        team,
        pokemon: team[pokemonIndex] || null,
        leveledUp: false,
        evolved: false,
        evolvedFrom: null,
        evolvedTo: null,
      };
    }

    const updatedTeam = team.map((pokemon, index) =>
      index === pokemonIndex ? normalizePokemon({ ...pokemon }) : pokemon,
    );
    const pokemon = updatedTeam[pokemonIndex];
    pokemon.xp = (pokemon.xp || 0) + xpAmount;
    let leveledUp = false;
    let evolved = false;
    let evolvedFrom = null;

    while (pokemon.xp >= Math.max(25, (pokemon.level || 1) * 50)) {
      const xpNeeded = Math.max(25, (pokemon.level || 1) * 50);
      pokemon.xp -= xpNeeded;
      pokemon.level = (pokemon.level || 1) + 1;
      pokemon.maxHp = Math.floor((pokemon.maxHp || pokemon.hp || 1) * 1.15);
      pokemon.attack = Math.floor((pokemon.attack || 1) * 1.12);
      pokemon.defense = Math.floor((pokemon.defense || 1) * 1.12);
      pokemon.specialAttack = Math.floor((pokemon.specialAttack || 1) * 1.12);
      pokemon.specialDefense = Math.floor((pokemon.specialDefense || 1) * 1.12);
      pokemon.currentHp = pokemon.maxHp;
      leveledUp = true;
    }

    const evolution = getEvolution(pokemon);
    if (evolution && pokemon.level >= evolution.level) {
      evolvedFrom = pokemon.name;
      pokemon.name = evolution.name;
      pokemon.type = evolution.type || pokemon.type;
      pokemon.types = [pokemon.type];
      pokemon.attack = Math.floor(pokemon.attack * 1.05);
      pokemon.defense = Math.floor(pokemon.defense * 1.05);
      pokemon.maxHp = Math.floor(pokemon.maxHp * 1.05);
      pokemon.specialAttack = Math.floor(pokemon.specialAttack * 1.05);
      pokemon.specialDefense = Math.floor(pokemon.specialDefense * 1.05);
      pokemon.currentHp = pokemon.maxHp;
      pokemon.evolvesTo = null;
      pokemon.evolveLevel = null;
      pokemon.evolvedFrom = evolvedFrom;
      evolved = true;
    }

    return {
      team: updatedTeam,
      pokemon,
      leveledUp,
      evolved,
      evolvedFrom,
      evolvedTo: evolved ? pokemon.name : null,
    };
  }

  function applyXpToParticipants(team, participantIndexes, xpAmount) {
    const indexes = [...new Set((participantIndexes || []).map(Number))].filter(
      (index) => team[index] && xpAmount > 0,
    );
    if (!indexes.length) {
      return { team, results: [], xpEach: 0 };
    }

    const xpEach = Math.max(1, Math.floor(xpAmount / indexes.length));
    let updatedTeam = team;
    const results = indexes.map((index) => {
      const result = applyXpToPokemon(updatedTeam, index, xpEach);
      updatedTeam = result.team;
      return {
        index,
        xpAward: xpEach,
        pokemon: result.pokemon,
        leveledUp: result.leveledUp,
        evolved: result.evolved,
        evolvedFrom: result.evolvedFrom,
        evolvedTo: result.evolvedTo,
      };
    });

    return { team: updatedTeam, results, xpEach };
  }

  function appendXpLog(log, xpResults) {
    (xpResults || []).forEach((result) => {
      if (!result.pokemon || result.xpAward <= 0) return;
      log.push(`${result.pokemon.name} gained ${result.xpAward} XP.`);
      if (result.leveledUp) {
        log.push(`${result.pokemon.name} leveled up to ${result.pokemon.level}!`);
      }
      if (result.evolved) {
        log.push(
          `${result.evolvedFrom || "Your Pokemon"} evolved into ${
            result.evolvedTo || result.pokemon.name
          }!`,
        );
      }
    });
  }

  return {
    awardCoins,
    calculateBattleXp,
    applyXpToPokemon,
    applyXpToParticipants,
    appendXpLog,
  };
}

module.exports = {
  createRewardEngine,
};
