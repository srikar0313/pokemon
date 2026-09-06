(function exposePokemonVariantUtils(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PokemonVariantUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createUtils() {
  const artworkRoot =
    "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork";

  function getFormId(pokemon) {
    return pokemon?.form?.id || "normal";
  }

  function getVariantKey(pokemon = {}) {
    return `${pokemon.id || pokemon.name}:${getFormId(pokemon)}:${pokemon.shiny ? "shiny" : "normal"}`;
  }

  function isSameVariant(left = {}, right = {}, includeShiny = true) {
    const sameSpecies =
      left.id && right.id
        ? Number(left.id) === Number(right.id)
        : String(left.name || "").toLowerCase() ===
          String(right.name || "").toLowerCase();
    return (
      sameSpecies &&
      getFormId(left) === getFormId(right) &&
      (!includeShiny || Boolean(left.shiny) === Boolean(right.shiny))
    );
  }

  function getDisplayName(pokemon = {}) {
    const formName = pokemon.form?.name
      ? pokemon.form.name.replace(/\s+Form$/i, "")
      : "";
    return [pokemon.shiny ? "Shiny" : "", formName, pokemon.name || "Pokemon"]
      .filter(Boolean)
      .join(" ");
  }

  function resolvePokemonArtwork(pokemon) {
    if (!pokemon || typeof pokemon !== "object") return null;
    const formArtwork = pokemon.form?.artwork;
    if (pokemon.form) {
      if (pokemon.shiny && formArtwork?.shiny) return formArtwork.shiny;
      if (formArtwork?.normal) return formArtwork.normal;
    }
    if (pokemon.shiny && pokemon.artwork?.shiny) return pokemon.artwork.shiny;
    return pokemon.artwork?.normal || null;
  }

  function getArtworkUrl(pokemon, fallbackImageId) {
    if (!pokemon || typeof pokemon !== "object") {
      return `${artworkRoot}/${pokemon || fallbackImageId}.png`;
    }
    const explicitArtwork = resolvePokemonArtwork(pokemon);
    if (explicitArtwork) return explicitArtwork;

    const imageId = pokemon.shiny
      ? pokemon.form?.shinyImageId || pokemon.shinyImageId ||
        pokemon.form?.imageId || pokemon.imageId || fallbackImageId || pokemon.id
      : pokemon.form?.imageId || pokemon.imageId || fallbackImageId || pokemon.id;
    const shinyFolder = pokemon.shiny ? "/shiny" : "";
    return `${artworkRoot}${shinyFolder}/${imageId}.png`;
  }

  function getNormalArtworkFallback(url) {
    return String(url || "").includes("/official-artwork/shiny/")
      ? String(url).replace("/official-artwork/shiny/", "/official-artwork/")
      : null;
  }

  return {
    getFormId,
    getVariantKey,
    isSameVariant,
    getDisplayName,
    resolvePokemonArtwork,
    getArtworkUrl,
    getNormalArtworkFallback,
  };
});
