const {
  applyEntryAbility,
  canApplyStatus,
  getDamageModifier,
  getStatusPreventionMessage,
  resolveTypeImmunity,
} = require("./abilityEngine");

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

function createBattleEngine({ getRandomInt, random = Math.random }) {
  const stageStats = [
    "attack",
    "defense",
    "specialAttack",
    "specialDefense",
    "speed",
    "accuracy",
    "evasion",
  ];

  function ensureBattleState(pokemon) {
    pokemon.battleState = pokemon.battleState || {};
    pokemon.battleState.stages = pokemon.battleState.stages || {};
    pokemon.battleState.volatile = pokemon.battleState.volatile || {};
    if (pokemon.status === "confused") {
      pokemon.status = "none";
      pokemon.battleState.volatile.confusionTurns ||= getRandomInt(2, 5);
    } else if (pokemon.status === "flinched") {
      pokemon.status = "none";
      pokemon.battleState.volatile.flinched = true;
    } else if (
      pokemon.status === "asleep" &&
      !pokemon.battleState.volatile.sleepTurns
    ) {
      pokemon.battleState.volatile.sleepTurns = getRandomInt(1, 3);
    }
    stageStats.forEach((stat) => {
      pokemon.battleState.stages[stat] = Math.max(
        -6,
        Math.min(6, Number(pokemon.battleState.stages[stat] || 0)),
      );
    });
    return pokemon.battleState;
  }

  function getStageMultiplier(stage, accuracy = false) {
    const value = Math.max(-6, Math.min(6, Number(stage || 0)));
    if (accuracy) {
      return value >= 0 ? (3 + value) / 3 : 3 / (3 - value);
    }
    return value >= 0 ? (2 + value) / 2 : 2 / (2 - value);
  }

  function getEffectiveStat(pokemon, stat) {
    const fallbackStat =
      stat === "specialAttack"
        ? pokemon?.attack
        : stat === "specialDefense"
          ? pokemon?.defense
          : 1;
    const base = Number(pokemon?.[stat] || fallbackStat || 1);
    const stage = ensureBattleState(pokemon).stages[stat] || 0;
    let value = base * getStageMultiplier(stage);
    if (stat === "speed" && pokemon.status === "paralyzed") value *= 0.5;
    return Math.max(1, value);
  }

  function resetBattleState(pokemon) {
    if (pokemon) delete pokemon.battleState;
    return pokemon;
  }

  function resetSwitchState(pokemon) {
    if (!pokemon) return pokemon;
    const state = ensureBattleState(pokemon);
    const sleepTurns =
      pokemon.status === "asleep" ? state.volatile.sleepTurns : null;
    state.stages = Object.fromEntries(stageStats.map((stat) => [stat, 0]));
    state.volatile = sleepTurns ? { sleepTurns } : {};
    state.protected = false;
    return pokemon;
  }

  function executeUtilityTurn({
    actionType,
    playerPokemon,
    opponentPokemon,
    opponentMove,
    opponentLabel = "Opponent",
    battle,
    log = [],
    playerActionMetadata = {},
  }) {
    const metadata = {
      order: ["player"],
      turns: [{ side: "player", action: actionType, ...playerActionMetadata }],
    };
    if (
      !opponentMove ||
      playerPokemon.currentHp <= 0 ||
      opponentPokemon.currentHp <= 0
    ) {
      return { metadata };
    }

    metadata.order.push("opponent");
    log.push(`${opponentLabel}'s turn:`);
    const result = executeBattleMove(
      opponentPokemon,
      playerPokemon,
      opponentMove.name,
      "",
      { battle },
    );
    log.push(...result.log);
    metadata.turns.push({
      side: "opponent",
      move: opponentMove.name,
      ...result.metadata,
    });
    return { metadata };
  }

  function resolveForcedSwitch(team = []) {
    const nextIndex = team.findIndex((pokemon) => pokemon?.currentHp > 0);
    if (nextIndex >= 0) resetSwitchState(team[nextIndex]);
    return nextIndex;
  }

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
    attacker,
    defender,
    movePower,
    category,
    moveType,
    weather = "clear",
  ) {
    let atkStat, defStatUsed;
    if (category === "Physical") {
      atkStat = getEffectiveStat(attacker, "attack");
      defStatUsed = getEffectiveStat(defender, "defense");
      if (weather === "snow" && (defender.types || []).includes("Ice")) {
        defStatUsed *= 1.5;
      }
    } else if (category === "Special") {
      atkStat = getEffectiveStat(attacker, "specialAttack");
      defStatUsed = getEffectiveStat(defender, "specialDefense");
    } else {
      return { damage: 0, effectiveness: 1, critical: false, burnReduced: false };
    }

    const stab = (attacker.types || []).includes(moveType) ? 1.5 : 1;
    const effectiveness = getCombinedTypeEffectiveness(moveType, defender.types);
    const randomFactor = getRandomInt(85, 100) / 100;
    const critical = random() < 0.0625 ? 1.5 : 1;
    const burnReduction = attacker.status === "burned" && category === "Physical" ? 0.5 : 1;
    const weatherModifier =
      (weather === "rain" && moveType === "Water") ||
      (["sun", "sunny"].includes(weather) && moveType === "Fire")
        ? 1.5
        : (weather === "rain" && moveType === "Fire") ||
            (["sun", "sunny"].includes(weather) && moveType === "Water")
          ? 0.5
          : 1;

    const base = (((2 * (attacker.level || 1)) / 5 + 2) * atkStat * movePower) / defStatUsed;
    const damage = Math.floor(
      (base / 50 + 2) *
        stab *
        effectiveness *
        randomFactor *
        critical *
        burnReduction *
        weatherModifier,
    );
    return {
      damage: effectiveness === 0 ? 0 : Math.max(1, damage),
      effectiveness,
      critical: critical > 1,
      burnReduced: burnReduction < 1,
      weatherModifier,
    };
  }

  function getMoveByName(pokemon, moveName) {
    return (pokemon.moves || []).find((move) => move.name === moveName);
  }

  function checkAccuracy(move, attacker = null, defender = null) {
    const accuracyStage = attacker
      ? ensureBattleState(attacker).stages.accuracy
      : 0;
    const evasionStage = defender
      ? ensureBattleState(defender).stages.evasion
      : 0;
    const chance = Math.max(
      1,
      Math.min(
        100,
        ((move.accuracy ?? 100) * getStageMultiplier(accuracyStage, true)) /
          getStageMultiplier(evasionStage, true),
      ),
    );
    return random() * 100 < chance;
  }

  function changeStat(target, stat, stages) {
    if (!stageStats.includes(stat) || !Number.isFinite(stages)) return false;
    const state = ensureBattleState(target);
    const previous = state.stages[stat] || 0;
    const next = Math.max(-6, Math.min(6, previous + stages));
    state.stages[stat] = next;
    return { changed: next !== previous, previous, next, applied: next - previous };
  }

  function getUnsupportedEffectMessage(effect) {
    const labels = {
      trap: "Trap effect",
      flinch: "Flinch effect",
      flinched: "Flinch effect",
      curse: "Curse effect",
      taunted: "Taunt effect",
      priority: "Priority effect",
    };
    const label = labels[effect?.type] || `${effect?.type || "Move"} effect`;
    return `${label} is not implemented yet.`;
  }

  function applyStatusDamage(pokemon, divisor, message, log) {
    const maxHp = Math.max(1, pokemon.maxHp || pokemon.hp || 1);
    const damage = Math.min(
      pokemon.currentHp,
      Math.max(1, Math.floor(maxHp / divisor)),
    );
    pokemon.currentHp = Math.max(0, pokemon.currentHp - damage);
    log.push(`${pokemon.name} ${message} It lost ${damage} HP.`);
  }

  function applyEndOfTurnStatus(pokemon, log = [], weather = "clear") {
    if (!pokemon || pokemon.currentHp <= 0) return log;

    const status = pokemon.status || "none";
    if (status === "burned") {
      applyStatusDamage(pokemon, 16, "is hurt by its burn.", log);
    } else if (status === "poisoned") {
      applyStatusDamage(pokemon, 8, "is hurt by poison.", log);
    } else if (status === "badpoison") {
      const state = ensureBattleState(pokemon);
      state.volatile.badPoisonTurns = (state.volatile.badPoisonTurns || 0) + 1;
      const maxHp = Math.max(1, pokemon.maxHp || pokemon.hp || 1);
      const damage = Math.min(pokemon.currentHp, Math.max(1, Math.floor(maxHp * state.volatile.badPoisonTurns / 16)));
      pokemon.currentHp = Math.max(0, pokemon.currentHp - damage);
      log.push(`${pokemon.name} is badly hurt by poison. It lost ${damage} HP.`);
    }
    if (
      pokemon.currentHp > 0 &&
      weather === "sandstorm" &&
      !(pokemon.types || []).some((type) => ["Rock", "Ground", "Steel"].includes(type))
    ) {
      applyStatusDamage(pokemon, 16, "is buffeted by the sandstorm.", log);
    }
    ensureBattleState(pokemon).protected = false;
    const volatile = ensureBattleState(pokemon).volatile;
    delete volatile.flinched;
    if (volatile.switchCooldown > 0) volatile.switchCooldown -= 1;

    return log;
  }

  function applyMoveEffect(move, attacker, defender, context = {}) {
    const effect = move.effect;
    const log = [];
    if (!effect || random() * 100 >= (effect.chance ?? 100)) {
      return log;
    }

    const target = effect.target === "self" ? attacker : defender;
    const targetName = target === attacker ? attacker.name : defender.name;
    const recordEffect = (details) => {
      if (Array.isArray(context.metadata?.effects)) {
        context.metadata.effects.push(details);
      }
    };

    if (effect.type === "status") {
      if (["confused", "flinched"].includes(effect.status)) {
        const volatile = ensureBattleState(target).volatile;
        if (effect.status === "confused" && !volatile.confusionTurns) {
          volatile.confusionTurns = getRandomInt(2, 5);
          log.push(`${targetName} became confused!`);
          recordEffect({ type: "volatileStatus", status: "confused", target: effect.target || "opponent" });
        } else if (effect.status === "flinched") {
          volatile.flinched = true;
          log.push(`${targetName} flinched!`);
          recordEffect({ type: "volatileStatus", status: "flinched", target: effect.target || "opponent" });
        }
      } else if (
        ["asleep", "burned", "frozen", "paralyzed", "poisoned", "badpoison"].includes(
          effect.status,
        ) &&
        (!target.status || target.status === "none")
      ) {
        if (canApplyStatus(target, effect.status)) {
          target.status = effect.status;
          if (effect.status === "asleep") {
            ensureBattleState(target).volatile.sleepTurns = getRandomInt(1, 3);
          }
          log.push(`${targetName} was ${formatStatusForLog(effect.status)}!`);
          recordEffect({ type: "status", status: effect.status, target: effect.target || "opponent" });
        } else {
          log.push(getStatusPreventionMessage(target));
        }
      } else if (!["asleep", "burned", "frozen", "paralyzed", "poisoned", "badpoison"].includes(effect.status)) {
        log.push(getUnsupportedEffectMessage({ type: effect.status }));
      }
    } else if (effect.type === "statChange") {
      if (effect.stat === "recoil") {
        const recoil =
          context.damage > 0
            ? Math.min(
                attacker.currentHp,
                Math.max(1, Math.floor(context.damage / 3)),
              )
            : 0;
        attacker.currentHp = Math.max(0, attacker.currentHp - recoil);
        if (recoil > 0) {
          log.push(`${attacker.name} was hurt by recoil and lost ${recoil} HP!`);
          recordEffect({ type: "recoil", amount: recoil, target: "self" });
        }
      } else {
        const result = changeStat(target, effect.stat, effect.stages);
        if (!result) {
          log.push(getUnsupportedEffectMessage({ type: `${effect.stat} stat` }));
          return log;
        }
        const direction = effect.stages > 0 ? "rose" : "fell";
        if (result?.changed) {
          log.push(`${targetName}'s ${formatStatForLog(effect.stat)} ${direction}!`);
          recordEffect({
            type: "statChange",
            stat: effect.stat,
            stages: result.applied,
            target: effect.target || "opponent",
          });
        }
        else if (result) log.push(`${targetName}'s ${formatStatForLog(effect.stat)} cannot change further!`);
      }
    } else if (effect.type === "heal" || effect.type === "healAndSleep") {
      const maxHp = attacker.maxHp || attacker.hp || 1;
      const healed = Math.min(
        maxHp - attacker.currentHp,
        Math.max(1, Math.floor(maxHp * ((effect.percent || 50) / 100))),
      );
      attacker.currentHp += healed;
      log.push(`${attacker.name} recovered ${healed} HP.`);
      recordEffect({ type: "heal", amount: healed, target: "self" });
      if (effect.type === "healAndSleep") {
        attacker.status = effect.status || "asleep";
        ensureBattleState(attacker).volatile.sleepTurns = getRandomInt(1, 3);
        log.push(`${attacker.name} fell asleep!`);
        recordEffect({ type: "status", status: attacker.status, target: "self" });
      }
    } else if (effect.type === "allStatsUp") {
      ["attack", "defense", "specialAttack", "specialDefense", "speed"].forEach(
        (stat) => changeStat(attacker, stat, effect.stages || 1),
      );
      log.push(`${attacker.name}'s stats rose!`);
      recordEffect({ type: "allStatsUp", stages: effect.stages || 1, target: "self" });
    } else if (effect.type === "randomMove") {
      log.push("A mysterious power sparked, but nothing happened.");
    } else if (effect.type === "criticalBoost") {
      return log;
    } else if (effect.type === "weather") {
      if (context.battle) context.battle.weather = effect.weather || "clear";
      log.push(`The weather changed to ${effect.weather || "clear"}!`);
      recordEffect({ type: "weather", weather: effect.weather || "clear" });
    } else if (effect.type === "recoil") {
      const recoil =
        context.damage > 0
          ? Math.min(
              attacker.currentHp,
              Math.max(
                1,
                Math.floor(context.damage * ((effect.percent || 25) / 100)),
              ),
            )
          : 0;
      attacker.currentHp = Math.max(0, attacker.currentHp - recoil);
      if (recoil > 0) {
        log.push(`${attacker.name} was hurt by recoil and lost ${recoil} HP!`);
        recordEffect({ type: "recoil", amount: recoil, target: "self" });
      }
    } else if (effect.type === "drain") {
      const maxHp = attacker.maxHp || attacker.hp || 1;
      const healed =
        context.damage > 0
          ? Math.min(
              maxHp - attacker.currentHp,
              Math.max(
                1,
                Math.floor(context.damage * ((effect.percent || 50) / 100)),
              ),
            )
          : 0;
      attacker.currentHp += healed;
      if (healed > 0) {
        log.push(`${attacker.name} drained ${healed} HP!`);
        recordEffect({ type: "drain", amount: healed, target: "self" });
      }
    } else {
      log.push(getUnsupportedEffectMessage(effect));
    }

    return log;
  }

  function calculateMoveDamage(attacker, defender, move, weather = "clear") {
    const baseResult = calculateDamage(
      attacker,
      defender,
      move.power || 0,
      move.category,
      move.type,
      weather,
    );
    const boostedCritical =
      move.effect?.type === "criticalBoost" &&
      random() * 100 < (move.effect.chance ?? 0);
    const hits = Math.max(1, move.hits || 1);
    const criticalMultiplier = boostedCritical && !baseResult.critical ? 1.5 : 1;
    const abilityModifier = getDamageModifier(
      attacker,
      defender,
      move,
      baseResult.effectiveness,
    );
    return {
      ...baseResult,
      damage:
        baseResult.effectiveness === 0
          ? 0
          : Math.max(
              1,
              Math.floor(
                baseResult.damage * criticalMultiplier * abilityModifier,
              ),
            ) *
            hits,
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

  function executeBattleMove(
    attacker,
    defender,
    moveName,
    defenderPrefix = "",
    context = {},
  ) {
    const log = [];
    const metadata = { moveName, effects: [] };
    const move = getMoveByName(attacker, moveName);
    if (!move) return { error: "Move not found", log, metadata };
    Object.assign(metadata, {
      moveType: move.type || "Normal",
      category: move.category || "Physical",
      priority: Number(move.priority || 0),
    });
    if (move.currentPp <= 0) {
      log.push("No PP left for this move!");
      return { error: "No PP left for this move", log, metadata };
    }

    const attackerState = ensureBattleState(attacker);
    if (attackerState.volatile.flinched) {
      delete attackerState.volatile.flinched;
      log.push(`${attacker.name} flinched and could not move!`);
      return { move, log, metadata, skipped: "flinch" };
    }
    if (attacker.status === "paralyzed" && random() < 0.25) {
      log.push(`${attacker.name} is paralyzed and cannot move!`);
      return { move, log, metadata, skipped: "paralysis" };
    }
    if (attacker.status === "asleep") {
      attackerState.volatile.sleepTurns = Math.max(0, (attackerState.volatile.sleepTurns || 1) - 1);
      if (attackerState.volatile.sleepTurns > 0) {
        log.push(`${attacker.name} is asleep and cannot move!`);
        return { move, log, metadata, skipped: "sleep" };
      }
      attacker.status = "none";
      log.push(`${attacker.name} woke up!`);
    }
    if (attacker.status === "frozen") {
      if (random() >= 0.2) {
        log.push(`${attacker.name} is frozen and cannot move!`);
        return { move, log, metadata, skipped: "freeze" };
      }
      attacker.status = "none";
      log.push(`${attacker.name} thawed out!`);
    }
    if (attackerState.volatile.confusionTurns > 0) {
      attackerState.volatile.confusionTurns -= 1;
      const confusionEnded = attackerState.volatile.confusionTurns === 0;
      if (random() < 1 / 3) {
        applyStatusDamage(attacker, 8, "hurt itself in confusion.", log);
        if (confusionEnded) log.push(`${attacker.name} snapped out of confusion!`);
        return { move, log, metadata, skipped: "confusion" };
      }
      if (confusionEnded) {
        log.push(`${attacker.name} snapped out of confusion!`);
      }
    }

    move.currentPp -= 1;
    log.push(`${attacker.name} used ${move.name}!`);

    if (!checkAccuracy(move, attacker, defender)) {
      log.push("The attack missed!");
      return { move, log, metadata, missed: true };
    }

    if (move.name === "Protect") {
      attackerState.protected = true;
      log.push(`${attacker.name} protected itself!`);
      metadata.effects.push({ type: "protect", target: "self" });
      return { move, log, metadata };
    }

    if (ensureBattleState(defender).protected) {
      log.push(`${defender.name} protected itself!`);
      return { move, log, metadata, protected: true };
    }

    let damage = 0;
    if (move.category !== "Status" && (move.power || 0) > 0) {
      const immunity = resolveTypeImmunity(defender, move);
      if (immunity.immune) {
        log.push(immunity.message);
        return { move, log, metadata, abilityImmune: true };
      }
      const damageResult = calculateMoveDamage(
        attacker,
        defender,
        move,
        context.weather || context.battle?.weather || "clear",
      );
      damage = damageResult.damage;
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
      Object.assign(metadata, {
        damage: damageResult.damage,
        critical: damageResult.critical,
        effectiveness: damageResult.effectiveness,
        hits: damageResult.hits,
      });
    }

    log.push(
      ...applyMoveEffect(move, attacker, defender, {
        ...context,
        damage,
        metadata,
      }),
    );
    metadata.weather = context.battle?.weather || context.weather || "clear";
    return { move, log, metadata };
  }

  function getAvailableMoves(pokemon) {
    return (pokemon.moves || []).filter((move) => move.currentPp > 0);
  }

  function resolveTurnOrder(actions = []) {
    return actions
      .map((action, index) => ({ ...action, _index: index }))
      .sort((left, right) => {
        const leftClass = ["switch", "item"].includes(left.type) ? 2 : 1;
        const rightClass = ["switch", "item"].includes(right.type) ? 2 : 1;
        if (leftClass !== rightClass) return rightClass - leftClass;
        const priorityDifference = Number(right.move?.priority || 0) - Number(left.move?.priority || 0);
        if (priorityDifference) return priorityDifference;
        const speedDifference = getEffectiveStat(right.pokemon, "speed") - getEffectiveStat(left.pokemon, "speed");
        if (speedDifference) return speedDifference;
        return random() < 0.5 ? left._index - right._index : right._index - left._index;
      })
      .map(({ _index, ...action }) => action);
  }

  function isDamagingMove(move) {
    return move.category !== "Status" && (move.power || 0) > 0;
  }

  function estimateMoveDamage(attacker, defender, move, weather = "clear") {
    if (!isDamagingMove(move)) return 0;
    const attackStat =
      move.category === "Special"
        ? getEffectiveStat(attacker, "specialAttack")
        : getEffectiveStat(attacker, "attack");
    let defenseStat =
      move.category === "Special"
        ? getEffectiveStat(defender, "specialDefense")
        : getEffectiveStat(defender, "defense");
    if (
      weather === "snow" &&
      move.category === "Physical" &&
      (defender.types || []).includes("Ice")
    ) {
      defenseStat *= 1.5;
    }
    const stab = (attacker.types || []).includes(move.type) ? 1.5 : 1;
    const effectiveness = getCombinedTypeEffectiveness(move.type, defender.types);
    const base =
      (((2 * (attacker.level || 1)) / 5 + 2) * attackStat * (move.power || 0)) /
        defenseStat /
        50 +
      2;
    const weatherModifier =
      (weather === "rain" && move.type === "Water") ||
      (["sun", "sunny"].includes(weather) && move.type === "Fire")
        ? 1.5
        : (weather === "rain" && move.type === "Fire") ||
            (["sun", "sunny"].includes(weather) && move.type === "Water")
          ? 0.5
          : 1;
    const burnModifier =
      attacker.status === "burned" && move.category === "Physical" ? 0.5 : 1;
    const abilityModifier = getDamageModifier(
      attacker,
      defender,
      move,
      effectiveness,
    );
    return Math.max(
      0,
      Math.floor(
        base *
          stab *
          effectiveness *
          weatherModifier *
          burnModifier *
          abilityModifier *
          Math.max(1, move.hits || 1),
      ),
    );
  }

  function isUsefulStatusMove(move, attacker, defender, weather = "clear") {
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
        "badpoison",
        "flinched",
      ];
      return (
        usefulStatuses.includes(effect.status) &&
        canApplyStatus(defender, effect.status) &&
        (effect.status === "confused"
          ? !ensureBattleState(defender).volatile.confusionTurns
          : effect.status === "flinched"
            ? getEffectiveStat(attacker, "speed") >
              getEffectiveStat(defender, "speed")
            : !defender.status || defender.status === "none")
      );
    }
    if (effect.type === "weather") {
      return (effect.weather || "clear") !== weather;
    }
    if (effect.type === "statChange" && !stageStats.includes(effect.stat)) {
      return effect.stat === "recoil" && isDamagingMove(move);
    }
    return ["statChange", "heal", "healAndSleep", "allStatsUp"].includes(
      effect.type,
    );
  }

  function scoreMove(attacker, defender, move, weather = "clear") {
    if (move.currentPp <= 0) return -Infinity;
    let score = 100;
    const effectiveness = isDamagingMove(move)
      ? getCombinedTypeEffectiveness(move.type, defender.types)
      : 1;

    if (isDamagingMove(move)) {
      if (effectiveness === 0 || resolveTypeImmunity(defender, move).immune) {
        return -Infinity;
      }
      if (effectiveness > 1) score += 80;
      if (effectiveness < 1) score -= 40;
      if ((attacker.types || []).includes(move.type)) score += 30;
      score += (move.power || 0) / 2;
      if (
        estimateMoveDamage(attacker, defender, move, weather) >=
        defender.currentHp
      ) {
        score += 100;
      }
      if (
        move.priority &&
        defender.currentHp / Math.max(1, defender.maxHp) <= 0.25
      ) {
        score += 40;
      }
    } else {
      if (!isUsefulStatusMove(move, attacker, defender, weather)) {
        return -Infinity;
      }
      score += move.effect?.type === "status" ? 35 : 20;
      if (move.effect?.type === "statChange") {
        const target = move.effect.target === "self" ? attacker : defender;
        const stage = ensureBattleState(target).stages[move.effect.stat] || 0;
        if (
          (move.effect.stages > 0 && stage >= 6) ||
          (move.effect.stages < 0 && stage <= -6)
        ) {
          return -Infinity;
        }
      }
      if (["heal", "healAndSleep"].includes(move.effect?.type)) {
        const hpRatio = attacker.currentHp / Math.max(1, attacker.maxHp);
        if (hpRatio > 0.75) return -Infinity;
        score += (1 - hpRatio) * 100;
      }
    }

    const randomFactor = 0.9 + random() * 0.2;
    return score * randomFactor;
  }

  function chooseAiMove(
    attacker,
    defender,
    difficulty = aiDifficulty.MEDIUM,
    weather = "clear",
  ) {
    const moves = getAvailableMoves(attacker);
    if (moves.length === 0) return null;

    if (difficulty === aiDifficulty.EASY && random() < 0.75) {
      return moves[Math.floor(random() * moves.length)];
    }
    if (difficulty === aiDifficulty.MEDIUM && random() < 0.3) {
      return moves[Math.floor(random() * moves.length)];
    }

    const scoredMoves = moves
      .map((move) => ({
        move,
        score: scoreMove(attacker, defender, move, weather),
      }))
      .filter((entry) => entry.score > -Infinity)
      .sort((a, b) => b.score - a.score);

    return (
      scoredMoves[0]?.move || moves[Math.floor(random() * moves.length)]
    );
  }

  function chooseBestMove(attacker, defender, weather = "clear") {
    return chooseAiMove(attacker, defender, aiDifficulty.MEDIUM, weather);
  }

  function chooseGymMove(attacker, defender, weather = "clear") {
    return chooseAiMove(attacker, defender, aiDifficulty.HARD, weather);
  }

  function isWeakToOpponent(currentPokemon, opponent) {
    return (opponent.types || []).some(
      (type) =>
        !resolveTypeImmunity(currentPokemon, { type }).immune &&
        getCombinedTypeEffectiveness(type, currentPokemon.types) > 1,
    );
  }

  function hasAdvantageAgainst(candidate, opponent) {
    return getAvailableMoves(candidate)
      .filter(isDamagingMove)
      .some(
        (move) =>
          !resolveTypeImmunity(opponent, move).immune &&
          getCombinedTypeEffectiveness(move.type, opponent.types) > 1,
      );
  }

  function chooseAiSwitch(team, currentIndex, opponent) {
    const currentPokemon = team[currentIndex];
    if (
      !currentPokemon ||
      ensureBattleState(currentPokemon).volatile.switchCooldown > 0 ||
      !isWeakToOpponent(currentPokemon, opponent)
    ) {
      return null;
    }
    const candidates = team
      .map((pokemon, index) => ({ pokemon, index }))
      .filter(
        ({ pokemon, index }) =>
          index !== currentIndex &&
          pokemon.currentHp > 0 &&
          hasAdvantageAgainst(pokemon, opponent),
      )
      .map(({ pokemon, index }) => ({
        index,
        score:
          getAvailableMoves(pokemon)
            .filter(isDamagingMove)
            .reduce(
              (best, move) =>
                Math.max(best, getCombinedTypeEffectiveness(move.type, opponent.types)),
              0,
            ) * 100 +
          (pokemon.currentHp / Math.max(1, pokemon.maxHp)) * 25 -
          (isWeakToOpponent(pokemon, opponent) ? 50 : 0),
      }))
      .sort((left, right) => right.score - left.score);
    return candidates[0]?.index ?? null;
  }

  function chooseDefensiveMove(current, opponent, weather = "clear") {
    return getAvailableMoves(current)
      .filter(
        (move) =>
          move.category === "Status" &&
          (move.effect?.target === "self" ||
            move.effect?.type === "heal" ||
            move.effect?.type === "healAndSleep"),
      )
      .map((move) => ({ move, score: scoreMove(current, opponent, move, weather) }))
      .filter(({ score }) => score > -Infinity)
      .sort((left, right) => right.score - left.score)[0]?.move;
  }

  function chooseGymAction(session, opponent) {
    const current = session.gymTeam[session.gymIndex];
    if (!current) return { type: "none" };

    const lowHp = current.currentHp / Math.max(1, current.maxHp) < 0.3;
    if (lowHp) {
      const defensiveMove = chooseDefensiveMove(
        current,
        opponent,
        session.weather || "clear",
      );
      if (defensiveMove) return { type: "move", move: defensiveMove };
    }

    const switchIndex = chooseAiSwitch(
      session.gymTeam,
      session.gymIndex,
      opponent,
    );
    if (Number.isInteger(switchIndex) && switchIndex >= 0) {
      return { type: "switch", index: switchIndex };
    }

    return {
      type: "move",
      move: chooseGymMove(current, opponent, session.weather || "clear"),
    };
  }

  function chooseTrainerAction(
    team,
    currentIndex,
    aiItems,
    opponent,
    trainerName,
    difficulty = aiDifficulty.HARD,
    weather = "clear",
  ) {
    const current = team[currentIndex];
    if (!current) return { type: "none" };

    const lowHp = current.currentHp / Math.max(1, current.maxHp) < 0.3;
    if (
      difficulty === aiDifficulty.HARD &&
      lowHp &&
      (aiItems?.potion || 0) > 0
    ) {
      return { type: "item", itemId: "potion", trainerName };
    }
    if (lowHp) {
      const defensiveMove = chooseDefensiveMove(current, opponent, weather);
      if (defensiveMove) return { type: "move", move: defensiveMove };
    }

    if (difficulty === aiDifficulty.HARD) {
      const switchIndex = chooseAiSwitch(team, currentIndex, opponent);
      if (Number.isInteger(switchIndex) && switchIndex >= 0) {
        return { type: "switch", index: switchIndex };
      }
    }

    return {
      type: "move",
      move: chooseAiMove(current, opponent, difficulty, weather),
    };
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
    applyEndOfTurnStatus,
    ensureBattleState,
    getStageMultiplier,
    getEffectiveStat,
    resetBattleState,
    resetSwitchState,
    executeUtilityTurn,
    resolveForcedSwitch,
    resolveTurnOrder,
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
    applyEntryAbility,
  };
}

module.exports = {
  createBattleEngine,
  typeChart,
  aiDifficulty,
};
