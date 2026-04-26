const path = require("path");
const { loadGameData, loadJson, saveJson } = require("../backend/dataLoader");
const { createPokemonUtils } = require("../backend/pokemonUtils");
const { createGameState } = require("../backend/gameState");

const rootDir = path.join(__dirname, "..");
const teamLimit = 6;
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

function main() {
  const gameData = loadGameData();
  const pokemonUtils = createPokemonUtils({
    pokemonPath: path.join(rootDir, "pokemon.json"),
    readJsonFile: loadJson,
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
    starterPokemon: pokemonUtils.starterPikachu,
  });

  const playerState = gameState.loadPlayerState();
  const { team, storage } = gameState.loadTeamAndStorage();
  const pokemon = pokemonUtils.getPokemonTemplates();

  assert(playerState.trainerName, "player state did not load");
  assert(team.length <= teamLimit, `team has ${team.length}, expected <= ${teamLimit}`);
  assert(team.length + storage.length >= 1, "no owned Pokemon found");
  assert(pokemon.length >= 1, "pokemon.json has no Pokemon");

  const missingPp = pokemon.flatMap((entry) =>
    (entry.moves || [])
      .filter((move) => move.pp === undefined && move.maxPp === undefined)
      .map((move) => `${entry.name}:${move.name}`),
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
