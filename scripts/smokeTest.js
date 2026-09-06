const path = require("path");
const { loadGameData, loadJson, saveJson } = require("../backend/dataLoader");
const {
  createPokemonUtils,
  STAT_BASE_VERSION,
} = require("../backend/pokemonUtils");
const { createGameState } = require("../backend/gameState");
const { createRewardEngine } = require("../backend/rewardEngine");
const { createEncounterEngine } = require("../backend/encounterEngine");
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
  });
}

function main() {
  const gameData = loadGameData();
  const pokemonUtils = createPokemonUtils({
    pokemonPath: path.join(rootDir, "pokemon.json"),
    readJsonFile: loadJson,
    moveCatalog: gameData.moves,
    canonicalPokemon: gameData.canonicalPokemon,
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
  });

  const playerState = gameState.loadPlayerState();
  const { team, storage } = gameState.loadTeamAndStorage();
  const pokemon = pokemonUtils.getPokemonTemplates();
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
  const rewardEngine = createRewardEngine({
    normalizePokemon: pokemonUtils.normalizePokemon,
    getEvolution: pokemonUtils.getEvolution,
    getPokemonTemplateByName: pokemonUtils.getPokemonTemplateByName,
    getPokemonFormDefinition: pokemonUtils.getPokemonFormDefinition,
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
  assert(Array.isArray(gameData.quests), "quests did not load");

  const mappings = speciesMap.species || [];
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
    catalogOnlyPokemon.every(
      (entry) =>
        entry.habitats.length === 0 &&
        entry.times.length === 0 &&
        entry.movesetPolicy === "temporary-default",
    ),
    "a catalog-only Pokemon received an encounter assignment",
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
        template.habitats.length === 0 &&
        template.times.length === 0
      );
    }),
    "an evolution-closure Pokemon is missing or can spawn",
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
  assert(
    alolanVulpix.form?.id === "alolan" &&
      alolanVulpix.types.join(",") === "Ice" &&
      alolanVulpix.imageId === 10103,
    "regional form overrides were not normalized",
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

  const unsupportedRegionalEvolution = rewardEngine.evolvePokemonFromTemplate(
    pokemonUtils.normalizePokemon({
      ...pokemonUtils.getPokemonTemplateByName("Pikachu"),
      level: 12,
      form: {
        id: "legacy-regional",
        name: "Legacy Regional Form",
        category: "regional",
      },
    }),
    { name: "Raichu", level: 12 },
  );
  assert(
    !unsupportedRegionalEvolution.evolved,
    "unsupported regional evolution silently became a normal form",
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
