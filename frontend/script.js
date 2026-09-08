let activePokemon = null;
let activeInventoryIndex = 0;
let wild = null;
let currentPlayerHP = 0;
let currentWildHP = 0;
let playerStatus = "none";
let wildStatus = "none";
let wildParticipantIndexes = new Set();
let selectedArea = null;
let teamCache = [];
let storageCache = [];
let partyPresetCache = [];
let partyPresetMessage = "";
let activePartyPresetSlot = 1;
let playerState = null;
let shopCatalog = [];
let pokedexCache = null;
let questCache = null;
let handbookCache = null;
let handbookSection = "types";
let handbookSearch = "";
let handbookReturnScreen = "explore";
let handbookRequest = null;
const pokemonImageIdByName = new Map();
let pokedexFilters = {
  status: "all",
  habitat: "all",
  type: "all",
  rarity: "all",
  availability: "all",
  search: "",
};
let pokedexPage = 1;
const POKEDEX_PAGE_SIZE = 48;
let gymCache = [];
let eliteCache = null;
let gymBattle = null;
let eliteBattle = null;
let npcCache = [];
let npcMap = null;
let npcBattle = null;
let npcInteractionPending = false;
let isInBattle = false;
let isSwitching = false;
let wildSwitchForced = false;
let activeScreen = "explore";
let activeOverlay = null;
let pendingSwapStorageIndex = null;
let storageRandomizing = false;
let quickPokemonSelectedIndex = 0;
let quickPokemonDetailIndex = null;
let focusedNpcId = null;
let routeDialogue = null;
let battleActionBusy = false;
let battleBagOpen = false;
let routeEncounterPending = false;
let routeEncounterCooldownSteps = 0;
const evolutionPresentationQueue = [];
let evolutionPresentationActive = false;
let evolutionPresentationHints = [];
const processedEvolutionLineBatches = new WeakSet();
const PARTY_LIMIT = 6;
const STORAGE_PAGE_SIZE = 24;
const ROUTE_ENCOUNTER_CHANCES = {
  grass: 0.12,
  danger: 0.18,
  rare: 0.22,
  path: 0.04,
  camp: 0,
  blocked: 0,
};
const storageUiState = {
  search: "",
  type: "all",
  rarity: "all",
  form: "all",
  shiny: "all",
  sort: "id",
  page: 1,
  detailIndex: null,
};
const areaPlayerPositions = {};
const routeDiscovery = {};
const recentRouteDiscoveries = {};
let lastZoneEventAt = 0;

const icons = {
  standard: "assets/icons/ball-standard.svg",
  great: "assets/icons/ball-great.svg",
  ultra: "assets/icons/ball-ultra.svg",
  master: "assets/icons/ball-master.svg",
  potion: "assets/icons/potion.svg",
  berry: "assets/icons/berry.svg",
  backpack: "assets/icons/backpack.svg",
  heart: "assets/icons/heart.svg",
  xp: "assets/icons/xp.svg",
  evolution: "assets/icons/xp.svg",
  run: "assets/icons/arrow-run.svg",
  burned: "assets/icons/status-burn.svg",
  frozen: "assets/icons/status-freeze.svg",
  poisoned: "assets/icons/status-poison.svg",
  badpoison: "assets/icons/status-poison.svg",
  paralyzed: "assets/icons/status-paralyzed.svg",
  asleep: "assets/icons/status-asleep.svg",
  confused: "assets/icons/status-confused.svg",
  fainted: "assets/icons/status-fainted.svg",
};

const defaultMoves = [
  {
    name: "Tackle",
    type: "Normal",
    category: "Physical",
    power: 40,
    accuracy: 100,
    pp: 35,
  },
  {
    name: "Growl",
    type: "Normal",
    category: "Status",
    power: null,
    accuracy: 100,
    pp: 40,
    effect: "lower_attack",
  },
];

const trainerSprites = {
  player: "https://play.pokemonshowdown.com/sprites/trainers/red.png",
  spark: "https://play.pokemonshowdown.com/sprites/trainers/volkner.png",
  mistyra: "https://play.pokemonshowdown.com/sprites/trainers/misty.png",
  flint: "https://play.pokemonshowdown.com/sprites/trainers/flint.png",
  verdia: "https://play.pokemonshowdown.com/sprites/trainers/erika.png",
  zephyr: "https://play.pokemonshowdown.com/sprites/trainers/falkner.png",
  garnet: "https://play.pokemonshowdown.com/sprites/trainers/brock.png",
  lunara: "https://play.pokemonshowdown.com/sprites/trainers/sabrina.png",
  glacius: "https://play.pokemonshowdown.com/sprites/trainers/pryce.png",
  noctis: "https://play.pokemonshowdown.com/sprites/trainers/grimsley.png",
  pyra: "https://play.pokemonshowdown.com/sprites/trainers/flannery.png",
  marinus: "https://play.pokemonshowdown.com/sprites/trainers/wallace.png",
  drakon: "https://play.pokemonshowdown.com/sprites/trainers/lance.png",
  champion: "https://play.pokemonshowdown.com/sprites/trainers/steven.png",
  trainer: "https://play.pokemonshowdown.com/sprites/trainers/youngster.png",
  guide: "https://play.pokemonshowdown.com/sprites/trainers/oak.png",
  shop: "https://play.pokemonshowdown.com/sprites/trainers/clerk.png",
  healer: "https://play.pokemonshowdown.com/sprites/trainers/nurse.png",
  hiker: "https://play.pokemonshowdown.com/sprites/trainers/hiker.png",
  fisherman: "https://play.pokemonshowdown.com/sprites/trainers/fisherman.png",
  psychic: "https://play.pokemonshowdown.com/sprites/trainers/psychic.png",
  ranger: "https://play.pokemonshowdown.com/sprites/trainers/pokemonranger.png",
  ruinManiac: "https://play.pokemonshowdown.com/sprites/trainers/ruinmaniac.png",
  channeler: "https://play.pokemonshowdown.com/sprites/trainers/channeler-gen3.png",
};

const npcTypeLabels = {
  trainer: "Trainer",
  guide: "Guide",
  shop: "Shop",
  healer: "Healer",
};

const leaderThemes = {
  Electric: { className: "volt", badge: "Volt Badge", icon: "⚡" },
  Water: { className: "aqua", badge: "Aqua Badge", icon: "💧" },
  Fire: { className: "blaze", badge: "Blaze Badge", icon: "🔥" },
  Grass: { className: "forest", badge: "Forest Badge", icon: "🍃" },
  Flying: { className: "storm", badge: "Storm Badge", icon: "🪽" },
  Rock: { className: "rock", badge: "Rock Badge", icon: "🪨" },
  Psychic: { className: "psychic", badge: "Psychic Badge", icon: "🔮" },
  Ice: { className: "ice", badge: "Ice Badge", icon: "❄️" },
  Dark: { className: "shadow", badge: "Night Crest", icon: "🌑" },
  Ghost: { className: "shadow", badge: "Night Crest", icon: "👻" },
  Dragon: { className: "dragon", badge: "Drake Crest", icon: "🐉" },
  Legendary: { className: "champion", badge: "Champion Badge", icon: "👑" },
};

const badgeCollection = [
  { name: "Volt Badge", label: "Volt", icon: "assets/badges/volt.svg" },
  { name: "Aqua Badge", label: "Aqua", icon: "assets/badges/aqua.svg" },
  { name: "Blaze Badge", label: "Blaze", icon: "assets/badges/blaze.svg" },
  { name: "Forest Badge", label: "Forest", icon: "assets/badges/forest.svg" },
  { name: "Storm Badge", label: "Storm", icon: "assets/badges/storm.svg" },
  { name: "Rock Badge", label: "Rock", icon: "assets/badges/rock.svg" },
  { name: "Psychic Badge", label: "Psychic", icon: "assets/badges/psychic.svg" },
  { name: "Ice Badge", label: "Ice", icon: "assets/badges/ice.svg" },
  {
    name: "Champion Badge",
    label: "Champion",
    icon: "assets/badges/champion.svg",
  },
];

async function init() {
  try {
    renderBattlePlaceholder();
    await loadProfile();
    await displayAreas();
    await loadGyms();
    await loadEliteFour();
    await loadPokedex();
    await loadInventory();
    await loadShop();
    await loadQuests();
    setActiveScreen("explore");
  } catch (error) {
    console.error("Error:", error);
  }
}

function setActiveScreen(screen) {
  if (screen !== "battle") closeWildEncounterLayer();
  activeScreen = screen;
  document.querySelectorAll(".screen-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `${screen}-screen`);
  });
  document.querySelectorAll(".nav-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.screen === screen);
  });
  if (screen === "pokedex") loadPokedex();
  if (screen === "quests") loadQuests();
  if (screen === "handbook") loadHandbook();
  if (screen === "battle") focusBattlePresentation();
}

const handbookSections = [
  ["types", "Type Guide"],
  ["moves", "Move Categories"],
  ["status", "Status Effects"],
  ["abilities", "Abilities"],
  ["weather", "Weather"],
  ["catching", "Catching"],
  ["evolution", "Evolution"],
  ["glossary", "Glossary"],
];

async function loadHandbook() {
  const panel = document.getElementById("handbook-panel");
  if (!panel) return;
  if (!handbookCache) {
    panel.innerHTML = '<div class="handbook-empty">Loading Battle Handbook...</div>';
    handbookRequest ||= fetch("/api/handbook")
      .then((response) => {
        if (!response.ok) throw new Error("Could not load Battle Handbook");
        return response.json();
      })
      .then((data) => {
        handbookCache = data;
        return data;
      })
      .finally(() => {
        handbookRequest = null;
      });
    try {
      await handbookRequest;
    } catch (error) {
      panel.innerHTML = `<div class="handbook-empty">${escapeHtml(error.message)}</div>`;
      return;
    }
  }
  renderHandbook();
}

function openHandbook(section = "types") {
  if (activeScreen !== "handbook") handbookReturnScreen = activeScreen;
  if (activeOverlay) closeOverlay();
  handbookSection = handbookSections.some(([id]) => id === section)
    ? section
    : "types";
  handbookSearch = "";
  setActiveScreen("handbook");
}

function returnFromHandbook() {
  if (handbookReturnScreen === "battle") {
    if (wild && isInBattle) return showBattle();
    if (gymBattle?.playerPokemon) return showGymBattle();
    if (eliteBattle?.playerPokemon) return showEliteBattle();
    if (npcBattle?.playerPokemon) return showNpcBattle();
  }
  setActiveScreen(handbookReturnScreen || "explore");
}

function selectHandbookSection(section) {
  handbookSection = section;
  handbookSearch = "";
  renderHandbook();
}

function updateHandbookSearch(value) {
  handbookSearch = value;
  renderHandbookContent();
}

function getFilteredHandbookEntries(entries) {
  return window.HandbookUI?.filterHandbookEntries
    ? window.HandbookUI.filterHandbookEntries(entries, handbookSearch)
    : entries.filter((entry) =>
        JSON.stringify(entry).toLowerCase().includes(handbookSearch.trim().toLowerCase()),
      );
}

function renderHandbookTagList(items, emptyLabel = "None") {
  if (!items?.length) return `<span class="handbook-none">${emptyLabel}</span>`;
  return items.map((item) => `<span class="handbook-tag">${escapeHtml(item)}</span>`).join("");
}

function renderHandbookTypeGuide() {
  const typeChart = handbookCache.typeChart || {};
  const entries = window.HandbookUI?.buildTypeGuide
    ? window.HandbookUI.buildTypeGuide(typeChart)
    : Object.keys(typeChart).map((name) => ({ name }));
  const filtered = getFilteredHandbookEntries(entries);
  const allTypes = Object.keys(typeChart);
  return `
    <div class="handbook-type-grid">
      ${filtered.map((entry) => `
        <article class="handbook-type-card" style="--type-color:${getTypeColor(entry.name)}">
          <h3>${escapeHtml(entry.name)}</h3>
          <dl>
            <dt>Strong against</dt><dd>${renderHandbookTagList(entry.strongAgainst)}</dd>
            <dt>Weak against</dt><dd>${renderHandbookTagList(entry.weakAgainst)}</dd>
            <dt>Resisted by</dt><dd>${renderHandbookTagList(entry.resistedBy)}</dd>
            <dt>No effect against</dt><dd>${renderHandbookTagList(entry.noEffectAgainst)}</dd>
          </dl>
        </article>
      `).join("")}
    </div>
    ${filtered.length ? `
      <details class="handbook-chart-wrap">
        <summary>Simplified attack chart</summary>
        <p>Rows attack columns. Blank cells deal normal damage.</p>
        <div class="handbook-chart-scroll">
          <table class="handbook-type-chart">
            <thead><tr><th>ATK</th>${allTypes.map((type) => `<th title="${type}">${type.slice(0, 3)}</th>`).join("")}</tr></thead>
            <tbody>${allTypes.map((attacker) => `<tr><th>${attacker}</th>${allTypes.map((defender) => {
              const value = window.HandbookUI?.getTypeMultiplier
                ? window.HandbookUI.getTypeMultiplier(typeChart, attacker, defender)
                : typeChart[attacker]?.[defender] ?? 1;
              const label = value === 0 ? "0" : value > 1 ? "2x" : value < 1 ? "1/2" : "";
              return `<td class="chart-${value === 0 ? "immune" : value > 1 ? "strong" : value < 1 ? "weak" : "normal"}" title="${attacker} into ${defender}: ${value}x">${label}</td>`;
            }).join("")}</tr>`).join("")}</tbody>
          </table>
        </div>
      </details>` : '<div class="handbook-empty">No matching types.</div>'}
  `;
}

function renderHandbookMoveCategories() {
  const entries = getFilteredHandbookEntries(handbookCache.moveCategories || []);
  return `<div class="handbook-card-grid">${entries.map((entry) => `
    <article class="handbook-info-card handbook-category-${entry.name.toLowerCase()}">
      <span class="handbook-kicker">${escapeHtml(entry.formula)}</span>
      <h3>${escapeHtml(entry.name)}</h3>
      <p>${escapeHtml(entry.description)}</p>
      ${entry.example ? `<div class="handbook-example"><strong>${escapeHtml(entry.example.name)}</strong><span>${escapeHtml(entry.example.type)} | Power ${entry.example.power ?? "--"} | Accuracy ${entry.example.accuracy ?? 100}</span></div>` : ""}
    </article>`).join("")}</div>${entries.length ? "" : '<div class="handbook-empty">No matching move categories.</div>'}`;
}

function renderHandbookStatuses() {
  const entries = getFilteredHandbookEntries(handbookCache.statuses || []);
  return `<div class="handbook-card-grid">${entries.map((entry) => `
    <article class="handbook-info-card status-${entry.key}">
      <h3>${escapeHtml(entry.name)}</h3><p>${escapeHtml(entry.effect)}</p>
      <div class="handbook-facts"><span>Turn loss: <strong>${escapeHtml(entry.turnLoss)}</strong></span><span>HP loss: <strong>${escapeHtml(entry.hpLoss)}</strong></span><span>Stat effect: <strong>${escapeHtml(entry.statEffect)}</strong></span></div>
    </article>`).join("")}</div>${entries.length ? "" : '<div class="handbook-empty">No matching status effects.</div>'}`;
}

function renderHandbookAbilities() {
  const entries = getFilteredHandbookEntries(handbookCache.abilities || []);
  const groups = [["active", "Active / implemented"], ["partial", "Partially supported"]];
  return `${groups.map(([support, label]) => {
    const group = entries.filter((entry) => entry.support === support);
    return group.length ? `<section class="handbook-group"><h3>${label}</h3><div class="handbook-card-grid compact">${group.map((entry) => `<article class="handbook-info-card"><h4>${escapeHtml(entry.name)}</h4><p>${escapeHtml(entry.description)}</p></article>`).join("")}</div></section>` : "";
  }).join("")}
  ${entries.length ? `<p class="handbook-note"><strong>Display-only:</strong> ${escapeHtml(handbookCache.abilitySummary?.displayOnly || "")}</p>` : '<div class="handbook-empty">No matching abilities.</div>'}`;
}

function renderHandbookWeather() {
  const entries = getFilteredHandbookEntries(handbookCache.weather || []);
  return `<div class="handbook-card-grid">${entries.map((entry) => `<article class="handbook-info-card handbook-weather-${entry.key}"><h3>${escapeHtml(entry.name)}</h3><p>${escapeHtml(entry.effect)}</p><div class="handbook-facts"><span>Boost: <strong>${escapeHtml(entry.boosted.join(", ") || "None")}</strong></span><span>Reduce: <strong>${escapeHtml(entry.reduced.join(", ") || "None")}</strong></span><span>${escapeHtml(entry.passive)}</span></div></article>`).join("")}</div>${entries.length ? "" : '<div class="handbook-empty">No matching weather.</div>'}`;
}

function renderHandbookList(items, heading, note = "") {
  const entries = getFilteredHandbookEntries((items || []).map((text) => ({ text })));
  return `<section class="handbook-list-panel"><h3>${escapeHtml(heading)}</h3><ol>${entries.map((entry) => `<li>${escapeHtml(entry.text)}</li>`).join("")}</ol>${note ? `<p class="handbook-note">${escapeHtml(note)}</p>` : ""}</section>${entries.length ? "" : '<div class="handbook-empty">No matching guidance.</div>'}`;
}

function renderHandbookEvolution() {
  const evolution = handbookCache.evolution || {};
  return renderHandbookList(
    evolution.supportedText,
    "Evolution methods supported by this game",
    evolution.unsupportedText,
  );
}

function renderHandbookGlossary() {
  const entries = getFilteredHandbookEntries(handbookCache.glossary || []);
  return `<div class="handbook-glossary">${entries.map((entry) => `<article><h3>${escapeHtml(entry.term)}</h3><p>${escapeHtml(entry.definition)}</p></article>`).join("")}</div>${entries.length ? "" : '<div class="handbook-empty">No matching battle terms.</div>'}`;
}

function renderHandbookContent() {
  const content = document.getElementById("handbook-content");
  const count = document.getElementById("handbook-search-count");
  if (!content || !handbookCache) return;
  const renderers = {
    types: renderHandbookTypeGuide,
    moves: renderHandbookMoveCategories,
    status: renderHandbookStatuses,
    abilities: renderHandbookAbilities,
    weather: renderHandbookWeather,
    catching: () => renderHandbookList(handbookCache.catching, "Catching tips"),
    evolution: renderHandbookEvolution,
    glossary: renderHandbookGlossary,
  };
  content.innerHTML = (renderers[handbookSection] || renderers.types)();
  if (count) count.textContent = handbookSearch ? `Filtered by "${handbookSearch}"` : "Showing all";
}

function renderHandbook() {
  const panel = document.getElementById("handbook-panel");
  if (!panel || !handbookCache) return;
  panel.innerHTML = `
    <div class="handbook-header">
      <div><span class="handbook-eyebrow">Trainer reference</span><h2>Battle Handbook</h2><p>Quick answers based on this game's current mechanics.</p></div>
      ${handbookReturnScreen === "battle" ? '<button class="secondary-btn" onclick="returnFromHandbook()">Back to Battle</button>' : ""}
    </div>
    <nav class="handbook-tabs" aria-label="Battle Handbook sections">${handbookSections.map(([id, label]) => `<button class="handbook-tab${id === handbookSection ? " active" : ""}" onclick="selectHandbookSection('${id}')">${label}</button>`).join("")}</nav>
    <div class="handbook-tools"><label for="handbook-search">Search this section</label><input id="handbook-search" type="search" value="${escapeHtml(handbookSearch)}" placeholder="Search type, status, ability, or term" oninput="updateHandbookSearch(this.value)"><small id="handbook-search-count">Showing all</small></div>
    <div id="handbook-content" class="handbook-content"></div>
  `;
  renderHandbookContent();
}

function renderBattleHandbookShortcut(section = "moves") {
  return `<button type="button" class="handbook-help-button" onclick="openHandbook('${section}')" title="Open Battle Handbook" aria-label="Open Battle Handbook">?</button>`;
}

function focusBattlePresentation() {
  window.requestAnimationFrame(() => {
    const battleScreen = document.getElementById("battle-screen");
    const battleCard = battleScreen?.querySelector(".battle-screen-card");
    if (!battleScreen || !battleCard) return;
    battleCard.scrollTop = 0;
    if (!battleScreen.classList.contains("wild-encounter-layer")) {
      battleScreen.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  });
}

function openWildEncounterLayer() {
  const battleScreen = document.getElementById("battle-screen");
  battleScreen?.classList.add("active", "wild-encounter-layer");
  document.body.classList.add("wild-encounter-open");
  document.querySelectorAll(".nav-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.screen === activeScreen);
  });
  focusBattlePresentation();
}

function closeWildEncounterLayer() {
  const battleScreen = document.getElementById("battle-screen");
  battleScreen?.classList.remove("wild-encounter-layer");
  if (activeScreen !== "battle") {
    battleScreen?.classList.remove("active");
  }
  document.body.classList.remove("wild-encounter-open");
}

function clearWildEncounterState() {
  endBattlePresentation();
  teamCache.forEach((pokemon) => {
    restorePokemonTransform(pokemon);
    delete pokemon.battleState;
  });
  if (activePokemon) {
    restorePokemonTransform(activePokemon);
    delete activePokemon.battleState;
  }
  wild = null;
  currentWildHP = 0;
  wildStatus = "none";
  wildParticipantIndexes = new Set();
  isInBattle = false;
  isSwitching = false;
  wildSwitchForced = false;
  battleBagOpen = false;
  closeWildEncounterLayer();
}

async function returnToRouteAfterWildBattle(message, delay = 1000) {
  setBattleActionBusy(true);
  if (delay > 0) await wait(delay);
  clearWildEncounterState();
  setBattleActionBusy(false);
  renderBattlePlaceholder(message);
  setActiveScreen("explore");
  renderRouteWorld();
}

function openOverlay(type) {
  if (
    type === "quickPokemon" &&
    (isInBattle || npcBattle || gymBattle || eliteBattle || battleActionBusy)
  ) {
    alert("Quick Pokemon is unavailable during battle.");
    return;
  }
  activeOverlay = type;
  document.getElementById("overlay-backdrop")?.classList.remove("hidden");
  document
    .querySelector(".overlay-card")
    ?.classList.toggle("storage-overlay", type === "storage");
  document
    .getElementById("shop-panel")
    ?.classList.toggle("hidden", type !== "shop");
  document
    .getElementById("center-panel")
    ?.classList.toggle("hidden", type !== "center");
  document
    .getElementById("swap-panel")
    ?.classList.toggle("hidden", type !== "swap");
  document
    .getElementById("storage-panel")
    ?.classList.toggle("hidden", type !== "storage");
  document
    .getElementById("quick-pokemon-panel")
    ?.classList.toggle("hidden", type !== "quickPokemon");
  const title = document.getElementById("overlay-title");
  if (title) {
    title.textContent =
      type === "shop"
        ? "Shop"
        : type === "swap"
          ? "Swap Pokemon"
          : type === "storage"
            ? "PC Storage"
            : type === "quickPokemon"
              ? "Quick Pokemon"
              : "Pokemon Center";
  }
  if (type === "shop") displayShop();
  if (type === "swap") renderSwapPicker();
  if (type === "storage") {
    storageUiState.detailIndex = null;
    partyPresetMessage = "";
    renderStorageBrowser();
  }
  if (type === "quickPokemon") {
    quickPokemonSelectedIndex = activeInventoryIndex;
    quickPokemonDetailIndex = null;
    renderQuickPokemon();
  }
}

function closeOverlay(event) {
  if (event && event.target !== event.currentTarget) return;
  activeOverlay = null;
  pendingSwapStorageIndex = null;
  quickPokemonDetailIndex = null;
  document.getElementById("overlay-backdrop")?.classList.add("hidden");
  document.querySelector(".overlay-card")?.classList.remove("storage-overlay");
}

function renderBattlePlaceholder(
  message = "Choose an area or challenge a gym to start a battle.",
) {
  const encounter = document.getElementById("encounter");
  if (!encounter) return;
  encounter.innerHTML = `
    <div class="battle-placeholder">
      <h2>Battle Screen</h2>
      <p>${message}</p>
    </div>
  `;
}

function normalizeMove(move) {
  const maxPp = move.maxPp ?? move.pp ?? move.currentPp ?? 10;
  return {
    ...move,
    pp: move.pp ?? maxPp,
    maxPp,
    currentPp: Math.min(move.currentPp ?? maxPp, maxPp),
    accuracy: move.accuracy ?? 100,
    category: move.category || "Physical",
  };
}

function normalizePokemon(pokemon) {
  const transform = pokemon?.battleState?.transform;
  if (transform?.active && transform.copied) {
    pokemon = {
      ...pokemon,
      ...transform.copied,
      id: pokemon.id,
      speciesId: pokemon.speciesId,
      ownedId: pokemon.ownedId,
      currentHp: pokemon.currentHp,
      maxHp: pokemon.maxHp,
      status: pokemon.status,
      shiny: pokemon.shiny,
      battleState: pokemon.battleState,
    };
  }
  const resolvedImageId =
    pokemon.imageId || pokemonImageIdByName.get(pokemon.name) || pokemon.id;
  const types =
    Array.isArray(pokemon.types) && pokemon.types.length > 0
      ? pokemon.types
      : [pokemon.type || "Normal"];
  const moves =
    Array.isArray(pokemon.moves) && pokemon.moves.length > 0
      ? pokemon.moves
      : defaultMoves;

  const maxHp = pokemon.maxHp || pokemon.hp || 1;
  const currentHp = Math.max(
    0,
    Math.min(pokemon.currentHp ?? maxHp, maxHp),
  );

  return {
    ...pokemon,
    imageId: resolvedImageId,
    type: pokemon.type || types[0],
    types,
    level: pokemon.level || 1,
    xp: pokemon.xp || 0,
    maxHp,
    currentHp,
    specialAttack: pokemon.specialAttack ?? pokemon.attack ?? 1,
    specialDefense: pokemon.specialDefense ?? pokemon.defense ?? 1,
    status: pokemon.status || "none",
    shiny: Boolean(pokemon.shiny),
    form: pokemon.form?.id ? pokemon.form : null,
    moves: moves.map(normalizeMove),
  };
}

function restorePokemonTransform(pokemon) {
  const transformOriginal = pokemon?.battleState?.transform?.original;
  if (!transformOriginal) return pokemon;
  Object.entries(transformOriginal).forEach(([field, value]) => {
    if (value === null) delete pokemon[field];
    else pokemon[field] = JSON.parse(JSON.stringify(value));
  });
  return pokemon;
}

function getPokemonDisplayName(pokemon) {
  if (window.PokemonVariantUtils) {
    return window.PokemonVariantUtils.getDisplayName(pokemon);
  }
  const formName = pokemon?.form?.name
    ? pokemon.form.name.replace(/\s+Form$/i, "")
    : "";
  return [pokemon?.shiny ? "Shiny" : "", formName, pokemon?.name || "Pokemon"]
    .filter(Boolean)
    .join(" ");
}

function renderVariantBadges(pokemon) {
  return `
    ${pokemon?.shiny ? '<span class="variant-badge shiny-variant">SHINY</span>' : ""}
    ${pokemon?.form ? `<span class="variant-badge form-variant">${escapeHtml(pokemon.form.name || `${pokemon.form.id} Form`)}</span>` : ""}
  `;
}

function getXpNeeded(pokemon) {
  const level = Math.max(1, pokemon?.level || 1);
  const currentTotal = level ** 3;
  const nextTotal = (level + 1) ** 3;
  return Math.max(50, Math.floor((nextTotal - currentTotal) * 1.2));
}

function renderXpBar(pokemon) {
  const needed = getXpNeeded(pokemon);
  const current = pokemon?.xp || 0;
  const percent = Math.max(0, Math.min(100, (current / needed) * 100));
  return `
    <div class="xp-meter">
      <div class="xp-meter-head">
        <span>${renderIcon("xp", "XP")} XP</span>
        <strong>${current}/${needed}</strong>
      </div>
      <div class="xp-bar"><div class="xp-fill" style="width: ${percent}%"></div></div>
    </div>
  `;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function prefersReducedMotion() {
  return Boolean(
    window.BattlePresentation?.reducedMotion ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches,
  );
}

function getMoveFromPokemon(pokemon, moveName) {
  return (pokemon?.moves || []).find((move) => move.name === moveName) || null;
}

function setBattleActionBusy(isBusy) {
  battleActionBusy = isBusy;
  document
    .querySelectorAll(
      ".move-btn, .battle-action-row button, .battle-bag button, .gym-switch-buttons button, .wild-switch-panel button, .catch-options button, .handbook-help-button",
    )
    .forEach((button) => {
      button.disabled = isBusy || button.dataset.locked === "true";
      button.classList.toggle("busy", isBusy);
    });
}

function getBattleSide(side) {
  return document.querySelector(`.battle-pokemon.${side}-side`);
}

function getBattlePresentation() {
  return window.BattlePresentation || null;
}

function runBattlePresentation(method, ...args) {
  const presentation = getBattlePresentation();
  if (typeof presentation?.[method] !== "function") return Promise.resolve(null);
  try {
    return Promise.resolve(presentation[method](...args)).catch((error) => {
      console.warn(`Battle presentation ${method} failed; continuing with CSS.`, error);
      return null;
    });
  } catch (error) {
    console.warn(`Battle presentation ${method} failed; continuing with CSS.`, error);
    return Promise.resolve(null);
  }
}

function mountBattlePresentation(kind, player, opponent, weather = "clear") {
  const container = document.querySelector("#battle-screen .battle-container");
  if (!container) return;
  runBattlePresentation("mount", { container, kind, weather, player, opponent });
}

function presentBattleArena(kind, player, opponent, weather = "clear", lines = []) {
  mountBattlePresentation(kind, player, opponent, weather);
  showAbilityAnnouncements(lines, player, opponent);
}

function refreshCurrentBattlePresentation() {
  if (wild && isInBattle) {
    mountBattlePresentation("wild", activePokemon, wild, wild.weather);
  } else if (gymBattle?.playerPokemon && gymBattle?.gymPokemon) {
    mountBattlePresentation("gym", gymBattle.playerPokemon, gymBattle.gymPokemon);
  } else if (eliteBattle?.playerPokemon && eliteBattle?.opponentPokemon) {
    mountBattlePresentation(
      eliteBattle.isChampion ? "champion" : "elite",
      eliteBattle.playerPokemon,
      eliteBattle.opponentPokemon,
    );
  } else if (npcBattle?.playerPokemon && npcBattle?.opponentPokemon) {
    mountBattlePresentation("npc", npcBattle.playerPokemon, npcBattle.opponentPokemon);
  }
}

function endBattlePresentation() {
  runBattlePresentation("endBattle");
}

function showFloatingBattleText(side, text, tone = "neutral") {
  const target = getBattleSide(side);
  if (!target || !text) return;
  const bubble = document.createElement("span");
  bubble.className = `floating-battle-text floating-${tone}`;
  bubble.textContent = text;
  target.appendChild(bubble);
  setTimeout(() => bubble.remove(), prefersReducedMotion() ? 900 : 1300);
}

function showTypeEffect(side, type = "Normal") {
  const target = getBattleSide(side);
  if (!target || prefersReducedMotion()) return;
  const effect = document.createElement("span");
  effect.className = `type-burst type-burst-${String(type || "Normal").toLowerCase()}`;
  target.appendChild(effect);
  setTimeout(() => effect.remove(), 650);
}

async function animateAttack(side, moveOrType = "Normal") {
  const move =
    typeof moveOrType === "string"
      ? { name: "Attack", type: moveOrType, category: "Physical" }
      : moveOrType || { name: "Attack", type: "Normal", category: "Physical" };
  const presentation = runBattlePresentation("playMove", side, move);
  if (prefersReducedMotion()) {
    await presentation;
    if (move.category !== "Status") {
      showTypeEffect(side === "player" ? "opponent" : "player", move.type);
    }
    return;
  }
  const attacker = getBattleSide(side);
  const defenderSide = side === "player" ? "opponent" : "player";
  const defender = getBattleSide(defenderSide);
  if (!attacker || !defender) return;
  attacker.classList.add(side === "player" ? "attack-forward" : "attack-backward");
  await Promise.all([wait(190), presentation]);
  attacker.classList.remove("attack-forward", "attack-backward");
  if (move.category !== "Status") showTypeEffect(defenderSide, move.type);
}

async function animateHit(side, feedback = {}) {
  const presentation = runBattlePresentation("hit", side, {
    heavy: feedback.damage >= 30,
    critical: feedback.critical,
    effectiveness: feedback.effectiveness,
  });
  const defender = getBattleSide(side);
  if (!defender || prefersReducedMotion()) {
    await presentation;
    return;
  }
  if (typeof getBattlePresentation()?.hit === "function") {
    await presentation;
    return;
  }
  defender.classList.add("hit-shake", "hit-flash");
  await wait(230);
  defender.classList.remove("hit-shake", "hit-flash");
}

function animateHpChange(side, before, after, maxHp) {
  const fill = getBattleSide(side)?.querySelector(".hp-fill");
  if (!fill) return;
  fill.style.width = `${getHpPercent(before, maxHp)}%`;
  requestAnimationFrame(() => {
    fill.style.width = `${getHpPercent(after, maxHp)}%`;
  });
}

async function animateFaint(side) {
  const presentation = runBattlePresentation("faint", side);
  const target = getBattleSide(side);
  if (!target || prefersReducedMotion()) {
    await presentation;
    return;
  }
  target.classList.add("fainting");
  await Promise.all([wait(560), presentation]);
}

async function animatePokemonSwitch(side, pokemon = {}) {
  const presentation = runBattlePresentation("switchPokemon", side, pokemon);
  const target = getBattleSide(side);
  if (!target || prefersReducedMotion()) {
    await presentation;
    return;
  }
  target.classList.add("send-out");
  await Promise.all([wait(260), presentation]);
  target.classList.remove("send-out");
}

function getStatusFeedback(before, after) {
  if (after && after !== "none" && after !== before) return formatStatus(after).toUpperCase();
  return "";
}

function getMoveFromLog(pokemon, lines = []) {
  const moves = pokemon?.moves || [];
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index] || "";
    if (!/ used /i.test(line)) continue;
    const move = moves.find((entry) =>
      new RegExp(`\\bused\\s+${escapeRegExp(entry.name)}!?`, "i").test(line),
    );
    if (move) return move;
  }
  return null;
}

function getMoveTypeFromLog(pokemon, lines = []) {
  return getMoveFromLog(pokemon, lines)?.type || "Normal";
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getBattleLogEvents(lines = [], playerPokemon, opponentPokemon) {
  const events = [];
  let currentSide = null;
  const playerName = escapeRegExp(playerPokemon?.name || "");
  const opponentName = escapeRegExp(opponentPokemon?.name || "");
  lines.forEach((line) => {
    if (/ used /i.test(line)) {
      const namesMatch =
        playerPokemon?.name && playerPokemon.name === opponentPokemon?.name;
      if (namesMatch) {
        const playerMove = getMoveFromLog(playerPokemon, [line]);
        const opponentMove = getMoveFromLog(opponentPokemon, [line]);
        if (playerMove && !opponentMove) currentSide = "player";
        else if (opponentMove && !playerMove) currentSide = "opponent";
        else currentSide = currentSide === "player" ? "opponent" : "player";
      } else if (
        playerName &&
        new RegExp(`\\b${playerName}\\b.* used `, "i").test(line)
      ) {
        currentSide = "player";
      } else if (
        opponentName &&
        new RegExp(`\\b${opponentName}\\b.* used `, "i").test(line)
      ) {
        currentSide = "opponent";
      } else {
        currentSide = currentSide === "player" ? "opponent" : "player";
      }
      events.push({ side: currentSide, line });
      return;
    }
    if (currentSide) events.push({ side: currentSide, line });
  });
  return events;
}

function getAttackFeedback(lines, playerPokemon, opponentPokemon, attackSide) {
  const feedback = { critical: false, effectiveness: 1 };
  getBattleLogEvents(lines, playerPokemon, opponentPokemon)
    .filter(({ side }) => side === attackSide)
    .forEach(({ line }) => {
      if (/critical hit/i.test(line)) feedback.critical = true;
      if (/super effective/i.test(line)) feedback.effectiveness = 2;
      if (/not very effective/i.test(line)) feedback.effectiveness = 0.5;
      if (/no effect/i.test(line)) feedback.effectiveness = 0;
    });
  return feedback;
}

function showAbilityAnnouncements(lines = [], playerPokemon, opponentPokemon) {
  const abilities = [
    { side: "player", name: formatAbilityName(playerPokemon?.ability) },
    { side: "opponent", name: formatAbilityName(opponentPokemon?.ability) },
  ].filter((entry) => entry.name && entry.name !== "Unknown");
  lines.forEach((line) => {
    abilities.forEach(({ side, name }) => {
      if (
        new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(line) &&
        /(absorbed|blocked|prevented|lowered|raised|activated)/i.test(line)
      ) {
        runBattlePresentation("announceAbility", side, name);
      }
    });
  });
}

function showBattleLogFeedback(
  lines = [],
  playerPokemon,
  opponentPokemon,
  attackSide = null,
) {
  getBattleLogEvents(lines, playerPokemon, opponentPokemon).forEach(({ side, line }) => {
    if (attackSide && side !== attackSide) return;
    const target = side === "player" ? "opponent" : "player";
    if (/super effective/i.test(line)) showFloatingBattleText(target, "SUPER EFFECTIVE!", "effective");
    if (/not very effective/i.test(line)) showFloatingBattleText(target, "Not very effective...", "weak");
    if (/no effect/i.test(line)) showFloatingBattleText(target, "No effect!", "immune");
    if (/critical hit/i.test(line)) showFloatingBattleText(target, "CRITICAL HIT!", "critical");
    if (/attack missed|but it missed/i.test(line)) showFloatingBattleText(target, "MISS", "weak");
    if (/protected itself|was protected/i.test(line)) showFloatingBattleText(target, "PROTECTED", "immune");
    if (/flinched(?: and could not move)?/i.test(line)) showFloatingBattleText(side, "FLINCHED", "weak");
  });
}

async function playBattleTurnAnimation({
  lines = [],
  playerBeforeHp,
  playerAfterHp,
  playerMaxHp,
  opponentBeforeHp,
  opponentAfterHp,
  opponentMaxHp,
  playerStatusBefore = "none",
  playerStatusAfter = "none",
  opponentStatusBefore = "none",
  opponentStatusAfter = "none",
  playerMoveType = "Normal",
  opponentMoveType = "Normal",
  playerMove = null,
  opponentMove = null,
  playerPokemon = null,
  opponentPokemon = null,
  turnMetadata = null,
} = {}) {
  showAbilityAnnouncements(lines, playerPokemon, opponentPokemon);

  const opponentDamage = Math.max(0, (opponentBeforeHp || 0) - (opponentAfterHp || 0));
  const playerDamage = Math.max(0, (playerBeforeHp || 0) - (playerAfterHp || 0));
  const events = getBattleLogEvents(lines, playerPokemon, opponentPokemon);
  const playerActed = events.some(({ side, line }) => side === "player" && / used /i.test(line));
  const opponentActed = events.some(({ side, line }) => side === "opponent" && / used /i.test(line));
  const playerTurn = turnMetadata?.turns?.find((turn) => turn.side === "player");
  const opponentTurn = turnMetadata?.turns?.find((turn) => turn.side === "opponent");
  const playerLogFeedback = getAttackFeedback(lines, playerPokemon, opponentPokemon, "player");
  const opponentLogFeedback = getAttackFeedback(lines, playerPokemon, opponentPokemon, "opponent");
  const playerFeedback = {
    critical: playerTurn?.critical ?? playerLogFeedback.critical,
    effectiveness: playerTurn?.effectiveness ?? playerLogFeedback.effectiveness,
    damage: playerTurn?.damage ?? opponentDamage,
    maxHp: opponentMaxHp,
  };
  const opponentFeedback = {
    critical: opponentTurn?.critical ?? opponentLogFeedback.critical,
    effectiveness: opponentTurn?.effectiveness ?? opponentLogFeedback.effectiveness,
    damage: opponentTurn?.damage ?? playerDamage,
    maxHp: playerMaxHp,
  };
  const getVolatileStatusAfter = (targetSide, pokemonBefore) => {
    const targetName = pokemonBefore?.name ? escapeRegExp(pokemonBefore.name) : "";
    if (
      targetName &&
      lines.some((line) => new RegExp(`\\b${targetName}\\b.*snapped out of confusion`, "i").test(line))
    ) {
      return null;
    }
    for (const [actingSide, turn] of [["player", playerTurn], ["opponent", opponentTurn]]) {
      const effect = (turn?.effects || []).find((entry) => {
        if (entry.type !== "volatileStatus" || entry.status !== "confused") return false;
        const affectedSide = entry.target === "self"
          ? actingSide
          : actingSide === "player" ? "opponent" : "player";
        return affectedSide === targetSide;
      });
      if (effect) return effect.status;
    }
    return pokemonBefore?.battleState?.volatile?.confusionTurns > 0
      ? "confused"
      : null;
  };

  const animatePlayerAction = async () => {
    if (opponentDamage > 0 || playerActed) {
      await animateAttack(
        "player",
        playerMove || { name: "Attack", type: playerMoveType, category: "Physical" },
      );
    }
    if (opponentDamage > 0 || (playerActed && playerFeedback.effectiveness === 0)) {
      if (opponentDamage > 0) {
        showFloatingBattleText("opponent", `-${opponentDamage}`, "damage");
        animateHpChange("opponent", opponentBeforeHp, opponentAfterHp, opponentMaxHp);
      }
      await animateHit("opponent", playerFeedback);
    }
    runBattlePresentation("showTurnMetadata", "player", playerTurn || {});
    showBattleLogFeedback(lines, playerPokemon, opponentPokemon, "player");
    const statusText = getStatusFeedback(opponentStatusBefore, opponentStatusAfter);
    if (statusText) {
      showFloatingBattleText("opponent", statusText, "status");
      runBattlePresentation("playStatus");
    }
  };

  const animateOpponentAction = async () => {
    if (playerDamage > 0 || opponentActed) {
      await animateAttack(
        "opponent",
        opponentMove || { name: "Attack", type: opponentMoveType, category: "Physical" },
      );
    }
    if (playerDamage > 0 || (opponentActed && opponentFeedback.effectiveness === 0)) {
      if (playerDamage > 0) {
        showFloatingBattleText("player", `-${playerDamage}`, "damage");
        animateHpChange("player", playerBeforeHp, playerAfterHp, playerMaxHp);
      }
      await animateHit("player", opponentFeedback);
    }
    runBattlePresentation("showTurnMetadata", "opponent", opponentTurn || {});
    showBattleLogFeedback(lines, playerPokemon, opponentPokemon, "opponent");
    const statusText = getStatusFeedback(playerStatusBefore, playerStatusAfter);
    if (statusText) {
      showFloatingBattleText("player", statusText, "status");
      runBattlePresentation("playStatus");
    }
  };

  const resolvedOrder = (turnMetadata?.order || []).filter((side, index, order) =>
    ["player", "opponent"].includes(side) && order.indexOf(side) === index,
  );
  if (resolvedOrder[0] === "opponent") {
    await animateOpponentAction();
    await animatePlayerAction();
  } else {
    await animatePlayerAction();
    await animateOpponentAction();
  }
  if (playerAfterHp > playerBeforeHp || opponentAfterHp > opponentBeforeHp) {
    runBattlePresentation("playHealing");
  }
  runBattlePresentation(
    "setStatus",
    "player",
    playerStatusAfter !== "none"
      ? playerStatusAfter
      : getVolatileStatusAfter("player", playerPokemon) || "none",
  );
  runBattlePresentation(
    "setStatus",
    "opponent",
    opponentStatusAfter !== "none"
      ? opponentStatusAfter
      : getVolatileStatusAfter("opponent", opponentPokemon) || "none",
  );

  if ((opponentAfterHp || 0) <= 0 && opponentBeforeHp > 0) await animateFaint("opponent");
  if ((playerAfterHp || 0) <= 0 && playerBeforeHp > 0) await animateFaint("player");
  await wait(prefersReducedMotion() ? 80 : 180);
}

function getPokemonFromTeamSlot(team = [], index, fallback = null) {
  return normalizePokemon(team[index] || fallback || {});
}

function logMentionsFaint(lines = [], pokemon) {
  if (!pokemon?.name) return false;
  const name = escapeRegExp(pokemon.name);
  return lines.some((line) => new RegExp(`\\b${name}\\b.*fainted`, "i").test(line));
}

function isSameBattlePokemon(left, right) {
  if (!left || !right) return false;
  return (
    left.id === right.id &&
    left.name === right.name &&
    (left.level || 1) === (right.level || 1)
  );
}

function getPreviousPokemonAfterTurn(team = [], index, fallback, previousPokemon, lines = []) {
  const candidate = getPokemonFromTeamSlot(team, index, fallback);
  if (isSameBattlePokemon(previousPokemon, candidate)) return candidate;
  const movedCandidate = (team || []).map(normalizePokemon).find((pokemon) =>
    isSameBattlePokemon(previousPokemon, pokemon),
  );
  if (movedCandidate) return movedCandidate;
  if (
    previousPokemon?.name &&
    logMentionsFaint(lines, previousPokemon) &&
    hasBattlePokemonChanged(previousPokemon, candidate)
  ) {
    return {
      ...previousPokemon,
      currentHp: 0,
    };
  }
  return candidate;
}

function hasBattlePokemonChanged(previousPokemon, nextPokemon) {
  if (!previousPokemon || !nextPokemon) return false;
  return (
    previousPokemon.id !== nextPokemon.id ||
    previousPokemon.name !== nextPokemon.name ||
    previousPokemon.level !== nextPokemon.level
  );
}

async function playTrainerBattleTransition({
  previousState,
  nextState,
  lines = [],
  moveName,
  action = "move",
  pokemonIndex = null,
  opponentField,
  opponentTeamField,
  opponentIndexField,
  renderBattle,
  renderResult,
  assignState,
  won = false,
  lost = false,
  afterFinal,
  afterContinue,
}) {
  const isVoluntarySwitch =
    action === "switch" && Number.isInteger(Number(pokemonIndex));
  const previousPlayerIndex = isVoluntarySwitch
    ? Number(pokemonIndex)
    : (previousState.playerIndex ?? 0);
  const playerBefore = normalizePokemon(
    isVoluntarySwitch
      ? previousState.playerTeam?.[previousPlayerIndex]
      : previousState.playerPokemon,
  );
  const opponentBefore = normalizePokemon(previousState[opponentField]);
  const playerMove = getMoveFromPokemon(playerBefore, moveName);
  const previousOpponentIndex = previousState[opponentIndexField] ?? 0;

  if (isVoluntarySwitch) {
    assignState({
      ...previousState,
      playerIndex: previousPlayerIndex,
      playerPokemon: playerBefore,
    });
    renderBattle([]);
    await animatePokemonSwitch("player", playerBefore);
  }

  const oldPlayerAfter = getPreviousPokemonAfterTurn(
    nextState.playerTeam,
    previousPlayerIndex,
    nextState.playerPokemon,
    playerBefore,
    lines,
  );
  const oldOpponentAfter = getPreviousPokemonAfterTurn(
    nextState[opponentTeamField],
    previousOpponentIndex,
    nextState[opponentField],
    opponentBefore,
    lines,
  );
  const opponentMoveType = getMoveTypeFromLog(opponentBefore, lines);
  const opponentMove = getMoveFromLog(opponentBefore, lines);

  await playBattleTurnAnimation({
    lines,
    playerBeforeHp: playerBefore.currentHp,
    playerAfterHp: oldPlayerAfter.currentHp,
    playerMaxHp: oldPlayerAfter.maxHp || playerBefore.maxHp,
    opponentBeforeHp: opponentBefore.currentHp,
    opponentAfterHp: oldOpponentAfter.currentHp,
    opponentMaxHp: oldOpponentAfter.maxHp || opponentBefore.maxHp,
    playerStatusBefore: playerBefore.status || "none",
    playerStatusAfter: oldPlayerAfter.status || "none",
    opponentStatusBefore: opponentBefore.status || "none",
    opponentStatusAfter: oldOpponentAfter.status || "none",
    playerMoveType: playerMove?.type || "Normal",
    opponentMoveType,
    playerMove,
    opponentMove,
    playerPokemon: playerBefore,
    opponentPokemon: opponentBefore,
    turnMetadata: nextState.turnMetadata,
  });

  if (won || lost) {
    assignState(nextState);
    setBattleActionBusy(false);
    renderResult(lines);
    if (afterFinal) await afterFinal();
    return;
  }

  const playerIndexChanged = nextState.playerIndex !== previousPlayerIndex;
  const opponentIndexChanged =
    nextState[opponentIndexField] !== previousState[opponentIndexField] ||
    hasBattlePokemonChanged(opponentBefore, nextState[opponentField]);

  assignState(nextState);
  renderBattle([]);
  if (opponentIndexChanged) {
    await animatePokemonSwitch("opponent", nextState[opponentField]);
  }
  if (playerIndexChanged) await animatePokemonSwitch("player", nextState.playerPokemon);
  appendBattleLog(lines);
  setBattleActionBusy(false);
  if (afterContinue) await afterContinue();
}

function renderMoveDetails(pokemon) {
  return `
    <div class="pokemon-moves">
      <h4>Moves</h4>
      <div class="moves-grid">
        ${(pokemon.moves || [])
          .map(
            (move) => `
              <div class="move-summary" style="border-color: ${getTypeColor(move.type)}">
                <strong>${move.name}</strong>
                <span>${renderTypeBadges([move.type])} ${move.category}</span>
                <span>Power ${move.power ?? 0} | Accuracy ${move.accuracy ?? 100}</span>
                <span>PP ${move.currentPp}/${move.maxPp ?? move.pp}</span>
              </div>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function formatAbilityName(ability) {
  const name = typeof ability === "string" ? ability : ability?.name;
  return String(name || "Unknown")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getMovePreviewEffectiveness(move, opponent) {
  if (!opponent || move.category === "Status" || Number(move.power || 0) <= 0) {
    return 1;
  }
  const ability = String(
    typeof opponent.ability === "string"
      ? opponent.ability
      : opponent.ability?.name || "",
  ).toLowerCase();
  const immunityTypes = {
    levitate: "Ground",
    "water-absorb": "Water",
    "volt-absorb": "Electric",
    "dry-skin": "Water",
    "flash-fire": "Fire",
    "lightning-rod": "Electric",
    "motor-drive": "Electric",
    "sap-sipper": "Grass",
  };
  if (immunityTypes[ability] === move.type) return 0;
  return getCombinedTypeEffectiveness(move.type, opponent.types || [opponent.type]);
}

function getTacticalMoveData(move, opponent) {
  const effectiveness = getMovePreviewEffectiveness(move, opponent);
  if (window.BattleTacticalUI?.getMoveDisplayData) {
    return window.BattleTacticalUI.getMoveDisplayData(move, effectiveness);
  }
  const maxPp = move.maxPp ?? move.pp ?? 0;
  return {
    ...move,
    currentPp: move.currentPp ?? maxPp,
    maxPp,
    priority: Number(move.priority || 0),
    categoryKey: String(move.category || "Physical").toLowerCase(),
    effectiveness: null,
    effectDescription: "No additional effect.",
  };
}

function createBattleMoveButton(move, opponent, onUse, disabled = false) {
  const data = getTacticalMoveData(move, opponent);
  const button = document.createElement("button");
  button.className = `move-btn tactical-move-card move-type-${String(data.type).toLowerCase()} category-${data.categoryKey}`;
  button.style.setProperty("--move-color", getTypeColor(data.type));
  const priority = data.priority
    ? `<span class="move-priority">Priority ${data.priority > 0 ? "+" : ""}${data.priority}</span>`
    : "";
  const effectiveness = data.effectiveness
    ? `<span class="move-effectiveness effect-${data.effectiveness.key}">${data.effectiveness.label}</span>`
    : "";
  const power = data.category === "Status" ? "--" : data.power;
  const tooltip = `${data.name}. ${data.type} ${data.category}. Power ${power}. Accuracy ${data.accuracy}. PP ${data.currentPp} of ${data.maxPp}. Priority ${data.priority}. ${data.effectDescription}`;
  button.setAttribute("aria-label", tooltip);
  button.title = tooltip;
  button.innerHTML = `
    <span class="move-card-head">
      <strong>${escapeHtml(data.name)}</strong>
      <span class="move-type-chip">${escapeHtml(data.type)}</span>
    </span>
    <span class="move-card-meta">
      <span class="move-category category-${data.categoryKey}">${escapeHtml(data.category)}</span>
      <span>PP <strong>${data.currentPp}/${data.maxPp}</strong></span>
    </span>
    <span class="move-card-stats">
      <span>POW <strong>${power}</strong></span>
      <span>ACC <strong>${data.accuracy}</strong></span>
      ${priority}
    </span>
    ${effectiveness}
    <span class="move-detail-tooltip" role="tooltip">${escapeHtml(data.effectDescription)}</span>
  `;
  button.disabled = battleActionBusy || disabled || data.currentPp <= 0;
  button.onclick = () => onUse(move.name);
  return button;
}

function renderBattleTacticalHud(pokemon) {
  const tactical = window.BattleTacticalUI;
  const ability = tactical?.getCurrentBattleAbility
    ? tactical.getCurrentBattleAbility(pokemon)
    : { label: formatAbilityName(pokemon.ability), copied: false };
  const stages = tactical?.getStageBadges
    ? tactical.getStageBadges(pokemon)
    : [];
  const conditions = tactical?.getBattleConditions
    ? tactical.getBattleConditions(pokemon)
    : [];
  return `
    <div class="battle-tactical-hud">
      <div class="battle-ability" title="Current battle ability">
        <span>Ability</span>
        <strong>${escapeHtml(ability.label)}</strong>
        ${ability.copied ? '<small>Copied</small>' : ""}
      </div>
      ${conditions.length ? `<div class="battle-condition-row">${conditions.map((condition) => `<span class="battle-condition condition-${condition.key}">${escapeHtml(condition.label)}</span>`).join("")}</div>` : ""}
      ${stages.length ? `<div class="battle-stage-row" aria-label="Temporary stat stages">${stages.map((stage) => `<span class="battle-stage stage-${stage.direction}">${stage.text}</span>`).join("")}</div>` : ""}
    </div>
  `;
}

function renderBattleWeatherHud(weather = "clear") {
  const data = window.BattleTacticalUI?.getWeatherDisplay
    ? window.BattleTacticalUI.getWeatherDisplay(weather)
    : { key: weather, icon: "--", label: formatStatus(weather), description: "Current battle weather." };
  if (data.key === "clear") return "";
  return `
    <button type="button" class="battle-weather-hud weather-${data.key}" title="${escapeHtml(data.description)}" onclick="this.classList.toggle('expanded')" aria-label="${escapeHtml(`${data.label}: ${data.description}`)}">
      <span aria-hidden="true">${data.icon}</span><strong>${data.label}</strong><small>${escapeHtml(data.description)}</small>
    </button>
  `;
}

function renderLearnsetDetails(pokemon) {
  const learnset = pokemon.learnset || [];
  if (!learnset.length) return "";
  return `
    <details class="learnset-panel">
      <summary>Level-up moves (${learnset.length})</summary>
      <div class="learnset-list">
        ${learnset
          .map(
            (entry) => `<span><strong>Lv${entry.level}</strong> ${escapeHtml(typeof entry.move === "string" ? entry.move : entry.move?.name)}</span>`,
          )
          .join("")}
      </div>
      ${pokemon.learnsetVersionGroup ? `<small>Source: ${escapeHtml(pokemon.learnsetVersionGroup)}</small>` : ""}
    </details>
  `;
}

function renderPokemonStatBars(pokemon) {
  const stats = [
    ["HP", pokemon.maxHp || pokemon.hp || 1],
    ["ATK", pokemon.attack || 1],
    ["DEF", pokemon.defense || 1],
    ["SP.ATK", pokemon.specialAttack || pokemon.attack || 1],
    ["SP.DEF", pokemon.specialDefense || pokemon.defense || 1],
    ["SPD", pokemon.speed || Math.round(((pokemon.attack || 1) + (pokemon.specialAttack || pokemon.attack || 1)) / 2)],
  ];
  const maxStat = Math.max(120, ...stats.map(([, value]) => value));
  return `
    <div class="stat-panel">
      <h4>Stats</h4>
      ${stats
        .map(([label, value]) => `
          <div class="stat-row">
            <span>${label}</span>
            <div class="stat-track"><div style="width: ${Math.min(100, (value / maxStat) * 100)}%"></div></div>
            <strong>${value}</strong>
          </div>
        `)
        .join("")}
    </div>
  `;
}

function getEvolutionItemBySlug(itemSlug) {
  return shopCatalog.find((item) => item.evolutionItem === itemSlug) || null;
}

function renderEvolutionRequirementOption(requirement) {
  const unsupported = requirement.unsupported || [];
  const state = unsupported.length
    ? "unsupported"
    : requirement.satisfied
      ? "satisfied"
      : "unsatisfied";
  const stateLabel =
    state === "satisfied"
      ? "Satisfied"
      : state === "unsupported"
        ? "Unsupported"
        : "Not met";
  return `
    <div class="evolution-requirement ${state}">
      <strong>${stateLabel}</strong>
      ${(requirement.checks || [])
        .map(
          (check) => `<span class="${check.satisfied ? "met" : "unmet"}">${check.satisfied ? "OK" : "Need"}: ${escapeHtml(check.label)}</span>`,
        )
        .join("")}
      ${unsupported.map((entry) => `<span>Unavailable: ${escapeHtml(entry)}</span>`).join("")}
    </div>
  `;
}

function renderEvolutionPanel(
  pokemon,
  section = "team",
  index = activeInventoryIndex,
) {
  const options = pokemon.evolutionOptions || [];
  const pendingOptions = pokemon.pendingEvolution?.options || [];
  return `
    <div class="evolution-panel">
      <h4>Evolution</h4>
      <div class="detail-evolution-stage">
        <img src="${getPokemonImage(pokemon)}" alt="${pokemon.name}">
        <div><strong>${pokemon.name}</strong><small>Lv${pokemon.level || 1}</small></div>
      </div>
      ${
        pendingOptions.length
          ? `<div class="pending-evolution-options">
              <p><strong>Choose an evolution:</strong></p>
              ${pendingOptions
                .map(
                  (option) => `<button class="secondary-btn" onclick="resolvePendingEvolution('${section}', ${index}, ${option.targetSpeciesId})">${escapeHtml(option.targetName)}</button>`,
                )
                .join("")}
            </div>`
          : ""
      }
      ${
        options.length
          ? `<div class="evolution-option-list">
              ${options
                .map((option) => {
                  const itemActions = (option.items || [])
                    .map((itemSlug) => getEvolutionItemBySlug(itemSlug))
                    .filter(Boolean)
                    .map((item) => {
                      const quantity = playerState?.items?.[item.id] || 0;
                      return `<button class="secondary-btn evolution-item-button" onclick="useItem(event, '${item.id}', ${index}, '${section}', ${option.targetSpeciesId})" ${quantity > 0 && option.supported ? "" : "disabled"}>Use ${escapeHtml(item.name)} (${quantity})</button>`;
                    })
                    .join("");
                  return `<div class="evolution-option${option.supported ? "" : " unsupported"}">
                    <strong>${escapeHtml(option.targetName)}</strong>
                    ${(option.requirementOptions || [])
                      .map(renderEvolutionRequirementOption)
                      .join('<span class="evolution-or">or</span>')}
                    ${itemActions}
                  </div>`;
                })
                .join("")}
            </div>`
          : "<p>Final evolution</p>"
      }
    </div>
  `;
}

function renderPendingMovePanel(pokemon, section = "team", index = activeInventoryIndex) {
  if (!pokemon.pendingMove) return "";
  return `
    <div class="pending-move-panel">
      <h4>${pokemon.name} wants to learn ${pokemon.pendingMove.name}</h4>
      <p>Choose a move to replace, or skip learning it.</p>
      <div class="moves-grid">
        ${(pokemon.moves || [])
          .map(
            (move, moveIndex) => `
              <button class="move-summary pending-replace" onclick="learnPendingMove('${section}', ${index}, ${moveIndex})">
                <strong>${move.name}</strong>
                <span>${move.type} | ${move.category}</span>
                <span>Power ${move.power ?? 0} | Acc ${move.accuracy ?? 100}</span>
                <span>Replace with ${pokemon.pendingMove.name}</span>
              </button>
            `,
          )
          .join("")}
      </div>
      <button class="secondary-btn" onclick="skipPendingMove('${section}', ${index})">Skip ${pokemon.pendingMove.name}</button>
    </div>
  `;
}

function renderPokemonDetailCard(
  pokemon,
  title = "Pokemon details",
  section = "team",
  index = activeInventoryIndex,
) {
  const fainted = pokemon.currentHp <= 0;
  return `
    <div class="player-card trainer-sheet${fainted ? " fainted" : ""}">
      <div class="trainer-portrait trainer-player">
        <span class="trainer-role">${title}</span>
        <img src="${getPokemonImage(pokemon)}" alt="${pokemon.name}">
      </div>
      <div class="player-info">
        <div class="panel-header compact-header">
          <div>
            <h2>${escapeHtml(getPokemonDisplayName(pokemon))}</h2>
            <div class="variant-badges">${renderVariantBadges(pokemon)}</div>
            <p>Level ${pokemon.level} | ${renderTypeBadges(pokemon.types)}</p>
          </div>
          <div class="badge-token player-badge-token">
            <span class="badge-icon">XP</span>
            <span>Next level: ${getXpNeeded(pokemon) - (pokemon.xp || 0)}</span>
          </div>
        </div>
        <div class="partner-showcase">
          <img class="partner-art" src="${getPokemonImage(pokemon)}" alt="${pokemon.name}">
          <div class="partner-stats">
            <p>${renderIcon("heart", "HP")} HP: ${pokemon.currentHp}/${pokemon.maxHp}</p>
            <p>Status: ${fainted ? renderStatus("fainted") : renderStatus(pokemon.status)}</p>
            <p>Friendship: ${pokemon.friendship ?? 70}/255 | ${escapeHtml(formatPokemonGender(pokemon.gender))}</p>
            <p>Ability: <strong>${escapeHtml(formatAbilityName(pokemon.ability))}</strong></p>
            ${pokemon.form ? `<p>Form: <strong>${escapeHtml(pokemon.form.name || pokemon.form.id)}</strong></p>` : ""}
            ${renderXpBar(pokemon)}
          </div>
        </div>
        <div class="pokemon-detail-grid">
          ${renderPokemonStatBars(pokemon)}
          ${renderEvolutionPanel(pokemon, section, index)}
        </div>
        ${renderMoveDetails(pokemon)}
        ${renderLearnsetDetails(pokemon)}
        ${renderPendingMovePanel(pokemon, section, index)}
        <div class="pokemon-detail-help">
          <button class="secondary-btn" onclick="openHandbook('evolution')">Learn more in Handbook</button>
        </div>
        <div class="hp-bar"><div class="hp-fill" style="width: ${getHpPercent(pokemon.currentHp, pokemon.maxHp)}%"></div></div>
      </div>
    </div>
  `;
}

function displayCurrentPlayer() {
  const currentPlayer = document.getElementById("current-player");

  if (!activePokemon) {
    currentPlayer.innerHTML = `
      <div class="player-card">
        <div class="player-info">
          <h2>Loading your team...</h2>
          <p>Your starter will appear here in a moment.</p>
        </div>
      </div>
    `;
    return;
  }

  currentPlayer.innerHTML = renderPokemonDetailCard(
    activePokemon,
    "Active",
    "team",
    activeInventoryIndex,
  );
}

async function displayAreas() {
  const response = await fetch("/api/areas");
  const areas = await response.json();
  const unlockedAreas = areas.filter((area) =>
    typeof area === "string" ? true : area.unlocked,
  );
  if (
    !selectedArea ||
    !unlockedAreas.some(
      (area) => (typeof area === "string" ? area : area.id) === selectedArea,
    )
  ) {
    selectedArea = unlockedAreas.length
      ? typeof unlockedAreas[0] === "string"
        ? unlockedAreas[0]
        : unlockedAreas[0].id
      : null;
  }

  let html = `
    <div class="panel-header">
      <div>
        <h3>Select Area</h3>
        <p>Move with arrow keys or WASD, then press E near an NPC.</p>
      </div>
    </div>
    <div class="area-selector">
  `;
  areas.forEach((area) => {
    const areaId = typeof area === "string" ? area : area.id;
    const areaName = typeof area === "string" ? area : area.name;
    const unlocked = typeof area === "string" ? true : area.unlocked;
    const requiresBadge = typeof area === "string" ? null : area.requiresBadge;
    const emoji = getAreaEmoji(areaId);
    const activeClass = selectedArea === areaId ? " active" : "";
    html += `
      <button onclick="selectArea(event, '${areaId}')" class="area-btn${unlocked ? activeClass : " locked"}" ${unlocked ? "" : "disabled"}>
        <strong>${emoji} ${areaName.toUpperCase()}</strong>
        <span>${unlocked ? "Unlocked" : `Needs ${requiresBadge || "a badge"}`}</span>
      </button>
    `;
  });
  html += "</div>";
  document.getElementById("areas").innerHTML = html;
  updateAreaHelper(selectedArea);

  if (selectedArea) {
    await loadAreaWorld(selectedArea);
  } else {
    renderRouteWorld();
  }
}

async function selectArea(event, area) {
  selectedArea = area;
  document
    .querySelectorAll(".area-btn")
    .forEach((btn) => btn.classList.remove("active"));
  event.currentTarget.classList.add("active");
  updateAreaHelper(area);
  await loadAreaWorld(area);
  displayCurrentPlayer();
}

function getAreaHelperText(area) {
  const legendaryNote =
    "Legendary Pokemon are extremely rare and usually appear only in specific biomes.";
  switch (area) {
    case "forest":
      return `Forest: Grass/Bug Pokemon. ${legendaryNote}`;
    case "lake":
      return `Lake: Water Pokemon. ${legendaryNote}`;
    case "cave":
      return `Cave: Rock/Ground/Poison Pokemon. ${legendaryNote}`;
    case "volcano":
      return `Volcano: Fire Pokemon. ${legendaryNote}`;
    case "mountain":
      return `Mountain: Flying/Rock/Dragon Pokemon. ${legendaryNote}`;
    case "desert":
      return `Desert: Ground/Dark Pokemon. ${legendaryNote}`;
    case "graveyard":
      return `Graveyard: Ghost/Dark Pokemon. ${legendaryNote}`;
    default:
      return `Select an area to view biome-specific encounter hints. ${legendaryNote}`;
  }
}

function updateAreaHelper(area) {
  const helper = document.getElementById("area-helper");
  if (!helper) return;
  helper.textContent = getAreaHelperText(area);
}

async function loadAreaWorld(area) {
  if (!area) {
    npcCache = [];
    npcMap = null;
    focusedNpcId = null;
    routeDialogue = null;
    renderRouteWorld();
    return;
  }

  const response = await fetch(`/api/npcs?area=${encodeURIComponent(area)}`);
  const data = await response.json();
  if (data.error) {
    npcCache = [];
    npcMap = null;
    focusedNpcId = null;
    routeDialogue = null;
    renderRouteWorld();
    return;
  }

  npcCache = data.npcs || [];
  npcMap = data.map || { width: 8, height: 6, theme: area };
  if (
    routeDialogue?.npc &&
    !npcCache.some((npc) => npc.id === routeDialogue.npc.id)
  ) {
    routeDialogue = null;
  }
  if (!areaPlayerPositions[area]) {
    areaPlayerPositions[area] = getDefaultPlayerPosition(area, npcMap);
  }
  loadRouteDiscovery(area);
  revealRouteTiles(area, areaPlayerPositions[area]);
  if (!focusedNpcId || !npcCache.some((npc) => npc.id === focusedNpcId)) {
    focusedNpcId = npcCache[0]?.id || null;
  }
  renderRouteWorld();
}

function getDefaultPlayerPosition(area, map) {
  const width = map?.width || 8;
  const height = map?.height || 6;
  return {
    x: Math.max(1, Math.floor(width / 2)),
    y: Math.max(1, height),
  };
}

function getPlayerPosition(area = selectedArea) {
  if (!area) return { x: 1, y: 1 };
  if (!areaPlayerPositions[area]) {
    areaPlayerPositions[area] = getDefaultPlayerPosition(area, npcMap);
  }
  return areaPlayerPositions[area];
}

function getDiscoveryKey(area = selectedArea) {
  return `pokemon.route.discovery.${area || "unknown"}`;
}

function getTileKey(x, y) {
  return `${x},${y}`;
}

function loadRouteDiscovery(area = selectedArea) {
  if (!area || routeDiscovery[area]) return routeDiscovery[area] || new Set();
  try {
    const saved = JSON.parse(
      localStorage.getItem(getDiscoveryKey(area)) || "[]",
    );
    routeDiscovery[area] = new Set(Array.isArray(saved) ? saved : []);
  } catch {
    routeDiscovery[area] = new Set();
  }
  return routeDiscovery[area];
}

function saveRouteDiscovery(area = selectedArea) {
  if (!area || !routeDiscovery[area]) return;
  localStorage.setItem(
    getDiscoveryKey(area),
    JSON.stringify([...routeDiscovery[area]]),
  );
}

function revealRouteTiles(
  area = selectedArea,
  position = getPlayerPosition(area),
  radius = 1,
) {
  if (!area || !npcMap || !position) return [];
  const discovered = loadRouteDiscovery(area);
  recentRouteDiscoveries[area] = new Set();

  for (let y = position.y - radius; y <= position.y + radius; y += 1) {
    for (let x = position.x - radius; x <= position.x + radius; x += 1) {
      if (x < 1 || y < 1 || x > (npcMap.width || 0) || y > (npcMap.height || 0))
        continue;
      const key = getTileKey(x, y);
      if (!discovered.has(key)) {
        discovered.add(key);
        recentRouteDiscoveries[area].add(key);
      }
    }
  }

  saveRouteDiscovery(area);
  return [...recentRouteDiscoveries[area]];
}

function isRouteTileDiscovered(x, y, area = selectedArea) {
  return loadRouteDiscovery(area).has(getTileKey(x, y));
}

function getRouteTileType(x, y) {
  const npc = getNpcAtPosition(x, y);
  if (npc)
    return npc.type === "healer" || npc.type === "shop" ? "camp" : "blocked";
  if ((x * 17 + y * 29) % 41 === 0) return "rare";
  if ((x * 11 + y * 13) % 31 === 0) return "danger";
  if ((x + y) % 5 === 0) return "grass";
  return "path";
}

function getExplorationStats(area = selectedArea) {
  const total = Math.max(1, (npcMap?.width || 0) * (npcMap?.height || 0));
  const discovered = Math.min(loadRouteDiscovery(area).size, total);
  const percent = Math.round((discovered / total) * 100);
  return { discovered, total, percent, cleared: percent >= 80 };
}

function getNpcAtPosition(x, y) {
  return (
    npcCache.find((npc) => npc.position?.x === x && npc.position?.y === y) ||
    null
  );
}

function getNearbyNpc() {
  const playerPosition = getPlayerPosition();
  return (
    npcCache
      .filter((npc) => {
        const distance =
          Math.abs((npc.position?.x || 0) - playerPosition.x) +
          Math.abs((npc.position?.y || 0) - playerPosition.y);
        return distance <= 1;
      })
      .sort((left, right) => {
        const leftDistance =
          Math.abs((left.position?.x || 0) - playerPosition.x) +
          Math.abs((left.position?.y || 0) - playerPosition.y);
        const rightDistance =
          Math.abs((right.position?.x || 0) - playerPosition.x) +
          Math.abs((right.position?.y || 0) - playerPosition.y);
        return leftDistance - rightDistance;
      })[0] || null
  );
}

function getFocusedNpc() {
  return (
    npcCache.find((npc) => npc.id === focusedNpcId) ||
    getNearbyNpc() ||
    npcCache[0] ||
    null
  );
}

function inspectNpc(npcId) {
  focusedNpcId = npcId;
  renderRouteWorld();
}

function selectOrInteractNpc(npcId) {
  const npc = npcCache.find((entry) => entry.id === Number(npcId));
  if (!npc) return;
  focusedNpcId = npc.id;
  if (getNearbyNpc()?.id === npc.id) {
    interactNearbyNpc();
    return;
  }
  renderRouteWorld();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function setRouteDialogue(npc, text, tone = "neutral") {
  routeDialogue = {
    npc,
    text,
    tone,
  };
  renderRouteDialogue();
}

function getGuideAreaHint() {
  const hints = {
    forest: "Grass and Bug Pokemon are common here. Some rare creatures hide deeper in the trees.",
    lake: "Water Pokemon gather around the lake. Patient trainers sometimes spot rare ripples.",
    cave: "Rock, Ground, and Poison Pokemon are common in caves. Bring healing items.",
    volcano: "Fire Pokemon thrive near volcanic heat. Water moves help a lot here.",
    mountain: "Flying, Rock, and Dragon Pokemon appear in the mountains. Rare energy gathers at night.",
    desert: "Ground and Dark Pokemon handle the desert well. Sand can make battles tricky.",
    graveyard: "Ghost and Dark Pokemon appear around the graveyard, especially at night.",
  };
  const progression = {
    cave: "The cave opens after earning the Volt Badge.",
    volcano: "The volcano opens after earning the Blaze Badge.",
    mountain: "The mountain opens after earning the Rock Badge.",
    desert: "The desert opens after earning the Rock Badge.",
    graveyard: "The graveyard opens after earning the Psychic Badge.",
  };
  return progression[selectedArea] || hints[selectedArea] || "Some Pokemon only appear during the day or at night.";
}

function showNpcTalk(npcId) {
  const npc = npcCache.find((entry) => entry.id === npcId) || getFocusedNpc();
  if (!npc) return;
  focusedNpcId = npc.id;
  setRouteDialogue(npc, npc.defeated && npc.type === "trainer" ? "That was a strong team. I will keep training." : npc.dialogue, "dialogue");
}

function showGuideAreaHint(npcId) {
  const npc = npcCache.find((entry) => entry.id === npcId) || getFocusedNpc();
  if (!npc) return;
  focusedNpcId = npc.id;
  setRouteDialogue(npc, getGuideAreaHint(), "rare");
}

function showTrainerRematchDialogue(npcId) {
  const npc = npcCache.find((entry) => entry.id === npcId) || getFocusedNpc();
  if (!npc) return;
  focusedNpcId = npc.id;
  setRouteDialogue(
    npc,
    "I've been training. Come back soon and we'll test our teams again.",
    "battle",
  );
}

function clearRouteDialogue() {
  routeDialogue = null;
  renderRouteDialogue();
}

function renderNpcActions(npc, interactable) {
  if (!npc) return "";
  const disabled = interactable ? "" : "disabled";
  const talkButton = `<button class="secondary-btn" onclick="showNpcTalk(${npc.id})">Talk</button>`;
  const leaveButton = `<button class="secondary-btn" onclick="clearRouteDialogue()">Leave</button>`;

  if (npc.type === "trainer") {
    if (npc.defeated) {
      return `
        <div class="npc-action-row">
          ${talkButton}
          <button class="secondary-btn" onclick="showTrainerRematchDialogue(${npc.id})">Rematch</button>
          ${leaveButton}
        </div>
      `;
    }
    return `
      <div class="npc-action-row">
        <button class="primary-action" onclick="interactNearbyNpc()" ${disabled}>Battle [E]</button>
        ${talkButton}
        ${leaveButton}
      </div>
    `;
  }
  if (npc.type === "shop") {
    return `
      <div class="npc-action-row">
        <button class="primary-action" onclick="interactNearbyNpc()" ${disabled}>Shop [E]</button>
        ${talkButton}
        ${leaveButton}
      </div>
    `;
  }
  if (npc.type === "healer") {
    return `
      <div class="npc-action-row">
        <button class="primary-action" onclick="interactNearbyNpc()" ${disabled}>Heal Team [E]</button>
        ${talkButton}
        ${leaveButton}
      </div>
    `;
  }
  return `
    <div class="npc-action-row">
      ${talkButton}
      <button class="secondary-btn" onclick="showGuideAreaHint(${npc.id})">Ask About Area</button>
      ${leaveButton}
    </div>
  `;
}

function showZoneEventToast(event, text) {
  let holder = document.getElementById("zone-event-toasts");
  if (!holder) {
    holder = document.createElement("div");
    holder.id = "zone-event-toasts";
    holder.className = "zone-event-toasts";
    document.body.appendChild(holder);
  }
  const title = event.itemName
    ? "ITEM FOUND"
    : event.coins
      ? "COINS FOUND"
      : event.tone === "warning"
        ? "DANGER"
        : event.tone === "rare"
          ? "RARE ENERGY"
          : "ROUTE EVENT";
  const detail = event.itemName
    ? `${event.itemName} x1`
    : event.coins
      ? `+${event.coins} coins`
      : text;
  const toast = document.createElement("div");
  toast.className = `zone-event-toast toast-${event.tone || "neutral"}`;
  toast.innerHTML = `<strong>${title}</strong><span>${escapeHtml(detail)}</span>`;
  holder.appendChild(toast);
  setTimeout(() => toast.remove(), 3600);
}

function renderRouteDialogue() {
  const dialogue = document.getElementById("npc-dialogue");
  if (!dialogue) return;

  const nearbyNpc = getNearbyNpc();
  const focusedNpc = getFocusedNpc();
  const speaker = routeDialogue?.npc || nearbyNpc || focusedNpc;
  const message =
    routeDialogue?.text ||
    (nearbyNpc
      ? `Press E or use Interact to talk to ${nearbyNpc.name}.`
      : selectedArea
        ? `Move next to a character in ${formatAreaName(selectedArea)} to interact.`
        : "Choose an area to begin exploring.");

  const safeMessage = escapeHtml(message);
  const canInteractWithSpeaker = Boolean(
    nearbyNpc &&
      speaker &&
      nearbyNpc.id === speaker.id &&
      activeScreen === "explore" &&
      !activeOverlay &&
      !npcInteractionPending &&
      !npcBattle &&
      !gymBattle &&
      !eliteBattle &&
      !isInBattle,
  );
  dialogue.innerHTML = `
    <div class="dialogue-box${routeDialogue?.tone ? ` dialogue-${routeDialogue.tone}` : ""}">
      <div class="dialogue-portrait">
        ${
          speaker
            ? `<img src="${getNpcSprite(speaker)}" alt="${escapeHtml(speaker.name)}">`
            : `<span>${getNpcTypeIcon("guide")}</span>`
        }
      </div>
      <div class="dialogue-content">
        <div class="dialogue-head">
          <strong>${escapeHtml(speaker?.name || "Route")}</strong>
          <span>${speaker ? npcTypeLabels[speaker.type] || "World" : "Explore"}</span>
        </div>
        <p>${safeMessage}</p>
        ${speaker ? renderNpcActions(speaker, canInteractWithSpeaker) : ""}
      </div>
    </div>
  `;
}

function renderRouteWorld() {
  const routeWorld = document.getElementById("route-world");
  if (!routeWorld) return;
  if (!selectedArea || !npcMap) {
    routeWorld.innerHTML = `
      <div class="route-placeholder">
        <h3>Route Map</h3>
        <p>Select an area to see the world and its characters.</p>
      </div>
    `;
    renderRouteDialogue();
    return;
  }

  const playerPosition = getPlayerPosition();
  const nearbyNpc = getNearbyNpc();
  const focusedNpc = getFocusedNpc();
  const displayNpc = nearbyNpc || focusedNpc;
  const stats = getExplorationStats();
  const interactable = Boolean(
    nearbyNpc &&
    activeScreen === "explore" &&
    !activeOverlay &&
    !npcInteractionPending &&
    !npcBattle &&
    !gymBattle &&
    !eliteBattle &&
    !isInBattle,
  );

  routeWorld.innerHTML = `
    <div class="route-layout">
      <div class="route-map-panel route-theme-${npcMap.theme || selectedArea}">
        <div class="route-map-head">
          <div>
            <h3>${formatAreaName(selectedArea)} Route</h3>
            <p>Walk up to a character to interact.</p>
          </div>
          <div class="route-map-hint">WASD / Arrows / E</div>
        </div>
        <div class="route-progress">
          <span>${stats.discovered}/${stats.total} tiles discovered</span>
          <strong>${stats.percent}% explored${stats.cleared ? " - Area cleared" : ""}</strong>
        </div>
        <div class="route-map-body">
          <div class="route-grid" style="grid-template-columns: repeat(${npcMap.width}, minmax(0, 1fr));">
            ${renderRouteTiles(playerPosition, nearbyNpc)}
          </div>
          <div class="route-minimap-panel">
            <div class="route-minimap-head">
              <strong>Minimap</strong>
              <span>${stats.percent}%</span>
            </div>
            <div class="route-minimap" style="grid-template-columns: repeat(${npcMap.width}, minmax(0, 1fr));">
              ${renderRouteMinimap(playerPosition)}
            </div>
          </div>
        </div>
        <div class="route-map-actions">
          <button class="quick-find-btn" onclick="findPokemonQuickly()">
            Find Pokemon
          </button>
        </div>
      </div>
      <div class="route-side-panel">
        ${
          displayNpc
            ? `
              <div class="route-npc-card ${displayNpc.defeated ? "defeated" : ""}">
                <div class="route-npc-header">
                  <img class="route-npc-sprite" src="${getNpcSprite(displayNpc)}" alt="${displayNpc.name}">
                  <div>
                    <strong>${displayNpc.name}</strong>
                    <span>${npcTypeLabels[displayNpc.type] || "NPC"}</span>
                  </div>
                </div>
                <p>${displayNpc.dialogue}</p>
                ${
                  displayNpc.type === "trainer" && displayNpc.team?.length
                    ? `<div class="route-npc-team">${displayNpc.team
                        .map(
                          (member) =>
                            `<span>${member.name} Lv${member.level}</span>`,
                        )
                        .join("")}</div>`
                    : ""
                }
                ${renderNpcActions(displayNpc, interactable)}
                ${
                  !interactable
                    ? `<small>${nearbyNpc ? "Close the current menu or battle first." : "Move next to this character first."}</small>`
                    : ""
                }
              </div>
            `
            : `
              <div class="route-npc-card">
                <strong>No characters here yet</strong>
                <p>Pick another area to find more route encounters.</p>
              </div>
            `
        }
      </div>
    </div>
  `;

  renderRouteDialogue();
}

function renderRouteTiles(playerPosition, nearbyNpc) {
  let html = "";
  for (let y = 1; y <= (npcMap?.height || 0); y += 1) {
    for (let x = 1; x <= (npcMap?.width || 0); x += 1) {
      const npc = getNpcAtPosition(x, y);
      const isPlayer = playerPosition.x === x && playerPosition.y === y;
      const discovered = isRouteTileDiscovered(x, y) || isPlayer;
      const recent = recentRouteDiscoveries[selectedArea]?.has(
        getTileKey(x, y),
      );
      const tileType = getRouteTileType(x, y);
      const showNpc = npc && discovered;
      const classes = ["route-tile"];
      if (isPlayer) classes.push("player");
      classes.push(`tile-${tileType}`);
      if (recent) classes.push("newly-discovered");
      if (showNpc) classes.push("npc", `npc-${npc.type}`);
      if (showNpc && nearbyNpc?.id === npc?.id) classes.push("nearby");
      html += `
        <button
          class="${classes.join(" ")}"
          ${showNpc ? `onclick="selectOrInteractNpc(${npc.id})"` : 'type="button"'}
          ${showNpc ? "" : 'tabindex="-1"'}
        >
          ${
            isPlayer
              ? `<img class="route-player-sprite" src="${trainerSprites.player}" alt="${playerState?.trainerName || "Player"}">`
              : showNpc
                ? `
                  <img class="route-npc-map-sprite" src="${getNpcSprite(npc)}" alt="${npc.name}">
                  <span class="route-role-badge">${getNpcTypeIcon(npc.type)}</span>
                  ${nearbyNpc?.id === npc.id ? '<span class="route-prompt">E</span>' : ""}
                  ${npc.defeated ? '<span class="route-defeated-badge">Done</span>' : ""}
                `
                : `<span class="route-tile-fill">${getRouteTileSymbol(tileType)}</span>`
          }
        </button>
      `;
    }
  }
  return html;
}

function renderRouteMinimap(playerPosition) {
  let html = "";
  for (let y = 1; y <= (npcMap?.height || 0); y += 1) {
    for (let x = 1; x <= (npcMap?.width || 0); x += 1) {
      const isPlayer = playerPosition.x === x && playerPosition.y === y;
      const discovered = isRouteTileDiscovered(x, y) || isPlayer;
      const npc = getNpcAtPosition(x, y);
      const tileType = getRouteTileType(x, y);
      const classes = ["minimap-cell", `mini-${tileType}`];
      if (isPlayer) classes.push("mini-player");
      if (npc && discovered) classes.push("mini-npc");
      html += `<span class="${classes.join(" ")}"></span>`;
    }
  }
  return html;
}

function getRouteTileSymbol(tileType) {
  if (tileType === "rare") return "!";
  if (tileType === "danger") return "▲";
  if (tileType === "camp") return "+";
  if (tileType === "grass") return "";
  return "";
}

async function maybeTriggerZoneEvent(position) {
  if (
    !selectedArea ||
    activeOverlay ||
    isInBattle ||
    npcBattle ||
    gymBattle ||
    eliteBattle
  )
    return;
  const now = Date.now();
  if (now - lastZoneEventAt < 4500 || Math.random() > 0.18) return;

  lastZoneEventAt = now;
  const tileType = getRouteTileType(position.x, position.y);
  const eventsByType = {
    rare: [
      {
        text: "A strange energy pulses from this part of the route.",
        tone: "rare",
      },
      {
        text: "Loose coins shimmer near the rare zone.",
        coins: 35,
        tone: "reward",
      },
    ],
    danger: [
      { text: "The danger zone grows unstable. Stay ready.", tone: "warning" },
      { text: "You hear movement nearby...", tone: "warning" },
    ],
    camp: [
      { text: "The air feels calm around the camp.", tone: "heal" },
      {
        text: "A small supply pouch was found near the camp.",
        itemId: "potion",
        itemName: "Potion",
        tone: "reward",
      },
    ],
    grass: [
      { text: "The tall grass rustles softly.", tone: "neutral" },
      {
        text: "A dropped Poke Ball was tucked under the grass.",
        itemId: "standard",
        itemName: "Poke Ball",
        tone: "reward",
      },
      {
        text: "You found a few coins on the path through the grass.",
        coins: 15,
        tone: "reward",
      },
    ],
    path: [
      { text: "The route is quiet for a moment.", tone: "neutral" },
      {
        text: "Loose coins were found on the path.",
        coins: 10,
        tone: "reward",
      },
    ],
  };
  const options = eventsByType[tileType] || eventsByType.path;
  const event = options[Math.floor(Math.random() * options.length)];

  if (event.coins || event.itemId) {
    try {
      const response = await fetch("/api/zone-event/reward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coins: event.coins || 0,
          itemId: event.itemId || null,
          quantity: 1,
          reason: "Zone event",
        }),
      });
      const data = await response.json();
      if (!data.error && data.state) {
        playerState = data.state;
        displayStats();
        displayBag();
      }
    } catch (error) {
      console.error("Zone reward failed:", error);
    }
  }

  const rewardText = event.itemName
    ? `${event.text} +1 ${event.itemName}.`
    : event.coins
      ? `${event.text} +${event.coins} coins.`
      : event.text;
  showZoneEventToast(event, rewardText);
  setRouteDialogue(null, rewardText, event.tone);
}

async function maybeTriggerWildEncounter(position) {
  if (
    !selectedArea ||
    !position ||
    routeEncounterPending ||
    battleActionBusy ||
    activeOverlay ||
    isInBattle ||
    npcBattle ||
    gymBattle ||
    eliteBattle ||
    !activePokemon ||
    activePokemon.currentHp <= 0
  ) {
    return false;
  }

  if (routeEncounterCooldownSteps > 0) {
    routeEncounterCooldownSteps -= 1;
    return false;
  }

  const tileType = getRouteTileType(position.x, position.y);
  const chance = ROUTE_ENCOUNTER_CHANCES[tileType] || 0;
  if (chance <= 0 || Math.random() >= chance) return false;

  routeEncounterPending = true;
  try {
    const started = await startWildEncounter(selectedArea);
    if (started) routeEncounterCooldownSteps = 3;
    return started;
  } finally {
    routeEncounterPending = false;
  }
}

async function moveRoutePlayer(dx, dy) {
  if (!selectedArea || !npcMap) return;
  if (
    routeEncounterPending ||
    activeOverlay ||
    npcBattle ||
    gymBattle ||
    eliteBattle ||
    isInBattle
  )
    return;
  const current = getPlayerPosition();
  const next = {
    x: Math.max(1, Math.min(npcMap?.width || 8, current.x + dx)),
    y: Math.max(1, Math.min(npcMap?.height || 6, current.y + dy)),
  };
  if (next.x === current.x && next.y === current.y) return;
  if (getNpcAtPosition(next.x, next.y)) {
    return;
  }
  areaPlayerPositions[selectedArea] = next;
  const nearbyNpc = getNearbyNpc();
  if (nearbyNpc) {
    focusedNpcId = nearbyNpc.id;
  }
  revealRouteTiles(selectedArea, next);
  renderRouteWorld();
  const encounterStarted = await maybeTriggerWildEncounter(next);
  if (!encounterStarted) await maybeTriggerZoneEvent(next);
}

async function interactNearbyNpc() {
  if (
    npcInteractionPending ||
    activeOverlay ||
    npcBattle ||
    gymBattle ||
    eliteBattle ||
    isInBattle
  ) {
    return;
  }
  const npc = getNearbyNpc() || getFocusedNpc();
  if (!npc) {
    setRouteDialogue(null, "No one is nearby to interact with.", "warning");
    return;
  }

  const playerPosition = getPlayerPosition();
  const distance =
    Math.abs((npc.position?.x || 0) - playerPosition.x) +
    Math.abs((npc.position?.y || 0) - playerPosition.y);
  if (distance > 1) {
    focusedNpcId = npc.id;
    renderRouteWorld();
    setRouteDialogue(
      npc,
      `${npc.name} is too far away. Move next to them first.`,
      "warning",
    );
    return;
  }

  npcInteractionPending = true;
  renderRouteWorld();
  let data;
  try {
    const response = await fetch("/api/npc/interact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ npcId: npc.id }),
    });
    data = await response.json();
    if (!response.ok || data.error) {
      throw new Error(data.error || "NPC interaction failed");
    }
  } catch (error) {
    console.error("NPC interaction failed:", error);
    setRouteDialogue(
      npc,
      error.message || "Could not interact right now.",
      "warning",
    );
    return;
  } finally {
    npcInteractionPending = false;
    renderRouteWorld();
  }

  focusedNpcId = npc.id;
  if (data.action === "battle") {
    npcBattle = data.session;
    setRouteDialogue(data.npc, data.dialogue, "battle");
    showNpcBattle(data.log || []);
    animatePokemonSwitch("opponent", npcBattle.opponentPokemon);
    return;
  }

  if (data.action === "shop") {
    setRouteDialogue(data.npc, data.dialogue, "shop");
    openOverlay("shop");
    return;
  }

  if (data.action === "heal") {
    setRouteDialogue(data.npc, data.message || data.dialogue, "heal");
    renderBattlePlaceholder(data.message || "Your Pokemon feel refreshed.");
    await loadProfile();
    await loadInventory();
    await loadAreaWorld(selectedArea);
    return;
  }

  setRouteDialogue(data.npc, data.dialogue, "dialogue");
  await loadAreaWorld(selectedArea);
}

async function loadGyms() {
  const response = await fetch("/api/gyms");
  gymCache = await response.json();
  displayGyms();
}

async function loadEliteFour() {
  const response = await fetch("/api/elitefour");
  eliteCache = await response.json();
  displayEliteFour();
}

function displayGyms() {
  const gymsDiv = document.getElementById("gyms");
  if (!gymsDiv) return;

  gymsDiv.innerHTML = `
    <div class="panel-header">
      <div>
        <h3>Gym Arenas</h3>
        <p>Earn badges and build your collection case.</p>
      </div>
    </div>
    ${renderBadgeCollection(playerState?.badges || [])}
    <div class="gym-list">
      ${gymCache
        .map((gym) => {
          const theme = getLeaderTheme(gym.type);
          return `
            <button class="gym-card ${gym.defeated ? "defeated" : ""}" ${gym.unlocked ? "" : "disabled"} onclick="startGymBattle(${gym.id})">
              <div class="leader-card-head leader-${theme.className}">
                <strong>${gym.name}</strong>
                <span>${gym.leaderName}</span>
              </div>
              <div class="leader-card-body">
                <img class="leader-sprite" src="${getTrainerSprite(gym.type, gym.leaderName)}" alt="${gym.leaderName}">
                <div class="leader-card-meta">
                  <span>${gym.city} | Lv ${gym.difficulty}</span>
                  <span>${gym.team.map((member) => member.name).join(" / ")}</span>
                  <div class="badge-token badge-${theme.className}">
                    <span class="badge-icon">${theme.icon}</span>
                    <span>${gym.badge}</span>
                  </div>
                  <span>${
                    gym.defeated
                      ? "Cleared - Rematch"
                      : gym.unlocked
                        ? `${gym.rewardCoins} coins`
                        : `Locked - earn ${gym.requiresBadge || "the previous badge"}`
                  }</span>
                </div>
              </div>
            </button>
          `;
        })
        .join("")}
    </div>
  `;
}

function displayEliteFour() {
  const eliteDiv = document.getElementById("elite");
  if (!eliteDiv) return;
  if (!eliteCache) {
    eliteDiv.innerHTML = "";
    return;
  }

  const stages = eliteCache.stages || [];
  eliteDiv.innerHTML = `
    <div class="panel-header">
      <div>
        <h3>Elite Four</h3>
        <p>Endgame gauntlet with no healing between battles.</p>
      </div>
      <strong>${eliteCache.completed ? "Cleared" : eliteCache.unlocked ? "Unlocked" : "Locked"}</strong>
    </div>
    <div class="gym-list">
      ${stages
        .map((stage, index) => {
          const theme = getLeaderTheme(stage.type);
          return `
            <button class="elite-card${eliteCache.unlocked ? "" : " locked"}" ${eliteCache.unlocked && index === 0 ? "" : "disabled"} onclick="startEliteRun()">
              <div class="leader-card-head leader-${theme.className}">
                <strong>${stage.name}</strong>
                <span>${index < 4 ? `Elite Four ${index + 1}` : "Champion"}</span>
              </div>
              <div class="leader-card-body">
                <img class="leader-sprite" src="${getTrainerSprite(stage.type, stage.name)}" alt="${stage.name}">
                <div class="leader-card-meta">
                  <span>${stage.type} specialist</span>
                  <span>${stage.team.map((member) => `${member.name} Lv${member.level}`).join(", ")}</span>
                  <div class="badge-token badge-${theme.className}">
                    <span class="badge-icon">${theme.icon}</span>
                    <span>${theme.badge}</span>
                  </div>
                </div>
              </div>
            </button>
          `;
        })
        .join("")}
    </div>
    <p class="elite-status">
      ${
        eliteCache.completed
          ? "Champion defeated. The full gauntlet is yours."
          : eliteCache.active
            ? "An Elite Four run is active. Press the first card to resume."
            : eliteCache.unlocked
              ? "Beat all four and then the Champion in one run."
              : "Earn all gym badges to unlock the Elite Four."
      }
    </p>
  `;
}

async function startGymBattle(gymId) {
  const response = await fetch("/api/gym/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gymId }),
  });
  const data = await response.json();
  if (data.error) {
    alert(data.error);
    if (data.error === "No active gym battle") {
      gymBattle = null;
      showGymResult(["Gym battle finished."]);
    }
    return;
  }
  gymBattle = data.session;
  showGymBattle(data.log);
  animatePokemonSwitch("opponent", gymBattle.gymPokemon);
}

function renderGymTeamIndicators() {
  const team = gymBattle?.gymTeam || [];
  if (!team.length) return "";
  const remaining = team.filter((pokemon) => (pokemon.currentHp ?? pokemon.maxHp ?? 0) > 0).length;
  return `
    <div class="trainer-team-indicator" aria-label="${gymBattle.gym.leaderName} has ${remaining} of ${team.length} Pokémon remaining">
      <span>Leader team</span>
      <div class="trainer-team-balls">
        ${team
          .map((pokemon, index) => {
            const hp = pokemon.currentHp ?? pokemon.maxHp ?? 0;
            const stateClass =
              hp <= 0 ? "fainted" : index === gymBattle.gymIndex ? "active" : "";
            const label = `${pokemon.name} ${hp <= 0 ? "fainted" : "ready"}`;
            return `<img class="trainer-team-ball ${stateClass}" src="${icons.standard}" alt="${label}" title="${label}">`;
          })
          .join("")}
      </div>
      <strong>${remaining}/${team.length}</strong>
    </div>
  `;
}

function showGymBattle(lines = []) {
  setActiveScreen("battle");
  if (!gymBattle?.playerPokemon || !gymBattle?.gymPokemon) {
    showGymResult(lines);
    return;
  }
  const player = normalizePokemon(gymBattle.playerPokemon);
  const opponent = normalizePokemon(gymBattle.gymPokemon);
  const theme = getLeaderTheme(gymBattle.gym.type);
  const encounter = document.getElementById("encounter");
  encounter.innerHTML = `
    <div class="arena-log">
      <div class="arena-trainer-banner leader-${theme.className}">
        <img class="arena-trainer-sprite" src="${getTrainerSprite(gymBattle.gym.type, gymBattle.gym.leaderName)}" alt="${gymBattle.gym.leaderName}">
        <div>
          <h2>${gymBattle.gym.leaderName}</h2>
          <p class="weather-info">${gymBattle.gym.name} | ${gymBattle.gym.type} leader | No catching | No running</p>
          ${renderGymTeamIndicators()}
        </div>
        <div class="badge-token badge-${theme.className}">
          <span class="badge-icon">${theme.icon}</span>
          <span>${gymBattle.gym.badge}</span>
        </div>
      </div>
      <div class="battle-help-row">${renderBattleHandbookShortcut("moves")}</div>
      ${renderBattleWeatherHud(gymBattle.weather || "clear")}
      <div class="battle-container gym-battle-container">
        <div class="battle-pokemon player-side status-${player.status || "none"}${getHpPercent(player.currentHp, player.maxHp) <= 25 ? " low-hp" : ""}">
          <img class="battle-sprite" src="${getPokemonImage(player)}" alt="${player.name}">
          <div class="battle-info">
            <h3>${player.name} Lv${player.level}</h3>
            ${renderTypeBadges(player.types)}
            <div class="hp-bar"><div class="hp-fill" style="width: ${getHpPercent(player.currentHp, player.maxHp)}%"></div></div>
            <p class="hp-line">${renderIcon("heart", "HP")} ${player.currentHp}/${player.maxHp} HP</p>
            ${renderBattleTacticalHud(player)}
          </div>
        </div>
        <div class="vs">VS</div>
        <div class="battle-pokemon opponent-side status-${opponent.status || "none"}${getHpPercent(opponent.currentHp, opponent.maxHp) <= 25 ? " low-hp" : ""}">
          <img class="battle-sprite" src="${getPokemonImage(opponent)}" alt="${opponent.name}">
          <div class="battle-info">
            <h3>Gym ${opponent.name} Lv${opponent.level}</h3>
            ${renderTypeBadges(opponent.types)}
            <div class="hp-bar"><div class="hp-fill" style="width: ${getHpPercent(opponent.currentHp, opponent.maxHp)}%"></div></div>
            <p class="hp-line">${renderIcon("heart", "HP")} ${opponent.currentHp}/${opponent.maxHp} HP</p>
            ${renderBattleTacticalHud(opponent)}
          </div>
        </div>
      </div>
      <div id="gym-move-buttons" class="move-buttons"></div>
      <div id="gym-switch-buttons" class="gym-switch-buttons"></div>
      <div id="battle-log"></div>
    </div>
  `;
  showGymMoveButtons(player);
  showGymSwitchButtons();
  presentBattleArena("gym", player, opponent, gymBattle.weather || "clear", lines);
  appendBattleLog(lines);
}

function showGymResult(lines = []) {
  endBattlePresentation();
  setActiveScreen("battle");
  const encounter = document.getElementById("encounter");
  encounter.innerHTML = `
    <div class="arena-log">
      <h2>Gym Arena</h2>
      <div id="battle-log"></div>
      <button class="secondary-btn" onclick="setActiveScreen('gym'); loadGyms()">Back to Gyms</button>
    </div>
  `;
  appendBattleLog(lines.length ? lines : ["Gym battle finished."]);
}

function showGymMoveButtons(player) {
  const moveButtonsDiv = document.getElementById("gym-move-buttons");
  if (!moveButtonsDiv) return;
  moveButtonsDiv.innerHTML = "";
  player.moves.forEach((move) => {
    moveButtonsDiv.appendChild(
      createBattleMoveButton(move, gymBattle?.gymPokemon, gymMove, player.currentHp <= 0),
    );
  });
}

function showGymSwitchButtons() {
  const switchDiv = document.getElementById("gym-switch-buttons");
  if (!switchDiv) return;
  switchDiv.innerHTML = `
    <h3>Switch Pokémon</h3>
    ${(gymBattle.playerTeam || [])
      .map(
        (pokemon, index) =>
          `<button class="secondary-btn" ${battleActionBusy || pokemon.currentHp <= 0 || index === gymBattle.playerIndex ? "disabled" : ""} onclick="gymSwitch(${index})">${pokemon.name} ${pokemon.currentHp}/${pokemon.maxHp}</button>`,
      )
      .join("")}
  `;
}

async function gymMove(moveName) {
  if (battleActionBusy) return;
  const previousState = { ...gymBattle };
  setBattleActionBusy(true);
  let data;
  try {
    const response = await fetch("/api/gym/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moveName }),
    });
    data = await response.json();
  } catch (error) {
    console.error("Gym move failed:", error);
    setBattleActionBusy(false);
    alert("Gym battle action failed.");
    return;
  }
  if (data.error) {
    if (Array.isArray(data.log)) appendBattleLog(data.log);
    alert(data.error);
    setBattleActionBusy(false);
    if (
      data.error === "No active gym battle" ||
      data.error === "Gym battle is already finished"
    ) {
      gymBattle = null;
      showGymResult(["Gym battle finished."]);
      await loadProfile();
      await loadGyms();
      await loadInventory();
      if (questCache) await loadQuests();
    }
    return;
  }
  await loadInventory();
  await playTrainerBattleTransition({
    previousState,
    nextState: data.session,
    lines: data.log,
    moveName,
    opponentField: "gymPokemon",
    opponentTeamField: "gymTeam",
    opponentIndexField: "gymIndex",
    renderBattle: showGymBattle,
    renderResult: showGymResult,
    assignState: (session) => {
      gymBattle = session;
    },
    won: data.won,
    lost: data.lost,
    afterFinal: async () => {
      gymBattle = null;
      await loadProfile();
      await displayAreas();
      await loadGyms();
      await loadEliteFour();
      if (questCache) await loadQuests();
    },
    afterContinue: async () => {
      showGymMoveButtons(normalizePokemon(gymBattle.playerPokemon));
      showGymSwitchButtons();
    },
  });
}

async function gymSwitch(pokemonIndex) {
  if (battleActionBusy) return;
  const previousState = { ...gymBattle };
  setBattleActionBusy(true);
  let data;
  try {
    const response = await fetch("/api/gym/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "switch", pokemonIndex }),
    });
    data = await response.json();
  } catch (error) {
    console.error("Gym switch failed:", error);
    setBattleActionBusy(false);
    alert("Gym switch failed.");
    return;
  }
  if (data.error) {
    alert(data.error);
    setBattleActionBusy(false);
    return;
  }
  await loadInventory();
  await playTrainerBattleTransition({
    previousState,
    nextState: data.session,
    lines: data.log,
    action: "switch",
    pokemonIndex,
    opponentField: "gymPokemon",
    opponentTeamField: "gymTeam",
    opponentIndexField: "gymIndex",
    renderBattle: showGymBattle,
    renderResult: showGymResult,
    assignState: (session) => {
      gymBattle = session;
    },
    won: data.won,
    lost: data.lost,
    afterFinal: async () => {
      gymBattle = null;
      await loadProfile();
      await displayAreas();
      await loadGyms();
      await loadEliteFour();
      if (questCache) await loadQuests();
    },
    afterContinue: async () => {
      showGymMoveButtons(normalizePokemon(gymBattle.playerPokemon));
      showGymSwitchButtons();
    },
  });
}

async function startEliteRun() {
  const response = await fetch("/api/elite/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const data = await response.json();
  if (data.error) {
    alert(data.error);
    return;
  }
  eliteBattle = data.session;
  showEliteBattle(data.log);
  animatePokemonSwitch("opponent", eliteBattle.opponentPokemon);
}

function showEliteBattle(lines = []) {
  setActiveScreen("battle");
  if (!eliteBattle?.playerPokemon || !eliteBattle?.opponentPokemon) {
    showEliteResult(lines);
    return;
  }
  const player = normalizePokemon(eliteBattle.playerPokemon);
  const opponent = normalizePokemon(eliteBattle.opponentPokemon);
  const theme = getLeaderTheme(eliteBattle.trainer.type);
  const encounter = document.getElementById("encounter");
  encounter.innerHTML = `
    <div class="arena-log">
      <div class="arena-trainer-banner leader-${theme.className}">
        <img class="arena-trainer-sprite" src="${getTrainerSprite(eliteBattle.trainer.type, eliteBattle.trainer.name)}" alt="${eliteBattle.trainer.name}">
        <div>
          <h2>${eliteBattle.trainer.name}</h2>
          <p class="weather-info">${eliteBattle.progressLabel} | ${eliteBattle.isChampion ? "Champion Battle" : `${eliteBattle.trainer.type} specialist`} | No healing between rounds</p>
        </div>
        <div class="badge-token badge-${theme.className}">
          <span class="badge-icon">${theme.icon}</span>
          <span>${theme.badge}</span>
        </div>
      </div>
      <div class="battle-help-row">${renderBattleHandbookShortcut("moves")}</div>
      ${renderBattleWeatherHud(eliteBattle.weather || "clear")}
      <div class="battle-container elite-battle-container">
        <div class="battle-pokemon player-side status-${player.status || "none"}${getHpPercent(player.currentHp, player.maxHp) <= 25 ? " low-hp" : ""}">
          <img class="battle-sprite" src="${getPokemonImage(player)}" alt="${player.name}">
          <div class="battle-info">
            <h3>${player.name} Lv${player.level}</h3>
            ${renderTypeBadges(player.types)}
            <div class="hp-bar"><div class="hp-fill" style="width: ${getHpPercent(player.currentHp, player.maxHp)}%"></div></div>
            <p class="hp-line">${renderIcon("heart", "HP")} ${player.currentHp}/${player.maxHp} HP</p>
            ${renderBattleTacticalHud(player)}
          </div>
        </div>
        <div class="vs">VS</div>
        <div class="battle-pokemon opponent-side status-${opponent.status || "none"}${getHpPercent(opponent.currentHp, opponent.maxHp) <= 25 ? " low-hp" : ""}">
          <img class="battle-sprite" src="${getPokemonImage(opponent)}" alt="${opponent.name}">
          <div class="battle-info">
            <h3>${eliteBattle.isChampion ? opponent.name : `${eliteBattle.trainer.name}'s ${opponent.name}`} Lv${opponent.level}</h3>
            ${renderTypeBadges(opponent.types)}
            <div class="hp-bar"><div class="hp-fill" style="width: ${getHpPercent(opponent.currentHp, opponent.maxHp)}%"></div></div>
            <p class="hp-line">${renderIcon("heart", "HP")} ${opponent.currentHp}/${opponent.maxHp} HP</p>
            ${renderBattleTacticalHud(opponent)}
          </div>
        </div>
      </div>
      <div id="elite-move-buttons" class="move-buttons"></div>
      <div id="elite-switch-buttons" class="gym-switch-buttons"></div>
      <div id="battle-log"></div>
    </div>
  `;
  showEliteMoveButtons(player);
  showEliteSwitchButtons();
  presentBattleArena(
    eliteBattle.isChampion ? "champion" : "elite",
    player,
    opponent,
    eliteBattle.weather || "clear",
    lines,
  );
  appendBattleLog(lines);
}

function showEliteResult(lines = []) {
  endBattlePresentation();
  setActiveScreen("battle");
  const encounter = document.getElementById("encounter");
  encounter.innerHTML = `
    <div class="arena-log">
      <h2>Elite Four</h2>
      <div id="battle-log"></div>
      <button class="secondary-btn" onclick="setActiveScreen('gym'); loadEliteFour()">Back to Elite Four</button>
    </div>
  `;
  appendBattleLog(
    lines.length ? lines : ["The Elite Four challenge has ended."],
  );
}

function showEliteMoveButtons(player) {
  const moveButtonsDiv = document.getElementById("elite-move-buttons");
  if (!moveButtonsDiv) return;
  moveButtonsDiv.innerHTML = "";
  player.moves.forEach((move) => {
    moveButtonsDiv.appendChild(
      createBattleMoveButton(move, eliteBattle?.opponentPokemon, eliteMove, player.currentHp <= 0),
    );
  });
}

function showEliteSwitchButtons() {
  const switchDiv = document.getElementById("elite-switch-buttons");
  if (!switchDiv) return;
  switchDiv.innerHTML = `
    <h3>Switch Pokémon</h3>
    ${(eliteBattle.playerTeam || [])
      .map(
        (pokemon, index) =>
          `<button class="secondary-btn" ${battleActionBusy || pokemon.currentHp <= 0 || index === eliteBattle.playerIndex ? "disabled" : ""} onclick="eliteSwitch(${index})">${pokemon.name} ${pokemon.currentHp}/${pokemon.maxHp}</button>`,
      )
      .join("")}
  `;
}

async function eliteMove(moveName) {
  if (battleActionBusy) return;
  const previousState = { ...eliteBattle };
  setBattleActionBusy(true);
  let data;
  try {
    const response = await fetch("/api/elite/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moveName }),
    });
    data = await response.json();
  } catch (error) {
    console.error("Elite move failed:", error);
    setBattleActionBusy(false);
    alert("Elite Four action failed.");
    return;
  }
  if (data.error) {
    if (Array.isArray(data.log)) appendBattleLog(data.log);
    alert(data.error);
    setBattleActionBusy(false);
    if (data.error === "No active Elite Four battle") {
      eliteBattle = null;
      showEliteResult(["The Elite Four challenge has ended."]);
      await loadEliteFour();
      await loadInventory();
      await loadProfile();
      if (questCache) await loadQuests();
    }
    return;
  }
  await loadInventory();
  await playTrainerBattleTransition({
    previousState,
    nextState: data.session,
    lines: data.log,
    moveName,
    opponentField: "opponentPokemon",
    opponentTeamField: "opponentTeam",
    opponentIndexField: "opponentIndex",
    renderBattle: showEliteBattle,
    renderResult: showEliteResult,
    assignState: (session) => {
      eliteBattle = session;
    },
    won: data.won,
    lost: data.lost,
    afterFinal: async () => {
      eliteBattle = null;
      await loadProfile();
      await loadEliteFour();
      await loadGyms();
      if (questCache) await loadQuests();
    },
    afterContinue: async () => {
      showEliteMoveButtons(normalizePokemon(eliteBattle.playerPokemon));
      showEliteSwitchButtons();
    },
  });
}

async function eliteSwitch(pokemonIndex) {
  if (battleActionBusy) return;
  const previousState = { ...eliteBattle };
  setBattleActionBusy(true);
  let data;
  try {
    const response = await fetch("/api/elite/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "switch", pokemonIndex }),
    });
    data = await response.json();
  } catch (error) {
    console.error("Elite switch failed:", error);
    setBattleActionBusy(false);
    alert("Elite Four switch failed.");
    return;
  }
  if (data.error) {
    alert(data.error);
    setBattleActionBusy(false);
    return;
  }
  await loadInventory();
  await playTrainerBattleTransition({
    previousState,
    nextState: data.session,
    lines: data.log,
    action: "switch",
    pokemonIndex,
    opponentField: "opponentPokemon",
    opponentTeamField: "opponentTeam",
    opponentIndexField: "opponentIndex",
    renderBattle: showEliteBattle,
    renderResult: showEliteResult,
    assignState: (session) => {
      eliteBattle = session;
    },
    won: data.won,
    lost: data.lost,
    afterFinal: async () => {
      eliteBattle = null;
      await loadProfile();
      await loadEliteFour();
      await loadGyms();
      if (questCache) await loadQuests();
    },
    afterContinue: async () => {
      showEliteMoveButtons(normalizePokemon(eliteBattle.playerPokemon));
      showEliteSwitchButtons();
    },
  });
}

function showNpcBattle(lines = []) {
  setActiveScreen("battle");
  if (!npcBattle?.playerPokemon || !npcBattle?.opponentPokemon) {
    showNpcResult(lines);
    return;
  }

  const player = normalizePokemon(npcBattle.playerPokemon);
  const opponent = normalizePokemon(npcBattle.opponentPokemon);
  const npc = npcBattle.npc;
  const encounter = document.getElementById("encounter");
  encounter.innerHTML = `
    <div class="arena-log npc-arena-log">
      <div class="arena-trainer-banner npc-trainer-banner">
        <img class="arena-trainer-sprite" src="${getNpcSprite(npc)}" alt="${npc.name}">
        <div>
          <h2>${npc.name}</h2>
          <p class="weather-info">${npcTypeLabels[npc.type] || "Trainer"} battle | No catching | No running</p>
        </div>
        <div class="badge-token npc-badge-token">
          <span class="badge-icon">${getNpcTypeIcon(npc.type)}</span>
          <span>${npc.defeated ? "Rematch Blocked" : `${npc.rewardCoins} coins`}</span>
        </div>
      </div>
      <div class="battle-help-row">${renderBattleHandbookShortcut("moves")}</div>
      ${renderBattleWeatherHud(npcBattle.weather || "clear")}
      <div class="battle-container npc-battle-container">
        <div class="battle-pokemon player-side status-${player.status || "none"}${getHpPercent(player.currentHp, player.maxHp) <= 25 ? " low-hp" : ""}">
          <img class="battle-sprite" src="${getPokemonImage(player)}" alt="${player.name}">
          <div class="battle-info">
            <h3>${player.name} Lv${player.level}</h3>
            ${renderTypeBadges(player.types)}
            <div class="hp-bar"><div class="hp-fill" style="width: ${getHpPercent(player.currentHp, player.maxHp)}%"></div></div>
            <p class="hp-line">${renderIcon("heart", "HP")} ${player.currentHp}/${player.maxHp} HP</p>
            ${renderBattleTacticalHud(player)}
          </div>
        </div>
        <div class="vs">VS</div>
        <div class="battle-pokemon opponent-side status-${opponent.status || "none"}${getHpPercent(opponent.currentHp, opponent.maxHp) <= 25 ? " low-hp" : ""}">
          <img class="battle-sprite" src="${getPokemonImage(opponent)}" alt="${opponent.name}">
          <div class="battle-info">
            <h3>${npc.name}'s ${opponent.name} Lv${opponent.level}</h3>
            ${renderTypeBadges(opponent.types)}
            <div class="hp-bar"><div class="hp-fill" style="width: ${getHpPercent(opponent.currentHp, opponent.maxHp)}%"></div></div>
            <p class="hp-line">${renderIcon("heart", "HP")} ${opponent.currentHp}/${opponent.maxHp} HP</p>
            ${renderBattleTacticalHud(opponent)}
          </div>
        </div>
      </div>
      <div id="npc-move-buttons" class="move-buttons"></div>
      <div id="npc-switch-buttons" class="gym-switch-buttons"></div>
      <div id="battle-log"></div>
    </div>
  `;
  showNpcMoveButtons(player);
  showNpcSwitchButtons();
  presentBattleArena("npc", player, opponent, npcBattle.weather || "clear", lines);
  appendBattleLog(lines);
}

function showNpcResult(lines = []) {
  endBattlePresentation();
  setActiveScreen("battle");
  const encounter = document.getElementById("encounter");
  encounter.innerHTML = `
    <div class="arena-log npc-arena-log">
      <h2>Trainer Battle</h2>
      <div id="battle-log"></div>
      <button class="secondary-btn" onclick="setActiveScreen('explore'); loadAreaWorld(selectedArea)">Back to Route</button>
    </div>
  `;
  appendBattleLog(lines.length ? lines : ["Trainer battle finished."]);
}

function showNpcMoveButtons(player) {
  const moveButtonsDiv = document.getElementById("npc-move-buttons");
  if (!moveButtonsDiv) return;
  moveButtonsDiv.innerHTML = "";
  player.moves.forEach((move) => {
    moveButtonsDiv.appendChild(
      createBattleMoveButton(move, npcBattle?.opponentPokemon, npcMove, player.currentHp <= 0),
    );
  });
}

function showNpcSwitchButtons() {
  const switchDiv = document.getElementById("npc-switch-buttons");
  if (!switchDiv) return;
  switchDiv.innerHTML = `
    <h3>Switch Pokémon</h3>
    ${(npcBattle.playerTeam || [])
      .map(
        (pokemon, index) =>
          `<button class="secondary-btn" ${battleActionBusy || pokemon.currentHp <= 0 || index === npcBattle.playerIndex ? "disabled" : ""} onclick="npcSwitch(${index})">${pokemon.name} ${pokemon.currentHp}/${pokemon.maxHp}</button>`,
      )
      .join("")}
  `;
}

async function npcMove(moveName) {
  if (battleActionBusy) return;
  const previousState = { ...npcBattle };
  setBattleActionBusy(true);
  let data;
  try {
    const response = await fetch("/api/npc/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moveName }),
    });
    data = await response.json();
  } catch (error) {
    console.error("NPC move failed:", error);
    setBattleActionBusy(false);
    alert("Trainer battle action failed.");
    return;
  }
  if (data.error) {
    if (Array.isArray(data.log)) appendBattleLog(data.log);
    alert(data.error);
    setBattleActionBusy(false);
    if (data.error === "No active NPC battle") {
      npcBattle = null;
      showNpcResult(["Trainer battle finished."]);
      await loadAreaWorld(selectedArea);
      await loadProfile();
      await loadInventory();
      if (questCache) await loadQuests();
    }
    return;
  }

  await loadInventory();
  await playTrainerBattleTransition({
    previousState,
    nextState: data.session,
    lines: data.log,
    moveName,
    opponentField: "opponentPokemon",
    opponentTeamField: "opponentTeam",
    opponentIndexField: "opponentIndex",
    renderBattle: showNpcBattle,
    renderResult: showNpcResult,
    assignState: (session) => {
      npcBattle = session;
    },
    won: data.won,
    lost: data.lost,
    afterFinal: async () => {
      npcBattle = null;
      await loadProfile();
      await loadInventory();
      await loadAreaWorld(selectedArea);
      if (questCache) await loadQuests();
    },
    afterContinue: async () => {
      showNpcMoveButtons(normalizePokemon(npcBattle.playerPokemon));
      showNpcSwitchButtons();
    },
  });
}

async function npcSwitch(pokemonIndex) {
  if (battleActionBusy) return;
  const previousState = { ...npcBattle };
  setBattleActionBusy(true);
  let data;
  try {
    const response = await fetch("/api/npc/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "switch", pokemonIndex }),
    });
    data = await response.json();
  } catch (error) {
    console.error("NPC switch failed:", error);
    setBattleActionBusy(false);
    alert("Trainer switch failed.");
    return;
  }
  if (data.error) {
    alert(data.error);
    setBattleActionBusy(false);
    return;
  }
  await loadInventory();
  await playTrainerBattleTransition({
    previousState,
    nextState: data.session,
    lines: data.log,
    action: "switch",
    pokemonIndex,
    opponentField: "opponentPokemon",
    opponentTeamField: "opponentTeam",
    opponentIndexField: "opponentIndex",
    renderBattle: showNpcBattle,
    renderResult: showNpcResult,
    assignState: (session) => {
      npcBattle = session;
    },
    won: data.won,
    lost: data.lost,
    afterFinal: async () => {
      npcBattle = null;
      await loadProfile();
      await loadInventory();
      await loadAreaWorld(selectedArea);
      if (questCache) await loadQuests();
    },
    afterContinue: async () => {
      showNpcMoveButtons(normalizePokemon(npcBattle.playerPokemon));
      showNpcSwitchButtons();
    },
  });
}

async function loadProfile() {
  const response = await fetch("/api/profile");
  playerState = await response.json();
  displayStats();
}

function renderBadgeCollection(earnedBadges = [], compact = false) {
  const earned = new Set(earnedBadges || []);
  const earnedCount = badgeCollection.filter((badge) => earned.has(badge.name)).length;
  return `
    <div class="badge-collection ${compact ? "compact" : ""}">
      ${compact ? "" : `
        <div class="badge-case-header">
          <strong>Badge Case</strong>
          <span>${earnedCount}/${badgeCollection.length}</span>
        </div>
      `}
      ${badgeCollection
        .map((badge) => {
          const unlocked = earned.has(badge.name);
          return `
            <div class="badge-display ${unlocked ? "earned" : "locked"}" title="${unlocked ? badge.name : `${badge.name} locked`}">
              <img src="${badge.icon}" alt="${badge.name}">
              ${compact ? "" : `<span>${badge.label}</span><em>${unlocked ? "Earned" : "Locked"}</em>`}
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function displayStats() {
  const stats = document.getElementById("stats");
  if (!stats || !playerState) return;
  stats.innerHTML = `
    <div class="top-bar">
      <div class="top-brand">
        <strong>Pokemon Adventure</strong>
        <span>${playerState.trainerName}</span>
      </div>
      <div class="top-metric">
        <span>Coins</span>
        <strong>${playerState.coins ?? playerState.money}</strong>
      </div>
      <div class="top-metric badges-metric">
        <div class="metric-title-row">
          <span>Badges</span>
          <strong>${playerState.badges?.length || 0}/${badgeCollection.length}</strong>
        </div>
        ${renderBadgeCollection(playerState.badges || [], true)}
      </div>
      <button
        id="presentation-settings-toggle"
        class="top-settings-button"
        onclick="window.BattlePresentation?.toggleSettings()"
        aria-label="Battle audio and motion settings"
        aria-expanded="false"
        title="Battle settings"
      >Audio</button>
    </div>
  `;
}

async function loadQuests() {
  const panel = document.getElementById("quests-panel");
  if (panel && !questCache) {
    panel.innerHTML = "<p>Loading quests...</p>";
  }
  const response = await fetch("/api/quests");
  questCache = await response.json();
  displayQuests();
}

function formatQuestType(type) {
  const labels = {
    pokemonCaught: "Catch",
    catch: "Catch",
    pokedexCaught: "Collection",
    wildBattlesWon: "Battle",
    npcBattlesWon: "Trainer",
    gymBattlesWon: "Gym",
    badges: "Badge",
    eliteWins: "League",
    championDefeated: "Champion",
  };
  return labels[type] || String(type || "Quest");
}

function getQuestItemMeta(itemId) {
  return shopCatalog.find((item) => item.id === itemId) || {
    id: itemId,
    name: itemId,
    icon: itemId,
  };
}

function renderQuestReward(reward = {}) {
  const itemEntries = Array.isArray(reward.items)
    ? reward.items.map((item) => [item.id, item.quantity])
    : Object.entries(reward.items || {});
  const rewards = [];
  if (reward.coins) rewards.push(`<span>${reward.coins} coins</span>`);
  itemEntries.forEach(([itemId, quantity]) => {
    const item = getQuestItemMeta(itemId);
    rewards.push(
      `<span>${renderIcon(item.icon, item.name)} ${quantity} ${item.name}</span>`,
    );
  });
  return rewards.length ? rewards.join("") : "<span>No reward listed</span>";
}

function getQuestChainLabel(chain) {
  const labels = {
    catch: "Catching Path",
    battle: "Battle Path",
    trainer: "Trainer Path",
    badge: "Badge Case Path",
  };
  return labels[chain] || "Adventure Path";
}

function groupQuestsByChain(quests = []) {
  return quests.reduce((groups, quest) => {
    const chain = quest.chain || "adventure";
    if (!groups[chain]) groups[chain] = [];
    groups[chain].push(quest);
    return groups;
  }, {});
}

function renderQuestCard(quest) {
  const status = quest.claimed ? "Claimed" : quest.claimable ? "Ready" : "Active";
  const tier = quest.tier ? `Tier ${quest.tier}` : formatQuestType(quest.type);
  return `
    <article class="quest-card ${quest.claimed ? "claimed" : ""} ${quest.claimable ? "claimable" : ""}">
      <div class="quest-card-head">
        <span>${tier}</span>
        <em>${status}</em>
      </div>
      <h3>${quest.title}</h3>
      <p>${quest.description}</p>
      <div class="quest-progress-line">
        <span>${quest.progress}/${quest.goal}</span>
        <strong>${quest.percent}%</strong>
      </div>
      <div class="quest-progress-bar">
        <div style="width: ${quest.percent}%"></div>
      </div>
      <div class="quest-rewards">
        ${renderQuestReward(quest.reward)}
      </div>
      <button class="primary-action" onclick="claimQuest('${quest.id}')" ${quest.claimable ? "" : "disabled"}>
        ${quest.claimed ? "Claimed" : quest.claimable ? "Claim Reward" : "In Progress"}
      </button>
    </article>
  `;
}

function displayQuests() {
  const panel = document.getElementById("quests-panel");
  if (!panel) return;
  if (!questCache?.quests) {
    panel.innerHTML = "<p>No quests available yet.</p>";
    return;
  }

  const summary = questCache.summary || {};
  const quests = questCache.quests;
  const questGroups = groupQuestsByChain(quests);
  panel.innerHTML = `
    <div class="quests-header">
      <div>
        <h2>Quests</h2>
        <p>Complete missions as you explore, catch, battle, and earn badges.</p>
      </div>
      <button class="secondary-btn" onclick="loadQuests()">Refresh</button>
    </div>
    <div class="quest-summary">
      <div><span>Available</span><strong>${summary.available ?? quests.length}</strong></div>
      <div><span>Complete</span><strong>${summary.completed ?? 0}</strong></div>
      <div><span>Claimable</span><strong>${summary.claimable ?? 0}</strong></div>
      <div><span>Locked Next</span><strong>${summary.hidden ?? 0}</strong></div>
    </div>
    <p class="quest-chain-note">Completed quests reveal the next tier automatically, like Catch 1 -> Catch 5 -> Catch 15.</p>
    <div class="quest-chain-list">
      ${Object.entries(questGroups)
        .map(([chain, chainQuests]) => `
          <section class="quest-chain-section">
            <div class="quest-chain-header">
              <h3>${getQuestChainLabel(chain)}</h3>
              <span>${chainQuests.filter((quest) => quest.completed).length}/${chainQuests.length} complete</span>
            </div>
            <div class="quest-grid">
              ${chainQuests.map(renderQuestCard).join("")}
            </div>
          </section>
        `)
        .join("")}
    </div>
  `;
}

async function claimQuest(questId) {
  const response = await fetch("/api/quests/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questId }),
  });
  const data = await response.json();
  if (data.error) {
    alert(data.error);
    return;
  }
  if (data.state) playerState = data.state;
  questCache = {
    summary: data.summary,
    quests: data.quests,
    stats: data.state?.questStats || questCache?.stats || {},
    claimed: data.state?.quests?.claimed || questCache?.claimed || [],
  };
  displayStats();
  displayQuests();
  displayBag();
  const rewardLines = [data.message];
  if (data.reward?.coins) rewardLines.push(`You earned ${data.reward.coins} coins.`);
  (data.reward?.items || []).forEach((item) => {
    rewardLines.push(`You received ${item.quantity} ${item.name}.`);
  });
  showRewardPopup(rewardLines);
}

async function loadPokedex() {
  const panel = document.getElementById("pokedex-panel");
  if (panel && !pokedexCache) {
    panel.innerHTML = "<p>Loading Pokédex...</p>";
  }
  const response = await fetch("/api/pokedex");
  pokedexCache = await response.json();
  (pokedexCache.entries || []).forEach((entry) => {
    if (entry.name && entry.imageId) {
      pokemonImageIdByName.set(entry.name, entry.imageId);
    }
  });
  console.log("Pokedex entries received:", pokedexCache.entries?.length || 0);
  displayPokedex();
}

function getPokedexFilterOptions(key) {
  if (!pokedexCache?.entries) return [];
  const values = new Set();
  pokedexCache.entries.forEach((entry) => {
    if (key === "habitat") {
      (entry.habitats || []).forEach((habitat) => values.add(habitat));
    } else if (key === "type") {
      (entry.types || []).forEach((type) => values.add(type));
    } else if (entry[key]) {
      values.add(entry[key]);
    }
  });
  return [...values].sort();
}

function setPokedexStatusFilter(status) {
  if (status === "all") {
    resetPokedexFilters();
    return;
  }
  pokedexFilters.status = status;
  pokedexPage = 1;
  displayPokedex();
}

function updatePokedexSelectFilter(key, value) {
  pokedexFilters[key] = value;
  pokedexPage = 1;
  displayPokedex();
}

function updatePokedexSearch(value) {
  pokedexFilters.search = value;
  pokedexPage = 1;
  displayPokedex();
}

function setPokedexPage(page) {
  pokedexPage = Math.max(1, Number(page) || 1);
  displayPokedex();
  document.getElementById("pokedex-panel")?.scrollTo({ top: 0, behavior: "smooth" });
}

function resetPokedexFilters() {
  pokedexFilters = {
    status: "all",
    habitat: "all",
    type: "all",
    rarity: "all",
    availability: "all",
    search: "",
  };
  pokedexPage = 1;
  displayPokedex();
}

function getFilteredPokedexEntries() {
  if (!pokedexCache?.entries) return [];
  const searchTerm = (pokedexFilters.search || "").trim().toLowerCase();
  return pokedexCache.entries.filter((entry) => {
    if (pokedexFilters.status === "seen" && !entry.seen) return false;
    if (pokedexFilters.status === "caught" && !entry.caught) return false;
    if (pokedexFilters.status === "uncaught" && entry.caught) return false;
    if (
      pokedexFilters.status === "legendary" &&
      !["legendary", "mythical"].includes(entry.rarity)
    ) {
      return false;
    }
    if (
      pokedexFilters.habitat !== "all" &&
      !(entry.habitats || []).includes(pokedexFilters.habitat)
    ) {
      return false;
    }
    if (
      pokedexFilters.type !== "all" &&
      !(entry.types || []).includes(pokedexFilters.type)
    ) {
      return false;
    }
    if (
      pokedexFilters.rarity !== "all" &&
      entry.rarity !== pokedexFilters.rarity
    ) {
      return false;
    }
    if (
      pokedexFilters.availability !== "all" &&
      entry.availability?.status !== pokedexFilters.availability
    ) {
      return false;
    }
    if (searchTerm) {
      const searchable = [
        entry.name,
        entry.rarity,
        ...(entry.types || []),
        ...(entry.habitats || []),
        entry.availability?.status,
        ...(entry.availability?.areas || []),
      ]
        .join(" ")
        .toLowerCase();
      if (!searchable.includes(searchTerm)) return false;
    }
    return true;
  });
}

function escapePokedexSearchValue(value) {
  return String(value || "").replace(/"/g, "&quot;");
}

function renderPokedexSelect(key, label, values, formatter = (value) => value) {
  return `
    <label class="pokedex-filter-select">
      <span>${label}</span>
      <select onchange="updatePokedexSelectFilter('${key}', this.value)">
        <option value="all">All</option>
        ${values
          .map(
            (value) =>
              `<option value="${value}" ${pokedexFilters[key] === value ? "selected" : ""}>${formatter(value)}</option>`,
          )
          .join("")}
      </select>
    </label>
  `;
}

function renderEvolutionChain(entry, canShowDetails) {
  const graph = entry.evolutionGraph || {
    stages: entry.evolutionChain || [],
    edges: [],
  };
  const stages = graph.stages || [];
  const edges = graph.edges || [];
  if (stages.length <= 1) {
    return `<div class="pokedex-evolution"><p>${canShowDetails ? "No further evolution" : "Evolution: unknown"}</p></div>`;
  }
  const targetSpeciesIds = new Set(edges.map((edge) => edge.toSpeciesId));
  const roots = stages.filter(
    (stage) => !targetSpeciesIds.has(stage.speciesId),
  );
  const depthBySpeciesId = new Map(
    (roots.length ? roots : stages.slice(0, 1)).map((stage) => [
      stage.speciesId,
      0,
    ]),
  );
  let changed = true;
  while (changed) {
    changed = false;
    edges.forEach((edge) => {
      const parentDepth = depthBySpeciesId.get(edge.fromSpeciesId);
      if (parentDepth === undefined) return;
      const nextDepth = parentDepth + 1;
      if ((depthBySpeciesId.get(edge.toSpeciesId) ?? -1) < nextDepth) {
        depthBySpeciesId.set(edge.toSpeciesId, nextDepth);
        changed = true;
      }
    });
  }
  const layers = [...new Set(stages.map((stage) => depthBySpeciesId.get(stage.speciesId) || 0))]
    .sort((left, right) => left - right)
    .map((depth) =>
      stages.filter(
        (stage) => (depthBySpeciesId.get(stage.speciesId) || 0) === depth,
      ),
    );
  const edgeLabel = (edge) => {
    return (edge?.conditionLabels || []).join(" / ") || "Evolve";
  };
  const renderStage = (stage, depth) => {
    const visible = stage.seen || stage.caught;
    const incoming = edges.filter(
      (edge) => edge.toSpeciesId === stage.speciesId,
    );
    const knownParent = incoming.some((edge) =>
      stages.some(
        (candidate) =>
          candidate.speciesId === edge.fromSpeciesId &&
          (candidate.seen || candidate.caught),
      ),
    );
    return `
      <div class="evolution-branch-node">
        ${
          depth > 0
            ? `<div class="evolution-chain-arrow"><span>${visible && knownParent ? incoming.map(edgeLabel).join(" / ") : "???"}</span><b>↓</b></div>`
            : ""
        }
        <div class="evolution-chain-stage ${visible ? "known" : "hidden-stage"}">
          <img src="${getPokemonImage(stage)}" alt="${visible ? stage.name : "Unknown evolution"}" onerror="handleExternalImageError(event)">
          <div>
            <strong>${visible ? stage.name : "???"}</strong>
            <small>${visible ? `#${String(stage.speciesId ?? stage.id).padStart(3, "0")}` : "#???"}</small>
            ${visible ? renderTypeBadges(stage.types || [stage.type]) : ""}
          </div>
        </div>
      </div>
    `;
  };
  return `
    <div class="pokedex-evolution">
      <strong class="evolution-chain-title">Evolution family</strong>
      <div class="evolution-chain-list">
        ${layers
          .map(
            (layer, depth) => `
              <div class="evolution-chain-level ${layer.length > 1 ? "branching" : ""}">
                ${layer.map((stage) => renderStage(stage, depth)).join("")}
              </div>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderLegendaryHint(entry, canShowDetails) {
  if (!["legendary", "mythical"].includes(entry.rarity)) return "";
  const habitat = entry.habitats?.[0]
    ? formatAreaName(entry.habitats[0])
    : "a hidden area";
  const time = entry.times?.[0] || "rare conditions";
  const clue = canShowDetails
    ? `Rumored to appear in ${formatList(entry.habitats, formatAreaName)} during ${formatList(entry.times)}.`
    : `Rumored to appear in ${habitat} at ${time}.`;
  return `<p class="legendary-hint">Extremely rare. ${clue}</p>`;
}

function getAvailabilityLabel(status) {
  return {
    wild: "Wild",
    evolution: "Evolution-only",
    special: "Special",
    unavailable: "Unavailable",
  }[status] || "Unknown";
}

function renderAvailability(entry, canShowDetails) {
  const availability = entry.availability || {};
  const label = getAvailabilityLabel(availability.status);
  const areas = availability.areas || [];
  const hint = areas.length
    ? `${canShowDetails ? "Area" : "Area hint"}: ${formatList(areas, formatAreaName)}`
    : canShowDetails
      ? availability.reason || "No wild area"
      : "Discover this Pokémon to reveal its requirements.";
  return `
    <div class="pokedex-availability availability-${availability.status || "unavailable"}">
      <strong>${label}</strong><span>${escapeHtml(hint)}</span>
    </div>
  `;
}

function renderPokedexCard(entry) {
  const canShowDetails = entry.seen || entry.caught;
  const status = entry.caught ? "Caught" : entry.seen ? "Seen" : "Unknown";
  const cardClass = `pokedex-card ${entry.caught ? "caught" : entry.seen ? "seen" : "unknown"}`;
  const habitats = formatList(entry.habitats, formatAreaName);
  const times = formatList(entry.times);
  const displayName = canShowDetails ? entry.name : "???";
  return `
    <article class="${cardClass}">
      <div class="pokedex-card-art">
        ${
          canShowDetails
            ? `<img src="${getPokemonImage(entry)}" alt="${entry.name}">`
            : `<div class="pokedex-silhouette">?</div>`
        }
      </div>
      <div class="pokedex-card-body">
        <div class="pokedex-card-head">
          <span>#${String(entry.speciesId ?? entry.id).padStart(3, "0")}</span>
          <strong>${displayName}</strong>
          <em>${status}</em>
        </div>
        <div class="pokedex-tags">
          <span class="rarity-pill rarity-${entry.rarity}">${entry.rarity}</span>
          ${canShowDetails ? renderTypeBadges(entry.types || []) : ""}
        </div>
        ${renderAvailability(entry, canShowDetails)}
        ${
          canShowDetails
            ? `
              <p>Habitats: ${habitats}</p>
              <p>Availability: ${times}</p>
              <p>Base catch rate: ${entry.baseCatchRate ?? "Unknown"}</p>
              <p>Abilities: ${escapeHtml((entry.abilities || []).map(formatAbilityName).join(", ") || "Unknown")}</p>
              <p>Level-up moves: ${(entry.learnset || []).length}${entry.learnsetVersionGroup ? ` (${escapeHtml(entry.learnsetVersionGroup)})` : ""}</p>
              ${renderEvolutionChain(entry, true)}
            `
            : `
              <p>Habitat clue: ${habitats || "Unknown"}</p>
              <p>Not encountered yet. Details unlock after you see it.</p>
              ${renderEvolutionChain(entry, false)}
            `
        }
        ${renderLegendaryHint(entry, canShowDetails)}
        ${renderPokedexForms(entry, canShowDetails)}
      </div>
    </article>
  `;
}

function renderPokedexForms(entry, canShowSpecies) {
  if (!Array.isArray(entry.forms) || !entry.forms.length) return "";
  const discoveredCount = entry.forms.filter(
    (form) =>
      canShowSpecies &&
      (form.seen || form.caught || form.shinySeen || form.shinyCaught),
  ).length;
  return `
    <div class="pokedex-forms">
      <strong>Forms discovered: ${discoveredCount}/${entry.forms.length}</strong>
      ${entry.forms
        .map((form) => {
          const discovered = Boolean(
            canShowSpecies &&
              (form.seen || form.caught || form.shinySeen || form.shinyCaught),
          );
          if (!discovered) {
            return `
              <div class="pokedex-form-row undiscovered">
                <span class="pokedex-form-silhouette">?</span>
                <span><b>Alternate form not discovered</b><small>Your caught form is already registered. Encounter this separate form to reveal it.</small></span>
              </div>
            `;
          }
          const formPokemon = {
            id: entry.id,
            name: entry.name,
            imageId: form.imageId,
            form: form.id === "normal" ? null : form,
          };
          return `
            <div class="pokedex-form-row">
              <span class="pokedex-form-art">
                <img src="${getPokemonImage(formPokemon)}" alt="${escapeHtml(form.name)}">
                ${form.shinySeen ? `<img src="${getPokemonImage({ ...formPokemon, shiny: true })}" alt="Shiny ${escapeHtml(form.name)}">` : ""}
              </span>
              <span>
                <b>${escapeHtml(form.name)}</b>
                <small>${form.caught ? "Caught" : "Seen"} · Shiny ${form.shinyCaught ? "caught" : form.shinySeen ? "seen" : "not found"}</small>
              </span>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function displayPokedex() {
  const panel = document.getElementById("pokedex-panel");
  if (!panel) return;
  if (!pokedexCache?.entries) {
    panel.innerHTML = "<p>Loading Pokédex...</p>";
    return;
  }

  const entries = getFilteredPokedexEntries();
  console.log("Pokedex entries displayed:", entries.length);
  const habitats = getPokedexFilterOptions("habitat");
  const types = getPokedexFilterOptions("type");
  const rarities = getPokedexFilterOptions("rarity");
  const achievements = pokedexCache.achievements || [];
  const pageCount = Math.max(1, Math.ceil(entries.length / POKEDEX_PAGE_SIZE));
  pokedexPage = Math.min(pokedexPage, pageCount);
  const pageStart = (pokedexPage - 1) * POKEDEX_PAGE_SIZE;
  const pageEntries = entries.slice(pageStart, pageStart + POKEDEX_PAGE_SIZE);

  panel.innerHTML = `
    <div class="screen-header pokedex-header">
      <div>
        <h2>Pokédex</h2>
        <p>Track every Pokémon you have seen, caught, and still need to discover.</p>
      </div>
      <button class="secondary-btn" onclick="loadPokedex()">Refresh</button>
    </div>
    <div class="pokedex-summary">
      <div><span>Total</span><strong>${pokedexCache.total}</strong></div>
      <div><span>Showing</span><strong>${entries.length}</strong></div>
      <div><span>Seen</span><strong>${pokedexCache.seenCount}</strong></div>
      <div><span>Caught</span><strong>${pokedexCache.caughtCount}</strong></div>
      <div><span>Complete</span><strong>${pokedexCache.caughtPercent}%</strong></div>
    </div>
    <div class="pokedex-trainer-card">
      <div>
        <strong>Trainer Milestones</strong>
        <p>${achievements.length ? achievements.join(" • ") : "Start exploring to unlock achievements."}</p>
      </div>
      <span>Showing ${entries.length}/${pokedexCache.total}</span>
    </div>
    <div class="pokedex-filters">
      <div class="pokedex-filter-buttons">
        ${["all", "seen", "caught", "uncaught", "legendary"]
          .map(
            (status) => `
              <button class="mini-btn ${pokedexFilters.status === status ? "active" : ""}" onclick="setPokedexStatusFilter('${status}')">
                ${status === "legendary" ? "Legendary/Mythical" : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            `,
          )
          .join("")}
      </div>
      <label class="pokedex-search">
        <span>Search</span>
        <input
          type="search"
          value="${escapePokedexSearchValue(pokedexFilters.search)}"
          placeholder="Name, type, biome, rarity"
          oninput="updatePokedexSearch(this.value)"
        >
      </label>
      <div class="pokedex-selects">
        ${renderPokedexSelect("habitat", "Biome", habitats, formatAreaName)}
        ${renderPokedexSelect("type", "Type", types)}
        ${renderPokedexSelect("rarity", "Rarity", rarities)}
        ${renderPokedexSelect(
          "availability",
          "Obtainable",
          ["wild", "evolution", "special", "unavailable"],
          getAvailabilityLabel,
        )}
        <button class="secondary-btn" onclick="resetPokedexFilters()">Clear</button>
      </div>
    </div>
    <p class="pokedex-note">Legendary Pokémon are extremely rare and usually appear only in specific biomes.</p>
    <div class="pokedex-grid">
      ${
        entries.length
          ? pageEntries.map(renderPokedexCard).join("")
          : "<p>No Pokémon match these filters.</p>"
      }
    </div>
    ${
      entries.length
        ? `<nav class="pokedex-pagination" aria-label="Pokédex pages">
            <button class="secondary-btn" onclick="setPokedexPage(${pokedexPage - 1})" ${pokedexPage === 1 ? "disabled" : ""}>Previous</button>
            <span>Page ${pokedexPage} of ${pageCount} · ${pageStart + 1}-${Math.min(pageStart + pageEntries.length, entries.length)} of ${entries.length}</span>
            <button class="secondary-btn" onclick="setPokedexPage(${pokedexPage + 1})" ${pokedexPage === pageCount ? "disabled" : ""}>Next</button>
          </nav>`
        : ""
    }
  `;
}

async function loadShop() {
  const response = await fetch("/api/shop");
  const data = await response.json();
  shopCatalog = data.catalog || [];
  if (playerState) {
    playerState.coins = data.coins ?? data.money;
    playerState.money = playerState.coins;
    playerState.items = data.items;
  }
  displayStats();
  displayShop();
  if (teamCache.length > 0 || storageCache.length > 0) {
    displayParty(teamCache);
    displayStorage(storageCache);
    displayBag();
  }
}

function displayShop() {
  const shop = document.getElementById("shop");
  if (!shop) return;
  if (!shopCatalog.length || !playerState) {
    shop.innerHTML = "";
    return;
  }
  const featuredItems = shopCatalog;
  shop.innerHTML = `
    <div class="panel-header">
      <div>
        <h3>${renderIcon("backpack", "Shop")} Shop</h3>
        <p>Buy essentials with your coins.</p>
      </div>
      <strong>${playerState.coins ?? playerState.money} coins</strong>
    </div>
      <div class="shop-grid">
        ${featuredItems
          .map(
            (item) => `
              <button class="shop-item icon-button" onclick="buyItem('${item.id}')">
                ${renderIcon(item.icon, item.name)}
                <span>${item.name}</span>
                <strong>${item.price}</strong>
              </button>
            `,
          )
          .join("")}
      </div>
  `;
}

async function buyItem(itemId) {
  const response = await fetch("/api/shop/buy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemId, quantity: 1 }),
  });
  const data = await response.json();
  if (data.error) {
    if (Array.isArray(data.log)) appendBattleLog(data.log);
    alert(data.error);
    return;
  }
  playerState = data.state;
  displayStats();
  displayShop();
  displayParty(teamCache);
  displayStorage(storageCache);
  displayBag();
}

async function loadInventory() {
  const battleStates =
    wild && isInBattle
      ? teamCache.map((pokemon) =>
          pokemon.battleState
            ? JSON.parse(JSON.stringify(pokemon.battleState))
            : null,
        )
      : [];
  const response = await fetch("/api/inventory");
  const data = await response.json();
  teamCache = (data.team || []).map(normalizePokemon);
  battleStates.forEach((battleState, index) => {
    if (battleState && teamCache[index]) {
      teamCache[index] = normalizePokemon({
        ...teamCache[index],
        battleState,
      });
    }
  });
  storageCache = (data.storage || []).map(normalizePokemon);
  partyPresetCache = data.partyPresets || [];

  if (teamCache.length > 0) {
    if (activeInventoryIndex >= teamCache.length) activeInventoryIndex = 0;
    activePokemon = teamCache[activeInventoryIndex];
  } else {
    activeInventoryIndex = 0;
    activePokemon = null;
  }

  displayCurrentPlayer();
  displayParty(teamCache);
  displayStorage(storageCache);
  displayBag();
}

function displayParty(data) {
  const usableItems = getUsableItems();
  let html = `
    <div class="inventory-header">
      <h3>Team (${data.length}/${PARTY_LIMIT})</h3>
      <span class="xp-help" title="Every Pokemon in your active party shares XP from battles. Storage Pokemon do not gain XP. Leveling uses a cubic growth curve, so higher levels need much more XP.">XP help</span>
      <button class="secondary-btn icon-button" onclick="healTeam()">${renderIcon("potion", "Potion")} Heal All</button>
    </div>
  `;

  if (data.length === 0) {
    html += "<p>No Pokémon in your team yet.</p>";
  }
  html += `<div class="party-grid">`;
  data.forEach((p, index) => {
    const isActive = index === activeInventoryIndex;
    const fainted = (p.currentHp ?? p.hp) <= 0;
    html += `<div class="inventory-item party-card${isActive ? " active" : ""}" onclick="selectPokemon(${index})">
        <img src="${getPokemonImage(p)}" alt="${p.name}">
        <div class="item-info">
          <div class="inventory-top">
            <strong>${getPokemonDisplayName(p)}</strong> Lv${p.level}
            ${renderVariantBadges(p)}
            ${renderTypeBadges(p.types)}
            ${isActive ? '<span class="active-label">ACTIVE</span>' : ""}
          </div>
          <div class="hp-bar-small"><div class="hp-fill" style="width: ${getHpPercent(p.currentHp ?? p.hp, p.maxHp)}%"></div></div>
          ${renderXpBar(p)}
          <p>${renderIcon("heart", "HP")} ${p.currentHp ?? p.hp}/${p.maxHp} HP ${fainted ? renderStatus("fainted") : renderStatus(p.status)}</p>
          <div class="bag-actions">
            <button onclick="setActivePokemonByIndex(event, ${index})" class="mini-item-btn icon-button">Make Active</button>
            <button onclick="event.stopPropagation(); showPokemonDetail('team', ${index})" class="mini-item-btn icon-button">Details</button>
            ${usableItems.length ? `<button onclick="setActiveScreen('inventory'); setActivePokemonByIndex(event, ${index})" class="mini-item-btn icon-button">Use Items</button>` : ""}
            <button onclick="releasePokemon(event, 'team', ${index})" class="mini-btn">Release</button>
          </div>
        </div>
    </div>`;
  });
  for (let index = data.length; index < PARTY_LIMIT; index += 1) {
    html += `
        <div class="party-slot-empty" aria-label="Empty party slot ${index + 1}">
          <span>${index + 1}</span>
          <strong>Empty slot</strong>
        </div>
    `;
  }
  html += `</div>`;
  html += `
    <div class="storage-summary">
      <div>
        <span>PC Storage</span>
        <strong>${storageCache.length} Pokemon stored</strong>
      </div>
      <button class="secondary-btn" onclick="openOverlay('storage')">Open Storage</button>
    </div>
  `;
  document.getElementById("party-panel").innerHTML = html;
}

function selectQuickPokemon(index) {
  if (!teamCache[index]) return;
  quickPokemonSelectedIndex = index;
  quickPokemonDetailIndex = null;
  renderQuickPokemon();
}

function makeQuickPokemonActive(index) {
  const pokemon = teamCache[index];
  if (!pokemon || (pokemon.currentHp ?? pokemon.hp ?? 0) <= 0) return;
  if (isInBattle || npcBattle || gymBattle || eliteBattle || battleActionBusy)
    return;
  setActivePokemonByIndex(null, index);
  quickPokemonSelectedIndex = index;
  renderQuickPokemon();
}

function showQuickPokemonDetails(index) {
  if (!teamCache[index]) return;
  quickPokemonDetailIndex = index;
  renderQuickPokemon();
}

function closeQuickPokemonDetails() {
  quickPokemonDetailIndex = null;
  renderQuickPokemon();
}

function useItemsFromQuickPokemon(index) {
  if (!teamCache[index]) return;
  setActivePokemonByIndex(null, index);
  closeOverlay();
  setActiveScreen("inventory");
}

async function healTeamFromQuickPokemon() {
  await healTeam();
  if (activeOverlay === "quickPokemon") renderQuickPokemon();
}

function renderQuickPokemon() {
  const panel = document.getElementById("quick-pokemon");
  if (!panel) return;

  if (Number.isInteger(quickPokemonDetailIndex)) {
    const pokemon = teamCache[quickPokemonDetailIndex];
    if (pokemon) {
      panel.innerHTML = `
        <div class="quick-detail-head">
          <button class="secondary-btn" onclick="closeQuickPokemonDetails()">Back</button>
          <strong>Party slot ${quickPokemonDetailIndex + 1}</strong>
        </div>
        ${renderPokemonDetailCard(
          pokemon,
          "Party Details",
          "team",
          quickPokemonDetailIndex,
        )}
      `;
      return;
    }
    quickPokemonDetailIndex = null;
  }

  if (!teamCache.length) {
    panel.innerHTML = "<p>Your party is empty.</p>";
    return;
  }

  if (!teamCache[quickPokemonSelectedIndex]) {
    quickPokemonSelectedIndex = activeInventoryIndex < teamCache.length
      ? activeInventoryIndex
      : 0;
  }
  const active = teamCache[activeInventoryIndex] || teamCache[0];
  const selected = teamCache[quickPokemonSelectedIndex];
  const selectedHp = selected.currentHp ?? selected.hp ?? 0;

  let slots = teamCache
    .map((pokemon, index) => {
      const hp = pokemon.currentHp ?? pokemon.hp ?? 0;
      const isActive = index === activeInventoryIndex;
      const isSelected = index === quickPokemonSelectedIndex;
      return `
        <button class="quick-party-slot${isActive ? " active" : ""}${isSelected ? " selected" : ""}" onclick="selectQuickPokemon(${index})">
          <img src="${getPokemonImage(pokemon)}" alt="${escapeHtml(pokemon.name)}">
          <span>
            <strong>${escapeHtml(getPokemonDisplayName(pokemon))}${isActive ? " · Active" : ""}</strong>
            <span class="variant-badges">${renderVariantBadges(pokemon)}</span>
            <small>Lv${pokemon.level || 1} · ${hp}/${pokemon.maxHp} HP</small>
          </span>
        </button>
      `;
    })
    .join("");
  for (let index = teamCache.length; index < PARTY_LIMIT; index += 1) {
    slots += `
      <div class="quick-party-slot empty" aria-label="Empty party slot ${index + 1}">
        <span><strong>Empty</strong><small>Party slot ${index + 1}</small></span>
      </div>
    `;
  }

  panel.innerHTML = `
    <div class="quick-active-card">
      <div class="quick-active-label">Active Pokemon</div>
      <img src="${getPokemonImage(active)}" alt="${escapeHtml(active.name)}">
      <div class="quick-active-info">
        <h3>${escapeHtml(getPokemonDisplayName(active))} <span>Lv${active.level || 1}</span></h3>
        <div class="variant-badges">${renderVariantBadges(active)}</div>
        <div>${renderTypeBadges(active.types || [active.type])}</div>
        <div class="hp-bar-small"><div class="hp-fill" style="width: ${getHpPercent(active.currentHp ?? active.hp, active.maxHp)}%"></div></div>
        <p>${active.currentHp ?? active.hp}/${active.maxHp} HP · ${
          (active.currentHp ?? active.hp ?? 0) <= 0
            ? "Fainted"
            : formatStatus(active.status)
        }</p>
        ${renderXpBar(active)}
      </div>
      <button class="secondary-btn icon-button" onclick="healTeamFromQuickPokemon()">${renderIcon("potion", "Potion")} Heal All</button>
    </div>
    <div class="quick-party-head">
      <div>
        <h3>Party</h3>
        <p>Select a Pokemon for quick actions.</p>
      </div>
      <strong>${teamCache.length}/${PARTY_LIMIT}</strong>
    </div>
    <div class="quick-party-grid">${slots}</div>
    <div class="quick-selection-bar">
      <div>
        <span>Selected</span>
        <strong>${escapeHtml(getPokemonDisplayName(selected))} · Lv${selected.level || 1}</strong>
      </div>
      <div class="quick-selection-actions">
        <button onclick="makeQuickPokemonActive(${quickPokemonSelectedIndex})" ${
          quickPokemonSelectedIndex === activeInventoryIndex || selectedHp <= 0
            ? "disabled"
            : ""
        }>Make Active</button>
        <button class="secondary-btn" onclick="showQuickPokemonDetails(${quickPokemonSelectedIndex})">Details</button>
        <button class="secondary-btn" onclick="useItemsFromQuickPokemon(${quickPokemonSelectedIndex})">Use Items</button>
      </div>
    </div>
  `;
}

function displayStorage(storage) {
  if (activeOverlay === "storage") renderStorageBrowser(storage);
}

function getFilteredStorage(storage = storageCache) {
  const search = storageUiState.search.trim().toLowerCase();
  const filtered = storage
    .map((pokemon, originalIndex) => ({ pokemon, originalIndex }))
    .filter(({ pokemon }) => {
      const types = Array.isArray(pokemon.types) ? pokemon.types : [pokemon.type];
      if (search && !pokemon.name.toLowerCase().includes(search)) return false;
      if (storageUiState.type !== "all" && !types.includes(storageUiState.type))
        return false;
      if (
        storageUiState.rarity !== "all" &&
        pokemon.rarity !== storageUiState.rarity
      )
        return false;
      const formCategory = pokemon.form?.category || "normal";
      if (storageUiState.form !== "all" && formCategory !== storageUiState.form)
        return false;
      if (storageUiState.shiny === "shiny" && !pokemon.shiny) return false;
      if (storageUiState.shiny === "non-shiny" && pokemon.shiny) return false;
      return true;
    });

  filtered.sort((left, right) => {
    if (storageUiState.sort === "name")
      return left.pokemon.name.localeCompare(right.pokemon.name);
    if (storageUiState.sort === "level-asc")
      return (left.pokemon.level || 1) - (right.pokemon.level || 1);
    if (storageUiState.sort === "level-desc")
      return (right.pokemon.level || 1) - (left.pokemon.level || 1);
    if (storageUiState.sort === "rarity") {
      const rarityRank = {
        mythical: 5,
        legendary: 4,
        rare: 3,
        uncommon: 2,
        common: 1,
      };
      return (
        (rarityRank[right.pokemon.rarity] || 0) -
        (rarityRank[left.pokemon.rarity] || 0)
      );
    }
    return (left.pokemon.id || 0) - (right.pokemon.id || 0);
  });
  return filtered;
}

function updateStorageFilter(key, value) {
  if (!Object.hasOwn(storageUiState, key)) return;
  storageUiState[key] = value;
  storageUiState.page = 1;
  storageUiState.detailIndex = null;
  renderStorageBrowser();
  if (key === "search") {
    requestAnimationFrame(() => {
      const search = document.getElementById("storage-search");
      search?.focus();
      search?.setSelectionRange(search.value.length, search.value.length);
    });
  }
}

function changeStoragePage(direction) {
  storageUiState.page += direction;
  renderStorageBrowser();
}

function showStoragePokemonDetail(index) {
  if (!storageCache[index]) return;
  storageUiState.detailIndex = index;
  renderStorageBrowser();
}

function closeStoragePokemonDetail() {
  storageUiState.detailIndex = null;
  renderStorageBrowser();
}

function renderStorageBrowser(storage = storageCache) {
  const browser = document.getElementById("storage-browser");
  if (!browser) return;

  if (
    Number.isInteger(storageUiState.detailIndex) &&
    storage[storageUiState.detailIndex]
  ) {
    const index = storageUiState.detailIndex;
    const pokemon = storage[index];
    browser.innerHTML = `
      <div class="storage-detail-head">
        <button class="secondary-btn" onclick="closeStoragePokemonDetail()">Back to Storage</button>
        <div class="storage-card-actions">
          <button class="secondary-btn" onclick="addPokemonToPartyPreset('${escapeHtml(pokemon.ownedId)}')" ${isPokemonInActivePreset(pokemon.ownedId) || isActivePartyPresetFull() ? "disabled" : ""}>${isPokemonInActivePreset(pokemon.ownedId) ? "Already Added" : isActivePartyPresetFull() ? "Party Full" : `Add to Party ${activePartyPresetSlot}`}</button>
          <button class="swap-btn" onclick="swapWithStorage(${index})">Move to Team</button>
          <button class="mini-btn" onclick="releasePokemon(event, 'storage', ${index})">Release</button>
        </div>
      </div>
      ${renderPokemonDetailCard(pokemon, "PC Storage", "storage", index)}
    `;
    return;
  }

  const types = [
    ...new Set(
      storage.flatMap((pokemon) => pokemon.types || [pokemon.type]),
    ),
  ]
    .filter(Boolean)
    .sort();
  const filtered = getFilteredStorage(storage);
  const pageCount = Math.max(1, Math.ceil(filtered.length / STORAGE_PAGE_SIZE));
  storageUiState.page = Math.min(Math.max(1, storageUiState.page), pageCount);
  const start = (storageUiState.page - 1) * STORAGE_PAGE_SIZE;
  const visible = filtered.slice(start, start + STORAGE_PAGE_SIZE);
  const showingStart = filtered.length ? start + 1 : 0;
  const showingEnd = Math.min(start + STORAGE_PAGE_SIZE, filtered.length);

  browser.innerHTML = `
    ${renderPartyPresetSlots()}
    <div class="storage-browser-head">
      <div>
        <h3>Storage ${storage.length}</h3>
        <p>Search and organize your collection without changing its saved order.</p>
      </div>
      <div class="storage-browser-actions">
        <strong>Showing ${showingStart}-${showingEnd} of ${filtered.length}</strong>
      </div>
    </div>
    <div class="storage-controls">
      <label>Search
        <input id="storage-search" type="search" value="${escapeHtml(storageUiState.search)}" placeholder="Pokemon name" oninput="updateStorageFilter('search', this.value)">
      </label>
      <label>Type
        <select onchange="updateStorageFilter('type', this.value)">
          <option value="all">All</option>
          ${types.map((type) => `<option value="${type}" ${storageUiState.type === type ? "selected" : ""}>${type}</option>`).join("")}
        </select>
      </label>
      <label>Rarity
        <select onchange="updateStorageFilter('rarity', this.value)">
          <option value="all" ${storageUiState.rarity === "all" ? "selected" : ""}>All</option>
          <option value="common" ${storageUiState.rarity === "common" ? "selected" : ""}>Common</option>
          <option value="uncommon" ${storageUiState.rarity === "uncommon" ? "selected" : ""}>Uncommon</option>
          <option value="rare" ${storageUiState.rarity === "rare" ? "selected" : ""}>Rare</option>
          <option value="legendary" ${storageUiState.rarity === "legendary" ? "selected" : ""}>Legendary</option>
          <option value="mythical" ${storageUiState.rarity === "mythical" ? "selected" : ""}>Mythical</option>
        </select>
      </label>
      <label>Form
        <select onchange="updateStorageFilter('form', this.value)">
          <option value="all" ${storageUiState.form === "all" ? "selected" : ""}>All</option>
          <option value="normal" ${storageUiState.form === "normal" ? "selected" : ""}>Normal</option>
          <option value="regional" ${storageUiState.form === "regional" ? "selected" : ""}>Regional</option>
          <option value="special" ${storageUiState.form === "special" ? "selected" : ""}>Special</option>
        </select>
      </label>
      <label>Shiny
        <select onchange="updateStorageFilter('shiny', this.value)">
          <option value="all" ${storageUiState.shiny === "all" ? "selected" : ""}>All</option>
          <option value="shiny" ${storageUiState.shiny === "shiny" ? "selected" : ""}>Shiny</option>
          <option value="non-shiny" ${storageUiState.shiny === "non-shiny" ? "selected" : ""}>Non-Shiny</option>
        </select>
      </label>
      <label>Sort
        <select onchange="updateStorageFilter('sort', this.value)">
          <option value="id" ${storageUiState.sort === "id" ? "selected" : ""}>Pokedex / ID</option>
          <option value="name" ${storageUiState.sort === "name" ? "selected" : ""}>Name</option>
          <option value="level-asc" ${storageUiState.sort === "level-asc" ? "selected" : ""}>Level ascending</option>
          <option value="level-desc" ${storageUiState.sort === "level-desc" ? "selected" : ""}>Level descending</option>
          <option value="rarity" ${storageUiState.sort === "rarity" ? "selected" : ""}>Rarity</option>
        </select>
      </label>
    </div>
    <div class="storage-grid">
      ${
        visible.length
          ? visible
              .map(({ pokemon, originalIndex }) => {
                const hp = pokemon.currentHp ?? pokemon.hp ?? 0;
                const fainted = hp <= 0;
                return `
                  <article class="storage-compact-card${fainted ? " fainted" : ""}" onclick="showStoragePokemonDetail(${originalIndex})" tabindex="0" onkeydown="if(event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')){ event.preventDefault(); showStoragePokemonDetail(${originalIndex}); }">
                    <img src="${getPokemonImage(pokemon)}" alt="${escapeHtml(pokemon.name)}" loading="lazy">
                    <div class="storage-card-copy">
                      <strong>${escapeHtml(getPokemonDisplayName(pokemon))}</strong>
                      <span class="variant-badges">${renderVariantBadges(pokemon)}</span>
                      <span>Lv${pokemon.level || 1} ${renderTypeBadges(pokemon.types || [pokemon.type])}</span>
                      <div class="hp-bar-small"><div class="hp-fill" style="width: ${getHpPercent(hp, pokemon.maxHp)}%"></div></div>
                      <small>${hp}/${pokemon.maxHp} HP · ${fainted ? "Fainted" : formatStatus(pokemon.status)}</small>
                    </div>
                    <div class="storage-card-actions">
                      <button class="mini-btn preset-add-btn" onclick="event.stopPropagation(); addPokemonToPartyPreset('${escapeHtml(pokemon.ownedId)}')" ${isPokemonInActivePreset(pokemon.ownedId) || isActivePartyPresetFull() ? "disabled" : ""}>${isPokemonInActivePreset(pokemon.ownedId) ? "Added" : isActivePartyPresetFull() ? "Full" : `Add to P${activePartyPresetSlot}`}</button>
                      <button class="mini-btn swap-btn" onclick="event.stopPropagation(); swapWithStorage(${originalIndex})">Team</button>
                      <button class="mini-btn" onclick="releasePokemon(event, 'storage', ${originalIndex})">Release</button>
                    </div>
                  </article>
                `;
              })
              .join("")
          : '<p class="storage-empty">No stored Pokemon match these filters.</p>'
      }
    </div>
    <div class="storage-pagination">
      <button class="secondary-btn" onclick="changeStoragePage(-1)" ${storageUiState.page <= 1 ? "disabled" : ""}>Previous</button>
      <strong>Page ${storageUiState.page}/${pageCount}</strong>
      <button class="secondary-btn" onclick="changeStoragePage(1)" ${storageUiState.page >= pageCount ? "disabled" : ""}>Next</button>
    </div>
  `;
}

function renderPartyPresetSlots() {
  const slots = Array.from({ length: 3 }, (_, index) =>
    partyPresetCache.find((preset) => preset.slot === index + 1) || {
      slot: index + 1,
      pokemon: [],
      missingCount: 0,
    },
  );
  const selectedPreset = slots.find(
    (preset) => preset.slot === activePartyPresetSlot,
  );
  const selectedPokemon = selectedPreset?.pokemon || [];
  return `
    <section class="party-presets-panel" aria-label="Saved party slots">
      <div class="party-presets-title">
        <div>
          <h3>Party Decks</h3>
          <span>Editing Party ${activePartyPresetSlot}. Your active team changes only when you press Use Party.</span>
        </div>
        ${partyPresetMessage ? `<strong class="party-preset-message">${escapeHtml(partyPresetMessage)}</strong>` : ""}
      </div>
      <div class="party-deck-tabs">
        ${slots
          .map(
            (preset) => `
              <button class="party-deck-tab${preset.slot === activePartyPresetSlot ? " active" : ""}" onclick="selectPartyPresetSlot(${preset.slot})">
                Party ${preset.slot}<span>${(preset.pokemon || []).length}/${PARTY_LIMIT}</span>
              </button>`,
          )
          .join("")}
      </div>
      <div class="party-deck-builder">
        ${Array.from({ length: PARTY_LIMIT }, (_, position) => {
          const pokemon = selectedPokemon[position];
          return pokemon
            ? `<button class="party-deck-card" onclick="removePokemonFromPartyPreset(${position})" title="Remove ${escapeHtml(pokemon.name)}">
                <span class="party-deck-number">${position + 1}</span>
                <img src="${getPokemonImage(pokemon)}" alt="${escapeHtml(pokemon.name)}">
                <strong>${escapeHtml(getPokemonDisplayName(pokemon))}</strong>
                <small>Lv${pokemon.level || 1}</small>
                <span class="party-deck-remove">Remove</span>
              </button>`
            : `<div class="party-deck-card empty">
                <span class="party-deck-number">${position + 1}</span>
                <strong>+</strong>
                <small>Add from storage</small>
              </div>`;
        }).join("")}
      </div>
      ${selectedPreset?.missingCount ? `<small>${selectedPreset.missingCount} released Pokemon unavailable</small>` : ""}
      <div class="party-deck-current">
        <strong>Current team</strong>
        <div class="party-deck-current-list">
          ${teamCache
            .map(
              (pokemon) => `<button onclick="addPokemonToPartyPreset('${escapeHtml(pokemon.ownedId)}')" ${isPokemonInActivePreset(pokemon.ownedId) || isActivePartyPresetFull() ? "disabled" : ""} title="Add ${escapeHtml(pokemon.name)}">
                <img src="${getPokemonImage(pokemon)}" alt="${escapeHtml(pokemon.name)}"><span>${escapeHtml(pokemon.name)}</span>
              </button>`,
            )
            .join("")}
        </div>
      </div>
      <div class="party-preset-actions">
        <button class="secondary-btn" onclick="savePartyPresetSlot(${activePartyPresetSlot})">Copy Current Team</button>
        <button class="secondary-btn random-slot-btn" onclick="randomizePartyFromStorage()" ${storageRandomizing ? "disabled" : ""}>${storageRandomizing ? "Choosing..." : `Randomize Party ${activePartyPresetSlot}`}</button>
        <button class="secondary-btn" onclick="clearPartyPresetSlot()" ${selectedPokemon.length === 0 ? "disabled" : ""}>Clear</button>
        <button class="primary-btn" onclick="loadPartyPresetSlot(${activePartyPresetSlot})" ${selectedPokemon.length === 0 ? "disabled" : ""}>Use Party ${activePartyPresetSlot}</button>
      </div>
    </section>
  `;
}

function selectPartyPresetSlot(slot) {
  activePartyPresetSlot = slot;
  partyPresetMessage = "";
  renderStorageBrowser();
}

function isPokemonInActivePreset(ownedId) {
  const preset = partyPresetCache.find(
    (entry) => entry.slot === activePartyPresetSlot,
  );
  return Boolean(
    ownedId &&
      (preset?.pokemon || []).some((pokemon) => pokemon.ownedId === ownedId),
  );
}

function isActivePartyPresetFull() {
  const preset = partyPresetCache.find(
    (entry) => entry.slot === activePartyPresetSlot,
  );
  return (preset?.pokemon || []).length >= PARTY_LIMIT;
}

function showPokemonDetail(section, index) {
  const pokemon =
    section === "storage" ? storageCache[index] : teamCache[index];
  const panel = document.getElementById("current-player");
  if (!pokemon || !panel) return;
  panel.innerHTML = renderPokemonDetailCard(
    normalizePokemon(pokemon),
    section === "storage" ? "Storage" : "Team",
    section,
    index,
  );
}

function displayBag() {
  const bag = document.getElementById("bag-panel");
  if (!bag || !playerState) return;
  const ownedItems = shopCatalog.filter(
    (item) => (playerState.items?.[item.id] || 0) > 0,
  );
  bag.innerHTML = `
    <div class="inventory-header">
      <h3>Items</h3>
      <p>Using on ${activePokemon?.name || "your active Pokemon"}</p>
    </div>
    <div class="bag-list">
      ${
        ownedItems.length
          ? ownedItems
              .map(
                (item) => `
                  <div class="bag-item">
                    <div class="bag-item-main">
                      <div class="bag-item-visual">
                        ${renderIcon(item.icon, item.name, "ui-icon bag-icon-large")}
                      </div>
                      <div class="bag-item-copy">
                        <div class="bag-item-top">
                          <strong>${item.name}</strong>
                          <span class="bag-type-pill">${formatItemCategory(item.category)}</span>
                        </div>
                        <p>${item.description}</p>
                      </div>
                    </div>
                    <div class="bag-item-actions">
                      <span>${playerState.items?.[item.id] || 0}</span>
                      ${
                        item.category === "evolution"
                          ? `<button class="secondary-btn" onclick="showEvolutionItemPokemonDialog('${item.id}')">Choose Pokémon</button>`
                          : ["healing", "status"].includes(item.category)
                            ? `<button class="secondary-btn" onclick="useItemOnActive('${item.id}')" ${activePokemon ? "" : "disabled"}>Use</button>`
                          : `<span class="bag-item-note">Battle item</span>`
                      }
                    </div>
                  </div>
                `,
              )
              .join("")
          : "<p>No items in your bag yet. Open the shop to stock up.</p>"
      }
    </div>
  `;
}

function formatItemCategory(category) {
  const labels = {
    ball: "Poke Ball",
    healing: "Healing",
    status: "Status",
    evolution: "Evolution",
  };
  return labels[category] || "Item";
}

function renderSwapPicker() {
  const picker = document.getElementById("swap-picker");
  if (!picker) return;

  const storedPokemon =
    pendingSwapStorageIndex != null
      ? storageCache[pendingSwapStorageIndex]
      : null;
  if (!storedPokemon) {
    picker.innerHTML = "<p>No stored Pokémon selected.</p>";
    return;
  }

  picker.innerHTML = `
    <div class="swap-picker">
      <div class="swap-summary">
        <img src="${getPokemonImage(storedPokemon)}" alt="${storedPokemon.name}">
        <div>
          <h3>${storedPokemon.name}</h3>
          <p>Choose which team slot should be replaced.</p>
          <p>${renderTypeBadges(storedPokemon.types)}</p>
        </div>
      </div>
      <div class="swap-team-grid">
        ${teamCache
          .map(
            (pokemon, index) => `
              <button class="swap-slot-btn" onclick="confirmStorageSwap(${index})" ${
                isInBattle && index === activeInventoryIndex ? "disabled" : ""
              }>
                <img src="${getPokemonImage(pokemon)}" alt="${pokemon.name}">
                <div>
                  <strong>Slot ${index + 1}: ${pokemon.name}</strong>
                  <span>${pokemon.currentHp}/${pokemon.maxHp} HP</span>
                </div>
              </button>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function resetPokemonForBattleSwitch(pokemon) {
  if (!pokemon) return;
  restorePokemonTransform(pokemon);
  const sleepTurns =
    pokemon.status === "asleep"
      ? pokemon.battleState?.volatile?.sleepTurns
      : null;
  pokemon.battleState = {
    stages: {
      attack: 0,
      defense: 0,
      specialAttack: 0,
      specialDefense: 0,
      speed: 0,
      accuracy: 0,
      evasion: 0,
    },
    volatile: sleepTurns ? { sleepTurns } : {},
    protected: false,
  };
}

async function selectPokemon(index) {
  const selected = teamCache[index];
  if (!selected) {
    alert("Could not select that Pokemon.");
    return;
  }

  if (isSwitching) {
    if (selected.currentHp <= 0) {
      alert("Cannot switch to a fainted Pokémon.");
      return;
    }
    const forcedSwitch = Boolean(wild && isInBattle && wildSwitchForced);
    const consumesTurn = Boolean(wild && isInBattle && !forcedSwitch);
    const outgoingPokemonIndex = activeInventoryIndex;
    const playerBefore = normalizePokemon(selected);
    const opponentBefore = wild ? normalizePokemon(wild) : null;
    if (activePokemon) resetPokemonForBattleSwitch(activePokemon);
    resetPokemonForBattleSwitch(selected);
    activeInventoryIndex = index;
    activePokemon = normalizePokemon(selected);
    if (wild && isInBattle) wildParticipantIndexes.add(index);
    currentPlayerHP = activePokemon.currentHp;
    playerStatus = activePokemon.status || "none";
    if (consumesTurn) setBattleActionBusy(true);
    isSwitching = false;
    wildSwitchForced = false;
    displayCurrentPlayer();
    showBattle();
    await animatePokemonSwitch("player", activePokemon);
    if (consumesTurn) {
      await performWildUtilityAction("switch", {
        playerBefore,
        opponentBefore,
        outgoingPokemonIndex,
      });
    } else if (forcedSwitch) {
      await performWildUtilityAction("forced-switch", {
        playerBefore,
        opponentBefore,
        outgoingPokemonIndex,
      });
    }
    return;
  }

  activeInventoryIndex = index;
  activePokemon = normalizePokemon(selected);
  displayCurrentPlayer();
  displayParty(teamCache);
  displayStorage(storageCache);
  displayBag();

  if (activePokemon.currentHp <= 0) {
    alert(`${activePokemon.name} has fainted. Heal or choose another Pokemon.`);
  }
}

function setActivePokemonByIndex(event, index) {
  if (event) event.stopPropagation();
  const selected = teamCache[index];
  if (!selected) return;
  activeInventoryIndex = index;
  activePokemon = normalizePokemon(selected);
  displayCurrentPlayer();
  displayParty(teamCache);
  displayStorage(storageCache);
  displayBag();
}

async function healTeam() {
  const response = await fetch("/api/heal", { method: "POST" });
  const data = await response.json();
  if (data.error) {
    alert(data.error);
    return;
  }
  wild = null;
  renderBattlePlaceholder(data.message || "Your Pokemon are ready.");
  const centerMessage = document.getElementById("center-message");
  if (centerMessage)
    centerMessage.textContent = data.message || "Your Pokemon are ready.";
  await loadProfile();
  await loadInventory();
}

async function useItem(
  event,
  itemId,
  pokemonIndex,
  section = "team",
  targetSpeciesId = null,
) {
  event?.stopPropagation?.();
  const response = await fetch("/api/use-item", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemId, pokemonIndex, section, targetSpeciesId }),
  });
  const data = await response.json();
  if (data.requiresEvolutionChoice) {
    showEvolutionChoiceDialog(itemId, pokemonIndex, section, data.options || []);
    return;
  }
  if (data.error) {
    alert(data.error);
    return;
  }
  playerState = data.state;
  if (Array.isArray(data.team)) teamCache = data.team.map(normalizePokemon);
  if (Array.isArray(data.storage)) storageCache = data.storage.map(normalizePokemon);
  appendBattleLog([data.message]);
  await loadInventory();
  displayStats();
  displayCurrentPlayer();
  renderBattlePlaceholder(data.message);
  const updated = section === "storage" ? storageCache[pokemonIndex] : teamCache[pokemonIndex];
  if (updated && activeScreen === "party") showPokemonDetail(section, pokemonIndex);
}

async function useItemOnActive(itemId) {
  if (!Number.isInteger(activeInventoryIndex)) {
    alert("Choose a Pokemon in Party first.");
    return;
  }
  await useItem({ stopPropagation() {} }, itemId, activeInventoryIndex);
}

function getEvolutionItemTargets(item) {
  return [
    ...teamCache.map((pokemon, index) => ({ pokemon, index, section: "team" })),
    ...storageCache.map((pokemon, index) => ({ pokemon, index, section: "storage" })),
  ].flatMap((entry) =>
    (entry.pokemon.evolutionOptions || [])
      .filter(
        (option) =>
          option.supported &&
          (option.items || []).includes(item.evolutionItem),
      )
      .map((option) => ({ ...entry, option })),
  );
}

function showEvolutionItemPokemonDialog(itemId) {
  const item = shopCatalog.find((entry) => entry.id === itemId);
  if (!item?.evolutionItem) return;
  const targets = getEvolutionItemTargets(item);
  document.querySelector(".evolution-item-picker-overlay")?.remove();
  const overlay = document.createElement("div");
  overlay.className =
    "evolution-overlay evolution-item-picker-overlay active";
  overlay.innerHTML = `
    <div class="evolution-choice-dialog evolution-item-picker" role="dialog" aria-modal="true" aria-label="Choose Pokémon for ${escapeHtml(item.name)}">
      <h3>Use ${escapeHtml(item.name)}</h3>
      <p>Choose a compatible Pokémon from your Party or Storage.</p>
      <div class="evolution-item-targets">
        ${
          targets.length
            ? targets
                .map(
                  ({ pokemon, index, section, option }) => `
                    <button class="evolution-item-target" onclick="closeEvolutionItemPokemonDialog(); useItem(event, '${item.id}', ${index}, '${section}', ${option.targetSpeciesId})">
                      <img src="${getPokemonImage(pokemon)}" alt="${escapeHtml(pokemon.name)}">
                      <span><strong>${escapeHtml(getPokemonDisplayName(pokemon))}</strong><small>${section === "team" ? "Party" : "Storage"} · Evolves into ${escapeHtml(option.targetName)}</small></span>
                    </button>
                  `,
                )
                .join("")
            : `<p class="evolution-item-empty">You do not currently own a Pokémon that can use this stone.</p>`
        }
      </div>
      <button class="secondary-btn" onclick="closeEvolutionItemPokemonDialog()">Cancel</button>
    </div>
  `;
  document.body.appendChild(overlay);
}

function closeEvolutionItemPokemonDialog() {
  document.querySelector(".evolution-item-picker-overlay")?.remove();
}

function showEvolutionChoiceDialog(itemId, pokemonIndex, section, options) {
  document.querySelector(".evolution-choice-overlay")?.remove();
  const overlay = document.createElement("div");
  overlay.className = "evolution-overlay evolution-choice-overlay active";
  overlay.innerHTML = `
    <div class="evolution-choice-dialog" role="dialog" aria-modal="true" aria-label="Choose evolution">
      <h3>Choose an evolution</h3>
      <div class="evolution-choice-actions">
        ${options
          .map(
            (option) => `<button class="primary-action" onclick="closeEvolutionChoiceDialog(); useItem(event, '${itemId}', ${pokemonIndex}, '${section}', ${option.targetSpeciesId})">${escapeHtml(option.targetName)}</button>`,
          )
          .join("")}
      </div>
      <button class="secondary-btn" onclick="closeEvolutionChoiceDialog()">Cancel</button>
    </div>
  `;
  document.body.appendChild(overlay);
}

function closeEvolutionChoiceDialog() {
  document.querySelector(".evolution-choice-overlay")?.remove();
}

async function resolvePendingEvolution(section, pokemonIndex, targetSpeciesId) {
  const response = await fetch("/api/evolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ section, pokemonIndex, targetSpeciesId }),
  });
  const data = await response.json();
  if (data.error) {
    alert(data.error);
    return;
  }
  if (Array.isArray(data.team)) teamCache = data.team.map(normalizePokemon);
  if (Array.isArray(data.storage)) storageCache = data.storage.map(normalizePokemon);
  appendBattleLog([data.message]);
  await loadProfile();
  await loadInventory();
  showPokemonDetail(section, pokemonIndex);
}

async function resolvePendingMove(section, pokemonIndex, payload) {
  const response = await fetch("/api/learn-move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ section, pokemonIndex, ...payload }),
  });
  const data = await response.json();
  if (data.error) {
    alert(data.error);
    return;
  }

  appendBattleLog([data.message]);
  await loadInventory();
  const updated =
    section === "storage" ? storageCache[pokemonIndex] : teamCache[pokemonIndex];
  if (updated) {
    if (activeOverlay === "quickPokemon" && section === "team") {
      quickPokemonDetailIndex = pokemonIndex;
      renderQuickPokemon();
      return;
    }
    const panel = document.getElementById("current-player");
    if (panel) {
      panel.innerHTML = renderPokemonDetailCard(
        normalizePokemon(updated),
        section === "storage" ? "Storage" : "Team",
        section,
        pokemonIndex,
      );
    }
  }
}

async function learnPendingMove(section, pokemonIndex, replaceIndex) {
  await resolvePendingMove(section, pokemonIndex, { replaceIndex });
}

async function skipPendingMove(section, pokemonIndex) {
  await resolvePendingMove(section, pokemonIndex, { skip: true });
}

function releasePokemon(event, section, index) {
  event.stopPropagation();
  const overallIndex = section === "storage" ? teamCache.length + index : index;
  const selected =
    section === "storage" ? storageCache[index] : teamCache[index];
  if (!selected) {
    alert("Could not release that Pokémon.");
    return;
  }
  if (section !== "storage" && overallIndex === activeInventoryIndex) {
    alert("Cannot release your active Pokémon.");
    return;
  }
  if (confirm(`Are you sure you want to release ${selected.name}?`)) {
    fetch("/api/release", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pokemonIndex: overallIndex }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.error) {
          alert(data.error);
        } else {
          if (section === "storage") storageUiState.detailIndex = null;
          loadInventory();
        }
      });
  }
}

async function swapWithStorage(storageIndex) {
  if (teamCache.length < PARTY_LIMIT) {
    await confirmStorageSwap(teamCache.length, storageIndex);
    return;
  }

  pendingSwapStorageIndex = storageIndex;
  openOverlay("swap");
}

async function randomizePartyFromStorage() {
  if (storageRandomizing) return;
  if (
    battleActionBusy ||
    isInBattle ||
    npcBattle ||
    gymBattle ||
    eliteBattle
  ) {
    alert("Finish the current battle before editing a party slot.");
    return;
  }
  if (
    !confirm(
      `Replace saved Party ${activePartyPresetSlot} with ${PARTY_LIMIT} random owned Pokemon? Your active team will not change.`,
    )
  ) {
    return;
  }

  storageRandomizing = true;
  renderStorageBrowser();
  try {
    const response = await fetch("/api/party/randomize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slot: activePartyPresetSlot }),
    });
    const data = await response.json();
    if (!response.ok || data.error) {
      alert(data.error || "Could not create a random party.");
      return;
    }

    partyPresetCache = data.slots || partyPresetCache;
    partyPresetMessage = `Party ${activePartyPresetSlot} randomized. Press Use Party to activate it.`;
  } catch (error) {
    alert("Could not create a random party.");
  } finally {
    storageRandomizing = false;
    renderStorageBrowser();
  }
}

async function savePartyPresetSlot(slot) {
  if (battleActionBusy || isInBattle || npcBattle || gymBattle || eliteBattle) {
    alert("Finish the current battle before saving a party slot.");
    return;
  }
  const existing = partyPresetCache.find((preset) => preset.slot === slot);
  if (existing?.pokemon?.length && !confirm(`Replace saved Party ${slot}?`)) {
    return;
  }
  const response = await fetch("/api/party-presets/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slot }),
  });
  const data = await response.json();
  if (!response.ok || data.error) {
    alert(data.error || "Could not save this party.");
    return;
  }
  partyPresetCache = data.slots || partyPresetCache;
  partyPresetMessage = `Current team saved in Party ${slot}.`;
  renderStorageBrowser();
}

async function updatePartyPresetSlot(action, values = {}) {
  if (battleActionBusy || isInBattle || npcBattle || gymBattle || eliteBattle) {
    alert("Finish the current battle before editing a party slot.");
    return false;
  }
  try {
    const response = await fetch("/api/party-presets/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slot: activePartyPresetSlot,
        action,
        ...values,
      }),
    });
    const data = await response.json();
    if (!response.ok || data.error) {
      alert(data.error || "Could not update this party.");
      return false;
    }
    partyPresetCache = data.slots || partyPresetCache;
    return true;
  } catch (error) {
    alert("Could not update this party.");
    return false;
  }
}

async function addPokemonToPartyPreset(ownedId) {
  const pokemon = [...teamCache, ...storageCache].find(
    (entry) => entry.ownedId === ownedId,
  );
  if (!pokemon) {
    alert("That Pokemon is no longer available.");
    return;
  }
  if (await updatePartyPresetSlot("add", { ownedId })) {
    partyPresetMessage = `${pokemon.name} added to Party ${activePartyPresetSlot}.`;
    renderStorageBrowser();
  }
}

async function removePokemonFromPartyPreset(position) {
  const preset = partyPresetCache.find(
    (entry) => entry.slot === activePartyPresetSlot,
  );
  const pokemon = preset?.pokemon?.[position];
  if (await updatePartyPresetSlot("remove", { position })) {
    partyPresetMessage = `${pokemon?.name || "Pokemon"} removed from Party ${activePartyPresetSlot}.`;
    renderStorageBrowser();
  }
}

async function clearPartyPresetSlot() {
  if (!confirm(`Clear every Pokemon from Party ${activePartyPresetSlot}?`)) {
    return;
  }
  if (await updatePartyPresetSlot("clear")) {
    partyPresetMessage = `Party ${activePartyPresetSlot} cleared.`;
    renderStorageBrowser();
  }
}

async function loadPartyPresetSlot(slot) {
  if (battleActionBusy || isInBattle || npcBattle || gymBattle || eliteBattle) {
    alert("Finish the current battle before loading a party slot.");
    return;
  }
  const response = await fetch("/api/party-presets/load", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slot }),
  });
  const data = await response.json();
  if (!response.ok || data.error) {
    alert(data.error || "Could not load this party.");
    return;
  }
  activeInventoryIndex = 0;
  storageUiState.detailIndex = null;
  storageUiState.page = 1;
  await loadInventory();
  partyPresetMessage = data.missingCount
    ? `Party ${slot} loaded with ${data.missingCount} unavailable member.`
    : `Party ${slot} is now your active team.`;
  renderStorageBrowser();
  renderBattlePlaceholder(
    data.missingCount
      ? `Party ${slot} loaded without ${data.missingCount} unavailable Pokemon.`
      : `Party ${slot} loaded.`,
  );
}

async function confirmStorageSwap(
  teamIndex,
  explicitStorageIndex = pendingSwapStorageIndex,
) {
  if (
    !Number.isInteger(teamIndex) ||
    teamIndex < 0 ||
    teamIndex >= PARTY_LIMIT
  ) {
    alert("Choose a valid team slot.");
    return;
  }
  if (!Number.isInteger(explicitStorageIndex) || explicitStorageIndex < 0) {
    alert("Choose a stored Pokémon first.");
    return;
  }
  if (teamIndex === activeInventoryIndex && isInBattle) {
    alert("Cannot replace your active Pokemon during a battle.");
    return;
  }

  const response = await fetch("/api/swap-storage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ teamIndex, storageIndex: explicitStorageIndex }),
  });
  const data = await response.json();
  if (data.error) {
    alert(data.error);
    return;
  }
  if (activeInventoryIndex >= (data.team || []).length)
    activeInventoryIndex = 0;
  await loadInventory();
  closeOverlay();
  renderBattlePlaceholder(data.message);
}

async function startWildEncounter(area = selectedArea) {
  if (battleActionBusy) return false;
  if (!selectedArea) {
    alert("Please select an area first!");
    return false;
  }
  const encounterArea = area || selectedArea;
  if (!activePokemon || activePokemon.currentHp <= 0) {
    alert("Your active Pokemon has fainted. Heal or choose another Pokemon.");
    return false;
  }

  try {
    const response = await fetch("/api/encounter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area: encounterArea }),
    });
    const data = await response.json();
    if (data.error) {
      alert(data.error);
      return false;
    }
    wild = normalizePokemon(data);
    currentPlayerHP = activePokemon.currentHp;
    currentWildHP = wild.currentHp;
    playerStatus = activePokemon.status || "none";
    wildStatus = wild.status || "none";
    wildParticipantIndexes = new Set([activeInventoryIndex]);
    if (pokedexCache) await loadPokedex();
    showBattle();
    animatePokemonSwitch("opponent", wild);
    return true;
  } catch (error) {
    console.error("Error:", error);
    return false;
  }
}

async function findPokemonQuickly() {
  if (
    routeEncounterPending ||
    battleActionBusy ||
    activeOverlay ||
    isInBattle ||
    npcBattle ||
    gymBattle ||
    eliteBattle
  ) {
    return;
  }

  routeEncounterPending = true;
  try {
    const started = await startWildEncounter(selectedArea);
    if (started) routeEncounterCooldownSteps = 3;
  } finally {
    routeEncounterPending = false;
  }
}

function getWildOwnership(pokemon) {
  const speciesName = String(pokemon?.name || "").trim().toLowerCase();
  if (!speciesName) return { owned: false, count: 0, locations: [] };

  const formId = pokemon?.form?.id || "normal";
  const allOwned = [...teamCache, ...storageCache];
  const matchesForm = (ownedPokemon) =>
    window.PokemonVariantUtils
      ? window.PokemonVariantUtils.isSameVariant(ownedPokemon, pokemon, false)
      : String(ownedPokemon?.name || "").trim().toLowerCase() === speciesName &&
        (ownedPokemon?.form?.id || "normal") === formId;
  const matchesVariant = (ownedPokemon) =>
    window.PokemonVariantUtils
      ? window.PokemonVariantUtils.isSameVariant(ownedPokemon, pokemon)
      : String(ownedPokemon?.name || "").trim().toLowerCase() === speciesName &&
        (ownedPokemon?.form?.id || "normal") === formId &&
        Boolean(ownedPokemon?.shiny) === Boolean(pokemon?.shiny);

  const partyCount = teamCache.filter(matchesVariant).length;
  const storageCount = storageCache.filter(matchesVariant).length;
  const locations = [];
  if (partyCount) locations.push("Party");
  if (storageCount) locations.push("Storage");

  return {
    owned: partyCount + storageCount > 0,
    count: partyCount + storageCount,
    locations,
    normalOwned: allOwned.some(
      (ownedPokemon) => matchesForm(ownedPokemon) && !ownedPokemon.shiny,
    ),
    shinyOwned: allOwned.some(
      (ownedPokemon) => matchesForm(ownedPokemon) && ownedPokemon.shiny,
    ),
  };
}

function showBattle() {
  const ownership = getWildOwnership(wild);
  const formLabel = wild.form?.name || "Normal form";
  const ownershipText = `${formLabel}: ${ownership.normalOwned ? "Owned" : "Not owned"} | Shiny: ${ownership.shinyOwned ? "Owned" : "Not owned"}`;
  openWildEncounterLayer();
  document.getElementById("encounter").innerHTML = `
    <div class="wild-encounter-head">
      <div>
        <span>Wild Encounter</span>
        <h2 class="wild-encounter-name">
          ${escapeHtml(getPokemonDisplayName(wild))} appeared!
          ${wild.shiny ? '<span class="shiny-encounter-label">SHINY</span>' : ""}
        </h2>
        <div class="variant-badges">${renderVariantBadges(wild)}</div>
        <p class="wild-ownership ${ownership.owned ? "owned" : "not-owned"}">${ownershipText}</p>
      </div>
      <p class="weather-info">${formatAreaName(wild.area)} | Weather: ${wild.weather}${wild.shiny ? " | Shiny encounter!" : ""}</p>
    </div>
    <div class="battle-help-row">${renderBattleHandbookShortcut("moves")}</div>
    ${renderBattleWeatherHud(wild.weather || "clear")}
    <div class="battle-container">
      <div class="battle-pokemon player-side status-${playerStatus || "none"}${getHpPercent(currentPlayerHP, activePokemon.maxHp) <= 25 ? " low-hp" : ""}">
        <img class="battle-sprite" src="${getPokemonImage(activePokemon)}" alt="${activePokemon.name}">
        <div class="battle-info">
          <h3>${activePokemon.name} Lv${activePokemon.level}</h3>
          ${renderTypeBadges(activePokemon.types)}
          <div class="hp-bar"><div class="hp-fill" style="width: ${getHpPercent(currentPlayerHP, activePokemon.maxHp)}%"></div></div>
          <p class="hp-line">${renderIcon("heart", "HP")} ${currentPlayerHP}/${activePokemon.maxHp} HP</p>
          ${renderBattleTacticalHud({ ...activePokemon, status: playerStatus, currentHp: currentPlayerHP })}
        </div>
      </div>
      <div class="vs">VS</div>
      <div class="battle-pokemon opponent-side status-${wildStatus || "none"}${wild.shiny ? " shiny-encounter" : ""}${getHpPercent(currentWildHP, wild.maxHp) <= 25 ? " low-hp" : ""}">
        <img class="battle-sprite" src="${getPokemonImage(wild)}" alt="${wild.name}">
        <div class="battle-info">
          <h3>${escapeHtml(getPokemonDisplayName(wild))} Lv${wild.level}</h3>
          <div class="variant-badges">${renderVariantBadges(wild)}</div>
          ${renderTypeBadges(wild.types)}
          <div class="hp-bar"><div class="hp-fill" style="width: ${getHpPercent(currentWildHP, wild.maxHp)}%"></div></div>
          <p class="hp-line">${renderIcon("heart", "HP")} ${currentWildHP}/${wild.maxHp} HP</p>
          ${renderBattleTacticalHud({ ...wild, status: wildStatus, currentHp: currentWildHP })}
        </div>
      </div>
    </div>
    <div id="type-advantage" class="type-advantage"></div>
    <div id="move-buttons" class="move-buttons"></div>
    <div class="battle-action-row">
      <div id="battle-item-panel"></div>
      <button onclick="switchPokemon()" class="secondary-btn">Switch Pokémon</button>
    </div>
    <div id="wild-switch-panel"></div>
    <div id="catch-panel"></div>
    <div id="battle-log"></div>
  `;
  updateTypeAdvantage();
  showMoveButtons();
  showBattleItemPanel();
  showCatchOptions();
  presentBattleArena("wild", activePokemon, wild, wild.weather);
  isInBattle = true;
}

function showMoveButtons(disabled = false) {
  const moveButtonsDiv = document.getElementById("move-buttons");
  if (!moveButtonsDiv) return;

  moveButtonsDiv.innerHTML = "";
  activePokemon.moves.forEach((move) => {
    moveButtonsDiv.appendChild(
      createBattleMoveButton(move, wild, attack, disabled || currentPlayerHP <= 0),
    );
  });
}

function getBattleUsableItems() {
  if (!playerState?.items) return [];
  return shopCatalog.filter(
    (item) =>
      ["healing", "status"].includes(item.category) &&
      (playerState.items[item.id] || 0) > 0,
  );
}

function canUseBattleItem(item) {
  if (!item) return false;
  if (!activePokemon || currentPlayerHP <= 0) return false;
  if (item.category === "healing") return currentPlayerHP < activePokemon.maxHp;
  return Boolean(item.cures?.includes(playerStatus));
}

function showBattleItemPanel(disabled = false) {
  const panel = document.getElementById("battle-item-panel");
  if (!panel) return;
  const items = getBattleUsableItems();
  const totalItems = items.reduce(
    (total, item) => total + (playerState.items[item.id] || 0),
    0,
  );
  const bagDisabled = battleActionBusy || disabled || !items.length;

  panel.innerHTML = `
    <div class="battle-bag${battleBagOpen ? " open" : ""}">
      <button
        class="secondary-btn icon-button battle-bag-toggle"
        ${bagDisabled ? "disabled" : ""}
        data-locked="${disabled || !items.length}"
        aria-expanded="${battleBagOpen}"
        onclick="toggleBattleBag()"
      >
        ${renderIcon("backpack", "Bag")}
        <span>Bag</span>
        <strong>${totalItems}</strong>
      </button>
      ${
        battleBagOpen && items.length
          ? `
            <div class="battle-bag-menu" role="dialog" aria-label="Battle Bag">
              <div class="battle-bag-head">
                <div>
                  <strong>Battle Bag</strong>
                  <span>Use on ${activePokemon?.name || "active Pokemon"}</span>
                </div>
                <button class="battle-bag-close" onclick="toggleBattleBag()" aria-label="Close battle bag">&times;</button>
              </div>
              <div class="battle-item-grid">
                ${items
                  .map((item) => {
                    const count = playerState.items[item.id] || 0;
                    const itemLocked = disabled || !canUseBattleItem(item);
                    const itemDisabled = battleActionBusy || itemLocked;
                    return `
                      <button class="mini-item-btn icon-button" ${itemDisabled ? "disabled" : ""} data-locked="${itemLocked}" onclick="useBattleItem('${item.id}')">
                        ${renderIcon(item.icon, item.name)}
                        <span>${item.name}</span>
                        <strong>${count}</strong>
                      </button>
                    `;
                  })
                  .join("")}
              </div>
            </div>
          `
          : ""
      }
    </div>
  `;
}

function toggleBattleBag() {
  if (battleActionBusy || !wild || !isInBattle) return;
  battleBagOpen = !battleBagOpen;
  showBattleItemPanel();
}

function switchPokemon() {
  if (battleActionBusy) return;
  battleBagOpen = false;
  showBattleItemPanel();
  isSwitching = true;
  wildSwitchForced = false;
  if (wild && isInBattle) {
    showWildSwitchPanel();
    return;
  }
  setActiveScreen("party");
  loadInventory();
}

function showWildSwitchPanel() {
  const panel = document.getElementById("wild-switch-panel");
  if (!panel) return;
  panel.innerHTML = `
    <div class="wild-switch-panel">
      <div class="wild-switch-head">
        <strong>Switch Pokemon</strong>
        <button class="secondary-btn" onclick="cancelWildSwitch()">Cancel</button>
      </div>
      <div class="wild-switch-grid">
        ${teamCache
          .map((pokemon, index) => {
            const disabled =
              index === activeInventoryIndex || (pokemon.currentHp || 0) <= 0;
            return `
              <button class="wild-switch-card" ${battleActionBusy || disabled ? "disabled" : ""} onclick="selectPokemon(${index})">
                <img src="${getPokemonImage(pokemon)}" alt="${pokemon.name}">
                <span>${pokemon.name}</span>
                <small>${pokemon.currentHp}/${pokemon.maxHp} HP</small>
              </button>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function cancelWildSwitch() {
  isSwitching = false;
  wildSwitchForced = false;
  const panel = document.getElementById("wild-switch-panel");
  if (panel) panel.innerHTML = "";
}

function updateTypeAdvantage() {
  const bestMove = activePokemon.moves
    .filter((move) => move.category !== "Status")
    .map((move) => ({
      move,
      effectiveness: getCombinedTypeEffectiveness(move.type, wild.types),
    }))
    .sort((a, b) => b.effectiveness - a.effectiveness)[0];

  const message =
    bestMove && bestMove.effectiveness > 1
      ? `${bestMove.move.name} has a type advantage.`
      : "";
  document.getElementById("type-advantage").innerHTML = message
    ? `<p class="advantage">${message}</p>`
    : "";
}

async function attack(moveName) {
  if (battleActionBusy) return;
  if (currentPlayerHP <= 0) {
    alert("Your active Pokemon has fainted. Heal or choose another Pokemon.");
    return;
  }
  if (currentWildHP <= 0) {
    alert("The wild Pokemon already fainted.");
    return;
  }

  const playerBefore = normalizePokemon(activePokemon);
  const opponentBefore = normalizePokemon(wild);
  const playerStatusBefore = playerStatus;
  const move = getMoveFromPokemon(playerBefore, moveName);
  battleBagOpen = false;
  setBattleActionBusy(true);

  let data;
  try {
    const response = await fetch("/api/battle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pokemonIndex: activeInventoryIndex,
        playerId: activePokemon.id,
        wild,
        moveName,
        playerHP: currentPlayerHP,
        wildHP: currentWildHP,
        playerStatus,
        wildStatus,
        playerBattleState: activePokemon.battleState || null,
        participantIndexes: [...wildParticipantIndexes],
      }),
    });
    data = await response.json();
  } catch (error) {
    console.error("Battle failed:", error);
    setBattleActionBusy(false);
    alert("Battle action failed.");
    return;
  }
  if (data.error) {
    alert(data.error);
    setBattleActionBusy(false);
    showMoveButtons();
    showBattleItemPanel();
    showCatchOptions();
    return;
  }

  currentPlayerHP = data.playerHP;
  currentWildHP = data.wildHP;
  playerStatus = data.playerStatus;
  wildStatus = data.wildStatus;
  activePokemon.currentHp = currentPlayerHP;
  activePokemon.status = playerStatus;
  activePokemon.moves = data.playerMoves.map(normalizeMove);
  if (data.playerPokemon) {
    activePokemon = normalizePokemon(data.playerPokemon);
    teamCache[activeInventoryIndex] = activePokemon;
    currentPlayerHP = activePokemon.currentHp;
    playerStatus = activePokemon.status || "none";
  }
  wild = normalizePokemon(data.wild);
  const opponentMove = getMoveFromLog(opponentBefore, data.log);
  const opponentMoveType = getMoveTypeFromLog(opponentBefore, data.log);

  await playBattleTurnAnimation({
    lines: data.log,
    playerBeforeHp: playerBefore.currentHp,
    playerAfterHp: currentPlayerHP,
    playerMaxHp: activePokemon.maxHp,
    opponentBeforeHp: opponentBefore.currentHp,
    opponentAfterHp: currentWildHP,
    opponentMaxHp: wild.maxHp,
    playerStatusBefore,
    playerStatusAfter: playerStatus,
    opponentStatusBefore: opponentBefore.status || "none",
    opponentStatusAfter: wildStatus,
    playerMoveType: move?.type || "Normal",
    opponentMoveType,
    playerMove: move,
    opponentMove,
    playerPokemon: playerBefore,
    opponentPokemon: opponentBefore,
    turnMetadata: data.turnMetadata,
  });
  setEvolutionPresentationHints(data.xpResult);
  appendBattleLog(data.log);
  updateBattleDisplay();
  displayCurrentPlayer();
  showMoveButtons(!!data.winner);
  showBattleItemPanel(!!data.winner);
  showCatchOptions(!!data.winner);
  await loadInventory();

  if (data.winner === "player") {
    if (data.moneyReward) {
      await loadProfile();
    }
    if (questCache) await loadQuests();
    appendBattleLog([
      `Wild ${wild.name} fainted. You cannot catch a fainted Pokemon.`,
    ]);
    await returnToRouteAfterWildBattle(
      `You defeated wild ${wild.name} and returned to the route.`,
    );
  } else if (data.winner === "wild") {
    const hasHealthyReplacement = teamCache.some(
      (pokemon, index) =>
        index !== activeInventoryIndex && (pokemon.currentHp || 0) > 0,
    );
    if (hasHealthyReplacement) {
      appendBattleLog([
        `${activePokemon.name} fainted. Choose another Pokemon to continue.`,
      ]);
      setBattleActionBusy(false);
      isSwitching = true;
      wildSwitchForced = true;
      showWildSwitchPanel();
    } else {
      appendBattleLog(["Your full party has fainted. Heal up and try again."]);
      await returnToRouteAfterWildBattle(
        "Your full party fainted. You returned to the route.",
      );
    }
  } else {
    setBattleActionBusy(false);
  }
}

async function performWildUtilityAction(
  action,
  {
    itemId = null,
    outgoingPokemonIndex = null,
    playerBefore = normalizePokemon(activePokemon),
    opponentBefore = normalizePokemon(wild),
  } = {},
) {
  if (!wild || !isInBattle) return;
  setBattleActionBusy(true);
  let data;
  try {
    const response = await fetch("/api/battle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        itemId,
        pokemonIndex: activeInventoryIndex,
        outgoingPokemonIndex,
        playerId: activePokemon.id,
        wild,
        playerHP: currentPlayerHP,
        wildHP: currentWildHP,
        playerStatus,
        wildStatus,
        playerBattleState: activePokemon.battleState || null,
      }),
    });
    data = await response.json();
  } catch (error) {
    console.error("Battle utility action failed:", error);
    setBattleActionBusy(false);
    alert("Battle action failed.");
    return;
  }
  if (data.error) {
    alert(data.error);
    setBattleActionBusy(false);
    showMoveButtons();
    showBattleItemPanel();
    showCatchOptions();
    return;
  }

  if (data.state) playerState = data.state;
  const itemTurn = data.turnMetadata?.turns?.find(
    (turn) => turn.side === "player" && turn.action === "item",
  );
  const healedHp = Math.min(
    activePokemon.maxHp,
    playerBefore.currentHp + Math.max(0, itemTurn?.hpChange || 0),
  );
  if (itemTurn?.hpChange > 0) {
    animateHpChange("player", playerBefore.currentHp, healedHp, activePokemon.maxHp);
    showFloatingBattleText("player", `+${itemTurn.hpChange}`, "status");
    runBattlePresentation("playHealing");
  }

  currentPlayerHP = data.playerHP;
  currentWildHP = data.wildHP;
  playerStatus = data.playerStatus;
  wildStatus = data.wildStatus;
  activePokemon = normalizePokemon(data.playerPokemon || activePokemon);
  teamCache[activeInventoryIndex] = activePokemon;
  currentPlayerHP = activePokemon.currentHp;
  playerStatus = activePokemon.status || "none";
  wild = normalizePokemon(data.wild);
  const opponentMove = getMoveFromLog(opponentBefore, data.log);
  await playBattleTurnAnimation({
    lines: data.log,
    playerBeforeHp: itemTurn?.hpChange > 0 ? healedHp : playerBefore.currentHp,
    playerAfterHp: currentPlayerHP,
    playerMaxHp: activePokemon.maxHp,
    opponentBeforeHp: opponentBefore.currentHp,
    opponentAfterHp: currentWildHP,
    opponentMaxHp: wild.maxHp,
    playerStatusBefore: playerBefore.status || "none",
    playerStatusAfter: playerStatus,
    opponentStatusBefore: opponentBefore.status || "none",
    opponentStatusAfter: wildStatus,
    opponentMoveType: getMoveTypeFromLog(opponentBefore, data.log),
    opponentMove,
    playerPokemon: playerBefore,
    opponentPokemon: opponentBefore,
    turnMetadata: data.turnMetadata,
  });
  setEvolutionPresentationHints(data.xpResult);
  appendBattleLog(data.log);
  updateBattleDisplay();
  displayStats();
  displayCurrentPlayer();
  showMoveButtons(!!data.winner);
  showBattleItemPanel(!!data.winner);
  showCatchOptions(!!data.winner);
  await loadInventory();

  if (data.winner === "player") {
    if (data.moneyReward) await loadProfile();
    if (questCache) await loadQuests();
    await returnToRouteAfterWildBattle(
      `You defeated wild ${wild.name} and returned to the route.`,
    );
  } else if (data.winner === "wild") {
    const hasHealthyReplacement = teamCache.some(
      (pokemon, index) =>
        index !== activeInventoryIndex && (pokemon.currentHp || 0) > 0,
    );
    if (hasHealthyReplacement) {
      setBattleActionBusy(false);
      isSwitching = true;
      wildSwitchForced = true;
      showWildSwitchPanel();
    } else {
      await returnToRouteAfterWildBattle(
        "Your full party fainted. You returned to the route.",
      );
    }
  } else {
    setBattleActionBusy(false);
  }
}

async function useBattleItem(itemId) {
  if (battleActionBusy) return;
  if (!wild || !isInBattle) {
    await useItemOnActive(itemId);
    return;
  }
  const item = shopCatalog.find((catalogItem) => catalogItem.id === itemId);
  if (!canUseBattleItem(item)) {
    alert("That item will not help right now.");
    return;
  }

  battleBagOpen = false;
  await performWildUtilityAction("item", { itemId });
}

function updateBattleDisplay() {
  const hpBars = document.querySelectorAll(".battle-container .hp-fill");
  if (hpBars.length >= 2) {
    hpBars[0].style.width =
      getHpPercent(currentPlayerHP, activePokemon.maxHp) + "%";
    hpBars[1].style.width = getHpPercent(currentWildHP, wild.maxHp) + "%";
  }

  const battlePokemons = document.querySelectorAll(".battle-pokemon");
  if (battlePokemons.length >= 2) {
    battlePokemons[0].querySelector(".hp-line").innerHTML =
      `${renderIcon("heart", "HP")} ${currentPlayerHP}/${activePokemon.maxHp} HP`;
    battlePokemons[0].querySelector(".status-line").innerHTML =
      renderStatus(playerStatus);
    battlePokemons[1].querySelector(".hp-line").innerHTML =
      `${renderIcon("heart", "HP")} ${currentWildHP}/${wild.maxHp} HP`;
    battlePokemons[1].querySelector(".status-line").innerHTML =
      renderStatus(wildStatus);
  }
}

function showCatchOptions(disabled = false) {
  const catchPanel = document.getElementById("catch-panel");
  if (!catchPanel) return;

  catchPanel.innerHTML = `
    <div class="catch-options">
      <h3>${renderIcon("backpack", "Bag")} Throw a Poke Ball</h3>
      <button class="icon-button" ${battleActionBusy || disabled ? "disabled" : ""} onclick="throwBall('standard')">${renderIcon("standard", "Poke Ball")} Poke Ball (${getItemCount("standard")})</button>
      <button class="icon-button" ${battleActionBusy || disabled ? "disabled" : ""} onclick="throwBall('great')">${renderIcon("great", "Great Ball")} Great Ball (${getItemCount("great")})</button>
      <button class="icon-button" ${battleActionBusy || disabled ? "disabled" : ""} onclick="throwBall('ultra')">${renderIcon("ultra", "Ultra Ball")} Ultra Ball (${getItemCount("ultra")})</button>
      <button class="icon-button" ${battleActionBusy || disabled ? "disabled" : ""} onclick="throwBall('master')">${renderIcon("master", "Master Ball")} Master Ball (${getItemCount("master")})</button>
      <button class="secondary-btn icon-button" ${battleActionBusy ? "disabled" : ""} onclick="endEncounter()">${renderIcon("run", "Run")} Run</button>
    </div>
  `;
}

async function throwBall(type) {
  if (battleActionBusy) return;
  if (getItemCount(type) <= 0) {
    alert("You don't have any " + type + " balls!");
    return;
  }
  if (!wild || currentWildHP <= 0) {
    alert("You cannot catch a fainted Pokemon.");
    return;
  }

  const hpPercent = currentWildHP / wild.maxHp;
  setBattleActionBusy(true);
  let data;
  try {
    const response = await fetch("/api/catch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: wild.id,
        pokemon: wild,
        pokeball: type,
        wildHPPercent: hpPercent,
        status: wildStatus,
        shiny: wild.shiny,
      }),
    });
    data = await response.json();
  } catch (error) {
    console.error("Catch failed:", error);
    runBattlePresentation("restoreCaptureScene");
    setBattleActionBusy(false);
    alert("Catch attempt failed.");
    return;
  }
  if (data.error) {
    runBattlePresentation("restoreCaptureScene");
    alert(data.error);
    setBattleActionBusy(false);
    return;
  }
  await runBattlePresentation("playCaptureSequence", {
    ballType: type,
    caught: Boolean(data.success),
    player: activePokemon,
    opponent: wild,
  });
  if (data.state) playerState = data.state;
  appendBattleLog([`${data.message} (${data.catchRate}% chance)`]);
  displayStats();
  if (pokedexCache) await loadPokedex();
  if (questCache) await loadQuests();

  if (data.success) {
    showMoveButtons(true);
    showCatchOptions(true);
    await loadInventory();
    await returnToRouteAfterWildBattle(
      "Great catch! You returned to the route.",
      450,
    );
    return;
  }

  setBattleActionBusy(false);
  showCatchOptions();
}

async function gainXP(amount) {
  const response = await fetch("/api/xp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pokemonIndex: activeInventoryIndex,
      xpAmount: amount,
    }),
  });
  const data = await response.json();
  if (data.error) {
    alert(data.error);
    return;
  }
  if (data.messages?.length) appendBattleLog(data.messages);
  await loadInventory();
}

function endEncounter() {
  if (battleActionBusy) return;
  clearWildEncounterState();
  renderBattlePlaceholder("You returned to the route.");
  setActiveScreen("explore");
  renderRouteWorld();
}

function appendBattleLog(lines) {
  showRewardPopup(lines);
  const logDiv = document.getElementById("battle-log");
  if (!logDiv) return;
  lines.forEach((line) => {
    const p = document.createElement("p");
    p.textContent = line;
    logDiv.appendChild(p);
  });
  logDiv.scrollTop = logDiv.scrollHeight;
}

function setEvolutionPresentationHints(xpResult) {
  evolutionPresentationHints = (xpResult?.results || [])
    .map((result) => result?.pokemon)
    .filter(Boolean)
    .map(normalizePokemon);
}

function classifyRewardLine(line) {
  if (/gained .* XP/i.test(line)) return "xp";
  if (/earned .* coins|caught .* earned/i.test(line)) return "coins";
  if (/grew to level|stats increased/i.test(line)) return "level";
  if (/learned|wants to learn/i.test(line)) return "move";
  if (/evolved/i.test(line)) return "evolution";
  if (/caught/i.test(line)) return "catch";
  return "other";
}

function getRewardGroupLabel(type) {
  const labels = {
    xp: "XP Growth",
    coins: "Coins",
    level: "Level Up",
    move: "Move Learning",
    evolution: "Evolution",
    catch: "Catch",
    other: "Rewards",
  };
  return labels[type] || "Rewards";
}

function renderBattleResultGroups(lines) {
  const groups = lines.reduce((result, line) => {
    const type = classifyRewardLine(line);
    if (!result[type]) result[type] = [];
    result[type].push(line);
    return result;
  }, {});
  const order = ["xp", "level", "move", "evolution", "coins", "catch", "other"];
  return order
    .filter((type) => groups[type]?.length)
    .map(
      (type) => `
        <section class="battle-result-group result-${type}">
          <strong>${getRewardGroupLabel(type)}</strong>
          ${groups[type].map((line) => `<p>${line}</p>`).join("")}
        </section>
      `,
    )
    .join("");
}

function showRewardPopup(lines = []) {
  queueEvolutionPresentations(lines);
  const rewardLines = lines.filter((line) =>
    /(earned|gained|grew to level|stats increased|learned|wants to learn|evolved|caught)/i.test(
      line,
    ),
  );
  if (!rewardLines.length) return;

  let holder = document.getElementById("reward-popups");
  if (!holder) {
    holder = document.createElement("div");
    holder.id = "reward-popups";
    holder.className = "reward-popups";
    document.body.appendChild(holder);
  }

  const popup = document.createElement("div");
  popup.className = "reward-popup battle-result-popup";
  const hasXpGrowth = rewardLines.some((line) => /gained .* XP/i.test(line));
  popup.innerHTML = `
    <div class="battle-result-head">
      <strong class="reward-popup-title">${hasXpGrowth ? "Battle Results" : "Reward Results"}</strong>
      <button type="button" onclick="this.closest('.reward-popup').remove()">×</button>
    </div>
    ${renderBattleResultGroups(rewardLines)}
  `;
  holder.appendChild(popup);
  setTimeout(() => popup.remove(), hasXpGrowth ? 9000 : 5200);
}

function queueEvolutionPresentations(lines = []) {
  if (!Array.isArray(lines) || processedEvolutionLineBatches.has(lines)) return;
  processedEvolutionLineBatches.add(lines);
  lines.forEach((line) => {
    const match = String(line || "").match(/^(.+?) evolved into (.+?)!$/i);
    if (!match) return;
    const event = resolveEvolutionPresentationEvent(
      match[1].trim(),
      match[2].trim(),
    );
    evolutionPresentationQueue.push(event);
  });
  evolutionPresentationHints = [];
  showNextEvolutionPresentation();
}

function resolveEvolutionPresentationEvent(from, to) {
  const candidates = [
    ...teamCache,
    ...storageCache,
    ...(gymBattle?.playerTeam || []),
    ...(eliteBattle?.playerTeam || []),
    ...(npcBattle?.playerTeam || []),
    ...evolutionPresentationHints,
    activePokemon,
  ].filter(Boolean);
  const evolved =
    candidates.find(
      (pokemon) => pokemon.name === to && pokemon.evolvedFrom === from,
    ) || candidates.find((pokemon) => pokemon.name === to);
  const sourceEntry = pokedexCache?.entries?.find(
    (entry) => entry.name === from,
  );
  const sourceForm = evolved?.form
    ? sourceEntry?.forms?.find((form) => form.id === evolved.form.id)
    : null;
  const after = normalizePokemon(evolved || { name: to });
  const before = {
    ...after,
    id: sourceEntry?.id ?? pokemonImageIdByName.get(from),
    speciesId: sourceEntry?.speciesId ?? null,
    imageId:
      sourceForm?.imageId ??
      sourceEntry?.imageId ??
      pokemonImageIdByName.get(from),
    artwork: sourceEntry?.artwork || null,
    name: from,
    form: sourceForm
      ? { ...sourceForm, artwork: sourceForm.artwork || null }
      : evolved?.form
        ? { ...evolved.form, artwork: null }
        : null,
    shiny: Boolean(evolved?.shiny),
  };
  return { from, to, before, after };
}

function showNextEvolutionPresentation() {
  if (evolutionPresentationActive || !evolutionPresentationQueue.length) return;
  evolutionPresentationActive = true;
  const event = evolutionPresentationQueue.shift();
  const overlay = document.createElement("div");
  overlay.className = "evolution-overlay";
  overlay.innerHTML = `
    <div class="evolution-presentation" role="dialog" aria-modal="true" aria-label="Pokemon evolution">
      <p class="evolution-kicker">${event.from} is evolving...</p>
      <div class="evolution-sprite-stage">
        <span class="evolution-aura"></span>
        <img class="evolution-old-sprite" src="${getPokemonImage(event.before)}" alt="${event.from}" onerror="handleExternalImageError(event)">
        <img class="evolution-new-sprite" src="${getPokemonImage(event.after)}" alt="${event.to}" onerror="handleExternalImageError(event)">
        <span class="evolution-particles">${"<i></i>".repeat(prefersReducedMotion() ? 5 : 16)}</span>
      </div>
      <div class="evolution-congratulations">
        <h2>Congratulations!</h2>
        <p>Your ${event.from} evolved into <strong>${event.to}</strong>!</p>
        <button class="primary-action" onclick="closeEvolutionPresentation()">Continue</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  runBattlePresentation("playEvolutionSequence", {
    before: event.before,
    after: event.after,
    container: overlay,
  });
  setTimeout(() => overlay.classList.add("complete"), prefersReducedMotion() ? 120 : 2700);
}

function closeEvolutionPresentation() {
  document.querySelector(".evolution-overlay")?.remove();
  evolutionPresentationActive = false;
  showNextEvolutionPresentation();
}

function renderTypeBadges(types) {
  return types
    .map(
      (type) =>
        `<span class="type-badge" style="background: ${getTypeColor(type)}">${type}</span>`,
    )
    .join(" ");
}

function getItemCount(itemId) {
  return playerState?.items?.[itemId] || 0;
}

function getUsableItems() {
  return shopCatalog.filter(
    (item) =>
      ["healing", "status"].includes(item.category) &&
      getItemCount(item.id) > 0,
  );
}

function renderIcon(name, label, className = "ui-icon") {
  const src = icons[name];
  if (!src) return "";
  return `<img class="${className}" src="${src}" alt="${label}" loading="lazy">`;
}

function renderStatus(status) {
  if (!status || status === "none") return "Ready";
  return `<span class="status-pill status-${status}">${renderIcon(status, formatStatus(status))}${formatStatus(status)}</span>`;
}

function getHpPercent(current, max) {
  return Math.max(0, Math.min(100, ((current || 0) / (max || 1)) * 100));
}

function formatStatus(status) {
  if (!status || status === "none") return "Ready";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatPokemonGender(gender) {
  if (gender === "male") return "Male";
  if (gender === "female") return "Female";
  return "Genderless";
}

function getTypeEffectiveness(attackerType, defenderType) {
  const typeChart = {
    Normal: { Rock: 0.5, Ghost: 0, Steel: 0.5 },
    Fire: {
      Fire: 0.5,
      Water: 0.5,
      Grass: 2,
      Ice: 2,
      Bug: 2,
      Rock: 0.5,
      Dragon: 0.5,
      Steel: 2,
    },
    Water: { Fire: 2, Water: 0.5, Grass: 0.5, Ground: 2, Rock: 2, Dragon: 0.5 },
    Electric: {
      Water: 2,
      Electric: 0.5,
      Grass: 0.5,
      Ground: 0,
      Flying: 2,
      Dragon: 0.5,
    },
    Grass: {
      Fire: 0.5,
      Water: 2,
      Grass: 0.5,
      Poison: 0.5,
      Ground: 2,
      Flying: 0.5,
      Bug: 0.5,
      Rock: 2,
      Dragon: 0.5,
      Steel: 0.5,
    },
    Ice: {
      Fire: 0.5,
      Water: 0.5,
      Grass: 2,
      Ice: 0.5,
      Ground: 2,
      Flying: 2,
      Dragon: 2,
      Steel: 0.5,
    },
    Fighting: {
      Normal: 2,
      Ice: 2,
      Rock: 2,
      Dark: 2,
      Steel: 2,
      Poison: 0.5,
      Flying: 0.5,
      Psychic: 0.5,
      Bug: 0.5,
      Fairy: 0.5,
      Ghost: 0,
    },
    Poison: {
      Grass: 2,
      Fairy: 2,
      Poison: 0.5,
      Ground: 0.5,
      Rock: 0.5,
      Ghost: 0.5,
      Steel: 0,
    },
    Ground: {
      Fire: 2,
      Electric: 2,
      Grass: 0.5,
      Poison: 2,
      Flying: 0,
      Bug: 0.5,
      Rock: 2,
      Steel: 2,
    },
    Flying: {
      Grass: 2,
      Fighting: 2,
      Bug: 2,
      Electric: 0.5,
      Rock: 0.5,
      Steel: 0.5,
    },
    Psychic: { Fighting: 2, Poison: 2, Psychic: 0.5, Steel: 0.5, Dark: 0 },
    Bug: {
      Grass: 2,
      Psychic: 2,
      Dark: 2,
      Fire: 0.5,
      Fighting: 0.5,
      Poison: 0.5,
      Flying: 0.5,
      Ghost: 0.5,
      Steel: 0.5,
      Fairy: 0.5,
    },
    Rock: {
      Fire: 2,
      Ice: 2,
      Flying: 2,
      Bug: 2,
      Fighting: 0.5,
      Ground: 0.5,
      Steel: 0.5,
    },
    Ghost: { Psychic: 2, Ghost: 2, Normal: 0, Dark: 0.5 },
    Dragon: { Dragon: 2, Steel: 0.5, Fairy: 0 },
    Dark: { Psychic: 2, Ghost: 2, Fighting: 0.5, Dark: 0.5, Fairy: 0.5 },
    Steel: {
      Ice: 2,
      Rock: 2,
      Fairy: 2,
      Fire: 0.5,
      Water: 0.5,
      Electric: 0.5,
      Steel: 0.5,
    },
    Fairy: {
      Fighting: 2,
      Dragon: 2,
      Dark: 2,
      Fire: 0.5,
      Poison: 0.5,
      Steel: 0.5,
    },
  };
  return typeChart[attackerType]?.[defenderType] ?? 1;
}

function getCombinedTypeEffectiveness(attackerType, defenderTypes) {
  return defenderTypes.reduce(
    (total, type) => total * getTypeEffectiveness(attackerType, type),
    1,
  );
}

function getPokemonImage(pokemonOrId) {
  if (window.PokemonVariantUtils) {
    const fallbackImageId =
      typeof pokemonOrId === "object"
        ? pokemonImageIdByName.get(pokemonOrId.name) || pokemonOrId.id
        : pokemonOrId;
    return window.PokemonVariantUtils.getArtworkUrl(
      pokemonOrId,
      fallbackImageId,
    );
  }
  const imageId =
    typeof pokemonOrId === "object"
      ? pokemonOrId.imageId ||
        pokemonImageIdByName.get(pokemonOrId.name) ||
        pokemonOrId.id
      : pokemonOrId;
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${imageId}.png`;
}

function handleExternalImageError(event) {
  const image = event.target;
  if (!(image instanceof HTMLImageElement) || image.dataset.fallbackApplied)
    return;

  const source = image.currentSrc || image.src || "";
  const normalArtworkFallback =
    window.PokemonVariantUtils?.getNormalArtworkFallback(source);
  if (normalArtworkFallback && !image.dataset.normalArtworkFallback) {
    image.dataset.normalArtworkFallback = "true";
    image.src = normalArtworkFallback;
    return;
  }
  let fallback = null;
  if (
    source.includes("/PokeAPI/sprites/") ||
    source.includes("/pokemon/other/")
  ) {
    fallback = "assets/icons/pokemon-placeholder.svg";
  } else if (source.includes("pokemonshowdown.com/sprites/trainers/")) {
    fallback = "assets/icons/trainer-placeholder.svg";
  }
  if (!fallback) return;

  image.dataset.fallbackApplied = "true";
  image.src = fallback;
}

function getTypeColor(type) {
  const colors = {
    Fire: "#F08030",
    Water: "#6890F0",
    Grass: "#78C850",
    Electric: "#F8D030",
    Psychic: "#F85888",
    Normal: "#A8A878",
    Flying: "#A890F0",
    Bug: "#A8B820",
    Ground: "#E0C068",
    Poison: "#A040A0",
    Rock: "#B8A038",
    Ghost: "#705898",
    Dragon: "#7038F8",
    Dark: "#705848",
    Steel: "#B8B8D0",
    Fairy: "#EE99AC",
  };
  return colors[type] || "#999999";
}

function getAreaEmoji(area) {
  const emojis = {
    forest: "🌲",
    lake: "💧",
    cave: "⛰️",
    volcano: "🌋",
    mountain: "⛏️",
    desert: "🏜️",
    graveyard: "👻",
  };
  return emojis[area] || "📍";
}

function formatAreaName(area) {
  if (!area) return "Route";
  return area.charAt(0).toUpperCase() + area.slice(1);
}

function formatList(values = [], formatter = (value) => value) {
  if (!values.length) return "Unknown";
  return values.map(formatter).join(", ");
}

function getLeaderTheme(type) {
  return (
    leaderThemes[type] || {
      className: "champion",
      badge: `${type} Badge`,
      icon: "★",
    }
  );
}

function getTrainerSprite(type, name = "") {
  const key = String(name || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  const leaderSprite = {
    spark: trainerSprites.spark,
    mistyra: trainerSprites.mistyra,
    flint: trainerSprites.flint,
    verdia: trainerSprites.verdia,
    zephyr: trainerSprites.zephyr,
    garnet: trainerSprites.garnet,
    lunara: trainerSprites.lunara,
    glacius: trainerSprites.glacius,
    noctis: trainerSprites.noctis,
    pyra: trainerSprites.pyra,
    marinus: trainerSprites.marinus,
    drakon: trainerSprites.drakon,
    championaurelius: trainerSprites.champion,
  }[key];
  if (leaderSprite) return leaderSprite;
  if (type === "Electric") return trainerSprites.spark;
  if (type === "Water") return trainerSprites.mistyra;
  if (type === "Fire") return trainerSprites.flint;
  if (type === "Grass") return trainerSprites.verdia;
  if (type === "Flying") return trainerSprites.zephyr;
  if (type === "Rock") return trainerSprites.garnet;
  if (type === "Psychic") return trainerSprites.lunara;
  if (type === "Ice") return trainerSprites.glacius;
  if (type === "Dark" || type === "Ghost") return trainerSprites.noctis;
  if (type === "Dragon") return trainerSprites.drakon;
  return trainerSprites.champion;
}

function getNpcSprite(npc) {
  const spriteKey = npc?.sprite || npc?.type;
  if (spriteKey === "trainer") return trainerSprites.trainer;
  if (spriteKey === "trainer-water") return trainerSprites.mistyra;
  if (spriteKey === "trainer-rock") return trainerSprites.hiker;
  if (spriteKey === "trainer-fire") return trainerSprites.pyra;
  if (spriteKey === "trainer-psychic") return trainerSprites.psychic;
  if (spriteKey === "trainer-ranger") return trainerSprites.ranger;
  if (spriteKey === "trainer-ruin") return trainerSprites.ruinManiac;
  if (spriteKey === "trainer-ghost") return trainerSprites.channeler;
  if (spriteKey === "guide") return trainerSprites.guide;
  if (spriteKey === "guide-sailor") return trainerSprites.fisherman;
  if (spriteKey === "guide-ranger") return trainerSprites.ranger;
  if (spriteKey === "guide-ghost") return trainerSprites.channeler;
  if (spriteKey === "shop") return trainerSprites.shop;
  if (spriteKey === "healer" || spriteKey === "healer-fire")
    return trainerSprites.healer;
  return trainerSprites.player;
}

function getNpcTypeIcon(type) {
  const iconsByType = {
    trainer: "!",
    guide: "?",
    shop: "$",
    healer: "+",
  };
  return iconsByType[type] || "•";
}

function handleExploreKeydown(event) {
  if (activeScreen !== "explore" || activeOverlay) return;
  if (npcBattle || gymBattle || eliteBattle || isInBattle) return;

  const key = event.key.toLowerCase();
  if (key === "arrowup" || key === "w") {
    event.preventDefault();
    moveRoutePlayer(0, -1);
  } else if (key === "arrowdown" || key === "s") {
    event.preventDefault();
    moveRoutePlayer(0, 1);
  } else if (key === "arrowleft" || key === "a") {
    event.preventDefault();
    moveRoutePlayer(-1, 0);
  } else if (key === "arrowright" || key === "d") {
    event.preventDefault();
    moveRoutePlayer(1, 0);
  } else if (key === "e") {
    event.preventDefault();
    interactNearbyNpc();
  }
}

document.addEventListener("keydown", handleExploreKeydown);
document.addEventListener("error", handleExternalImageError, true);
window.addEventListener("battle-presentation-ready", refreshCurrentBattlePresentation);

init();
