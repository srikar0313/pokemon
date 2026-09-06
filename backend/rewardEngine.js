function createRewardEngine({
  normalizePokemon,
  getEvolutionOptions,
  getAvailableEvolutions,
  getPokemonTemplateByName,
  getPokemonFormDefinition,
  updateAchievements,
}) {
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

  function evolvePokemonFromTemplate(pokemon, evolution) {
    const targetName = evolution?.targetName || evolution?.name;
    const sourceTemplate = getPokemonTemplateByName?.(pokemon.name);
    const targetTemplate = getPokemonTemplateByName?.(targetName);
    if (!targetTemplate?.name) {
      return {
        pokemon,
        evolved: false,
        evolvedFrom: null,
        evolvedTo: null,
        message: `${pokemon.name} could not evolve into ${targetName} because that species data is missing.`,
      };
    }

    const sourceForm = pokemon.form?.id
      ? getPokemonFormDefinition?.(sourceTemplate, pokemon.form.id)
      : null;
    let targetForm = null;
    if (pokemon.form?.id && !sourceForm) {
      return {
        pokemon,
        evolved: false,
        evolvedFrom: null,
        evolvedTo: null,
        message: `${pokemon.name}'s form cannot evolve because its form data is missing.`,
      };
    }
    if (sourceForm) {
      targetForm = sourceForm.evolvesToForm
        ? getPokemonFormDefinition?.(targetTemplate, sourceForm.evolvesToForm)
        : null;
      if (!targetForm) {
        return {
          pokemon,
          evolved: false,
          evolvedFrom: null,
          evolvedTo: null,
          message: `${pokemon.name}'s ${sourceForm.name || "regional form"} cannot evolve because its next form is not available.`,
        };
      }
    }

    const evolvedFrom = pokemon.name;
    const previousMaxHp = pokemon.maxHp || pokemon.hp || 1;
    const previousHpRatio =
      previousMaxHp > 0 ? Math.max(0, pokemon.currentHp || 0) / previousMaxHp : 1;
    const knownMoves = (pokemon.moves || [])
      .slice(0, 4)
      .map(normalizeLearnedMove);
    const evolvedPokemon = normalizePokemon({
      ...targetTemplate,
      level: pokemon.level || 1,
      xp: pokemon.xp ?? 0,
      shiny: pokemon.shiny ?? false,
      form: targetForm ? { id: targetForm.id } : null,
      status: pokemon.status || "none",
      pendingMove: pokemon.pendingMove || undefined,
    });
    [
      "maxHp",
      "attack",
      "defense",
      "specialAttack",
      "specialDefense",
    ].forEach((stat) => {
      const sourceBase =
        sourceForm?.[stat] ??
        sourceTemplate?.[stat] ??
        (stat === "maxHp" ? sourceTemplate?.hp : undefined) ??
        pokemon[stat] ??
        1;
      const targetBase =
        targetForm?.[stat] ??
        targetTemplate[stat] ??
        (stat === "maxHp" ? targetTemplate.hp : undefined) ??
        evolvedPokemon[stat] ??
        1;
      const accumulatedGrowth = Math.max(
        0,
        (pokemon[stat] ?? sourceBase) - sourceBase,
      );
      evolvedPokemon[stat] = Math.max(1, targetBase + accumulatedGrowth);
    });
    if (knownMoves.length) evolvedPokemon.moves = knownMoves;
    if (pokemon.statBaseVersion) {
      evolvedPokemon.statBaseVersion = pokemon.statBaseVersion;
    }

    evolvedPokemon.currentHp =
      (pokemon.currentHp || 0) <= 0
        ? 0
        : Math.max(
            1,
            Math.min(
              evolvedPokemon.maxHp || evolvedPokemon.hp || 1,
              Math.round((evolvedPokemon.maxHp || evolvedPokemon.hp || 1) * previousHpRatio),
            ),
          );
    evolvedPokemon.evolvedFrom = evolvedFrom;
    delete evolvedPokemon.pendingEvolution;

    return {
      pokemon: evolvedPokemon,
      evolved: true,
      evolvedFrom,
      evolvedTo: evolvedPokemon.name,
      message: `${evolvedFrom} evolved into ${evolvedPokemon.name}!`,
    };
  }

  function serializeEvolutionOptions(options) {
    return (options || []).map((option) => ({
      targetSpeciesId: option.targetSpeciesId,
      targetName: option.targetName,
      supported: option.supported,
      requirements: option.requirements,
      unsupportedRequirements: option.unsupportedRequirements,
    }));
  }

  function performEvolution(pokemon, context = {}) {
    const options = getEvolutionOptions?.(pokemon, context) || [];
    const available = getAvailableEvolutions?.(pokemon, context) || [];
    if (!available.length) {
      return {
        pokemon,
        evolved: false,
        options: serializeEvolutionOptions(options),
        message: options.length
          ? `${pokemon.name} does not meet the evolution requirements.`
          : `${pokemon.name} has no further evolution.`,
      };
    }
    const hasRequestedTarget =
      context.targetSpeciesId !== null &&
      context.targetSpeciesId !== undefined &&
      context.targetSpeciesId !== "";
    if (available.length > 1 && !hasRequestedTarget) {
      const pendingEvolution = {
        trigger: context.trigger,
        item: context.item || null,
        options: serializeEvolutionOptions(available),
      };
      return {
        pokemon: { ...pokemon, pendingEvolution },
        evolved: false,
        requiresChoice: true,
        pendingEvolution,
        options: pendingEvolution.options,
        message: `${pokemon.name} can evolve. Choose its evolution.`,
      };
    }
    const evolutionResult = evolvePokemonFromTemplate(pokemon, available[0]);
    return {
      ...evolutionResult,
      options: serializeEvolutionOptions(options),
      evolution: available[0],
    };
  }

  function calculateBattleXp(defeatedPokemon, trainerMultiplier = 1) {
    const baseYield = defeatedPokemon?.xpYield || 50;
    const level = defeatedPokemon?.level || 1;
    const multiplier = Math.min(Math.max(trainerMultiplier || 1, 1), 1.5);
    return Math.max(
      1,
      Math.floor((baseYield * level * multiplier) / 7),
    );
  }

  function getXpNeededForLevel(level) {
    const currentLevel = Math.max(1, level || 1);
    const currentTotal = currentLevel ** 3;
    const nextTotal = (currentLevel + 1) ** 3;
    return Math.max(50, Math.floor((nextTotal - currentTotal) * 1.2));
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
    let pokemon = updatedTeam[pokemonIndex];
    const startingName = pokemon.name;
    const startingLevel = pokemon.level || 1;
    const startingXp = pokemon.xp || 0;
    const startingXpNeeded = getXpNeededForLevel(startingLevel);
    const wasFainted = (pokemon.currentHp || 0) <= 0;
    pokemon.xp = startingXp + xpAmount;
    let leveledUp = false;
    let evolved = false;
    let evolvedFrom = null;
    const evolutionEvents = [];
    const messages = [];
    const statGains = [];
    const learnedMoves = [];

    while (pokemon.xp >= getXpNeededForLevel(pokemon.level || 1)) {
      const xpNeeded = getXpNeededForLevel(pokemon.level || 1);
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
      pokemon.currentHp = wasFainted
        ? 0
        : Math.min(pokemon.maxHp, (pokemon.currentHp || 0) + growth.maxHp);
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

    if (leveledUp) {
      while (true) {
        const evolutionResult = performEvolution(pokemon, {
          trigger: "level-up",
        });
        if (evolutionResult.requiresChoice) {
          pokemon = evolutionResult.pokemon;
          updatedTeam[pokemonIndex] = pokemon;
          messages.push(evolutionResult.message);
          break;
        }
        if (!evolutionResult.evolved) {
          delete pokemon.pendingEvolution;
          break;
        }
        messages.push(evolutionResult.message);
        evolutionEvents.push({
          from: evolutionResult.evolvedFrom,
          to: evolutionResult.evolvedTo,
        });
        pokemon = evolutionResult.pokemon;
        updatedTeam[pokemonIndex] = pokemon;
        evolved = true;
        evolvedFrom ||= evolutionResult.evolvedFrom;
      }
    }

    return {
      team: updatedTeam,
      pokemon,
      leveledUp,
      evolved,
      evolvedFrom,
      evolvedTo: evolved ? pokemon.name : null,
      evolutionEvents,
      startingName,
      startingLevel,
      endingLevel: pokemon.level || startingLevel,
      startingXp,
      endingXp: pokemon.xp || 0,
      startingXpNeeded,
      endingXpNeeded: getXpNeededForLevel(pokemon.level || startingLevel),
      statGains,
      learnedMoves,
      pendingMove: pokemon.pendingMove || null,
      pendingEvolution: pokemon.pendingEvolution || null,
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
        evolutionEvents: result.evolutionEvents,
        startingName: result.startingName,
        startingLevel: result.startingLevel,
        endingLevel: result.endingLevel,
        startingXp: result.startingXp,
        endingXp: result.endingXp,
        startingXpNeeded: result.startingXpNeeded,
        endingXpNeeded: result.endingXpNeeded,
        statGains: result.statGains,
        learnedMoves: result.learnedMoves,
        pendingMove: result.pendingMove,
        pendingEvolution: result.pendingEvolution,
        messages: result.messages,
      };
    });

    return { team: updatedTeam, results, xpEach };
  }

  function appendXpLog(log, xpResults) {
    (xpResults || []).forEach((result) => {
      if (!result.pokemon || result.xpAward <= 0) return;
      const startName = result.startingName || result.pokemon.name;
      const endName = result.pokemon.name;
      const nameLabel =
        startName === endName ? endName : `${startName} -> ${endName}`;
      log.push(
        `${nameLabel} gained ${result.xpAward} XP (Lv ${result.startingLevel} ${result.startingXp}/${result.startingXpNeeded} -> Lv ${result.endingLevel} ${result.endingXp}/${result.endingXpNeeded}).`,
      );
      (result.messages || []).forEach((message) => log.push(message));
    });
  }

  return {
    awardCoins,
    calculateBattleXp,
    applyXpToPokemon,
    applyXpToParticipants,
    appendXpLog,
    evolvePokemonFromTemplate,
    performEvolution,
    getXpNeededForLevel,
  };
}

module.exports = {
  createRewardEngine,
};
