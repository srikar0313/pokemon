const { createCanonicalPokemonLookup } = require("./canonicalPokemon");
const { applyObtainability } = require("./obtainability");

const STAT_BASE_VERSION = "pokeapi-v1";
const BASE_STAT_KEYS = [
  "maxHp",
  "attack",
  "defense",
  "specialAttack",
  "specialDefense",
  "speed",
];

const defaultMoves = [
  {
    name: "Tackle",
    type: "Normal",
    category: "Physical",
    power: 40,
    accuracy: 100,
    pp: 35,
  },
  {
    name: "Growl",
    type: "Normal",
    category: "Status",
    power: null,
    accuracy: 100,
    pp: 40,
    effect: "lower_attack",
  },
  {
    name: "Quick Attack",
    type: "Normal",
    category: "Physical",
    power: 40,
    accuracy: 100,
    pp: 30,
  },
  {
    name: "Tail Whip",
    type: "Normal",
    category: "Status",
    power: null,
    accuracy: 100,
    pp: 30,
    effect: "lower_defense",
  },
];

const starterPikachu = {
  id: 25,
  name: "Pikachu",
  type: "Electric",
  rarity: "uncommon",
  hp: 35,
  maxHp: 35,
  attack: 55,
  defense: 40,
  specialAttack: 50,
  specialDefense: 50,
  xpYield: 112,
  habitats: ["forest"],
  times: ["day"],
  baseCatchRate: 190,
  level: 1,
  xp: 0,
  currentHp: 35,
  types: ["Electric"],
  shiny: false,
  moves: [
    {
      name: "Thunderbolt",
      type: "Electric",
      category: "Special",
      power: 90,
      accuracy: 100,
      pp: 15,
    },
    {
      name: "Quick Attack",
      type: "Normal",
      category: "Physical",
      power: 40,
      accuracy: 100,
      pp: 30,
    },
    {
      name: "Growl",
      type: "Normal",
      category: "Status",
      power: null,
      accuracy: 100,
      pp: 40,
      effect: "lower_attack",
    },
    {
      name: "Thunder Wave",
      type: "Electric",
      category: "Status",
      power: null,
      accuracy: 90,
      pp: 20,
      effect: "paralyze",
    },
  ],
};

function createPokemonUtils({
  pokemonPath,
  readJsonFile,
  moveCatalog = {},
  canonicalPokemon = {},
  evolutionData = {},
  obtainability = {},
  speciesMap = {},
}) {
  let legacyPokemonTemplateCache = null;
  let pokemonTemplateCache = null;
  const canonicalLookup = createCanonicalPokemonLookup(canonicalPokemon);
  const availabilityBySpeciesId = new Map(
    (obtainability.entries || []).map((entry) => [entry.speciesId, entry]),
  );
  const originalSpeciesIds = new Set(
    (speciesMap.species || [])
      .filter((entry) => entry.existingBeforeExpansion)
      .map((entry) => entry.canonicalSpeciesId),
  );
  const evolutionChainBySpeciesId = new Map();
  (evolutionData.chains || []).forEach((chain) => {
    (chain.species || []).forEach((species) => {
      evolutionChainBySpeciesId.set(species.speciesId, chain);
    });
  });

  function getLegacyPokemonTemplates() {
    if (!legacyPokemonTemplateCache) {
      legacyPokemonTemplateCache = readJsonFile(pokemonPath, []);
    }
    return legacyPokemonTemplateCache;
  }

  function findTemplateForPokemon(templates, pokemon = {}) {
    const templateById = pokemon.id
      ? templates.find((template) => template.id === pokemon.id)
      : null;
    const templateByName = pokemon.name
      ? templates.find((template) => template.name === pokemon.name)
      : null;
    if (templateByName?.name && templateById?.name !== pokemon.name) {
      return templateByName;
    }
    return templateById?.name ? templateById : templateByName || null;
  }

  function applyFormBaseOverrides(baseStats, form = null) {
    if (!form) return { ...baseStats };
    return {
      maxHp: form.maxHp ?? form.hp ?? baseStats.maxHp,
      attack: form.attack ?? baseStats.attack,
      defense: form.defense ?? baseStats.defense,
      specialAttack: form.specialAttack ?? baseStats.specialAttack,
      specialDefense: form.specialDefense ?? baseStats.specialDefense,
      speed: form.speed ?? baseStats.speed,
    };
  }

  function getFormFromTemplate(template, pokemon = {}) {
    const formId =
      typeof pokemon.form === "string" ? pokemon.form : pokemon.form?.id;
    return formId
      ? (template?.forms || []).find((form) => form.id === formId) || null
      : null;
  }

  function getLegacyBaseStats(pokemon = {}) {
    const template = findTemplateForPokemon(
      getLegacyPokemonTemplates(),
      pokemon,
    );
    if (!template) return null;
    const baseStats = {
      maxHp: template.maxHp ?? template.hp ?? 1,
      attack: template.attack ?? 1,
      defense: template.defense ?? 1,
      specialAttack: template.specialAttack ?? template.attack ?? 1,
      specialDefense: template.specialDefense ?? template.defense ?? 1,
      speed: template.speed ?? 1,
    };
    return applyFormBaseOverrides(
      baseStats,
      getFormFromTemplate(template, pokemon),
    );
  }

  function getCanonicalBaseStats(pokemon = {}) {
    const canonical = canonicalLookup.getCanonicalPokemon(pokemon);
    if (!canonical?.baseStats) return null;
    const template = findTemplateForPokemon(
      getLegacyPokemonTemplates(),
      pokemon,
    );
    const baseStats = {
      maxHp: canonical.baseStats.hp,
      attack: canonical.baseStats.attack,
      defense: canonical.baseStats.defense,
      specialAttack: canonical.baseStats.specialAttack,
      specialDefense: canonical.baseStats.specialDefense,
      speed: canonical.baseStats.speed,
    };
    return applyFormBaseOverrides(
      baseStats,
      getFormFromTemplate(template, pokemon),
    );
  }

  function migrateOwnedPokemonStats(pokemon = {}) {
    if (pokemon.statBaseVersion === STAT_BASE_VERSION) return { ...pokemon };
    const legacyBase = getLegacyBaseStats(pokemon);
    const canonicalBase = getCanonicalBaseStats(pokemon);
    if (!legacyBase || !canonicalBase) return { ...pokemon };

    const previousMaxHp = Math.max(
      1,
      Number(pokemon.maxHp ?? pokemon.hp ?? legacyBase.maxHp) || 1,
    );
    const wasFainted = Number(pokemon.currentHp) === 0;
    const hpRatio = Math.max(
      0,
      Math.min(1, Number(pokemon.currentHp ?? previousMaxHp) / previousMaxHp),
    );
    const migrated = {
      ...pokemon,
      hp: canonicalBase.maxHp,
      statBaseVersion: STAT_BASE_VERSION,
    };

    BASE_STAT_KEYS.filter((stat) => stat !== "speed").forEach((stat) => {
      const ownedStat = Number(pokemon[stat] ?? legacyBase[stat]);
      const earnedGrowth = Math.max(0, ownedStat - legacyBase[stat]);
      migrated[stat] = Math.max(1, canonicalBase[stat] + earnedGrowth);
    });
    migrated.speed = Math.max(1, canonicalBase.speed);
    migrated.currentHp = wasFainted
      ? 0
      : Math.max(
          1,
          Math.min(migrated.maxHp, Math.round(migrated.maxHp * hpRatio)),
        );
    return migrated;
  }

  function enrichPokemonTemplate(pokemon = {}) {
    const canonical = canonicalLookup.getCanonicalPokemon(pokemon);
    if (!canonical) return { ...pokemon };
    const types = Array.isArray(canonical.types) ? [...canonical.types] : [];
    const baseStats = getCanonicalBaseStats(pokemon);
    const formIdByRegion = {
      alola: "alolan",
      galar: "galarian",
      hisui: "hisuian",
      paldea: "paldean",
    };
    const configuredForms = pokemon.forms || [];
    const forms = (canonical.forms || [])
      .filter((form) => form.category === "regional" && form.region)
      .map((form) => {
        const id = formIdByRegion[form.region] || form.region;
        const configured = configuredForms.find((entry) => entry.id === id) || {};
        return {
          ...configured,
          id,
          name: `${formatEvolutionValue(form.region)} Form`,
          category: "regional",
          types: form.types || configured.types || [],
          imageId: form.pokemonId,
          artwork: form.artwork,
          abilities: form.abilities || [],
        };
      });
    configuredForms.forEach((form) => {
      if (!forms.some((candidate) => candidate.id === form.id)) forms.push(form);
    });
    return applyObtainability({
      ...pokemon,
      hp: baseStats?.maxHp ?? pokemon.hp,
      maxHp: baseStats?.maxHp ?? pokemon.maxHp ?? pokemon.hp,
      attack: baseStats?.attack ?? pokemon.attack,
      defense: baseStats?.defense ?? pokemon.defense,
      specialAttack: baseStats?.specialAttack ?? pokemon.specialAttack,
      specialDefense: baseStats?.specialDefense ?? pokemon.specialDefense,
      speed: baseStats?.speed ?? pokemon.speed,
      statBaseVersion: STAT_BASE_VERSION,
      speciesId: canonical.speciesId,
      canonicalName: canonical.canonicalName,
      types: types.length ? types : pokemon.types,
      type: types[0] || pokemon.type,
      artwork: { ...(canonical.artwork || {}) },
      baseHappiness: canonical.baseHappiness ?? pokemon.baseHappiness ?? 70,
      genderRate: canonical.genderRate ?? pokemon.genderRate ?? -1,
      abilities: canonical.abilities || pokemon.abilities || [],
      learnset: canonical.learnset || pokemon.learnset || [],
      learnsetVersionGroup:
        canonical.learnsetVersionGroup || pokemon.learnsetVersionGroup || null,
      forms,
      isLegendary: Boolean(canonical.isLegendary),
      isMythical: Boolean(canonical.isMythical),
    }, availabilityBySpeciesId.get(canonical.speciesId), originalSpeciesIds.has(canonical.speciesId));
  }

  function getPokemonTemplates() {
    if (!pokemonTemplateCache) {
      pokemonTemplateCache =
        getLegacyPokemonTemplates().map(enrichPokemonTemplate);
    }
    return pokemonTemplateCache;
  }

  function getPokemonTemplate(id) {
    return getPokemonTemplates().find((pokemon) => pokemon.id === id) || {};
  }

  function getPokemonTemplateByName(name) {
    return getPokemonTemplates().find((pokemon) => pokemon.name === name) || null;
  }

  function getPokemonTemplateBySpeciesId(speciesId) {
    return (
      getPokemonTemplates().find(
        (pokemon) => pokemon.speciesId === Number(speciesId),
      ) || null
    );
  }

  function getPokemonSpeciesId(pokemonOrIdentity) {
    if (
      pokemonOrIdentity &&
      typeof pokemonOrIdentity === "object" &&
      Number.isInteger(Number(pokemonOrIdentity.speciesId))
    ) {
      return Number(pokemonOrIdentity.speciesId);
    }
    const numericIdentity = Number(pokemonOrIdentity);
    if (Number.isInteger(numericIdentity) && numericIdentity > 0) {
      return (
        canonicalLookup.getCanonicalPokemonByLocalId(numericIdentity)
          ?.speciesId || null
      );
    }
    const identityPokemon =
      pokemonOrIdentity && typeof pokemonOrIdentity === "object"
        ? pokemonOrIdentity
        : { name: pokemonOrIdentity };
    return canonicalLookup.getCanonicalPokemon(identityPokemon)?.speciesId || null;
  }

  function getCanonicalPokemon(pokemon = {}) {
    return canonicalLookup.getCanonicalPokemon(pokemon);
  }

  function getCanonicalForm(canonical, form) {
    if (!canonical || !form) return null;
    return (
      (canonical.forms || []).find(
        (candidate) => Number(candidate.pokemonId) === Number(form.imageId),
      ) || null
    );
  }

  function getPokemonTemplateForOwnedPokemon(pokemon = {}) {
    return findTemplateForPokemon(getPokemonTemplates(), pokemon) || {};
  }

  function getPokemonTypes(pokemon) {
    if (Array.isArray(pokemon.types) && pokemon.types.length > 0) {
      return pokemon.types;
    }
    return pokemon.type ? [pokemon.type] : [];
  }

  function rollPokemonGender(genderRate) {
    const rate = Number(genderRate);
    if (!Number.isFinite(rate) || rate < 0) return "genderless";
    if (rate === 0) return "male";
    if (rate >= 8) return "female";
    return Math.random() < rate / 8 ? "female" : "male";
  }

  function getNormalizedGender(gender, genderRate, pokemon = {}) {
    const normalizedGender = String(gender || "").toLowerCase();
    if (["male", "female", "genderless"].includes(normalizedGender)) {
      return normalizedGender;
    }
    const rate = Number(genderRate);
    if (!Number.isFinite(rate) || rate < 0) return "genderless";
    if (rate === 0) return "male";
    if (rate >= 8) return "female";
    const identity = `${pokemon.speciesId || pokemon.id || ""}:${pokemon.name || ""}`;
    const stableRoll = [...identity].reduce(
      (value, character) => (value * 31 + character.charCodeAt(0)) % 8,
      0,
    );
    return stableRoll < rate ? "female" : "male";
  }

  function getNormalAbilities(abilities = []) {
    const normal = abilities.filter((ability) => ability?.name && !ability.hidden);
    return normal.length ? normal : abilities.filter((ability) => ability?.name);
  }

  function getDeterministicAbility(abilities, pokemon = {}) {
    const available = getNormalAbilities(abilities);
    if (!available.length) return null;
    const identity = `${pokemon.speciesId || pokemon.id || ""}:${pokemon.name || ""}`;
    const index = [...identity].reduce(
      (value, character) =>
        (value * 31 + character.charCodeAt(0)) % available.length,
      0,
    );
    return { ...available[index] };
  }

  function normalizeAbility(ability, abilities, pokemon = {}) {
    const available = getNormalAbilities(abilities);
    if (!available.length) return null;
    const savedName = typeof ability === "string" ? ability : ability?.name;
    const savedSlot = typeof ability === "object" ? ability?.slot : null;
    const byName = available.find((candidate) => candidate.name === savedName);
    if (byName) return { ...byName };
    const bySlot = available.find((candidate) => candidate.slot === savedSlot);
    return { ...(bySlot || getDeterministicAbility(available, pokemon)) };
  }

  function getPokemonFormDefinition(pokemonOrName, formId) {
    if (!formId) return null;
    const template =
      typeof pokemonOrName === "string"
        ? getPokemonTemplateByName(pokemonOrName)
        : getPokemonTemplateForOwnedPokemon(pokemonOrName || {});
    return (template?.forms || []).find((form) => form.id === formId) || null;
  }

  function getPokemonVariantKey(pokemon = {}) {
    const formId = pokemon.form?.id || "normal";
    const identity = getPokemonSpeciesId(pokemon) || pokemon.id || pokemon.name;
    return `${identity}:${formId}:${pokemon.shiny ? "shiny" : "normal"}`;
  }

  function formatEvolutionValue(value) {
    return String(value || "")
      .split("-")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function getEvolutionConditionLabels(conditions = []) {
    return [
      ...new Set(
        conditions.map((condition) => {
          if (condition.minLevel) return `Lv${condition.minLevel}`;
          if (condition.item) return formatEvolutionValue(condition.item);
          if (condition.method === "friendship") return "Friendship";
          if (condition.method?.startsWith("trade")) return "Trade";
          if (condition.knownMove) {
            return `Know ${formatEvolutionValue(condition.knownMove)}`;
          }
          return formatEvolutionValue(condition.method) || "Evolve";
        }),
      ),
    ];
  }

  function getPokedexEvolutionGraph(pokemonOrIdentity) {
    const speciesId = getPokemonSpeciesId(pokemonOrIdentity);
    const chain = evolutionChainBySpeciesId.get(speciesId);
    if (!chain) return { chainId: null, stages: [], edges: [] };

    const outgoingBySpeciesId = new Map();
    (chain.edges || []).forEach((edge) => {
      const outgoing = outgoingBySpeciesId.get(edge.fromSpeciesId) || [];
      outgoing.push(edge);
      outgoingBySpeciesId.set(edge.fromSpeciesId, outgoing);
    });
    const stages = (chain.species || []).map((species) => {
      const template = getPokemonTemplates().find(
        (candidate) => candidate.speciesId === species.speciesId,
      );
      const outgoing = outgoingBySpeciesId.get(species.speciesId) || [];
      const onlyEvolution = outgoing.length === 1 ? outgoing[0] : null;
      const levelCondition = onlyEvolution?.conditions?.find(
        (condition) => Number.isFinite(condition.minLevel),
      );
      return {
        id: template?.id ?? species.localId,
        speciesId: species.speciesId,
        imageId: template?.imageId || species.speciesId,
        name: template?.name || species.name,
        canonicalName: template?.canonicalName || species.name,
        artwork: template?.artwork,
        type: template?.type,
        types: template ? getPokemonTypes(template) : [],
        evolvesTo:
          onlyEvolution &&
          getPokemonTemplates().find(
            (candidate) => candidate.speciesId === onlyEvolution.toSpeciesId,
          )?.name,
        evolveLevel: levelCondition?.minLevel || null,
      };
    });
    return {
      chainId: chain.chainId,
      stages,
      edges: (chain.edges || []).map((edge) => ({
        fromSpeciesId: edge.fromSpeciesId,
        toSpeciesId: edge.toSpeciesId,
        conditionLabels: getEvolutionConditionLabels(edge.conditions),
      })),
    };
  }

  function getMoveName(move) {
    return typeof move === "string" ? move : move?.name;
  }

  function expandMove(move) {
    if (typeof move === "string") {
      return { ...(moveCatalog[move] || { name: move }) };
    }
    return {
      ...(moveCatalog[move?.name] || {}),
      ...(move || {}),
    };
  }

  function normalizeMove(move, savedMove = null) {
    const expanded = expandMove(move);
    const saved = savedMove ? expandMove(savedMove) : null;
    const maxPp = expanded.maxPp ?? expanded.pp ?? saved?.maxPp ?? saved?.pp ?? saved?.currentPp ?? 10;
    return {
      ...expanded,
      name: expanded.name || getMoveName(move),
      category: expanded.category || "Physical",
      accuracy: expanded.accuracy ?? 100,
      power: expanded.power ?? 0,
      pp: expanded.pp ?? maxPp,
      maxPp,
      currentPp: Math.min(saved?.currentPp ?? expanded.currentPp ?? maxPp, maxPp),
    };
  }

  function normalizeLearnset(learnset = []) {
    return learnset
      .filter((entry) => entry?.level && entry.move)
      .map((entry) => ({
        ...entry,
        move: normalizeMove(entry.move),
      }));
  }

  function normalizePokemon(pokemon) {
    const template = getPokemonTemplateForOwnedPokemon(pokemon);
    const canonical = getCanonicalPokemon(template?.name ? template : pokemon);
    const migratedPokemon = migrateOwnedPokemonStats(pokemon);
    const merged = {
      ...template,
      ...migratedPokemon,
    };
    if (canonical) {
      const canonicalTypes = Array.isArray(canonical.types)
        ? [...canonical.types]
        : [];
      merged.speciesId = canonical.speciesId;
      merged.canonicalName = canonical.canonicalName;
      merged.isLegendary = Boolean(canonical.isLegendary);
      merged.isMythical = Boolean(canonical.isMythical);
      merged.artwork = { ...(canonical.artwork || {}) };
      if (canonicalTypes.length) {
        merged.types = canonicalTypes;
        merged.type = canonicalTypes[0];
      }
    }
    if (template?.name && merged.name === template.name) {
      merged.id = template.id;
      merged.imageId = template.imageId || template.id;
    }
    const hasGenericSavedType =
      pokemon.type === "Normal" &&
      Array.isArray(pokemon.types) &&
      pokemon.types.length === 1 &&
      pokemon.types[0] === "Normal" &&
      template.type &&
      template.type !== "Normal";

    if (hasGenericSavedType) {
      merged.type = template.type;
      merged.types = template.types || [template.type];
    }

    const types = getPokemonTypes(merged);
    const templateMoves =
      Array.isArray(template.moves) && template.moves.length > 0
        ? template.moves
        : null;
    const savedMoves = Array.isArray(pokemon.moves) ? pokemon.moves : [];
    const moveSource = savedMoves.length
      ? savedMoves
      : templateMoves || defaultMoves;
    const moves = moveSource.map((move) => {
      const moveName = getMoveName(move);
      const savedMove = savedMoves.find((saved) => getMoveName(saved) === moveName);
      return normalizeMove(move, savedMove);
    });

    const canonicalLearnset =
      canonical?.learnset || template.learnset || merged.learnset || [];
    const normalized = {
      ...merged,
      type: merged.type || types[0] || "Normal",
      types: types.length > 0 ? types : [merged.type || "Normal"],
      level: merged.level || 1,
      xp: merged.xp || 0,
      maxHp: merged.maxHp || merged.hp || 1,
      currentHp: merged.currentHp ?? merged.maxHp ?? merged.hp ?? 1,
      specialAttack: merged.specialAttack ?? merged.attack ?? 1,
      specialDefense: merged.specialDefense ?? merged.defense ?? 1,
      status: merged.status || "none",
      friendship: Math.max(
        0,
        Math.min(
          255,
          Number(merged.friendship ?? merged.baseHappiness ?? 70) || 0,
        ),
      ),
      gender: getNormalizedGender(merged.gender, merged.genderRate, merged),
      moves,
      learnset: normalizeLearnset(canonicalLearnset),
      learnsetVersionGroup:
        canonical?.learnsetVersionGroup || merged.learnsetVersionGroup || null,
    };
    if (template?.name) {
      normalized.imageId = template.imageId || template.id || normalized.imageId;
      normalized.rarity = template.rarity || normalized.rarity;
      normalized.habitats = template.habitats || normalized.habitats || [];
      normalized.times = template.times || normalized.times || ["day", "night"];
      normalized.baseCatchRate =
        template.baseCatchRate ?? normalized.baseCatchRate;
      normalized.xpYield = template.xpYield ?? normalized.xpYield;

      if (template.evolvesTo) {
        normalized.evolvesTo = template.evolvesTo;
        normalized.evolveLevel = template.evolveLevel;
        normalized.evolveType = template.evolveType || template.type;
      } else {
        delete normalized.evolvesTo;
        delete normalized.evolveLevel;
        delete normalized.evolveType;
      }
    }

    const formId =
      typeof merged.form === "string" ? merged.form : merged.form?.id;
    const configuredForm = getPokemonFormDefinition(template, formId);
    const form = configuredForm || (merged.form?.id ? merged.form : null);
    const canonicalForm = getCanonicalForm(canonical, form);
    normalized.shiny = Boolean(merged.shiny);
    normalized.form = form
      ? {
          id: form.id,
          name: form.name || `${form.id} Form`,
          category: form.category || "special",
          imageId: form.imageId,
          shinyImageId: form.shinyImageId,
          artwork: form.artwork || canonicalForm?.artwork,
        }
      : null;
    if (form) {
      if (form.types?.length) {
        normalized.types = [...form.types];
        normalized.type = form.type || form.types[0];
      }
      normalized.imageId = form.imageId || normalized.imageId;
      normalized.habitats = form.habitats || normalized.habitats;
      normalized.rarity = form.rarity || normalized.rarity;
      normalized.baseCatchRate = form.baseCatchRate ?? normalized.baseCatchRate;
      if (form.moves?.length) {
        normalized.moves = form.moves.slice(0, 4).map((move) => {
          const moveName = getMoveName(move);
          const savedMove = savedMoves.find(
            (saved) => getMoveName(saved) === moveName,
          );
          return normalizeMove(move, savedMove);
        });
      }
    }
    normalized.abilities = (
      form?.abilities?.length
        ? form.abilities
        : canonical?.abilities || merged.abilities || []
    ).map((ability) => ({ ...ability }));
    normalized.ability = normalizeAbility(
      merged.ability,
      normalized.abilities,
      normalized,
    );

    if (normalized.evolvedFrom) {
      const previousTemplate = getPokemonTemplateByName(normalized.evolvedFrom);
      const previousSpeciesId = getPokemonSpeciesId(previousTemplate);
      const currentSpeciesId = getPokemonSpeciesId(normalized);
      const canonicalEvolution = (
        evolutionChainBySpeciesId.get(previousSpeciesId)?.edges || []
      ).some(
        (edge) =>
          edge.fromSpeciesId === previousSpeciesId &&
          edge.toSpeciesId === currentSpeciesId,
      );
      const validPreviousEvolution =
        canonicalEvolution;
      if (!validPreviousEvolution) {
        delete normalized.evolvedFrom;
      }
    }
    normalized.currentHp = Math.max(
      0,
      Math.min(normalized.currentHp, normalized.maxHp),
    );
    if (merged.pendingMove) {
      normalized.pendingMove = normalizeMove(merged.pendingMove);
    } else {
      delete normalized.pendingMove;
    }
    delete normalized.battleModifiers;
    return normalized;
  }

  function restorePokemon(pokemon) {
    const normalized = normalizePokemon(pokemon);
    return {
      ...normalized,
      currentHp: normalized.maxHp,
      status: "none",
      moves: normalized.moves.map((move) => ({
        ...move,
        currentPp: move.maxPp ?? move.pp,
      })),
    };
  }

  function getStarterPokemon() {
    const templateById = getPokemonTemplate(25);
    const pikachuTemplate = templateById?.name
      ? templateById
      : getPokemonTemplateByName("Pikachu");
    return normalizePokemon(
      pikachuTemplate?.name ? { ...pikachuTemplate } : { ...starterPikachu },
    );
  }

  function getEvolutionRootName(name) {
    const graph = getPokedexEvolutionGraph(name);
    const targets = new Set(graph.edges.map((edge) => edge.toSpeciesId));
    return graph.stages.find((stage) => !targets.has(stage.speciesId))?.name || name;
  }

  function getEvolutionFamilyNames(name) {
    return getEvolutionChain(name).map((stage) => stage.name);
  }

  function getEvolutionChain(pokemonOrName) {
    const graph = getPokedexEvolutionGraph(pokemonOrName);
    const targets = new Set(graph.edges.map((edge) => edge.toSpeciesId));
    const depth = new Map(
      graph.stages
        .filter((stage) => !targets.has(stage.speciesId))
        .map((stage) => [stage.speciesId, 0]),
    );
    let changed = true;
    while (changed) {
      changed = false;
      graph.edges.forEach((edge) => {
        if (!depth.has(edge.fromSpeciesId)) return;
        const nextDepth = depth.get(edge.fromSpeciesId) + 1;
        if ((depth.get(edge.toSpeciesId) ?? -1) < nextDepth) {
          depth.set(edge.toSpeciesId, nextDepth);
          changed = true;
        }
      });
    }
    return graph.stages.slice().sort(
      (left, right) =>
        (depth.get(left.speciesId) || 0) - (depth.get(right.speciesId) || 0) ||
        left.speciesId - right.speciesId,
    );
  }

  function getEvolutionFamilyKey(pokemonOrName) {
    const name =
      typeof pokemonOrName === "string" ? pokemonOrName : pokemonOrName?.name;
    return getEvolutionRootName(name || "unknown");
  }

  function isPokemonOrEvolutionOf(pokemon, ancestor) {
    if (!pokemon || !ancestor) return false;
    const normalizedAncestor =
      typeof ancestor === "string" ? { name: ancestor } : ancestor;
    const ancestorTemplate = normalizedAncestor.id
      ? getPokemonTemplate(normalizedAncestor.id)
      : getPokemonTemplateByName(normalizedAncestor.name);
    const ancestorName = ancestorTemplate?.name || normalizedAncestor.name;
    const ancestorId = ancestorTemplate?.id || normalizedAncestor.id;
    if (!ancestorName && !ancestorId) return false;
    if (ancestorId && pokemon.id === ancestorId) return true;
    if (ancestorName && pokemon.name === ancestorName) return true;
    if (ancestorName && pokemon.evolvedFrom === ancestorName) return true;
    return getEvolutionFamilyNames(ancestorName).includes(pokemon.name);
  }

  function createLeveledPokemon(name, level) {
    const template = normalizePokemon(
      getPokemonTemplates().find((pokemon) => pokemon.name === name) || {},
    );
    const multiplier = 1 + Math.max(0, level - 1) * 0.08;
    const normalAbilities = getNormalAbilities(template.abilities);
    return {
      ...template,
      level,
      maxHp: Math.floor(template.maxHp * multiplier),
      currentHp: Math.floor(template.maxHp * multiplier),
      attack: Math.floor(template.attack * multiplier),
      defense: Math.floor(template.defense * multiplier),
      specialAttack: Math.floor(template.specialAttack * multiplier),
      specialDefense: Math.floor(template.specialDefense * multiplier),
      status: "none",
      friendship: template.baseHappiness ?? template.friendship ?? 70,
      gender: rollPokemonGender(template.genderRate),
      ability: normalAbilities.length
        ? { ...normalAbilities[Math.floor(Math.random() * normalAbilities.length)] }
        : null,
      moves: template.moves.map((move) => ({
        ...move,
        currentPp: move.maxPp ?? move.pp,
      })),
    };
  }

  function applyPokemonForm(pokemon, formId) {
    if (!getPokemonFormDefinition(pokemon, formId)) return normalizePokemon(pokemon);
    return normalizePokemon({ ...pokemon, form: { id: formId } });
  }

  return {
    defaultMoves,
    starterPikachu,
    getStarterPokemon,
    getPokemonTemplates,
    getLegacyPokemonTemplates,
    getPokemonTemplate,
    getPokemonTemplateByName,
    getPokemonTemplateBySpeciesId,
    getPokemonSpeciesId,
    getLegacyBaseStats,
    getCanonicalBaseStats,
    migrateOwnedPokemonStats,
    getCanonicalPokemon,
    getCanonicalPokemonByLocalId:
      canonicalLookup.getCanonicalPokemonByLocalId,
    getCanonicalPokemonBySpeciesId:
      canonicalLookup.getCanonicalPokemonBySpeciesId,
    getCanonicalPokemonByName: canonicalLookup.getCanonicalPokemonByName,
    getPokemonTypes,
    getPokemonFormDefinition,
    getPokemonVariantKey,
    getPokedexEvolutionGraph,
    applyPokemonForm,
    normalizeMove,
    normalizePokemon,
    restorePokemon,
    getEvolutionChain,
    getEvolutionRootName,
    getEvolutionFamilyNames,
    getEvolutionFamilyKey,
    isPokemonOrEvolutionOf,
    createLeveledPokemon,
  };
}

module.exports = {
  STAT_BASE_VERSION,
  createPokemonUtils,
  defaultMoves,
  starterPikachu,
};
