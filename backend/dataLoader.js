const fs = require("fs");
const path = require("path");

const rootDir = path.join(__dirname, "..");
const dataDir = path.join(rootDir, "data");

function loadJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    console.warn(`[dataLoader] Could not load ${filePath}: ${error.message}`);
    return fallback;
  }
}

function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function validateGameData(gameData) {
  const warnings = [];
  const pokemonNameList = (gameData.pokemon || []).map((pokemon) => pokemon.name);
  const pokemonNames = new Set(pokemonNameList);
  const moveNames = new Set(Object.keys(gameData.moves || {}));
  const getMoveName = (move) => (typeof move === "string" ? move : move?.name);
  pokemonNameList
    .filter((name, index, names) => names.indexOf(name) !== index)
    .forEach((name) => warnings.push(`Duplicate Pokemon name: ${name}`));
  const checkTeam = (label, team = []) => {
    team.forEach((member) => {
      if (!pokemonNames.has(member.name)) {
        warnings.push(`${label} references missing Pokemon: ${member.name}`);
      }
    });
  };

  (gameData.gyms || []).forEach((gym) => checkTeam(`Gym ${gym.name}`, gym.team));
  (gameData.eliteFour || []).forEach((trainer) =>
    checkTeam(`Elite Four ${trainer.name}`, trainer.team),
  );
  checkTeam(`Champion ${gameData.champion?.name || ""}`, gameData.champion?.team);
  (gameData.npcs || []).forEach((npc) => checkTeam(`NPC ${npc.name}`, npc.team));

  (gameData.pokemon || []).forEach((pokemon) => {
    if (!pokemon.moves?.length) warnings.push(`${pokemon.name} has no moves`);
    (pokemon.moves || []).forEach((move) => {
      const moveName = getMoveName(move);
      if (!moveNames.has(moveName)) {
        warnings.push(`${pokemon.name} references missing move: ${moveName}`);
      }
    });
    (pokemon.learnset || []).forEach((entry) => {
      const moveName = getMoveName(entry.move);
      if (!moveNames.has(moveName)) {
        warnings.push(`${pokemon.name} learnset references missing move: ${moveName}`);
      }
    });
    if (!pokemon.type && !pokemon.types?.length) warnings.push(`${pokemon.name} has no type`);
    if (!pokemon.rarity) warnings.push(`${pokemon.name} has no rarity`);
    if (pokemon.baseCatchRate === undefined) {
      warnings.push(`${pokemon.name} has no baseCatchRate`);
    }
  });

  Object.entries(gameData.moves || {}).forEach(([name, move]) => {
    if (!move.type) warnings.push(`${name} has no move type`);
    if (!move.category) warnings.push(`${name} has no move category`);
    if (move.accuracy === undefined) warnings.push(`${name} has no accuracy`);
    if (move.pp === undefined && move.maxPp === undefined) {
      warnings.push(`${name} has no PP`);
    }
  });

  if (warnings.length) {
    console.warn(`[game-data] ${warnings.length} validation warning(s):`);
    warnings.forEach((warning) => console.warn(`- ${warning}`));
  } else {
    console.log("[game-data] Validation passed.");
  }
}

function loadGameData() {
  const eliteData = loadJson(path.join(dataDir, "elite_four.json"), {});
  const npcData = loadJson(path.join(dataDir, "npcs.json"), {});
  const encounterData = loadJson(path.join(dataDir, "encounters.json"), {});
  const areaData = loadJson(path.join(dataDir, "areas.json"), {});
  const gameData = {
    pokemon: loadJson(path.join(rootDir, "pokemon.json"), []),
    moves: loadJson(path.join(dataDir, "moves.json"), {}),
    items: loadJson(path.join(dataDir, "items.json"), {}),
    gyms: loadJson(path.join(dataDir, "gyms.json"), []),
    eliteFour: eliteData.eliteFour || [],
    champion: eliteData.champion || {},
    npcs: npcData.npcs || [],
    npcMaps: npcData.npcMaps || {},
    areas: areaData.areas || [],
    areaUnlocks: areaData.areaUnlocks || {},
    rarityWeights: encounterData.rarityWeights || {},
    weatherBoosts: encounterData.weatherBoosts || {},
  };
  validateGameData(gameData);
  return gameData;
}

module.exports = {
  loadJson,
  saveJson,
  loadGameData,
};
