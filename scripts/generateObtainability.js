const path = require("path");
const { loadJson, saveJson } = require("../backend/dataLoader");
const { buildObtainability } = require("../backend/obtainability");

const rootDir = path.join(__dirname, "..");

function loadInputs() {
  return {
    pokemon: loadJson(path.join(rootDir, "pokemon.json"), []),
    canonicalPokemon: loadJson(
      path.join(rootDir, "data", "pokeapi", "canonical-pokemon.json"),
      { pokemon: [] },
    ),
    speciesMap: loadJson(
      path.join(rootDir, "data", "pokeapi", "species-map.json"),
      { species: [] },
    ),
    evolutions: loadJson(
      path.join(rootDir, "data", "pokeapi", "evolutions.json"),
      { chains: [] },
    ),
    items: loadJson(path.join(rootDir, "data", "items.json"), {}),
    imports: loadJson(
      path.join(rootDir, "data", "pokeapi", "imports.json"),
      { speciesIds: [] },
    ),
  };
}

function getOriginalConfig(inputs) {
  const originalLocalIds = new Set(
    inputs.speciesMap.species
      .filter((mapping) => mapping.existingBeforeExpansion)
      .map((mapping) => mapping.localId),
  );
  return inputs.pokemon
    .filter((pokemon) => originalLocalIds.has(pokemon.id))
    .map((pokemon) => ({
      id: pokemon.id,
      name: pokemon.name,
      habitats: pokemon.habitats || [],
      rarity: pokemon.rarity,
      times: pokemon.times || [],
      baseCatchRate: pokemon.baseCatchRate,
      forms: pokemon.forms || [],
    }))
    .sort((left, right) => left.id - right.id);
}

function main() {
  const inputs = loadInputs();
  const output = buildObtainability(inputs);
  saveJson(path.join(rootDir, "data", "obtainability.json"), output);
  if (process.argv.includes("--write-baseline")) {
    saveJson(
      path.join(rootDir, "data", "pokeapi", "original-134-config.json"),
      getOriginalConfig(inputs),
    );
  }
  console.log(
    `Obtainability: ${output.entries.length} species; ` +
      Object.entries(output.summary).map(([key, value]) => `${key}=${value}`).join(", "),
  );
}

if (require.main === module) main();

module.exports = { getOriginalConfig, loadInputs };
