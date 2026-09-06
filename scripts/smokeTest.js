const path = require("path");
const { loadGameData, loadJson, saveJson } = require("../backend/dataLoader");
const { createPokemonUtils } = require("../backend/pokemonUtils");
const { createGameState } = require("../backend/gameState");
const { createRewardEngine } = require("../backend/rewardEngine");

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
  const rewardEngine = createRewardEngine({
    normalizePokemon: pokemonUtils.normalizePokemon,
    getEvolution: pokemonUtils.getEvolution,
    getPokemonTemplateByName: pokemonUtils.getPokemonTemplateByName,
    updateAchievements: () => {},
  });
  const levelPokemonTo = (startingPokemon, targetLevel) => {
    let current = startingPokemon;
    let result = null;
    while ((current.level || 1) < targetLevel) {
      result = rewardEngine.applyXpToPokemon(
        [current],
        0,
        rewardEngine.getXpNeededForLevel(current.level || 1),
      );
      current = result.pokemon;
    }
    return { pokemon: current, result };
  };

  assert(playerState.trainerName, "player state did not load");
  assert(team.length <= teamLimit, `team has ${team.length}, expected <= ${teamLimit}`);
  assert(team.length + storage.length >= 1, "no owned Pokemon found");
  assert(pokemon.length >= 1, "pokemon.json has no Pokemon");
  assert(Array.isArray(gameData.quests), "quests did not load");
  [
    ["Bulbasaur", "Ivysaur", "Venusaur"],
    ["Charmander", "Charmeleon", "Charizard"],
    ["Squirtle", "Wartortle", "Blastoise"],
    ["Pichu", "Pikachu", "Raichu"],
  ].forEach((expectedChain) => {
    const actualChain = pokemonUtils
      .getEvolutionChain(expectedChain[expectedChain.length - 1])
      .map((stage) => stage.name);
    assert(
      actualChain.join(",") === expectedChain.join(","),
      `invalid evolution chain: expected ${expectedChain.join(" -> ")}, got ${actualChain.join(" -> ")}`,
    );
  });

  const evolutionBulbasaur = pokemonUtils.normalizePokemon({
    ...pokemonUtils.getPokemonTemplateByName("Bulbasaur"),
    level: 16,
    xp: 17,
    shiny: true,
    status: "burned",
    currentHp: 20,
  });
  evolutionBulbasaur.moves[0].currentPp = 3;
  const firstEvolution = rewardEngine.evolvePokemonFromTemplate(
    evolutionBulbasaur,
    pokemonUtils.getEvolution(evolutionBulbasaur),
  );
  assert(firstEvolution.evolved, "Bulbasaur did not evolve");
  assert(
    firstEvolution.pokemon.name === "Ivysaur",
    "Bulbasaur skipped Ivysaur",
  );
  assert(firstEvolution.pokemon.level === 16, "evolution did not preserve level");
  assert(firstEvolution.pokemon.xp === 17, "evolution did not preserve XP");
  assert(firstEvolution.pokemon.shiny, "evolution did not preserve shiny state");
  assert(
    firstEvolution.pokemon.status === "burned",
    "evolution did not preserve status",
  );
  assert(
    firstEvolution.pokemon.moves[0].name === evolutionBulbasaur.moves[0].name,
    "evolution replaced known moves",
  );
  assert(
    firstEvolution.pokemon.moves[0].currentPp === 3,
    "evolution reset move PP",
  );
  assert(
    Math.abs(
      firstEvolution.pokemon.currentHp / firstEvolution.pokemon.maxHp -
        evolutionBulbasaur.currentHp / evolutionBulbasaur.maxHp,
    ) <= 0.02,
    "direct evolution did not preserve HP ratio",
  );
  const ivysaur = { ...firstEvolution.pokemon, level: 32 };
  const secondEvolution = rewardEngine.evolvePokemonFromTemplate(
    ivysaur,
    pokemonUtils.getEvolution(ivysaur),
  );
  assert(
    secondEvolution.pokemon.name === "Venusaur",
    "Ivysaur did not evolve into Venusaur",
  );
  assert(
    pokemonUtils.getEvolution(secondEvolution.pokemon) === null,
    "final evolution retained a stale evolution target",
  );
  [
    ["Charmander", "Charmeleon"],
    ["Squirtle", "Wartortle"],
    ["Pikachu", "Raichu"],
  ].forEach(([sourceName, targetName]) => {
    const sourceTemplate = pokemonUtils.getPokemonTemplateByName(sourceName);
    const targetTemplate = pokemonUtils.getPokemonTemplateByName(targetName);
    const source = pokemonUtils.normalizePokemon({
      ...sourceTemplate,
      level: sourceTemplate.evolveLevel,
      xp: 9,
      shiny: true,
    });
    const result = rewardEngine.evolvePokemonFromTemplate(
      source,
      pokemonUtils.getEvolution(source),
    );
    assert(result.evolved, `${sourceName} did not evolve`);
    assert(result.pokemon.name === targetName, `${sourceName} evolved incorrectly`);
    assert(result.pokemon.id === targetTemplate.id, `${targetName} has wrong id`);
    assert(
      result.pokemon.imageId === targetTemplate.imageId,
      `${targetName} has wrong imageId`,
    );
    assert(
      result.pokemon.types.join(",") === targetTemplate.types.join(","),
      `${targetName} has wrong types`,
    );
  });
  const missingEvolution = rewardEngine.evolvePokemonFromTemplate(
    evolutionBulbasaur,
    { name: "Missingno", level: 16 },
  );
  assert(!missingEvolution.evolved, "missing evolution target did not fail safely");

  const bulbasaurAt15 = levelPokemonTo(
    pokemonUtils.normalizePokemon(
      pokemonUtils.getPokemonTemplateByName("Bulbasaur"),
    ),
    15,
  ).pokemon;
  bulbasaurAt15.currentHp = Math.round(bulbasaurAt15.maxHp * 0.5);
  bulbasaurAt15.moves[0].currentPp = 2;
  const bulbasaurHpBeforeLevel = bulbasaurAt15.currentHp;
  const bulbasaurMaxHpBeforeLevel = bulbasaurAt15.maxHp;
  const integratedIvysaur = rewardEngine.applyXpToPokemon(
    [bulbasaurAt15],
    0,
    rewardEngine.getXpNeededForLevel(15),
  );
  const ivysaurAfterXp = integratedIvysaur.pokemon;
  assert(integratedIvysaur.evolved, "real XP path did not evolve Bulbasaur");
  assert(ivysaurAfterXp.name === "Ivysaur", "real XP path skipped Ivysaur");
  assert(ivysaurAfterXp.level === 16, "real XP evolution has wrong level");
  ["maxHp", "attack", "defense", "specialAttack", "specialDefense"].forEach(
    (stat) => {
      assert(
        ivysaurAfterXp[stat] >= bulbasaurAt15[stat],
        `Bulbasaur -> Ivysaur regressed ${stat}`,
      );
    },
  );
  const expectedIvysaurRatio =
    (bulbasaurHpBeforeLevel + 5) / (bulbasaurMaxHpBeforeLevel + 5);
  assert(
    Math.abs(
      ivysaurAfterXp.currentHp / ivysaurAfterXp.maxHp - expectedIvysaurRatio,
    ) <= 0.02,
    "integrated Bulbasaur evolution did not preserve HP ratio",
  );
  assert(
    ivysaurAfterXp.moves[0].currentPp === 2,
    "integrated Bulbasaur evolution reset move PP",
  );
  assert(
    ivysaurAfterXp.speed ===
      pokemonUtils.getPokemonTemplateByName("Ivysaur").speed,
    "Ivysaur did not use target species Speed",
  );

  const ivysaurAt31 = levelPokemonTo(ivysaurAfterXp, 31).pokemon;
  ivysaurAt31.currentHp = Math.round(ivysaurAt31.maxHp * 0.4);
  ivysaurAt31.moves[0].currentPp = 1;
  const ivysaurHpBeforeLevel = ivysaurAt31.currentHp;
  const ivysaurMaxHpBeforeLevel = ivysaurAt31.maxHp;
  const integratedVenusaur = rewardEngine.applyXpToPokemon(
    [ivysaurAt31],
    0,
    rewardEngine.getXpNeededForLevel(31),
  );
  assert(integratedVenusaur.evolved, "real XP path did not evolve Ivysaur");
  assert(
    integratedVenusaur.pokemon.name === "Venusaur",
    "real XP path did not reach Venusaur",
  );
  ["maxHp", "attack", "defense", "specialAttack", "specialDefense"].forEach(
    (stat) => {
      assert(
        integratedVenusaur.pokemon[stat] >= ivysaurAt31[stat],
        `Ivysaur -> Venusaur regressed ${stat}`,
      );
    },
  );
  assert(
    integratedVenusaur.pokemon.moves[0].currentPp === 1,
    "Ivysaur -> Venusaur reset move PP",
  );
  const expectedVenusaurRatio =
    (ivysaurHpBeforeLevel + 6) / (ivysaurMaxHpBeforeLevel + 6);
  assert(
    Math.abs(
      integratedVenusaur.pokemon.currentHp / integratedVenusaur.pokemon.maxHp -
        expectedVenusaurRatio,
    ) <= 0.02,
    "integrated Ivysaur evolution did not preserve HP ratio",
  );

  [
    ["Charmander", "Charmeleon"],
    ["Squirtle", "Wartortle"],
  ].forEach(([sourceName, targetName]) => {
    const sourceTemplate = pokemonUtils.getPokemonTemplateByName(sourceName);
    const beforeEvolution = levelPokemonTo(
      pokemonUtils.normalizePokemon(sourceTemplate),
      sourceTemplate.evolveLevel - 1,
    ).pokemon;
    const result = rewardEngine.applyXpToPokemon(
      [beforeEvolution],
      0,
      rewardEngine.getXpNeededForLevel(beforeEvolution.level),
    );
    assert(result.evolved, `real XP path did not evolve ${sourceName}`);
    assert(
      result.pokemon.name === targetName,
      `${sourceName} evolved incorrectly`,
    );
    ["maxHp", "attack", "defense", "specialAttack", "specialDefense"].forEach(
      (stat) => {
        assert(
          result.pokemon[stat] >= beforeEvolution[stat],
          `${sourceName} -> ${targetName} regressed ${stat}`,
        );
      },
    );
  });
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
