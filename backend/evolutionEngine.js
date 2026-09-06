const supportedEvolutionMethods = new Set([
  "level",
  "item",
  "friendship",
  "level-time",
  "level-move",
  "trade",
  "trade-item",
]);

const LEVEL_UP_METHODS = new Set([
  "level",
  "friendship",
  "level-time",
  "level-move",
]);

function createEvolutionEngine({
  evolutionData = {},
  getPokemonSpeciesId,
  getPokemonTemplateBySpeciesId,
  getPokemonFormDefinition,
}) {
  const outgoingEdgesBySpeciesId = new Map();
  (evolutionData.chains || []).forEach((chain) => {
    (chain.edges || []).forEach((edge) => {
      const edges = outgoingEdgesBySpeciesId.get(edge.fromSpeciesId) || [];
      edges.push({ ...edge, chainId: chain.chainId });
      outgoingEdgesBySpeciesId.set(edge.fromSpeciesId, edges);
    });
  });

  function formatValue(value) {
    return String(value || "")
      .split("-")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function toSlug(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function getExpectedItem(condition) {
    if (condition.method === "item") return condition.item || null;
    if (condition.method === "trade") return "linking-cord";
    if (condition.method === "trade-item") return condition.heldItem || null;
    return null;
  }

  function getFriendshipThreshold(condition) {
    if (Number(condition.minHappiness) > 0) {
      return Number(condition.minHappiness);
    }
    if (Number(condition.minAffection) > 0) {
      return Math.min(255, Number(condition.minAffection) * 80);
    }
    return null;
  }

  function getUnsupportedRequirements(condition) {
    const requirements = [];
    if (condition.minBeauty) requirements.push("Beauty");
    if (condition.location) {
      requirements.push(`Location: ${formatValue(condition.location)}`);
    }
    if (condition.heldItem && condition.method !== "trade-item") {
      requirements.push(`Held item: ${formatValue(condition.heldItem)}`);
    }
    if (condition.tradeSpecies) {
      requirements.push(`Trade partner: ${formatValue(condition.tradeSpecies)}`);
    }
    if (condition.partySpecies) requirements.push("Party species requirement");
    if (condition.partyType) requirements.push("Party type requirement");
    if (condition.needsOverworldRain) requirements.push("Overworld rain");
    if (condition.turnUpsideDown) requirements.push("Special orientation");
    return requirements;
  }

  function canResolveFormPath(pokemon, edge, condition) {
    if (!condition.requiresFormResolution) return true;
    const sourceFormId = pokemon.form?.id;
    if (sourceFormId) {
      const sourceTemplate = getPokemonTemplateBySpeciesId(edge.fromSpeciesId);
      const targetTemplate = getPokemonTemplateBySpeciesId(edge.toSpeciesId);
      const sourceForm = getPokemonFormDefinition?.(sourceTemplate, sourceFormId);
      return Boolean(
        sourceForm?.evolvesToForm &&
          getPokemonFormDefinition?.(targetTemplate, sourceForm.evolvesToForm),
      );
    }

    const ambiguousEdges = (outgoingEdgesBySpeciesId.get(edge.fromSpeciesId) || [])
      .filter((candidate) =>
        (candidate.conditions || []).some(
          (candidateCondition) => candidateCondition.requiresFormResolution,
        ),
      );
    if (ambiguousEdges.length > 1) return false;

    const actionAlternatives = new Set(
      (edge.conditions || []).map((candidate) =>
        [
          getExpectedItem(candidate) || candidate.method,
          candidate.timeOfDay || "any-time",
        ].join(":"),
      ),
    );
    return actionAlternatives.size <= 1;
  }

  function getGenderLabel(gender) {
    if (Number(gender) === 1) return "female";
    if (Number(gender) === 2) return "male";
    return null;
  }

  function compareRelativeStats(pokemon, expected) {
    const attack = Number(pokemon.attack || 0);
    const defense = Number(pokemon.defense || 0);
    if (Number(expected) > 0) return attack > defense;
    if (Number(expected) < 0) return attack < defense;
    return attack === defense;
  }

  function buildRequirementChecks(pokemon, condition, context) {
    const checks = [];
    const expectedItem = getExpectedItem(condition);
    const friendshipThreshold = getFriendshipThreshold(condition);
    if (Number(condition.minLevel) > 0) {
      checks.push({
        label: `Reach level ${condition.minLevel}`,
        satisfied: Number(pokemon.level || 1) >= Number(condition.minLevel),
      });
    }
    if (friendshipThreshold) {
      checks.push({
        label: `Friendship ${pokemon.friendship || 0}/${friendshipThreshold}`,
        satisfied: Number(pokemon.friendship || 0) >= friendshipThreshold,
      });
    }
    if (condition.timeOfDay) {
      checks.push({
        label: `During ${formatValue(condition.timeOfDay)}`,
        satisfied: context.timeOfDay === condition.timeOfDay,
      });
    }
    if (condition.gender) {
      const requiredGender = getGenderLabel(condition.gender);
      checks.push({
        label: `Must be ${formatValue(requiredGender)}`,
        satisfied: pokemon.gender === requiredGender,
      });
    }
    if (condition.knownMove) {
      checks.push({
        label: `Know ${formatValue(condition.knownMove)}`,
        satisfied: (pokemon.moves || []).some(
          (move) => toSlug(move.name || move) === condition.knownMove,
        ),
      });
    }
    if (condition.knownMoveType) {
      checks.push({
        label: `Know a ${formatValue(condition.knownMoveType)} move`,
        satisfied: (pokemon.moves || []).some(
          (move) => toSlug(move.type) === condition.knownMoveType,
        ),
      });
    }
    if (condition.relativePhysicalStats != null) {
      const relation =
        Number(condition.relativePhysicalStats) > 0
          ? "Attack higher than Defense"
          : Number(condition.relativePhysicalStats) < 0
            ? "Defense higher than Attack"
            : "Attack equal to Defense";
      checks.push({
        label: relation,
        satisfied: compareRelativeStats(pokemon, condition.relativePhysicalStats),
      });
    }
    if (expectedItem) {
      checks.push({
        label: `Use ${formatValue(expectedItem)}`,
        satisfied:
          context.trigger === "use-item" && context.item === expectedItem,
      });
    }
    return checks;
  }

  function evaluateCondition(pokemon, edge, condition, context) {
    const unsupported = getUnsupportedRequirements(condition);
    if (!supportedEvolutionMethods.has(condition.method)) {
      unsupported.unshift(formatValue(condition.method) || "Special condition");
    }
    if (!canResolveFormPath(pokemon, edge, condition)) {
      unsupported.unshift("Unresolved regional form requirement");
    }
    const requirementChecks = buildRequirementChecks(pokemon, condition, context);
    const supported = unsupported.length === 0;
    const requirementsSatisfied =
      supported && requirementChecks.every((check) => check.satisfied);
    const expectedTrigger = LEVEL_UP_METHODS.has(condition.method)
      ? "level-up"
      : "use-item";
    return {
      available:
        requirementsSatisfied && context.trigger === expectedTrigger,
      supported,
      satisfied: requirementsSatisfied,
      requirementChecks,
      unsupported,
      expectedItem: getExpectedItem(condition),
    };
  }

  function getEvolutionOptions(pokemon, context = {}) {
    const speciesId = getPokemonSpeciesId(pokemon);
    return (outgoingEdgesBySpeciesId.get(speciesId) || []).map((edge) => {
      const target = getPokemonTemplateBySpeciesId(edge.toSpeciesId);
      const conditionResults = (edge.conditions || []).map((condition) =>
        evaluateCondition(pokemon, edge, condition, context),
      );
      return {
        chainId: edge.chainId,
        fromSpeciesId: edge.fromSpeciesId,
        targetSpeciesId: edge.toSpeciesId,
        targetName: target?.name || edge.to,
        target,
        available: conditionResults.some((result) => result.available),
        satisfied: conditionResults.some((result) => result.satisfied),
        supported: conditionResults.some((result) => result.supported),
        requirementOptions: conditionResults.map((result) => ({
          supported: result.supported,
          satisfied: result.satisfied,
          checks: result.requirementChecks,
          unsupported: result.unsupported,
          item: result.expectedItem,
        })),
        requirements: [
          ...new Set(
            conditionResults.flatMap((result) =>
              result.requirementChecks.map((check) => check.label),
            ),
          ),
        ],
        unsupportedRequirements: [
          ...new Set(conditionResults.flatMap((result) => result.unsupported)),
        ],
        conditions: edge.conditions || [],
      };
    });
  }

  function getAvailableEvolutions(pokemon, context = {}) {
    const hasRequestedTarget =
      context.targetSpeciesId !== null &&
      context.targetSpeciesId !== undefined &&
      context.targetSpeciesId !== "";
    const requestedTarget = Number(context.targetSpeciesId);
    return getEvolutionOptions(pokemon, context).filter(
      (option) =>
        option.available &&
        (!hasRequestedTarget ||
          (Number.isInteger(requestedTarget) &&
            option.targetSpeciesId === requestedTarget)),
    );
  }

  function canEvolve(pokemon, context = {}) {
    const options = getEvolutionOptions(pokemon, context);
    const available = options.filter((option) => option.available);
    return {
      canEvolve: available.length > 0,
      requiresChoice: available.length > 1,
      available,
      options,
    };
  }

  function getEvolutionSupportSummary() {
    const supported = {};
    const unsupported = {};
    const unsupportedConditions = {};
    outgoingEdgesBySpeciesId.forEach((edges) => {
      edges.forEach((edge) => {
        (edge.conditions || []).forEach((condition) => {
          const collection = supportedEvolutionMethods.has(condition.method)
            ? supported
            : unsupported;
          const method = condition.method || "unknown";
          collection[method] = (collection[method] || 0) + 1;
          getUnsupportedRequirements(condition).forEach((requirement) => {
            const key = requirement.split(":")[0];
            unsupportedConditions[key] =
              (unsupportedConditions[key] || 0) + 1;
          });
          if (condition.requiresFormResolution) {
            unsupportedConditions["Form resolution"] =
              (unsupportedConditions["Form resolution"] || 0) + 1;
          }
        });
      });
    });
    return { supported, unsupported, unsupportedConditions };
  }

  return {
    getEvolutionOptions,
    getAvailableEvolutions,
    canEvolve,
    getEvolutionSupportSummary,
  };
}

module.exports = {
  createEvolutionEngine,
  supportedEvolutionMethods,
};
