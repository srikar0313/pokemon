function isValidIndex(index, length) {
  return Number.isInteger(index) && index >= 0 && index < length;
}

function reorderParty(team = [], fromIndex, toIndex) {
  if (!isValidIndex(fromIndex, team.length) || !isValidIndex(toIndex, team.length)) {
    return { error: "Invalid party slot" };
  }
  const reordered = [...team];
  const [pokemon] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, pokemon);
  return { success: true, team: reordered };
}

function sendPartyPokemonToStorage(team = [], storage = [], teamIndex) {
  if (!isValidIndex(teamIndex, team.length)) {
    return { error: "Invalid party Pokemon" };
  }
  if (team.length <= 1) {
    return { error: "Keep at least one Pokemon in your party" };
  }
  const nextTeam = [...team];
  const nextStorage = [...storage];
  const [pokemon] = nextTeam.splice(teamIndex, 1);
  nextStorage.push(pokemon);
  return { success: true, pokemon, team: nextTeam, storage: nextStorage };
}

module.exports = {
  reorderParty,
  sendPartyPokemonToStorage,
};
