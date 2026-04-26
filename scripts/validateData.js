const { loadGameData } = require("../backend/dataLoader");

function validateTeam(label, team, pokemonNames, warnings) {
  (team || []).forEach((member) => {
    if (!pokemonNames.has(member.name)) {
      warnings.push(`${label} references missing Pokemon: ${member.name}`);
    }
  });
}

function validatePokemon(pokemon, warnings) {
  if (!pokemon.name) warnings.push(`Pokemon id ${pokemon.id || "unknown"} has no name`);
  if (!pokemon.type && !pokemon.types?.length) {
    warnings.push(`${pokemon.name || pokemon.id} has no type/types`);
  }
  if (!pokemon.rarity) warnings.push(`${pokemon.name} has no rarity`);
  if (!Array.isArray(pokemon.moves) || pokemon.moves.length === 0) {
    warnings.push(`${pokemon.name} has no moves`);
  }
  if (pokemon.baseCatchRate === undefined) {
    warnings.push(`${pokemon.name} has no baseCatchRate`);
  }
}

function main() {
  const gameData = loadGameData();
  const warnings = [];
  const pokemonNameList = gameData.pokemon.map((pokemon) => pokemon.name);
  const pokemonNames = new Set(pokemonNameList);
  const moveNames = new Set(Object.keys(gameData.moves || {}));
  const getMoveName = (move) => (typeof move === "string" ? move : move?.name);

  pokemonNameList
    .filter((name, index, names) => names.indexOf(name) !== index)
    .forEach((name) => warnings.push(`Duplicate Pokemon name: ${name}`));

  gameData.gyms.forEach((gym) =>
    validateTeam(`Gym ${gym.name}`, gym.team, pokemonNames, warnings),
  );
  gameData.eliteFour.forEach((trainer) =>
    validateTeam(`Elite Four ${trainer.name}`, trainer.team, pokemonNames, warnings),
  );
  validateTeam(
    `Champion ${gameData.champion?.name || ""}`,
    gameData.champion?.team,
    pokemonNames,
    warnings,
  );
  gameData.npcs.forEach((npc) =>
    validateTeam(`NPC ${npc.name}`, npc.team, pokemonNames, warnings),
  );
  gameData.pokemon.forEach((pokemon) => {
    validatePokemon(pokemon, warnings);
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
  });
  Object.entries(gameData.moves || {}).forEach(([name, move]) => {
    if (!move.type) warnings.push(`${name} has no move type`);
    if (!move.category) warnings.push(`${name} has no category`);
    if (move.accuracy === undefined) warnings.push(`${name} has no accuracy`);
    if (move.pp === undefined && move.maxPp === undefined) {
      warnings.push(`${name} has no PP`);
    }
  });

  if (warnings.length) {
    console.warn(`[validate] ${warnings.length} warning(s):`);
    warnings.forEach((warning) => console.warn(`- ${warning}`));
    process.exitCode = 1;
    return;
  }

  console.log(
    `[validate] OK: ${gameData.pokemon.length} Pokemon, ${gameData.gyms.length} gyms, ${gameData.eliteFour.length} Elite Four trainers.`,
  );
}

main();
