const typeChart = {
  Normal: { Rock: 0.5, Ghost: 0, Steel: 0.5 },
  Fire: {
    Fire: 0.5,
    Water: 0.5,
    Grass: 2,
    Ice: 2,
    Bug: 2,
    Rock: 0.5,
    Dragon: 0.5,
    Steel: 2,
  },
  Water: { Fire: 2, Water: 0.5, Grass: 0.5, Ground: 2, Rock: 2, Dragon: 0.5 },
  Electric: {
    Water: 2,
    Electric: 0.5,
    Grass: 0.5,
    Ground: 0,
    Flying: 2,
    Dragon: 0.5,
  },
  Grass: {
    Fire: 0.5,
    Water: 2,
    Grass: 0.5,
    Poison: 0.5,
    Ground: 2,
    Flying: 0.5,
    Bug: 0.5,
    Rock: 2,
    Dragon: 0.5,
    Steel: 0.5,
  },
  Ice: {
    Fire: 0.5,
    Water: 0.5,
    Grass: 2,
    Ice: 0.5,
    Ground: 2,
    Flying: 2,
    Dragon: 2,
    Steel: 0.5,
  },
  Fighting: {
    Normal: 2,
    Ice: 2,
    Rock: 2,
    Dark: 2,
    Steel: 2,
    Poison: 0.5,
    Flying: 0.5,
    Psychic: 0.5,
    Bug: 0.5,
    Fairy: 0.5,
    Ghost: 0,
  },
  Poison: {
    Grass: 2,
    Fairy: 2,
    Poison: 0.5,
    Ground: 0.5,
    Rock: 0.5,
    Ghost: 0.5,
    Steel: 0,
  },
  Ground: {
    Fire: 2,
    Electric: 2,
    Grass: 0.5,
    Poison: 2,
    Flying: 0,
    Bug: 0.5,
    Rock: 2,
    Steel: 2,
  },
  Flying: {
    Grass: 2,
    Fighting: 2,
    Bug: 2,
    Electric: 0.5,
    Rock: 0.5,
    Steel: 0.5,
  },
  Psychic: { Fighting: 2, Poison: 2, Psychic: 0.5, Steel: 0.5, Dark: 0 },
  Bug: {
    Grass: 2,
    Psychic: 2,
    Dark: 2,
    Fire: 0.5,
    Fighting: 0.5,
    Poison: 0.5,
    Flying: 0.5,
    Ghost: 0.5,
    Steel: 0.5,
    Fairy: 0.5,
    Rock: 1,
  },
  Rock: {
    Fire: 2,
    Ice: 2,
    Flying: 2,
    Bug: 2,
    Fighting: 0.5,
    Ground: 0.5,
    Steel: 0.5,
  },
  Ghost: { Psychic: 2, Ghost: 2, Normal: 0, Dark: 0.5 },
  Dragon: { Dragon: 2, Steel: 0.5, Fairy: 0 },
  Dark: { Psychic: 2, Ghost: 2, Fighting: 0.5, Dark: 0.5, Fairy: 0.5 },
  Steel: {
    Ice: 2,
    Rock: 2,
    Fairy: 2,
    Fire: 0.5,
    Water: 0.5,
    Electric: 0.5,
    Steel: 0.5,
  },
  Fairy: {
    Fighting: 2,
    Dragon: 2,
    Dark: 2,
    Fire: 0.5,
    Poison: 0.5,
    Steel: 0.5,
  },
};

const aiDifficulty = {
  EASY: "easy",
  MEDIUM: "medium",
  HARD: "hard",
};

function createBattleEngine({ getRandomInt }) {
  function getTypeEffectiveness(attackerType, defenderType) {
    if (!attackerType || !defenderType) return 1;
    return typeChart[attackerType]?.[defenderType] ?? 1;
  }

  function getCombinedTypeEffectiveness(attackerType, defenderTypes) {
    const types = Array.isArray(defenderTypes) ? defenderTypes : [defenderTypes];
    return types.reduce(
      (multiplier, type) =>
        multiplier * getTypeEffectiveness(attackerType, type),
      1,
    );
  }

  function calculateDamage(
    { attack, defense, specialAttack, specialDefense, types, level, status },
    { defense: defStat, specialDefense: defSpDef, types: oppTypes },
    movePower,
    category,
    moveType,
  ) {
    let atkStat, defStatUsed;
    if (category === "Physical") {
      atkStat = attack || 1;
      defStatUsed = defStat || 1;
    } else if (category === "Special") {
      atkStat = specialAttack || attack || 1;
      defStatUsed = defSpDef || defStat || 1;
    } else {
      return { damage: 0, effectiveness: 1, critical: false, burnReduced: false };
    }

    const stab = types.includes(moveType) ? 1.5 : 1;
    const effectiveness = getCombinedTypeEffectiveness(moveType, oppTypes);
    const randomFactor = getRandomInt(85, 100) / 100;
    const critical = Math.random() < 0.0625 ? 1.5 : 1;
    const burnReduction = status === "burned" ? 0.5 : 1;

    const base = (((2 * level) / 5 + 2) * atkStat * movePower) / defStatUsed;
    const damage = Math.floor(
      (base / 50 + 2) *
        stab *
        effectiveness *
        randomFactor *
        critical *
        burnReduction,
    );
    return {
      damage: Math.max(1, damage),
      effectiveness,
      critical: critical > 1,
      burnReduced: burnReduction < 1,
    };
  }

  function getMoveByName(pokemon, moveName) {
    return (pokemon.moves || []).find((move) => move.name === moveName);
  }

  function checkAccuracy(move) {
    return Math.random() * 100 < (move.accuracy ?? 100);
  }

  function changeStat(target, stat, stages) {
    if (!stat || !Number.isFinite(stages)) return false;
    const current = target[stat] ?? 1;
    const multiplier =
      stages > 0 ? 1 + stages * 0.25 : 1 / (1 + Math.abs(stages) * 0.25);
    target[stat] = Math.max(1, Math.floor(current * multiplier));
    return true;
  }

  function getUnsupportedEffectMessage(effect) {
    const labels = {
      weather: "Weather effect",
      trap: "Trap effect",
      recoil: "Recoil effect",
      flinch: "Flinch effect",
      flinched: "Flinch effect",
      curse: "Curse effect",
      taunted: "Taunt effect",
      priority: "Priority effect",
    };
    const label = labels[effect?.type] || `${effect?.type || "Move"} effect`;
    return `${label} is not implemented yet.`;
  }

  function applyMoveEffect(move, attacker, defender) {
    const effect = move.effect;
    const log = [];
    if (!effect || Math.random() * 100 >= (effect.chance ?? 100)) {
      return log;
    }

    const target = effect.target === "self" ? attacker : defender;
    const targetName = target === attacker ? attacker.name : defender.name;

    if (effect.type === "status") {
      if (!target.status || target.status === "none") {
        target.status = effect.status;
        log.push(`${targetName} was ${formatStatusForLog(effect.status)}!`);
      }
    } else if (effect.type === "statChange") {
      if (changeStat(target, effect.stat, effect.stages)) {
        const direction = effect.stages > 0 ? "rose" : "fell";
        log.push(
          `${targetName}'s ${formatStatForLog(effect.stat)} ${direction}!`,
        );
      }
    } else if (effect.type === "heal" || effect.type === "healAndSleep") {
      const maxHp = attacker.maxHp || attacker.hp || 1;
      const healed = Math.min(
        maxHp - attacker.currentHp,
        Math.max(1, Math.floor(maxHp * ((effect.percent || 50) / 100))),
      );
      attacker.currentHp += healed;
      log.push(`${attacker.name} recovered ${healed} HP.`);
      if (effect.type === "healAndSleep") {
        attacker.status = effect.status || "asleep";
        log.push(`${attacker.name} fell asleep!`);
      }
    } else if (effect.type === "allStatsUp") {
      ["attack", "defense", "specialAttack", "specialDefense", "speed"].forEach(
        (stat) => changeStat(attacker, stat, effect.stages || 1),
      );
      log.push(`${attacker.name}'s stats rose!`);
    } else if (effect.type === "randomMove") {
      log.push("A mysterious power sparked, but nothing happened.");
    } else if (effect.type === "criticalBoost") {
      return log;
    } else {
      log.push(getUnsupportedEffectMessage(effect));
    }

    return log;
  }

  function calculateMoveDamage(attacker, defender, move) {
    const baseResult = calculateDamage(
      attacker,
      defender,
      move.power || 0,
      move.category,
      move.type,
    );
    const boostedCritical =
      move.effect?.type === "criticalBoost" &&
      Math.random() * 100 < (move.effect.chance ?? 0);
    const hits = Math.max(1, move.hits || 1);
    const criticalMultiplier = boostedCritical && !baseResult.critical ? 1.5 : 1;
    return {
      ...baseResult,
      damage:
        Math.max(1, Math.floor(baseResult.damage * criticalMultiplier)) * hits,
      hits,
      critical: baseResult.critical || boostedCritical,
    };
  }

  function formatStatusForLog(status) {
    const labels = {
      asleep: "put to sleep",
      burned: "burned",
      confused: "confused",
      frozen: "frozen",
      paralyzed: "paralyzed",
      poisoned: "poisoned",
    };
    return labels[status] || status;
  }

  function formatStatForLog(stat) {
    return String(stat || "")
      .replace(/([A-Z])/g, " $1")
      .toLowerCase();
  }

  function executeBattleMove(attacker, defender, moveName, defenderPrefix = "") {
    const log = [];
    const move = getMoveByName(attacker, moveName);
    if (!move) return { error: "Move not found", log };
    if (move.currentPp <= 0) {
      log.push("No PP left for this move!");
      return { error: "No PP left for this move", log };
    }

    if (attacker.status === "paralyzed" && Math.random() < 0.25) {
      log.push(`${attacker.name} is paralyzed and cannot move!`);
      return { move, log };
    }
    if (attacker.status === "asleep" || attacker.status === "frozen") {
      log.push(`${attacker.name} is ${attacker.status} and cannot move!`);
      return { move, log };
    }

    move.currentPp -= 1;
    log.push(`${attacker.name} used ${move.name}!`);

    if (!checkAccuracy(move)) {
      log.push("The attack missed!");
      return { move, log };
    }

    if (move.category !== "Status" && (move.power || 0) > 0) {
      const damageResult = calculateMoveDamage(attacker, defender, move);
      defender.currentHp = Math.max(0, defender.currentHp - damageResult.damage);
      if (damageResult.critical) log.push("A critical hit!");
      if (damageResult.effectiveness > 1) log.push("It's super effective!");
      if (damageResult.effectiveness < 1 && damageResult.effectiveness > 0) {
        log.push("It's not very effective...");
      }
      if (damageResult.effectiveness === 0) log.push("It had no effect!");
      if (damageResult.hits > 1) log.push(`Hit ${damageResult.hits} times!`);
      log.push(
        `${defenderPrefix}${defender.name} took ${damageResult.damage} damage.`,
      );
    }

    log.push(...applyMoveEffect(move, attacker, defender));
    return { move, log };
  }

  function getAvailableMoves(pokemon) {
    return (pokemon.moves || []).filter((move) => move.currentPp > 0);
  }

  function isDamagingMove(move) {
    return move.category !== "Status" && (move.power || 0) > 0;
  }

  function estimateMoveDamage(attacker, defender, move) {
    if (!isDamagingMove(move)) return 0;
    const attackStat =
      move.category === "Special"
        ? attacker.specialAttack || attacker.attack || 1
        : attacker.attack || 1;
    const defenseStat =
      move.category === "Special"
        ? defender.specialDefense || defender.defense || 1
        : defender.defense || 1;
    const stab = (attacker.types || []).includes(move.type) ? 1.5 : 1;
    const effectiveness = getCombinedTypeEffectiveness(move.type, defender.types);
    const base =
      (((2 * (attacker.level || 1)) / 5 + 2) * attackStat * (move.power || 0)) /
        defenseStat /
        50 +
      2;
    return Math.max(0, Math.floor(base * stab * effectiveness));
  }

  function isUsefulStatusMove(move, defender) {
    const effect = move.effect;
    if (!effect) return false;
    if (effect.type === "status") {
      const usefulStatuses = [
        "paralyzed",
        "burned",
        "asleep",
        "frozen",
        "confused",
        "poisoned",
      ];
      return (
        usefulStatuses.includes(effect.status) &&
        (!defender.status || defender.status === "none")
      );
    }
    return ["statChange", "heal", "healAndSleep", "allStatsUp"].includes(
      effect.type,
    );
  }

  function scoreMove(attacker, defender, move) {
    if (move.currentPp <= 0) return -Infinity;
    let score = 100;
    const effectiveness = isDamagingMove(move)
      ? getCombinedTypeEffectiveness(move.type, defender.types)
      : 1;

    if (isDamagingMove(move)) {
      if (effectiveness === 0) return -Infinity;
      if (effectiveness > 1) score += 80;
      if (effectiveness < 1) score -= 40;
      if ((attacker.types || []).includes(move.type)) score += 30;
      score += (move.power || 0) / 2;
      if (estimateMoveDamage(attacker, defender, move) >= defender.currentHp) {
        score += 100;
      }
      if (
        move.priority &&
        defender.currentHp / Math.max(1, defender.maxHp) <= 0.25
      ) {
        score += 40;
      }
    } else {
      if (!isUsefulStatusMove(move, defender)) return -Infinity;
      score += move.effect?.type === "status" ? 35 : 20;
    }

    const randomFactor = 0.9 + Math.random() * 0.2;
    return score * randomFactor;
  }

  function chooseAiMove(attacker, defender, difficulty = aiDifficulty.MEDIUM) {
    const moves = getAvailableMoves(attacker);
    if (moves.length === 0) return null;

    if (difficulty === aiDifficulty.EASY && Math.random() < 0.75) {
      return moves[Math.floor(Math.random() * moves.length)];
    }
    if (difficulty === aiDifficulty.MEDIUM && Math.random() < 0.3) {
      return moves[Math.floor(Math.random() * moves.length)];
    }

    const scoredMoves = moves
      .map((move) => ({ move, score: scoreMove(attacker, defender, move) }))
      .filter((entry) => entry.score > -Infinity)
      .sort((a, b) => b.score - a.score);

    return (
      scoredMoves[0]?.move || moves[Math.floor(Math.random() * moves.length)]
    );
  }

  function chooseBestMove(attacker, defender) {
    return chooseAiMove(attacker, defender, aiDifficulty.MEDIUM);
  }

  function chooseGymMove(attacker, defender) {
    return chooseAiMove(attacker, defender, aiDifficulty.HARD);
  }

  function isWeakToOpponent(currentPokemon, opponent) {
    const opponentMoves = getAvailableMoves(opponent).filter(isDamagingMove);
    return opponentMoves.some(
      (move) => getCombinedTypeEffectiveness(move.type, currentPokemon.types) > 1,
    );
  }

  function hasAdvantageAgainst(candidate, opponent) {
    return getAvailableMoves(candidate)
      .filter(isDamagingMove)
      .some(
        (move) => getCombinedTypeEffectiveness(move.type, opponent.types) > 1,
      );
  }

  function chooseAiSwitch(team, currentIndex, opponent) {
    const currentPokemon = team[currentIndex];
    if (!currentPokemon || !isWeakToOpponent(currentPokemon, opponent))
      return null;
    return team.findIndex(
      (pokemon, index) =>
        index !== currentIndex &&
        pokemon.currentHp > 0 &&
        hasAdvantageAgainst(pokemon, opponent),
    );
  }

  function chooseGymAction(session, opponent) {
    const current = session.gymTeam[session.gymIndex];
    if (!current) return { type: "none" };

    const lowHp = current.currentHp / Math.max(1, current.maxHp) < 0.3;
    if (lowHp && (session.aiItems?.potion || 0) > 0) {
      return { type: "item", itemId: "potion" };
    }
    if (lowHp) {
      const defensiveMove = getAvailableMoves(current).find(
        (move) =>
          move.category === "Status" &&
          (move.effect?.target === "self" ||
            move.effect?.type === "heal" ||
            move.effect?.type === "healAndSleep" ||
            (move.effect?.type === "statChange" &&
              move.effect?.target === "self")),
      );
      if (defensiveMove) return { type: "move", move: defensiveMove };
    }

    const switchIndex = chooseAiSwitch(
      session.gymTeam,
      session.gymIndex,
      opponent,
    );
    if (switchIndex >= 0) return { type: "switch", index: switchIndex };

    return { type: "move", move: chooseGymMove(current, opponent) };
  }

  function chooseTrainerAction(
    team,
    currentIndex,
    aiItems,
    opponent,
    trainerName,
    difficulty = aiDifficulty.HARD,
  ) {
    const current = team[currentIndex];
    if (!current) return { type: "none" };

    const lowHp = current.currentHp / Math.max(1, current.maxHp) < 0.3;
    if (lowHp && (aiItems?.potion || 0) > 0) {
      return { type: "item", itemId: "potion", trainerName };
    }
    if (lowHp) {
      const defensiveMove = getAvailableMoves(current).find(
        (move) =>
          move.category === "Status" &&
          (move.effect?.target === "self" ||
            move.effect?.type === "heal" ||
            move.effect?.type === "healAndSleep" ||
            (move.effect?.type === "statChange" &&
              move.effect?.target === "self")),
      );
      if (defensiveMove) return { type: "move", move: defensiveMove };
    }

    const switchIndex = chooseAiSwitch(team, currentIndex, opponent);
    if (switchIndex >= 0) return { type: "switch", index: switchIndex };

    return { type: "move", move: chooseAiMove(current, opponent, difficulty) };
  }

  return {
    typeChart,
    aiDifficulty,
    getTypeEffectiveness,
    getCombinedTypeEffectiveness,
    calculateDamage,
    getMoveByName,
    checkAccuracy,
    changeStat,
    applyMoveEffect,
    calculateMoveDamage,
    executeBattleMove,
    getAvailableMoves,
    isDamagingMove,
    estimateMoveDamage,
    isUsefulStatusMove,
    scoreMove,
    chooseAiMove,
    chooseBestMove,
    chooseGymMove,
    chooseAiSwitch,
    chooseGymAction,
    chooseTrainerAction,
  };
}

module.exports = {
  createBattleEngine,
  typeChart,
  aiDifficulty,
};
