function createRewardEngine({ normalizePokemon, getEvolution, updateAchievements }) {
  const statGrowthByRarity = {
    common: {
      maxHp: 5,
      attack: 2,
      defense: 2,
      specialAttack: 2,
      specialDefense: 2,
    },
    uncommon: {
      maxHp: 6,
      attack: 3,
      defense: 3,
      specialAttack: 3,
      specialDefense: 3,
    },
    rare: {
      maxHp: 7,
      attack: 4,
      defense: 4,
      specialAttack: 4,
      specialDefense: 4,
    },
    legendary: {
      maxHp: 8,
      attack: 5,
      defense: 5,
      specialAttack: 5,
      specialDefense: 5,
    },
    mythical: {
      maxHp: 8,
      attack: 5,
      defense: 5,
      specialAttack: 5,
      specialDefense: 5,
    },
  };

  function getStatGrowth(pokemon) {
    return statGrowthByRarity[pokemon.rarity] || statGrowthByRarity.common;
  }

  function normalizeLearnedMove(move) {
    const maxPp = move.maxPp ?? move.pp ?? move.currentPp ?? 10;
    return {
      ...move,
      pp: move.pp ?? maxPp,
      maxPp,
      currentPp: move.currentPp ?? maxPp,
    };
  }

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
    const startingLevel = pokemon.level || 1;
    let leveledUp = false;
    let evolved = false;
    let evolvedFrom = null;
    const messages = [];
    const statGains = [];
    const learnedMoves = [];

    while (pokemon.xp >= (pokemon.level || 1) * 50) {
      const xpNeeded = (pokemon.level || 1) * 50;
      pokemon.xp -= xpNeeded;
      pokemon.level = (pokemon.level || 1) + 1;
      const growth = getStatGrowth(pokemon);
      pokemon.maxHp = (pokemon.maxHp || pokemon.hp || 1) + growth.maxHp;
      pokemon.attack = (pokemon.attack || 1) + growth.attack;
      pokemon.defense = (pokemon.defense || 1) + growth.defense;
      pokemon.specialAttack =
        (pokemon.specialAttack || pokemon.attack || 1) + growth.specialAttack;
      pokemon.specialDefense =
        (pokemon.specialDefense || pokemon.defense || 1) + growth.specialDefense;
      pokemon.currentHp = Math.min(
        pokemon.maxHp,
        (pokemon.currentHp || 0) + growth.maxHp,
      );
      leveledUp = true;
      statGains.push({ level: pokemon.level, ...growth });
      messages.push(`${pokemon.name} grew to level ${pokemon.level}! Stats increased.`);
    }

    (pokemon.learnset || [])
      .filter(
        (entry) =>
          entry?.move &&
          entry.level > startingLevel &&
          entry.level <= (pokemon.level || startingLevel),
      )
      .sort((a, b) => a.level - b.level)
      .forEach((entry) => {
        const move = normalizeLearnedMove(entry.move);
        const alreadyKnowsMove = (pokemon.moves || []).some(
          (knownMove) => knownMove.name === move.name,
        );
        if (alreadyKnowsMove) return;
        if ((pokemon.moves || []).length < 4) {
          pokemon.moves = [...(pokemon.moves || []), move];
          learnedMoves.push(move);
          messages.push(`${pokemon.name} learned ${move.name}!`);
          return;
        }
        pokemon.pendingMove = move;
        messages.push(
          `${pokemon.name} wants to learn ${move.name}, but already knows 4 moves.`,
        );
      });

    if (!pokemon.pendingMove) {
      delete pokemon.pendingMove;
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
      messages.push(`${evolvedFrom} evolved into ${pokemon.name}!`);
    }

    return {
      team: updatedTeam,
      pokemon,
      leveledUp,
      evolved,
      evolvedFrom,
      evolvedTo: evolved ? pokemon.name : null,
      statGains,
      learnedMoves,
      pendingMove: pokemon.pendingMove || null,
      messages,
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
        statGains: result.statGains,
        learnedMoves: result.learnedMoves,
        pendingMove: result.pendingMove,
        messages: result.messages,
      };
    });

    return { team: updatedTeam, results, xpEach };
  }

  function appendXpLog(log, xpResults) {
    (xpResults || []).forEach((result) => {
      if (!result.pokemon || result.xpAward <= 0) return;
      log.push(`${result.pokemon.name} gained ${result.xpAward} XP.`);
      (result.messages || []).forEach((message) => log.push(message));
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
