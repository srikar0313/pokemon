function getAbilityName(ability) {
  if (typeof ability === "string") return ability;
  return ability?.name ? String(ability.name) : null;
}

function getStatusName(status) {
  if (!status || status === "none") return null;
  if (typeof status === "string") return status;
  return status.name ? String(status.name) : null;
}

function toPokemonRow(playerId, pokemon, location, position) {
  return {
    ownedId: String(pokemon.ownedId),
    playerId,
    speciesId: Number(pokemon.speciesId || pokemon.id),
    legacyLocalId: Number.isFinite(Number(pokemon.id)) ? Number(pokemon.id) : null,
    name: String(pokemon.name || "Unknown Pokemon"),
    level: Math.max(1, Number(pokemon.level) || 1),
    xp: Math.max(0, Number(pokemon.xp) || 0),
    currentHp: Math.max(0, Number(pokemon.currentHp) || 0),
    maxHp: Math.max(1, Number(pokemon.maxHp || pokemon.hp) || 1),
    shiny: Boolean(pokemon.shiny),
    formId: pokemon.form?.id ? String(pokemon.form.id) : null,
    abilityName: getAbilityName(pokemon.ability),
    status: getStatusName(pokemon.status),
    moves: Array.isArray(pokemon.moves) ? pokemon.moves : [],
    data: pokemon,
    location,
    partyPosition: location === "PARTY" ? position : null,
    storagePosition: location === "STORAGE" ? position : null,
  };
}

async function loadOwnedPokemon(client, playerId) {
  const rows = await client.playerPokemon.findMany({
    where: { playerId },
    orderBy: [{ location: "asc" }, { partyPosition: "asc" }, { storagePosition: "asc" }],
  });
  const team = [];
  const storage = [];
  rows.forEach((row) => {
    const pokemon = {
      ...(row.data || {}),
      ownedId: row.ownedId,
      id: row.legacyLocalId ?? row.data?.id,
      speciesId: row.speciesId,
      level: row.level,
      xp: row.xp,
      currentHp: row.currentHp,
      maxHp: row.maxHp,
      shiny: row.shiny,
      moves: row.moves,
    };
    if (row.location === "PARTY") team.push(pokemon);
    else storage.push(pokemon);
  });
  return { team, storage };
}

async function saveOwnedPokemon(client, playerId, team = [], storage = []) {
  const allRows = [
    ...team.map((pokemon, index) => toPokemonRow(playerId, pokemon, "PARTY", index)),
    ...storage.map((pokemon, index) =>
      toPokemonRow(playerId, pokemon, "STORAGE", index),
    ),
  ];
  await client.playerPokemon.deleteMany({ where: { playerId } });
  if (allRows.length) await client.playerPokemon.createMany({ data: allRows });
}

module.exports = { loadOwnedPokemon, saveOwnedPokemon, toPokemonRow };
