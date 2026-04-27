const {
  getWarningCount,
  loadGameData,
  logValidationGroups,
  validateGameData,
} = require("../backend/dataLoader");

function main() {
  const gameData = loadGameData({ validate: false });
  const groups = validateGameData(gameData);
  const warningCount = getWarningCount(groups);

  logValidationGroups(groups, "validate");
  console.log(
    `[validate] Checked ${gameData.pokemon.length} Pokemon, ${gameData.gyms.length} gyms, ${gameData.eliteFour.length} Elite Four trainers.`,
  );

  if (warningCount) {
    console.log("[validate] Warnings are informational and do not fail validation yet.");
  }
}

main();
