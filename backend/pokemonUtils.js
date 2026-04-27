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

const evolutionTriggers = {
  Pichu: { level: 8, name: "Pikachu", type: "Electric" },
  Pikachu: { level: 12, name: "Raichu", type: "Electric" },
  Bulbasaur: { level: 16, name: "Ivysaur", type: "Grass" },
  Charmander: { level: 16, name: "Charmeleon", type: "Fire" },
  Squirtle: { level: 16, name: "Wartortle", type: "Water" },
  Chikorita: { level: 16, name: "Bayleef", type: "Grass" },
  Cyndaquil: { level: 16, name: "Quilava", type: "Fire" },
  Totodile: { level: 16, name: "Croconaw", type: "Water" },
  Eevee: { level: 16, name: "Vaporeon", type: "Water" },
};

function createPokemonUtils({ pokemonPath, readJsonFile, moveCatalog = {} }) {
  let pokemonTemplateCache = null;

  function getPokemonTemplates() {
    if (!pokemonTemplateCache) {
      pokemonTemplateCache = readJsonFile(pokemonPath, []);
    }
    return pokemonTemplateCache;
  }

  function getPokemonTemplate(id) {
    return getPokemonTemplates().find((pokemon) => pokemon.id === id) || {};
  }

  function getPokemonTemplateByName(name) {
    return getPokemonTemplates().find((pokemon) => pokemon.name === name) || null;
  }

  function getPokemonTypes(pokemon) {
    if (Array.isArray(pokemon.types) && pokemon.types.length > 0) {
      return pokemon.types;
    }
    return pokemon.type ? [pokemon.type] : [];
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
    const template = getPokemonTemplate(pokemon.id);
    const merged = {
      ...template,
      ...pokemon,
    };
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
    const moves = (
      templateMoves || savedMoves.length ? templateMoves || savedMoves : defaultMoves
    ).map((move) => {
      const moveName = getMoveName(move);
      const savedMove = savedMoves.find((saved) => getMoveName(saved) === moveName);
      return normalizeMove(move, savedMove);
    });

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
      moves,
      learnset: normalizeLearnset(merged.learnset || []),
    };
    if (merged.pendingMove) {
      normalized.pendingMove = normalizeMove(merged.pendingMove);
    } else {
      delete normalized.pendingMove;
    }
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

  function getEvolution(pokemon) {
    if (pokemon.evolvesTo && pokemon.evolveLevel) {
      return {
        level: pokemon.evolveLevel,
        name: pokemon.evolvesTo,
        type: pokemon.evolveType || pokemon.type,
      };
    }
    return evolutionTriggers[pokemon.name];
  }

  function createLeveledPokemon(name, level) {
    const template = normalizePokemon(
      getPokemonTemplates().find((pokemon) => pokemon.name === name) || {},
    );
    const multiplier = 1 + Math.max(0, level - 1) * 0.08;
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
      moves: template.moves.map((move) => ({
        ...move,
        currentPp: move.maxPp ?? move.pp,
      })),
    };
  }

  return {
    defaultMoves,
    starterPikachu,
    getPokemonTemplates,
    getPokemonTemplate,
    getPokemonTemplateByName,
    getPokemonTypes,
    normalizeMove,
    normalizePokemon,
    restorePokemon,
    getEvolution,
    createLeveledPokemon,
  };
}

module.exports = {
  createPokemonUtils,
  defaultMoves,
  starterPikachu,
};
