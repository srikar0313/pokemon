const path = require("path");
const { loadGameData, loadJson, saveJson } = require("../backend/dataLoader");
const { createPokemonUtils } = require("../backend/pokemonUtils");
const { createGameState } = require("../backend/gameState");

const rootDir = path.join(__dirname, "..");
const teamLimit = 6;
const memoryFiles = new Map();
const legacyBadgeMap = {
  "Spark Badge": "Volt Badge",
  "Thunder Badge": "Volt Badge",
  "Tide Badge": "Aqua Badge",
  "Cascade Badge": "Aqua Badge",
  "Ember Badge": "Blaze Badge",
  "Volcano Badge": "Blaze Badge",
};
const gymUnlocks = {
  1: null,
  2: "Volt Badge",
  3: "Aqua Badge",
  4: "Blaze Badge",
  5: "Forest Badge",
  6: "Storm Badge",
  7: "Rock Badge",
  8: "Psychic Badge",
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createMemoryGameState(pokemonUtils) {
  const memoryRead = (filePath, fallback) =>
    memoryFiles.has(filePath) ? memoryFiles.get(filePath) : fallback;
  const memoryWrite = (filePath, data) =>
    memoryFiles.set(filePath, JSON.parse(JSON.stringify(data)));

  return createGameState({
    inventoryPath: "memory-inventory.json",
    storagePath: "memory-storage.json",
    playerStatePath: "memory-player-state.json",
    teamLimit,
    gyms: [],
    areaUnlocks: {},
    gymUnlocks: {},
    legacyBadgeMap,
    championBadge: "Champion Badge",
    readJsonFile: memoryRead,
    writeJsonFile: memoryWrite,
    normalizePokemon: pokemonUtils.normalizePokemon,
    getStarterPokemon: pokemonUtils.getStarterPokemon,
    isPokemonOrEvolutionOf: pokemonUtils.isPokemonOrEvolutionOf,
    getEvolutionFamilyKey: pokemonUtils.getEvolutionFamilyKey,
  });
}

function main() {
  const gameData = loadGameData();
  const pokemonUtils = createPokemonUtils({
    pokemonPath: path.join(rootDir, "pokemon.json"),
    readJsonFile: loadJson,
    moveCatalog: gameData.moves,
  });
  const gameState = createGameState({
    inventoryPath: path.join(rootDir, "inventory.json"),
    storagePath: path.join(rootDir, "storage.json"),
    playerStatePath: path.join(rootDir, "player_state.json"),
    teamLimit,
    gyms: gameData.gyms,
    areaUnlocks: gameData.areaUnlocks,
    gymUnlocks,
    legacyBadgeMap,
    championBadge: gameData.champion.badge,
    readJsonFile: loadJson,
    writeJsonFile: saveJson,
    normalizePokemon: pokemonUtils.normalizePokemon,
    getStarterPokemon: pokemonUtils.getStarterPokemon,
    isPokemonOrEvolutionOf: pokemonUtils.isPokemonOrEvolutionOf,
    getEvolutionFamilyKey: pokemonUtils.getEvolutionFamilyKey,
  });

  const playerState = gameState.loadPlayerState();
  const { team, storage } = gameState.loadTeamAndStorage();
  const pokemon = pokemonUtils.getPokemonTemplates();
  const starterTemplate = pokemonUtils.getPokemonTemplateByName("Pikachu");
  const starter = pokemonUtils.getStarterPokemon();

  assert(playerState.trainerName, "player state did not load");
  assert(team.length <= teamLimit, `team has ${team.length}, expected <= ${teamLimit}`);
  assert(team.length + storage.length >= 1, "no owned Pokemon found");
  assert(pokemon.length >= 1, "pokemon.json has no Pokemon");
  assert(Array.isArray(gameData.quests), "quests did not load");
  assert(starter.name === "Pikachu", "starter Pokemon is not Pikachu");
  assert(starter.id === starterTemplate.id, "starter Pikachu did not use template id");
  assert(
    starter.moves.map((move) => move.name).join(",") === starterTemplate.moves.join(","),
    "starter Pikachu moves drifted from pokemon.json template",
  );
  [...team, ...storage].forEach((owned) => {
    const template = pokemonUtils.getPokemonTemplateByName(owned.name);
    assert(template, `owned Pokemon has no template: ${owned.name}`);
    assert(
      owned.id === template.id,
      `${owned.name} has mismatched id ${owned.id}, expected ${template.id}`,
    );
    assert(
      owned.imageId === template.imageId,
      `${owned.name} has mismatched imageId ${owned.imageId}, expected ${template.imageId}`,
    );
    if (template.evolvesTo) {
      assert(
        owned.evolvesTo === template.evolvesTo,
        `${owned.name} has mismatched evolvesTo ${owned.evolvesTo}, expected ${template.evolvesTo}`,
      );
    } else {
      assert(!owned.evolvesTo, `${owned.name} kept stale evolvesTo ${owned.evolvesTo}`);
    }
    if (owned.evolvedFrom) {
      const previousTemplate = pokemonUtils.getPokemonTemplateByName(owned.evolvedFrom);
      assert(
        previousTemplate?.evolvesTo === owned.name,
        `${owned.name} has invalid evolvedFrom ${owned.evolvedFrom}`,
      );
    }
  });

  memoryFiles.clear();
  const emptyState = createMemoryGameState(pokemonUtils);
  const emptyLoad = emptyState.loadTeamAndStorage();
  assert(emptyLoad.team.length === 1, "empty inventory did not create one starter");
  assert(emptyLoad.team[0].id === 25, "empty inventory starter is not Pikachu");

  memoryFiles.clear();
  memoryFiles.set("memory-inventory.json", [starter]);
  memoryFiles.set("memory-storage.json", []);
  const existingState = createMemoryGameState(pokemonUtils);
  const existingLoad = existingState.loadTeamAndStorage();
  const pikachuCount = [...existingLoad.team, ...existingLoad.storage].filter(
    (owned) => owned.id === 25,
  ).length;
  assert(pikachuCount === 1, "existing player received duplicate starter Pikachu");

  memoryFiles.clear();
  const raichu = pokemonUtils.normalizePokemon({
    ...pokemonUtils.getPokemonTemplateByName("Raichu"),
    level: 12,
    evolvedFrom: "Pikachu",
  });
  memoryFiles.set("memory-inventory.json", [raichu]);
  memoryFiles.set("memory-storage.json", []);
  const evolvedStarterState = createMemoryGameState(pokemonUtils);
  const evolvedStarterLoad = evolvedStarterState.loadTeamAndStorage();
  const starterFamilyCount = [
    ...evolvedStarterLoad.team,
    ...evolvedStarterLoad.storage,
  ].filter((owned) => pokemonUtils.isPokemonOrEvolutionOf(owned, starter)).length;
  assert(
    starterFamilyCount === 1,
    "evolved starter received duplicate level 1 Pikachu",
  );
  assert(
    pokemonUtils.getEvolutionFamilyKey("Geodude") ===
      pokemonUtils.getEvolutionFamilyKey("Graveler"),
    "Geodude and Graveler did not map to the same evolution family",
  );

  memoryFiles.clear();
  const geodude = pokemonUtils.normalizePokemon({
    ...pokemonUtils.getPokemonTemplateByName("Geodude"),
    level: 12,
    xp: 25,
  });
  const distinctGeodude = pokemonUtils.normalizePokemon({
    ...geodude,
    xp: 26,
  });
  memoryFiles.set("memory-inventory.json", [geodude, geodude]);
  memoryFiles.set("memory-storage.json", [geodude, distinctGeodude]);
  const duplicateCloneState = createMemoryGameState(pokemonUtils);
  const duplicateCloneLoad = duplicateCloneState.loadTeamAndStorage();
  const loadedGeodudes = [
    ...duplicateCloneLoad.team,
    ...duplicateCloneLoad.storage,
  ].filter((owned) => owned.name === "Geodude");
  assert(
    loadedGeodudes.length === 2,
    "exact Geodude clones were not cleaned while distinct catches were kept",
  );

  memoryFiles.clear();
  const bulbasaur = pokemonUtils.normalizePokemon(
    pokemonUtils.getPokemonTemplateByName("Bulbasaur"),
  );
  memoryFiles.set("memory-inventory.json", [bulbasaur]);
  memoryFiles.set("memory-storage.json", []);
  const noPikachuState = createMemoryGameState(pokemonUtils);
  const noPikachuLoad = noPikachuState.loadTeamAndStorage();
  const noPikachuOwned = [...noPikachuLoad.team, ...noPikachuLoad.storage];
  assert(
    noPikachuOwned.some((owned) => owned.id === 25),
    "existing inventory without Pikachu did not receive starter Pikachu",
  );
  assert(
    noPikachuOwned.some((owned) => owned.name === "Bulbasaur"),
    "existing inventory without Pikachu lost existing Pokemon",
  );

  const missingPp = pokemon.flatMap((entry) =>
    (entry.moves || [])
      .map((move) => (typeof move === "string" ? gameData.moves[move] : move))
      .filter((move) => !move || (move.pp === undefined && move.maxPp === undefined))
      .map((move) => `${entry.name}:${move?.name || "unknown"}`),
  );
  assert(
    missingPp.length === 0,
    `moves missing PP values: ${missingPp.slice(0, 10).join(", ")}`,
  );

  console.log(
    `[smoke] OK: player=${playerState.trainerName}, team=${team.length}, storage=${storage.length}, pokemon=${pokemon.length}`,
  );
}

try {
  main();
} catch (error) {
  console.error(`[smoke] ${error.message}`);
  process.exitCode = 1;
}
