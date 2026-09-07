const path = require("path");
const { loadGameData, loadJson, saveJson } = require("../backend/dataLoader");
const {
  createPokemonUtils,
  STAT_BASE_VERSION,
} = require("../backend/pokemonUtils");
const {
  createGameState,
  createRandomPartySelection,
} = require("../backend/gameState");
const { createRewardEngine } = require("../backend/rewardEngine");
const { createEvolutionEngine } = require("../backend/evolutionEngine");
const { createEncounterEngine } = require("../backend/encounterEngine");
const { createBattleEngine } = require("../backend/battleEngine");
const variantUtils = require("../frontend/variantUtils");

const rootDir = path.join(__dirname, "..");
const teamLimit = 6;
const expectedNationalDexMax = 400;
const expectedExistingLaterSpecies = 26;
const expectedPreClosureCatalogSize = 426;
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
    getPokemonVariantKey: pokemonUtils.getPokemonVariantKey,
    resolvePokemonSpeciesId: pokemonUtils.getPokemonSpeciesId,
  });
}

function main() {
  const gameData = loadGameData();
  const pokemonUtils = createPokemonUtils({
    pokemonPath: path.join(rootDir, "pokemon.json"),
    readJsonFile: loadJson,
    moveCatalog: gameData.moves,
    canonicalPokemon: gameData.canonicalPokemon,
    evolutionData: gameData.evolutions,
    obtainability: gameData.obtainability,
    speciesMap: gameData.speciesMap,
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
    getPokemonVariantKey: pokemonUtils.getPokemonVariantKey,
    resolvePokemonSpeciesId: pokemonUtils.getPokemonSpeciesId,
  });

  const playerState = gameState.loadPlayerState();
  const { team, storage } = gameState.loadTeamAndStorage();
  const pokemon = pokemonUtils.getPokemonTemplates();
  const originalConfig = loadJson(
    path.join(rootDir, "data", "pokeapi", "original-134-config.json"),
    [],
  );
  const speciesMap = loadJson(
    path.join(rootDir, "data", "pokeapi", "species-map.json"),
    {},
  );
  const evolutionData = loadJson(
    path.join(rootDir, "data", "pokeapi", "evolutions.json"),
    {},
  );
  const starterTemplate = pokemonUtils.getPokemonTemplateByName("Pikachu");
  const starter = pokemonUtils.getStarterPokemon();
  const evolutionEngine = createEvolutionEngine({
    evolutionData: gameData.evolutions,
    getPokemonSpeciesId: pokemonUtils.getPokemonSpeciesId,
    getPokemonTemplateBySpeciesId: pokemonUtils.getPokemonTemplateBySpeciesId,
    getPokemonFormDefinition: pokemonUtils.getPokemonFormDefinition,
  });
  let evolutionTimeOfDay = "day";
  const rewardEngine = createRewardEngine({
    normalizePokemon: pokemonUtils.normalizePokemon,
    getEvolutionOptions: evolutionEngine.getEvolutionOptions,
    getAvailableEvolutions: evolutionEngine.getAvailableEvolutions,
    getPokemonTemplateByName: pokemonUtils.getPokemonTemplateByName,
    getPokemonFormDefinition: pokemonUtils.getPokemonFormDefinition,
    getTimeOfDay: () => evolutionTimeOfDay,
    updateAchievements: () => {},
  });
  const battleEngine = createBattleEngine({ getRandomInt: () => 100 });
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
  const randomPartySource = {
    team: Array.from({ length: 6 }, (_, index) => ({ name: `Team-${index}` })),
    storage: Array.from({ length: 4 }, (_, index) => ({ name: `Box-${index}` })),
  };
  const randomizedParty = createRandomPartySelection(
    randomPartySource.team,
    randomPartySource.storage,
    teamLimit,
    () => 0,
  );
  const beforeRandomization = [...randomPartySource.team, ...randomPartySource.storage]
    .map((entry) => entry.name)
    .sort();
  const afterRandomization = [...randomizedParty.team, ...randomizedParty.storage]
    .map((entry) => entry.name)
    .sort();
  assert(
    randomizedParty.team.length === teamLimit,
    "random party does not respect the party limit",
  );
  assert(
    JSON.stringify(afterRandomization) === JSON.stringify(beforeRandomization),
    "random party lost or duplicated owned Pokemon",
  );
  assert(
    randomizedParty.team.some((entry) => entry.name.startsWith("Box-")),
    "random party did not select from storage",
  );
  memoryFiles.clear();
  const partyPresetState = createMemoryGameState(pokemonUtils);
  const presetTeam = ["Pikachu", "Bulbasaur", "Charmander"].map((name) =>
    pokemonUtils.normalizePokemon(
      pokemonUtils.getPokemonTemplateByName(name),
    ),
  );
  const presetStorage = ["Squirtle", "Caterpie"].map((name) =>
    pokemonUtils.normalizePokemon(
      pokemonUtils.getPokemonTemplateByName(name),
    ),
  );
  partyPresetState.saveTeamAndStorage(presetTeam, presetStorage);
  const ownedBeforePreset = partyPresetState.loadTeamAndStorage();
  const savedPreset = partyPresetState.savePartyPreset(1);
  assert(savedPreset.success, "party preset could not be saved");
  const addedPresetPokemon = partyPresetState.updatePartyPreset(3, {
    action: "add",
    ownedId: ownedBeforePreset.storage[0].ownedId,
  });
  assert(
    addedPresetPokemon.success &&
      addedPresetPokemon.slots[2].pokemon[0].name === "Squirtle",
    "stored Pokemon could not be added directly to a party preset",
  );
  assert(
    partyPresetState.updatePartyPreset(3, {
      action: "add",
      ownedId: ownedBeforePreset.storage[0].ownedId,
    }).error,
    "party preset accepted the same owned Pokemon twice",
  );
  const removedPresetPokemon = partyPresetState.updatePartyPreset(3, {
    action: "remove",
    position: 0,
  });
  assert(
    removedPresetPokemon.success &&
      removedPresetPokemon.slots[2].pokemon.length === 0,
    "Pokemon could not be removed from a party preset",
  );
  const activeBeforeRandomPreset = partyPresetState.loadTeamAndStorage();
  const randomizedPreset = partyPresetState.randomizePartyPreset(2, () => 0);
  const activeAfterRandomPreset = partyPresetState.loadTeamAndStorage();
  assert(
    randomizedPreset.success && randomizedPreset.slots[1].pokemon.length === 5,
    "selected party preset was not filled with random owned Pokemon",
  );
  assert(
    activeAfterRandomPreset.team.map((entry) => entry.ownedId).join("|") ===
      activeBeforeRandomPreset.team.map((entry) => entry.ownedId).join("|"),
    "randomizing a party preset changed the active team",
  );
  partyPresetState.saveTeamAndStorage(
    [ownedBeforePreset.storage[0]],
    [...ownedBeforePreset.team, ...ownedBeforePreset.storage.slice(1)],
  );
  const loadedPreset = partyPresetState.loadPartyPreset(1);
  assert(loadedPreset.success, "party preset could not be loaded");
  assert(
    loadedPreset.team.map((entry) => entry.name).join("|") ===
      "Pikachu|Bulbasaur|Charmander",
    "party preset did not restore its exact saved members",
  );
  const presetOwnedIds = [...loadedPreset.team, ...loadedPreset.storage].map(
    (entry) => entry.ownedId,
  );
  assert(
    presetOwnedIds.length === 5 && new Set(presetOwnedIds).size === 5,
    "party preset load lost or duplicated owned Pokemon",
  );
  assert(Array.isArray(gameData.quests), "quests did not load");
  assert(
    gameData.shinyRollChance === 0.01,
    `expected a 1% shiny chance, got ${gameData.shinyRollChance}`,
  );
  assert(
    gameData.speciesEncounterBoosts.Eevee === 4,
    "Eevee encounter boost is not configured",
  );
  const normalizedLegacyAreas = gameState.normalizePlayerState({
    coins: 321,
    unlockedAreas: ["forest", "ocean"],
  });
  assert(
    normalizedLegacyAreas.coins === 321 &&
      normalizedLegacyAreas.unlockedAreas.includes("forest") &&
      !normalizedLegacyAreas.unlockedAreas.includes("ocean"),
    "legacy ocean unlock normalization reset or retained invalid save data",
  );
  assert(
    gameData.obtainability.entries.length === pokemon.length &&
      gameData.obtainability.summary.unavailable === 0,
    "obtainability does not cover the full catalog",
  );
  assert(
    gameData.areas.length === 7 &&
      !gameData.areas.some((area) => area.id === "ocean") &&
      !Object.hasOwn(gameData.areaUnlocks, "ocean"),
    "the playable world must contain seven areas and no ocean",
  );
  const originalById = new Map(originalConfig.map((entry) => [entry.id, entry]));
  gameData.speciesMap.species
    .filter((mapping) => mapping.existingBeforeExpansion)
    .forEach((mapping) => {
      const template = gameData.pokemon.find((entry) => entry.id === mapping.localId);
      const baseline = originalById.get(mapping.localId);
      assert(
        baseline &&
          JSON.stringify({
            id: template.id,
            name: template.name,
            habitats: template.habitats || [],
            rarity: template.rarity,
            times: template.times || [],
            baseCatchRate: template.baseCatchRate,
            forms: template.forms || [],
          }) === JSON.stringify(baseline),
        `original encounter configuration changed for ${template?.name || mapping.localId}`,
      );
    });
  [
    "thunderStone",
    "fireStone",
    "waterStone",
    "leafStone",
    "moonStone",
    "sunStone",
    "shinyStone",
    "duskStone",
    "dawnStone",
    "iceStone",
    "linkingCord",
    "metalCoat",
    "dragonScale",
    "upgrade",
    "dubiousDisc",
    "protector",
    "electirizer",
    "magmarizer",
    "kingsRock",
    "prismScale",
    "reaperCloth",
    "deepSeaTooth",
    "deepSeaScale",
  ].forEach((itemId) => {
    assert(
      gameData.items[itemId]?.category === "evolution" &&
        gameData.items[itemId]?.evolutionItem,
      `missing evolution item: ${itemId}`,
    );
  });

  const mappings = speciesMap.species || [];
  assert(
    gameData.canonicalPokemon.pokemon.filter((entry) => entry.learnset?.length)
      .length === pokemon.length,
    "not every runtime species has a canonical level-up learnset",
  );
  assert(
    gameData.canonicalPokemon.pokemon.filter((entry) =>
      entry.abilities?.some((ability) => !ability.hidden),
    ).length === pokemon.length,
    "not every runtime species has a canonical normal ability",
  );
  ["Bulbasaur", "Pikachu", "Treecko", "Riolu", "Salandit"].forEach(
    (name) => {
      const template = pokemonUtils.getPokemonTemplateByName(name);
      assert(
        template.learnset?.length > 1 && template.learnsetVersionGroup,
        `${name} lacks a usable canonical learnset`,
      );
    },
  );
  const catalogOnlyTackleDefaults = pokemon.filter(
    (entry) =>
      entry.catalogOnly &&
      entry.learnset?.length > 1 &&
      entry.moves?.length === 1 &&
      (entry.moves[0].name || entry.moves[0]) === "Tackle",
  );
  assert(
    catalogOnlyTackleDefaults.length === 0,
    `catalog species still use Tackle-only defaults: ${catalogOnlyTackleDefaults
      .slice(0, 5)
      .map((entry) => entry.name)
      .join(", ")}`,
  );
  const ownedMoveBulbasaur = pokemonUtils.normalizePokemon({
    ...pokemonUtils.getPokemonTemplateByName("Bulbasaur"),
    moves: [
      {
        ...gameData.moves["Vine Whip"],
        currentPp: 3,
      },
    ],
  });
  memoryFiles.clear();
  const moveAbilitySaveState = createMemoryGameState(pokemonUtils);
  moveAbilitySaveState.saveTeamAndStorage([ownedMoveBulbasaur], []);
  const reloadedOwnedBulbasaur = moveAbilitySaveState
    .loadTeamAndStorage()
    .team.find((owned) => owned.name === "Bulbasaur");
  assert(
    reloadedOwnedBulbasaur.moves.length === 1 &&
      reloadedOwnedBulbasaur.moves[0].name === "Vine Whip" &&
      reloadedOwnedBulbasaur.moves[0].currentPp === 3,
    "owned moves or PP changed during canonical save migration",
  );
  assert(
    reloadedOwnedBulbasaur.ability?.name === ownedMoveBulbasaur.ability?.name,
    "selected ability changed across save/load",
  );
  const moveLearningBulbasaur = pokemonUtils.normalizePokemon({
    ...pokemonUtils.getPokemonTemplateByName("Bulbasaur"),
    level: 5,
  });
  const canonicalMoveLearning = rewardEngine.applyXpToPokemon(
    [moveLearningBulbasaur],
    0,
    rewardEngine.getXpNeededForLevel(5),
  );
  assert(
    canonicalMoveLearning.pendingMove?.name === "Growth",
    "canonical level-up learnset did not feed the pending-move system",
  );
  assert(pokemon.length === mappings.length, "catalog and species map counts differ");
  const closureMappings = mappings.filter(
    (mapping) => mapping.addedByEvolutionClosure === true,
  );
  assert(
    mappings.length - closureMappings.length === expectedPreClosureCatalogSize,
    "the pre-closure 426-species catalog was not preserved",
  );
  const nationalSpeciesIds = new Set(
    mappings
      .map((mapping) => mapping.canonicalSpeciesId)
      .filter(
        (speciesId) =>
          speciesId >= 1 && speciesId <= expectedNationalDexMax,
      ),
  );
  assert(
    nationalSpeciesIds.size === expectedNationalDexMax,
    `National Dex coverage is ${nationalSpeciesIds.size}/${expectedNationalDexMax}`,
  );
  assert(
    mappings.filter(
      (mapping) =>
        mapping.existingBeforeExpansion &&
        mapping.canonicalSpeciesId > expectedNationalDexMax,
    ).length === expectedExistingLaterSpecies,
    "existing later-generation Pokemon were not all preserved",
  );
  assert(
    new Set(mappings.map((mapping) => mapping.localId)).size === mappings.length,
    "expanded species map has duplicate local IDs",
  );
  assert(
    new Set(mappings.map((mapping) => mapping.canonicalSpeciesId)).size ===
      mappings.length,
    "expanded species map has duplicate canonical species IDs",
  );
  const catalogOnlyPokemon = pokemon.filter((entry) => entry.catalogOnly);
  assert(
    catalogOnlyPokemon.length === 292 + closureMappings.length,
    "catalog-only Pokemon count is wrong",
  );
  assert(
    catalogOnlyPokemon.every((entry) =>
      ["canonical-level-up", "canonical-unavailable"].includes(entry.movesetPolicy),
    ),
    "a catalog-only Pokemon has an invalid moveset policy",
  );

  const sampleSpecies = new Map([
    [11, "Metapod"],
    [14, "Kakuna"],
    [15, "Beedrill"],
    [17, "Pidgeotto"],
    [22, "Fearow"],
    [55, "Golduck"],
    [59, "Arcanine"],
    [76, "Golem"],
    [148, "Dragonair"],
    [212, "Scizor"],
    [248, "Tyranitar"],
    [252, "Treecko"],
    [257, "Blaziken"],
    [282, "Gardevoir"],
    [350, "Milotic"],
    [389, "Torterra"],
    [392, "Infernape"],
    [395, "Empoleon"],
  ]);
  sampleSpecies.forEach((name, speciesId) => {
    const mapping = mappings.find(
      (entry) => entry.canonicalSpeciesId === speciesId,
    );
    const template = pokemon.find((entry) => entry.id === mapping?.localId);
    assert(
      template?.name === name && template.speciesId === speciesId,
      `National Dex #${speciesId} ${name} is unavailable`,
    );
  });
  const evolutionSpeciesIds = new Set(
    (evolutionData.species || []).map((entry) => entry.speciesId),
  );
  assert(
    [...nationalSpeciesIds].every((speciesId) =>
      evolutionSpeciesIds.has(speciesId),
    ),
    "an evolution-family species inside National Dex #1-400 is unresolved",
  );
  assert(
    (evolutionData.species || []).every(
      (entry) => entry.presentInGame && Number.isInteger(entry.localId),
    ),
    "an evolution-family species is missing from the runtime catalog",
  );
  const templatesById = new Map(pokemon.map((entry) => [entry.id, entry]));
  assert(
    closureMappings.every((mapping) => {
      const template = templatesById.get(mapping.localId);
      return (
        template?.speciesId === mapping.canonicalSpeciesId &&
        template.catalogOnly === true &&
        template.availability
      );
    }),
    "an evolution-closure Pokemon is missing obtainability metadata",
  );

  const canonicalSpeciesIds = pokemon.map((entry) => entry.speciesId);
  assert(
    canonicalSpeciesIds.every((speciesId) => Number.isInteger(speciesId)),
    "not every runtime template has a canonical speciesId",
  );
  assert(
    new Set(canonicalSpeciesIds).size === pokemon.length,
    "different runtime Pokemon were merged into one canonical species",
  );
  const pikachu = pokemonUtils.getPokemonTemplateByName("Pikachu");
  const pidgeot = pokemonUtils.getPokemonTemplateByName("Pidgeot");
  const pidgey = pokemonUtils.getPokemonTemplateByName("Pidgey");
  assert(pikachu.id === 25 && pikachu.speciesId === 25, "Pikachu identity is wrong");
  assert(pidgeot.id === 16 && pidgeot.speciesId === 18, "Pidgeot identity is wrong");
  assert(pidgey.id === 237 && pidgey.speciesId === 16, "Pidgey identity is wrong");
  assert(
    pokemonUtils.getPokemonTemplateByName("Bulbasaur").types.join(",") ===
      "Grass,Poison",
    "Bulbasaur canonical types were not applied",
  );
  assert(
    pokemonUtils.getPokemonTemplateByName("Geodude").types.join(",") ===
      "Rock,Ground",
    "Geodude canonical types were not applied",
  );

  const oldPidgeot = pokemonUtils.normalizePokemon({
    id: 16,
    name: "Pidgeot",
    level: 9,
    shiny: true,
  });
  assert(
    oldPidgeot.speciesId === 18 && oldPidgeot.shiny,
    "old saved Pokemon was not canonically enriched",
  );
  const hisuianGrowlithe = pokemonUtils.normalizePokemon({
    ...pokemonUtils.getPokemonTemplateByName("Growlithe"),
    form: { id: "hisuian" },
  });
  assert(
    hisuianGrowlithe.speciesId === 58 &&
      hisuianGrowlithe.types.join(",") === "Fire,Rock",
    "Hisuian Growlithe lost its form type override",
  );
  assert(
    variantUtils.resolvePokemonArtwork(hisuianGrowlithe)?.includes("/10229.png"),
    "Hisuian Growlithe did not resolve canonical form artwork",
  );
  assert(
    variantUtils.resolvePokemonArtwork(oldPidgeot)?.includes("/shiny/18.png"),
    "shiny canonical artwork was not preferred",
  );

  memoryFiles.clear();
  const canonicalSaveState = createMemoryGameState(pokemonUtils);
  canonicalSaveState.saveTeamAndStorage([oldPidgeot], [{ id: 237, name: "Pidgey" }]);
  const canonicalSaveLoad = canonicalSaveState.loadTeamAndStorage();
  assert(
    canonicalSaveLoad.team.some(
      (owned) => owned.name === "Pidgeot" && owned.speciesId === 18,
    ),
    "caught Pokemon path did not preserve speciesId",
  );
  assert(
    canonicalSaveLoad.storage.some(
      (owned) => owned.name === "Pidgey" && owned.speciesId === 16,
    ),
    "storage normalization did not enrich speciesId",
  );

  ["Pikachu", "Bulbasaur", "Pidgeot", "Pidgey", "Geodude", "Eevee"].forEach(
    (name) => {
      const template = pokemonUtils.getPokemonTemplateByName(name);
      const legacyTemplate = pokemonUtils
        .getLegacyPokemonTemplates()
        .find((entry) => entry.name === name);
      const canonical = pokemonUtils.getCanonicalPokemonByName(name);
      assert(canonical?.baseStats, `${name} has no canonical base stats`);
      assert(
        template.statBaseVersion === STAT_BASE_VERSION,
        `${name} has no stat marker`,
      );
      assert(template.hp === canonical.baseStats.hp, `${name} has wrong base HP`);
      assert(template.maxHp === canonical.baseStats.hp, `${name} has wrong max HP`);
      assert(
        template.baseCatchRate === legacyTemplate.baseCatchRate,
        `${name} catch rate changed during stat migration`,
      );
      ["attack", "defense", "specialAttack", "specialDefense", "speed"].forEach(
        (stat) => {
          assert(
            template[stat] === canonical.baseStats[stat],
            `${name} has wrong canonical ${stat}`,
          );
        },
      );
    },
  );

  const legacyEeveeTemplate = pokemonUtils
    .getLegacyPokemonTemplates()
    .find((entry) => entry.name === "Eevee");
  const legacyEeveeBase = pokemonUtils.getLegacyBaseStats(legacyEeveeTemplate);
  const canonicalEeveeBase = pokemonUtils.getCanonicalBaseStats(legacyEeveeTemplate);
  const earnedGrowth = {
    maxHp: 20,
    attack: 7,
    defense: 6,
    specialAttack: 5,
    specialDefense: 4,
  };
  const legacyOwnedEevee = {
    ...legacyEeveeTemplate,
    maxHp: legacyEeveeBase.maxHp + earnedGrowth.maxHp,
    currentHp: Math.round((legacyEeveeBase.maxHp + earnedGrowth.maxHp) * 0.5),
    attack: legacyEeveeBase.attack + earnedGrowth.attack,
    defense: legacyEeveeBase.defense + earnedGrowth.defense,
    specialAttack: legacyEeveeBase.specialAttack + earnedGrowth.specialAttack,
    specialDefense: legacyEeveeBase.specialDefense + earnedGrowth.specialDefense,
    speed: legacyEeveeBase.speed,
  };
  const migratedEevee = pokemonUtils.normalizePokemon(legacyOwnedEevee);
  Object.entries(earnedGrowth).forEach(([stat, growth]) => {
    assert(
      migratedEevee[stat] - canonicalEeveeBase[stat] === growth,
      `Eevee lost earned ${stat} growth during migration`,
    );
  });
  assert(
    migratedEevee.statBaseVersion === STAT_BASE_VERSION,
    "owned Pokemon migration marker was not set",
  );
  assert(migratedEevee.speed === canonicalEeveeBase.speed, "Speed is not canonical");
  assert(
    Math.abs(migratedEevee.currentHp / migratedEevee.maxHp - 0.5) <= 0.02,
    "owned Pokemon migration did not preserve HP ratio",
  );
  const migratedEeveeAgain = pokemonUtils.normalizePokemon(migratedEevee);
  ["maxHp", "currentHp", "attack", "defense", "specialAttack", "specialDefense", "speed"].forEach(
    (stat) => {
      assert(
        migratedEeveeAgain[stat] === migratedEevee[stat],
        `second normalization changed migrated Eevee ${stat}`,
      );
    },
  );
  const faintedLegacyEevee = pokemonUtils.normalizePokemon({
    ...legacyOwnedEevee,
    currentHp: 0,
  });
  assert(faintedLegacyEevee.currentHp === 0, "fainted Pokemon revived during migration");
  assert(
    pokemonUtils.createLeveledPokemon("Eevee", 5).statBaseVersion ===
      STAT_BASE_VERSION,
    "newly created Pokemon did not start on the canonical stat version",
  );

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
  const bulbasaurEvolutionOption = evolutionEngine.getAvailableEvolutions(
    evolutionBulbasaur,
    { trigger: "level-up" },
  )[0];
  const firstEvolution = rewardEngine.evolvePokemonFromTemplate(
    evolutionBulbasaur,
    bulbasaurEvolutionOption,
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
  const ivysaurEvolutionOption = evolutionEngine.getAvailableEvolutions(
    ivysaur,
    { trigger: "level-up" },
  )[0];
  const secondEvolution = rewardEngine.evolvePokemonFromTemplate(
    ivysaur,
    ivysaurEvolutionOption,
  );
  assert(
    secondEvolution.pokemon.name === "Venusaur",
    "Ivysaur did not evolve into Venusaur",
  );
  assert(
    evolutionEngine.getEvolutionOptions(secondEvolution.pokemon).length === 0,
    "final evolution retained a stale evolution target",
  );
  [
    ["Charmander", "Charmeleon"],
    ["Squirtle", "Wartortle"],
  ].forEach(([sourceName, targetName]) => {
    const sourceTemplate = pokemonUtils.getPokemonTemplateByName(sourceName);
    const targetTemplate = pokemonUtils.getPokemonTemplateByName(targetName);
    const canonicalOption = evolutionEngine
      .getEvolutionOptions(sourceTemplate)
      .find((option) => option.targetName === targetName);
    const evolutionLevel = canonicalOption.conditions.find(
      (condition) => condition.method === "level",
    ).minLevel;
    const source = pokemonUtils.normalizePokemon({
      ...sourceTemplate,
      level: evolutionLevel,
      xp: 9,
      shiny: true,
    });
    const result = rewardEngine.evolvePokemonFromTemplate(
      source,
      evolutionEngine.getAvailableEvolutions(source, { trigger: "level-up" })[0],
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
  bulbasaurAt15.shiny = true;
  bulbasaurAt15.status = "burned";
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
  assert(ivysaurAfterXp.xp === 0, "real XP evolution did not preserve XP");
  assert(ivysaurAfterXp.shiny, "real XP evolution did not preserve shiny state");
  assert(ivysaurAfterXp.status === "burned", "real XP evolution lost status");
  assert(
    ivysaurAfterXp.statBaseVersion === STAT_BASE_VERSION,
    "real XP evolution lost the canonical stat marker",
  );
  const bulbasaurCanonicalBase = pokemonUtils.getCanonicalBaseStats(bulbasaurAt15);
  const ivysaurCanonicalBase = pokemonUtils.getCanonicalBaseStats(ivysaurAfterXp);
  const level16Growth = {
    maxHp: 5,
    attack: 2,
    defense: 2,
    specialAttack: 2,
    specialDefense: 2,
  };
  ["maxHp", "attack", "defense", "specialAttack", "specialDefense"].forEach(
    (stat) => {
      assert(
        ivysaurAfterXp[stat] >= bulbasaurAt15[stat],
        `Bulbasaur -> Ivysaur regressed ${stat}`,
      );
      const earnedBeforeEvolution =
        bulbasaurAt15[stat] - bulbasaurCanonicalBase[stat] + level16Growth[stat];
      assert(
        ivysaurAfterXp[stat] - ivysaurCanonicalBase[stat] ===
          earnedBeforeEvolution,
        `Bulbasaur -> Ivysaur did not preserve canonical ${stat} growth`,
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
    const canonicalLevel = evolutionEngine
      .getEvolutionOptions(sourceTemplate)
      .find((option) => option.targetName === targetName)
      .conditions.find((condition) => condition.method === "level").minLevel;
    const beforeEvolution = levelPokemonTo(
      pokemonUtils.normalizePokemon(sourceTemplate),
      canonicalLevel - 1,
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

  const highLevelPikachu = pokemonUtils.normalizePokemon({
    ...starterTemplate,
    level: 50,
  });
  const pikachuLevelResult = rewardEngine.applyXpToPokemon(
    [highLevelPikachu],
    0,
    rewardEngine.getXpNeededForLevel(50),
  );
  assert(
    pikachuLevelResult.pokemon.name === "Pikachu" && !pikachuLevelResult.evolved,
    "Pikachu incorrectly evolved by level",
  );
  const overThresholdBulbasaur = pokemonUtils.normalizePokemon({
    ...pokemonUtils.getPokemonTemplateByName("Bulbasaur"),
    level: 16,
    xp: 0,
  });
  const noLevelEvolution = rewardEngine.applyXpToPokemon(
    [overThresholdBulbasaur],
    0,
    1,
  );
  assert(
    noLevelEvolution.pokemon.name === "Bulbasaur",
    "level evolution triggered without gaining a level",
  );

  const oldSavePichu = pokemonUtils.normalizePokemon({
    ...pokemonUtils.getPokemonTemplateByName("Pichu"),
    level: 5,
  });
  assert(
    oldSavePichu.friendship === oldSavePichu.baseHappiness,
    "old save friendship did not initialize from canonical base happiness",
  );
  assert(
    ["male", "female", "genderless"].includes(oldSavePichu.gender),
    "old save gender was not initialized",
  );

  const friendlyPichu = pokemonUtils.normalizePokemon({
    ...oldSavePichu,
    friendship: 219,
  });
  const pichuFriendshipEvolution = rewardEngine.applyXpToPokemon(
    [friendlyPichu],
    0,
    rewardEngine.getXpNeededForLevel(friendlyPichu.level),
  );
  assert(
    pichuFriendshipEvolution.pokemon.name === "Pikachu",
    "Pichu did not evolve through friendship",
  );
  assert(
    pichuFriendshipEvolution.pokemon.friendship === 223 &&
      pichuFriendshipEvolution.friendshipGained === 4,
    "friendship gains were not preserved through evolution",
  );

  const friendlyGolbat = pokemonUtils.normalizePokemon({
    ...pokemonUtils.getPokemonTemplateByName("Golbat"),
    level: 24,
    friendship: 156,
  });
  const crobatEvolution = rewardEngine.applyXpToPokemon(
    [friendlyGolbat],
    0,
    rewardEngine.getXpNeededForLevel(friendlyGolbat.level),
  );
  assert(
    crobatEvolution.pokemon.name === "Crobat",
    "Golbat did not evolve through friendship",
  );

  const createFriendlyEevee = () =>
    pokemonUtils.normalizePokemon({
      ...pokemonUtils.getPokemonTemplateByName("Eevee"),
      level: 20,
      friendship: 156,
    });
  evolutionTimeOfDay = "day";
  const espeonEvolution = rewardEngine.applyXpToPokemon(
    [createFriendlyEevee()],
    0,
    rewardEngine.getXpNeededForLevel(20),
  );
  assert(
    espeonEvolution.pokemon.name === "Espeon",
    "Eevee did not evolve into Espeon during the day",
  );
  evolutionTimeOfDay = "night";
  const umbreonEvolution = rewardEngine.applyXpToPokemon(
    [createFriendlyEevee()],
    0,
    rewardEngine.getXpNeededForLevel(20),
  );
  assert(
    umbreonEvolution.pokemon.name === "Umbreon",
    "Eevee did not evolve into Umbreon at night",
  );
  evolutionTimeOfDay = "day";

  const sylveonCandidate = createFriendlyEevee();
  sylveonCandidate.moves[0] = {
    ...gameData.moves["Disarming Voice"],
    currentPp: gameData.moves["Disarming Voice"].maxPp,
  };
  const branchedEeveeEvolution = rewardEngine.applyXpToPokemon(
    [sylveonCandidate],
    0,
    rewardEngine.getXpNeededForLevel(sylveonCandidate.level),
  );
  assert(
    branchedEeveeEvolution.pokemon.name === "Eevee" &&
      branchedEeveeEvolution.pendingEvolution?.options.some(
        (option) => option.targetName === "Sylveon",
      ) &&
      branchedEeveeEvolution.pendingEvolution?.options.some(
        (option) => option.targetName === "Espeon",
      ),
    "known move type evolution did not expose the valid Eevee branches",
  );

  [
    ["Kadabra", "linking-cord", "Alakazam"],
    ["Onix", "metal-coat", "Steelix"],
    ["Porygon2", "dubious-disc", "Porygon-Z"],
  ].forEach(([sourceName, item, targetName]) => {
    const source = pokemonUtils.normalizePokemon(
      pokemonUtils.getPokemonTemplateByName(sourceName),
    );
    const result = rewardEngine.performEvolution(source, {
      trigger: "use-item",
      item,
    });
    assert(result.evolved, `${item} did not evolve ${sourceName}`);
    assert(
      result.pokemon.name === targetName,
      `${sourceName} evolved into ${result.pokemon.name} instead of ${targetName}`,
    );
  });

  const maleKirlia = pokemonUtils.normalizePokemon({
    ...pokemonUtils.getPokemonTemplateByName("Kirlia"),
    level: 25,
    gender: "male",
  });
  const galladeEvolution = rewardEngine.performEvolution(maleKirlia, {
    trigger: "use-item",
    item: "dawn-stone",
  });
  assert(
    galladeEvolution.pokemon.name === "Gallade",
    "male Kirlia did not evolve into Gallade",
  );
  let wrongRequirementItemCount = 1;
  const femaleKirlia = pokemonUtils.normalizePokemon({
    ...maleKirlia,
    gender: "female",
  });
  const invalidGalladeEvolution = rewardEngine.performEvolution(femaleKirlia, {
    trigger: "use-item",
    item: "dawn-stone",
  });
  if (invalidGalladeEvolution.evolved) wrongRequirementItemCount -= 1;
  assert(!invalidGalladeEvolution.evolved, "female Kirlia evolved into Gallade");
  assert(
    wrongRequirementItemCount === 1,
    "item was consumed when a gender requirement failed",
  );

  const tangela = pokemonUtils.normalizePokemon({
    ...pokemonUtils.getPokemonTemplateByName("Tangela"),
    level: 20,
  });
  tangela.moves[0] = {
    ...gameData.moves["Ancient Power"],
    currentPp: gameData.moves["Ancient Power"].maxPp,
  };
  const tangrowthEvolution = rewardEngine.applyXpToPokemon(
    [tangela],
    0,
    rewardEngine.getXpNeededForLevel(tangela.level),
  );
  assert(
    tangrowthEvolution.pokemon.name === "Tangrowth",
    "known-move evolution did not recognize Ancient Power",
  );

  const tyrogue = pokemonUtils.normalizePokemon({
    ...pokemonUtils.getPokemonTemplateByName("Tyrogue"),
    level: 19,
    attack: 40,
    defense: 30,
  });
  const hitmonleeEvolution = rewardEngine.applyXpToPokemon(
    [tyrogue],
    0,
    rewardEngine.getXpNeededForLevel(19),
  );
  assert(
    hitmonleeEvolution.pokemon.name === "Hitmonlee",
    "relative Attack/Defense evolution chose the wrong target",
  );

  const stonePikachu = pokemonUtils.normalizePokemon({
    ...starterTemplate,
    ownedId: "preset-evolution-test",
    level: 24,
    xp: 31,
    shiny: true,
    currentHp: Math.round(starterTemplate.maxHp * 0.4),
  });
  stonePikachu.moves[0].currentPp = 2;
  const thunderEvolution = rewardEngine.performEvolution(stonePikachu, {
    trigger: "use-item",
    item: "thunder-stone",
  });
  assert(thunderEvolution.evolved, "Thunder Stone did not evolve Pikachu");
  assert(thunderEvolution.pokemon.name === "Raichu", "Pikachu evolved incorrectly");
  assert(thunderEvolution.pokemon.speciesId === 26, "Raichu has wrong speciesId");
  assert(thunderEvolution.pokemon.shiny, "stone evolution lost shiny state");
  assert(thunderEvolution.pokemon.level === 24, "stone evolution lost level");
  assert(thunderEvolution.pokemon.xp === 31, "stone evolution lost XP");
  assert(
    thunderEvolution.pokemon.ownedId === "preset-evolution-test",
    "evolution lost party-preset ownership identity",
  );
  assert(
    thunderEvolution.pokemon.moves[0].currentPp === 2,
    "stone evolution reset move PP",
  );
  assert(
    thunderEvolution.pokemon.abilities.some(
      (ability) => ability.name === thunderEvolution.pokemon.ability?.name,
    ),
    "evolution left the Pokemon with an invalid target-species ability",
  );
  assert(
    Math.abs(
      thunderEvolution.pokemon.currentHp / thunderEvolution.pokemon.maxHp -
        stonePikachu.currentHp / stonePikachu.maxHp,
    ) <= 0.02,
    "stone evolution did not preserve HP ratio",
  );

  let wrongStoneCount = 1;
  const wrongStoneEvolution = rewardEngine.performEvolution(stonePikachu, {
    trigger: "use-item",
    item: "water-stone",
  });
  if (wrongStoneEvolution.evolved) wrongStoneCount -= 1;
  assert(!wrongStoneEvolution.evolved, "wrong stone evolved Pikachu");
  assert(wrongStoneCount === 1, "wrong stone was consumed");

  const eevee = pokemonUtils.normalizePokemon(
    pokemonUtils.getPokemonTemplateByName("Eevee"),
  );
  const eeveeOptions = evolutionEngine.getEvolutionOptions(eevee);
  assert(
    new Set(eeveeOptions.map((option) => option.targetSpeciesId)).size >= 8,
    "Eevee does not expose all canonical branches",
  );
  assert(
    evolutionEngine.getAvailableEvolutions(eevee, {
      trigger: "use-item",
      item: "water-stone",
    })[0]?.targetName === "Vaporeon",
    "Eevee Water Stone branch is incorrect",
  );

  const wurmple = pokemonUtils.createLeveledPokemon("Wurmple", 6);
  const wurmpleChoice = rewardEngine.applyXpToPokemon(
    [wurmple],
    0,
    rewardEngine.getXpNeededForLevel(6),
  );
  assert(
    !wurmpleChoice.evolved &&
      wurmpleChoice.pokemon.name === "Wurmple" &&
      wurmpleChoice.pendingEvolution?.options?.length === 2,
    "multiple valid branches did not create a pending evolution choice",
  );

  const caterpie = pokemonUtils.createLeveledPokemon("Caterpie", 6);
  const caterpieChainXp = [6, 7, 8, 9].reduce(
    (sum, level) => sum + rewardEngine.getXpNeededForLevel(level),
    0,
  );
  const butterfreeResult = rewardEngine.applyXpToPokemon(
    [caterpie],
    0,
    caterpieChainXp,
  );
  assert(
    butterfreeResult.pokemon.name === "Butterfree" &&
      butterfreeResult.pokemon.level === 10,
    "Caterpie did not follow its full canonical level chain",
  );
  assert(
    butterfreeResult.evolutionEvents
      .map((event) => `${event.from}->${event.to}`)
      .join(",") === "Caterpie->Metapod,Metapod->Butterfree",
    "Caterpie evolution events are incomplete",
  );

  memoryFiles.clear();
  memoryFiles.set("memory-inventory.json", [thunderEvolution.pokemon]);
  memoryFiles.set("memory-storage.json", []);
  const evolvedOwnershipState = createMemoryGameState(pokemonUtils);
  const evolvedPokedex = evolvedOwnershipState.loadPlayerState().pokedex;
  assert(
    evolvedPokedex.caught.includes(26),
    "evolved owned Pokemon was not marked caught by speciesId",
  );

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
      const previousSpeciesId = previousTemplate?.speciesId;
      const currentSpeciesId = template.speciesId;
      const isCanonicalEvolution = pokemonUtils
        .getPokedexEvolutionGraph(previousTemplate)
        .edges.some(
          (edge) =>
            edge.fromSpeciesId === previousSpeciesId &&
            edge.toSpeciesId === currentSpeciesId,
        );
      assert(
        isCanonicalEvolution,
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

  const normalVulpix = pokemonUtils.normalizePokemon(
    pokemonUtils.getPokemonTemplateByName("Vulpix"),
  );
  const alolanVulpix = pokemonUtils.normalizePokemon({
    ...normalVulpix,
    form: { id: "alolan" },
  });
  const shinyAlolanVulpix = pokemonUtils.normalizePokemon({
    ...alolanVulpix,
    shiny: true,
  });
  const shinyNormalVulpix = pokemonUtils.normalizePokemon({
    ...normalVulpix,
    shiny: true,
  });
  const alolanMeowth = pokemonUtils.applyPokemonForm(
    pokemonUtils.getPokemonTemplateByName("Meowth"),
    "alolan",
  );
  const galarianMeowth = pokemonUtils.applyPokemonForm(
    pokemonUtils.getPokemonTemplateByName("Meowth"),
    "galarian",
  );
  const paldeanWooper = pokemonUtils.applyPokemonForm(
    pokemonUtils.getPokemonTemplateByName("Wooper"),
    "paldean",
  );
  assert(
    alolanVulpix.form?.id === "alolan" &&
      alolanVulpix.types.join(",") === "Ice" &&
      alolanVulpix.imageId === 10103 &&
      alolanVulpix.abilities.some(
        (ability) => ability.name === alolanVulpix.ability?.name,
      ),
    "regional form overrides were not normalized",
  );
  assert(
    alolanMeowth.form?.id === "alolan" &&
      alolanMeowth.types.join(",") === "Dark" &&
      alolanMeowth.form.artwork?.normal &&
      galarianMeowth.form?.id === "galarian" &&
      galarianMeowth.types.join(",") === "Steel",
    "Meowth regional form types or artwork are incorrect",
  );
  assert(
    paldeanWooper.form?.id === "paldean" &&
      paldeanWooper.types.join(",") === "Poison,Ground" &&
      paldeanWooper.form.artwork?.normal,
    "Paldean Wooper type or artwork is incorrect",
  );
  assert(
    new Set([
      pokemonUtils.getPokemonVariantKey(normalVulpix),
      pokemonUtils.getPokemonVariantKey(shinyNormalVulpix),
      pokemonUtils.getPokemonVariantKey(alolanVulpix),
      pokemonUtils.getPokemonVariantKey(shinyAlolanVulpix),
    ]).size === 4,
    "normal, regional, and shiny variants do not have distinct identities",
  );
  assert(
    pokemonUtils.getPokemonSpeciesId(16) === 18,
    "Pidgeot local id 16 did not resolve to speciesId 18",
  );
  assert(
    pokemonUtils.getPokemonSpeciesId(237) === 16,
    "Pidgey local id 237 did not resolve to speciesId 16",
  );
  assert(
    pokemonUtils.getPokemonVariantKey({
      ...pokemonUtils.getPokemonTemplateByName("Pidgeot"),
      shiny: true,
    }) === "18:normal:shiny",
    "variant identity did not prefer canonical speciesId",
  );

  memoryFiles.clear();
  const legacyPidgeot = pokemonUtils.normalizePokemon(
    pokemonUtils.getPokemonTemplateByName("Pidgeot"),
  );
  memoryFiles.set("memory-inventory.json", [legacyPidgeot]);
  memoryFiles.set("memory-storage.json", []);
  memoryFiles.set("memory-player-state.json", {
    trainerName: "Legacy Collector",
    pokedex: {
      seen: [16, 237, 246, 58],
      caught: [16, 246, 58],
      formsSeen: ["16:normal:shiny", "246:normal:normal"],
      formsCaught: ["16:normal:shiny", "246:normal:normal"],
    },
  });
  const migratedGameState = createMemoryGameState(pokemonUtils);
  const migratedState = migratedGameState.loadPlayerState();
  assert(
    migratedGameState.resolvePokedexSpeciesId(246) === 94,
    "legacy Gengar id 246 did not resolve to speciesId 94",
  );
  assert(
    migratedState.pokedex.identityVersion === "species-v1",
    "Pokedex identity migration marker was not saved",
  );
  assert(
    [18, 16, 94, 58].every((speciesId) =>
      migratedState.pokedex.seen.includes(speciesId),
    ),
    "legacy seen IDs did not migrate to canonical species IDs",
  );
  assert(
    [18, 94, 58].every((speciesId) =>
      migratedState.pokedex.caught.includes(speciesId),
    ),
    "legacy caught IDs did not migrate to canonical species IDs",
  );
  assert(
    migratedState.pokedex.formsCaught.includes("18:normal:shiny") &&
      migratedState.pokedex.formsCaught.includes("94:normal:normal"),
    "legacy form or shiny progress did not migrate to species identity",
  );
  assert(
    migratedState.pokedex.caught.includes(58),
    "caught Pokemon no longer owned was lost during migration",
  );
  const migratedOwned = migratedGameState.getAllOwnedPokemon();
  assert(
    migratedOwned.every((owned) =>
      migratedState.pokedex.caught.includes(
        pokemonUtils.getPokemonSpeciesId(owned),
      ),
    ),
    "an owned Pokemon would appear in the uncaught Pokedex filter",
  );
  const secondNormalization = migratedGameState.normalizePlayerState({
    ...migratedState,
    pokedex: {
      ...migratedState.pokedex,
      seen: [16],
      caught: [16],
    },
  });
  assert(
    secondNormalization.pokedex.caught.includes(16) &&
      !secondNormalization.pokedex.caught.includes(18),
    "species identity was incorrectly remigrated as a local ID",
  );

  const eeveeGraph = pokemonUtils.getPokedexEvolutionGraph("Eevee");
  const eeveeTargets = new Set(
    eeveeGraph.edges
      .filter((edge) => edge.fromSpeciesId === 133)
      .map((edge) => edge.toSpeciesId),
  );
  assert(
    eeveeTargets.size === 8 &&
      [134, 135, 136, 196, 197, 470, 471, 700].every((speciesId) =>
        eeveeTargets.has(speciesId),
      ),
    "Eevee's branching evolution family is incomplete",
  );
  assert(
    pokemonUtils
      .getPokedexEvolutionGraph("Bulbasaur")
      .stages.map((stage) => stage.name)
      .join(" -> ") === "Bulbasaur -> Ivysaur -> Venusaur",
    "Bulbasaur's canonical display chain is incorrect",
  );

  const levitatingGastly = pokemonUtils.normalizePokemon({
    ...pokemonUtils.getPokemonTemplateByName("Gastly"),
    ability: { name: "levitate", slot: 1 },
  });
  const groundAttacker = pokemonUtils.normalizePokemon({
    ...pokemonUtils.getPokemonTemplateByName("Geodude"),
    moves: [
      { ...gameData.moves["Mud Shot"], accuracy: 100, currentPp: 10 },
    ],
  });
  const gastlyHp = levitatingGastly.currentHp;
  const levitateResult = battleEngine.executeBattleMove(
    groundAttacker,
    levitatingGastly,
    "Mud Shot",
  );
  assert(
    levitatingGastly.currentHp === gastlyHp &&
      levitateResult.log.some((line) => line.includes("Levitate")),
    "Levitate did not provide Ground immunity",
  );

  const intimidateUser = pokemonUtils.normalizePokemon({
    ...pokemonUtils.getPokemonTemplateByName("Arcanine"),
    ability: { name: "intimidate", slot: 1 },
  });
  const intimidatedTarget = pokemonUtils.normalizePokemon(
    pokemonUtils.getPokemonTemplateByName("Machop"),
  );
  const intimidateLog = [];
  battleEngine.applyEntryAbility(intimidateUser, intimidatedTarget, intimidateLog);
  assert(
    intimidatedTarget.battleModifiers?.attack < 1 &&
      intimidateLog.some((line) => line.includes("Intimidate")),
    "Intimidate entry hook did not lower Attack",
  );

  const immuneSnorlax = pokemonUtils.normalizePokemon({
    ...pokemonUtils.getPokemonTemplateByName("Snorlax"),
    ability: { name: "immunity", slot: 1 },
  });
  const poisonAttacker = pokemonUtils.normalizePokemon({
    ...pokemonUtils.getPokemonTemplateByName("Oddish"),
    moves: [
      {
        name: "Test Poison",
        type: "Poison",
        category: "Status",
        power: 0,
        accuracy: 100,
        pp: 10,
        maxPp: 10,
        currentPp: 10,
        effect: { type: "status", status: "poisoned", chance: 100 },
      },
    ],
  });
  const immunityResult = battleEngine.executeBattleMove(
    poisonAttacker,
    immuneSnorlax,
    "Test Poison",
  );
  assert(
    immuneSnorlax.status === "none" &&
      immunityResult.log.some((line) => line.includes("prevented")),
    "Immunity did not prevent poison",
  );

  memoryFiles.clear();
  const variantState = createMemoryGameState(pokemonUtils);
  variantState.saveTeamAndStorage(
    [normalVulpix, shinyNormalVulpix, alolanVulpix, shinyAlolanVulpix],
    [],
  );
  const loadedVariants = variantState.loadTeamAndStorage().team.filter(
    (owned) => owned.name === "Vulpix",
  );
  assert(loadedVariants.length === 4, "variant save/load collapsed valid Pokemon");
  assert(
    loadedVariants.some((owned) => !owned.form && owned.shiny),
    "caught shiny state was not preserved by save/load",
  );
  assert(
    loadedVariants.some((owned) => owned.form?.id === "alolan" && owned.shiny),
    "shiny regional form metadata was not preserved by save/load",
  );

  const encounterEngine = createEncounterEngine({
    rarityWeights: gameData.rarityWeights,
    legendaryRollChance: 0,
    weatherBoosts: gameData.weatherBoosts,
    getPokemonTypes: pokemonUtils.getPokemonTypes,
    formEncounterChance: 1,
  });
  const regionalEncounter = encounterEngine.selectEncounter(
    [pokemonUtils.getPokemonTemplateByName("Vulpix")],
    "mountain",
  );
  assert(
    regionalEncounter.form?.id === "alolan",
    "eligible regional form was not selected when the form roll succeeded",
  );
  const ordinaryEncounter = encounterEngine.selectEncounter(
    [pokemonUtils.getPokemonTemplateByName("Vulpix")],
    "volcano",
  );
  assert(!ordinaryEncounter.form, "regional form appeared outside its habitat");

  const worldEncounterEngine = createEncounterEngine({
    rarityWeights: gameData.rarityWeights,
    legendaryRollChance: 0,
    weatherBoosts: gameData.weatherBoosts,
    getPokemonTypes: pokemonUtils.getPokemonTypes,
    formEncounterChance: 0,
    speciesEncounterBoosts: gameData.speciesEncounterBoosts,
  });
  gameData.areas.forEach((area) => {
    const areaPool = pokemon.filter((entry) =>
      (entry.habitats || []).includes(area.id),
    );
    assert(areaPool.length > 0, `${area.id} has an empty wild pool`);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const encounter = worldEncounterEngine.selectEncounter(pokemon, area.id);
      assert(
        encounter.pokemon?.habitats?.includes(area.id),
        `${area.id} selected an unrelated biome Pokemon`,
      );
    }
  });

  assert(
    variantUtils.getArtworkUrl(normalVulpix, normalVulpix.id).endsWith("/37.png"),
    "normal artwork URL is incorrect",
  );
  assert(
    variantUtils
      .getArtworkUrl(shinyAlolanVulpix, shinyAlolanVulpix.id)
      .endsWith("/shiny/10103.png"),
    "shiny regional artwork URL is incorrect",
  );
  assert(
    variantUtils.isSameVariant(alolanVulpix, shinyAlolanVulpix) === false &&
      variantUtils.isSameVariant(normalVulpix, alolanVulpix) === false,
    "ownership matching does not distinguish forms and shiny variants",
  );
  assert(
    variantUtils
      .getNormalArtworkFallback(
        variantUtils.getArtworkUrl(shinyAlolanVulpix, shinyAlolanVulpix.id),
      )
      .endsWith("/10103.png"),
    "shiny artwork fallback is incorrect",
  );

  const unsupportedRegionalEvolution = evolutionEngine.canEvolve(alolanVulpix, {
    trigger: "use-item",
    item: "ice-stone",
  });
  assert(
    !unsupportedRegionalEvolution.canEvolve &&
      unsupportedRegionalEvolution.options.some((option) =>
        option.unsupportedRequirements.includes(
          "Unresolved regional form requirement",
        ),
      ),
    "ambiguous regional evolution was not blocked",
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
