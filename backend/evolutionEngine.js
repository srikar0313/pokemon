const supportedEvolutionMethods = new Set(["level", "item"]);

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

  function getUnsupportedRequirements(condition) {
    const requirements = [];
    if (condition.minHappiness || condition.minAffection) {
      requirements.push("Friendship");
    }
    if (condition.minBeauty) requirements.push("Beauty");
    if (condition.heldItem) {
      requirements.push(`Held item: ${formatValue(condition.heldItem)}`);
    }
    if (condition.knownMove) {
      requirements.push(`Known move: ${formatValue(condition.knownMove)}`);
    }
    if (condition.knownMoveType) {
      requirements.push(`Known move type: ${formatValue(condition.knownMoveType)}`);
    }
    if (condition.location) {
      requirements.push(`Location: ${formatValue(condition.location)}`);
    }
    if (condition.timeOfDay) {
      requirements.push(`Time: ${formatValue(condition.timeOfDay)}`);
    }
    if (condition.gender) requirements.push("Gender requirement");
    if (condition.tradeSpecies) {
      requirements.push(`Trade for ${formatValue(condition.tradeSpecies)}`);
    }
    if (condition.relativePhysicalStats != null) {
      requirements.push("Relative Attack/Defense requirement");
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
      const sourceTemplate = getPokemonTemplateBySpeciesId(
        edge.fromSpeciesId,
      );
      const targetTemplate = getPokemonTemplateBySpeciesId(edge.toSpeciesId);
      const sourceForm = getPokemonFormDefinition?.(
        sourceTemplate,
        sourceFormId,
      );
      return Boolean(
        sourceForm?.evolvesToForm &&
          getPokemonFormDefinition?.(targetTemplate, sourceForm.evolvesToForm),
      );
    }

    const itemAlternatives = new Set(
      (edge.conditions || []).map((candidate) => candidate.item).filter(Boolean),
    );
    return itemAlternatives.size <= 1;
  }

  function evaluateCondition(pokemon, edge, condition, context) {
    const requirements = getUnsupportedRequirements(condition);
    if (!supportedEvolutionMethods.has(condition.method)) {
      requirements.unshift(formatValue(condition.method) || "Special condition");
    }
    if (!canResolveFormPath(pokemon, edge, condition)) {
      requirements.unshift("Unresolved regional form requirement");
    }
    const supported = requirements.length === 0;
    let available = false;

    if (supported && condition.method === "level") {
      available =
        context.trigger === "level-up" &&
        Number(pokemon.level || 1) >= Number(condition.minLevel || Infinity);
    } else if (supported && condition.method === "item") {
      available =
        context.trigger === "use-item" &&
        Boolean(condition.item) &&
        condition.item === context.item;
    }

    const requirement =
      condition.method === "level"
        ? `Reach level ${condition.minLevel}`
        : condition.method === "item"
          ? `Use ${formatValue(condition.item)}`
          : requirements.join(", ");
    return { available, supported, requirement, unsupported: requirements };
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
        supported: conditionResults.some((result) => result.supported),
        requirements: [
          ...new Set(conditionResults.map((result) => result.requirement)),
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
    const supported = { level: 0, item: 0 };
    const unsupported = {};
    const unsupportedConditions = {};
    outgoingEdgesBySpeciesId.forEach((edges) => {
      edges.forEach((edge) => {
        (edge.conditions || []).forEach((condition) => {
          if (supportedEvolutionMethods.has(condition.method)) {
            supported[condition.method] += 1;
          } else {
            const method = condition.method || "unknown";
            unsupported[method] = (unsupported[method] || 0) + 1;
          }
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
