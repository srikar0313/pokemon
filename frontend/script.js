let activePokemon = null;
let activeInventoryIndex = 0;
let wild = null;
let currentPlayerHP = 0;
let currentWildHP = 0;
let playerStatus = "none";
let wildStatus = "none";
let selectedArea = null;
let teamCache = [];
let storageCache = [];
let playerState = null;
let shopCatalog = [];
let gymCache = [];
let eliteCache = null;
let gymBattle = null;
let eliteBattle = null;
let npcCache = [];
let npcMap = null;
let npcBattle = null;
let isInBattle = false;
let isSwitching = false;
let activeScreen = "explore";
let activeOverlay = null;
let pendingSwapStorageIndex = null;
let focusedNpcId = null;
let routeDialogue = null;
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

async function init() {
  try {
    renderBattlePlaceholder();
    await loadProfile();
    await displayAreas();
    await loadGyms();
    await loadEliteFour();
    await loadInventory();
    await loadShop();
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
}

function openWildEncounterLayer() {
  const battleScreen = document.getElementById("battle-screen");
  battleScreen?.classList.add("active", "wild-encounter-layer");
  document.body.classList.add("wild-encounter-open");
  document.querySelectorAll(".nav-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.screen === activeScreen);
  });
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
  wild = null;
  currentWildHP = 0;
  wildStatus = "none";
  isInBattle = false;
  isSwitching = false;
  closeWildEncounterLayer();
}

function openOverlay(type) {
  activeOverlay = type;
  document.getElementById("overlay-backdrop")?.classList.remove("hidden");
  document
    .getElementById("shop-panel")
    ?.classList.toggle("hidden", type !== "shop");
  document
    .getElementById("center-panel")
    ?.classList.toggle("hidden", type !== "center");
  document
    .getElementById("swap-panel")
    ?.classList.toggle("hidden", type !== "swap");
  const title = document.getElementById("overlay-title");
  if (title) {
    title.textContent =
      type === "shop"
        ? "Shop"
        : type === "swap"
          ? "Swap Pokemon"
          : "Pokemon Center";
  }
  if (type === "shop") displayShop();
  if (type === "swap") renderSwapPicker();
}

function closeOverlay(event) {
  if (event && event.target !== event.currentTarget) return;
  activeOverlay = null;
  pendingSwapStorageIndex = null;
  document.getElementById("overlay-backdrop")?.classList.add("hidden");
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
  const types =
    Array.isArray(pokemon.types) && pokemon.types.length > 0
      ? pokemon.types
      : [pokemon.type || "Normal"];
  const moves =
    Array.isArray(pokemon.moves) && pokemon.moves.length > 0
      ? pokemon.moves
      : defaultMoves;

  return {
    ...pokemon,
    type: pokemon.type || types[0],
    types,
    level: pokemon.level || 1,
    xp: pokemon.xp || 0,
    maxHp: pokemon.maxHp || pokemon.hp || 1,
    currentHp: pokemon.currentHp ?? pokemon.maxHp ?? pokemon.hp ?? 1,
    specialAttack: pokemon.specialAttack ?? pokemon.attack ?? 1,
    specialDefense: pokemon.specialDefense ?? pokemon.defense ?? 1,
    status: pokemon.status || "none",
    moves: moves.map(normalizeMove),
  };
}

function displayCurrentPlayer() {
  const currentPlayer = document.getElementById("current-player");
  const exploreBtn = document.getElementById("explore-btn");

  if (!activePokemon) {
    currentPlayer.innerHTML = `
      <div class="player-card">
        <div class="player-info">
          <h2>Loading your team...</h2>
          <p>Your starter will appear here in a moment.</p>
        </div>
      </div>
    `;
    if (exploreBtn) exploreBtn.disabled = true;
    return;
  }

  const fainted = activePokemon.currentHp <= 0;
  currentPlayer.innerHTML = `
    <div class="player-card trainer-sheet${fainted ? " fainted" : ""}">
      <div class="trainer-portrait trainer-player">
        <span class="trainer-role">Player</span>
        <img src="${trainerSprites.player}" alt="${playerState?.trainerName || "Player"} trainer">
      </div>
      <div class="player-info">
        <div class="panel-header compact-header">
          <div>
            <h2>${playerState?.trainerName || "Player"}</h2>
            <p>Active partner: ${activePokemon.name}${activePokemon.shiny ? " *" : ""}</p>
          </div>
          <div class="badge-token player-badge-token">
            <span class="badge-icon">🎒</span>
            <span>Trainer</span>
          </div>
        </div>
        <div class="partner-showcase">
          <img class="partner-art" src="${getPokemonImage(activePokemon.id)}" alt="${activePokemon.name}">
          <div class="partner-stats">
            <p>${renderTypeBadges(activePokemon.types)}</p>
            <p>${renderIcon("xp", "XP")} Level: ${activePokemon.level} | XP: ${activePokemon.xp}</p>
            <p>${renderIcon("heart", "HP")} HP: ${activePokemon.currentHp}/${activePokemon.maxHp}</p>
            <p>ATK ${activePokemon.attack} | DEF ${activePokemon.defense} | SP.ATK ${activePokemon.specialAttack} | SP.DEF ${activePokemon.specialDefense}</p>
            <p>Status: ${fainted ? renderStatus("fainted") : renderStatus(activePokemon.status)}</p>
          </div>
        </div>
        <div class="hp-bar"><div class="hp-fill" style="width: ${getHpPercent(activePokemon.currentHp, activePokemon.maxHp)}%"></div></div>
      </div>
    </div>
  `;
  if (exploreBtn) exploreBtn.disabled = fainted || !selectedArea;
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
    const emoji = getAreaEmoji(areaId);
    const activeClass = selectedArea === areaId ? " active" : "";
    html += `<button onclick="selectArea(event, '${areaId}')" class="area-btn${unlocked ? activeClass : " locked"}" ${unlocked ? "" : "disabled"}>${emoji} ${areaName.toUpperCase()}${unlocked ? "" : " LOCKED"}</button>`;
  });
  html += "</div>";
  document.getElementById("areas").innerHTML = html;

  const exploreBtn = document.getElementById("explore-btn");
  if (exploreBtn) {
    exploreBtn.style.display = selectedArea ? "inline-flex" : "none";
    exploreBtn.disabled =
      !activePokemon || activePokemon.currentHp <= 0 || !selectedArea;
  }

  if (selectedArea) {
    await loadAreaWorld(selectedArea);
  } else {
    renderRouteWorld();
  }
}

async function selectArea(event, area) {
  selectedArea = area;
  document.getElementById("explore-btn").style.display = "inline-flex";
  document
    .querySelectorAll(".area-btn")
    .forEach((btn) => btn.classList.remove("active"));
  event.currentTarget.classList.add("active");
  document.getElementById("explore-btn").disabled =
    !activePokemon || activePokemon.currentHp <= 0;
  await loadAreaWorld(area);
  displayCurrentPlayer();
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

function setRouteDialogue(npc, text, tone = "neutral") {
  routeDialogue = {
    npc,
    text,
    tone,
  };
  renderRouteDialogue();
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

  dialogue.innerHTML = `
    <div class="dialogue-box${routeDialogue?.tone ? ` dialogue-${routeDialogue.tone}` : ""}">
      <div class="dialogue-head">
        <strong>${speaker?.name || "Route"}</strong>
        <span>${speaker ? npcTypeLabels[speaker.type] || "World" : "Explore"}</span>
      </div>
      <p>${message}</p>
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
                <button class="primary-action route-interact-btn" onclick="interactNearbyNpc()" ${
                  interactable ? "" : "disabled"
                }>
                  ${displayNpc.type === "trainer" && !displayNpc.defeated ? "Battle [E]" : "Interact [E]"}
                </button>
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
          ${showNpc ? `onclick="inspectNpc(${npc.id})"` : 'type="button"'}
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
  setRouteDialogue(null, rewardText, event.tone);
}

function moveRoutePlayer(dx, dy) {
  if (!selectedArea || !npcMap) return;
  if (activeOverlay || npcBattle || gymBattle || eliteBattle || isInBattle)
    return;
  const current = getPlayerPosition();
  const next = {
    x: Math.max(1, Math.min(npcMap?.width || 8, current.x + dx)),
    y: Math.max(1, Math.min(npcMap?.height || 6, current.y + dy)),
  };
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
  maybeTriggerZoneEvent(next);
}

async function interactNearbyNpc() {
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

  const response = await fetch("/api/npc/interact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ npcId: npc.id }),
  });
  const data = await response.json();
  if (data.error) {
    alert(data.error);
    return;
  }

  focusedNpcId = npc.id;
  if (data.action === "battle") {
    npcBattle = data.session;
    setRouteDialogue(data.npc, data.dialogue, "battle");
    showNpcBattle(data.log || []);
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
    <h3>Gym Arenas</h3>
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
                  <span>${gym.defeated ? "Cleared - Rematch" : gym.unlocked ? `${gym.rewardCoins} coins` : "Locked"}</span>
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
            <button class="elite-card${eliteCache.unlocked ? "" : " locked"}" ${eliteCache.unlocked && !eliteCache.completed && index === 0 ? "" : "disabled"} onclick="startEliteRun()">
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
        </div>
        <div class="badge-token badge-${theme.className}">
          <span class="badge-icon">${theme.icon}</span>
          <span>${gymBattle.gym.badge}</span>
        </div>
      </div>
      <div class="battle-container gym-battle-container">
        <div class="battle-pokemon">
          <img src="${getPokemonImage(player.id)}" alt="${player.name}">
          <div class="battle-info">
            <h3>${player.name} Lv${player.level}</h3>
            ${renderTypeBadges(player.types)}
            <div class="hp-bar"><div class="hp-fill" style="width: ${getHpPercent(player.currentHp, player.maxHp)}%"></div></div>
            <p>${renderIcon("heart", "HP")} ${player.currentHp}/${player.maxHp} HP</p>
            <p>${renderStatus(player.status)}</p>
          </div>
        </div>
        <div class="vs">VS</div>
        <div class="battle-pokemon">
          <img src="${getPokemonImage(opponent.id)}" alt="${opponent.name}">
          <div class="battle-info">
            <h3>Gym ${opponent.name} Lv${opponent.level}</h3>
            ${renderTypeBadges(opponent.types)}
            <div class="hp-bar"><div class="hp-fill" style="width: ${getHpPercent(opponent.currentHp, opponent.maxHp)}%"></div></div>
            <p>${renderIcon("heart", "HP")} ${opponent.currentHp}/${opponent.maxHp} HP</p>
            <p>${renderStatus(opponent.status)}</p>
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
  appendBattleLog(lines);
}

function showGymResult(lines = []) {
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
    const btn = document.createElement("button");
    btn.className = "move-btn";
    btn.innerHTML = `<strong>${move.name}</strong><span>${move.type} | ${move.category} | ${move.currentPp}/${move.maxPp ?? move.pp}</span>`;
    btn.disabled = move.currentPp <= 0 || player.currentHp <= 0;
    btn.onclick = () => gymMove(move.name);
    moveButtonsDiv.appendChild(btn);
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
          `<button class="secondary-btn" ${pokemon.currentHp <= 0 || index === gymBattle.playerIndex ? "disabled" : ""} onclick="gymSwitch(${index})">${pokemon.name} ${pokemon.currentHp}/${pokemon.maxHp}</button>`,
      )
      .join("")}
  `;
}

async function gymMove(moveName) {
  const response = await fetch("/api/gym/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ moveName }),
  });
  const data = await response.json();
  if (data.error) {
    if (Array.isArray(data.log)) appendBattleLog(data.log);
    alert(data.error);
    if (
      data.error === "No active gym battle" ||
      data.error === "Gym battle is already finished"
    ) {
      gymBattle = null;
      showGymResult(["Gym battle finished."]);
      await loadProfile();
      await loadGyms();
      await loadInventory();
    }
    return;
  }
  gymBattle = data.session;
  await loadInventory();
  if (data.won || data.lost) {
    showGymResult(data.log);
    gymBattle = null;
    await loadProfile();
    await displayAreas();
    await loadGyms();
    await loadEliteFour();
  } else {
    showGymBattle(data.log);
  }
}

async function gymSwitch(pokemonIndex) {
  const response = await fetch("/api/gym/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "switch", pokemonIndex }),
  });
  const data = await response.json();
  if (data.error) {
    alert(data.error);
    return;
  }
  gymBattle = data.session;
  showGymBattle(data.log);
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
      <div class="battle-container elite-battle-container">
        <div class="battle-pokemon">
          <img src="${getPokemonImage(player.id)}" alt="${player.name}">
          <div class="battle-info">
            <h3>${player.name} Lv${player.level}</h3>
            ${renderTypeBadges(player.types)}
            <div class="hp-bar"><div class="hp-fill" style="width: ${getHpPercent(player.currentHp, player.maxHp)}%"></div></div>
            <p>${renderIcon("heart", "HP")} ${player.currentHp}/${player.maxHp} HP</p>
            <p>${renderStatus(player.status)}</p>
          </div>
        </div>
        <div class="vs">VS</div>
        <div class="battle-pokemon">
          <img src="${getPokemonImage(opponent.id)}" alt="${opponent.name}">
          <div class="battle-info">
            <h3>${eliteBattle.isChampion ? opponent.name : `${eliteBattle.trainer.name}'s ${opponent.name}`} Lv${opponent.level}</h3>
            ${renderTypeBadges(opponent.types)}
            <div class="hp-bar"><div class="hp-fill" style="width: ${getHpPercent(opponent.currentHp, opponent.maxHp)}%"></div></div>
            <p>${renderIcon("heart", "HP")} ${opponent.currentHp}/${opponent.maxHp} HP</p>
            <p>${renderStatus(opponent.status)}</p>
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
  appendBattleLog(lines);
}

function showEliteResult(lines = []) {
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
    const btn = document.createElement("button");
    btn.className = "move-btn";
    btn.innerHTML = `<strong>${move.name}</strong><span>${move.type} | ${move.category} | ${move.currentPp}/${move.maxPp ?? move.pp}</span>`;
    btn.disabled = move.currentPp <= 0 || player.currentHp <= 0;
    btn.onclick = () => eliteMove(move.name);
    moveButtonsDiv.appendChild(btn);
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
          `<button class="secondary-btn" ${pokemon.currentHp <= 0 || index === eliteBattle.playerIndex ? "disabled" : ""} onclick="eliteSwitch(${index})">${pokemon.name} ${pokemon.currentHp}/${pokemon.maxHp}</button>`,
      )
      .join("")}
  `;
}

async function eliteMove(moveName) {
  const response = await fetch("/api/elite/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ moveName }),
  });
  const data = await response.json();
  if (data.error) {
    if (Array.isArray(data.log)) appendBattleLog(data.log);
    alert(data.error);
    if (data.error === "No active Elite Four battle") {
      eliteBattle = null;
      showEliteResult(["The Elite Four challenge has ended."]);
      await loadEliteFour();
      await loadInventory();
      await loadProfile();
    }
    return;
  }
  eliteBattle = data.session;
  await loadInventory();
  if (data.won || data.lost) {
    showEliteResult(data.log);
    eliteBattle = null;
    await loadProfile();
    await loadEliteFour();
    await loadGyms();
  } else {
    showEliteBattle(data.log);
  }
}

async function eliteSwitch(pokemonIndex) {
  const response = await fetch("/api/elite/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "switch", pokemonIndex }),
  });
  const data = await response.json();
  if (data.error) {
    alert(data.error);
    return;
  }
  eliteBattle = data.session;
  showEliteBattle(data.log);
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
      <div class="battle-container npc-battle-container">
        <div class="battle-pokemon">
          <img src="${getPokemonImage(player.id)}" alt="${player.name}">
          <div class="battle-info">
            <h3>${player.name} Lv${player.level}</h3>
            ${renderTypeBadges(player.types)}
            <div class="hp-bar"><div class="hp-fill" style="width: ${getHpPercent(player.currentHp, player.maxHp)}%"></div></div>
            <p>${renderIcon("heart", "HP")} ${player.currentHp}/${player.maxHp} HP</p>
            <p>${renderStatus(player.status)}</p>
          </div>
        </div>
        <div class="vs">VS</div>
        <div class="battle-pokemon">
          <img src="${getPokemonImage(opponent.id)}" alt="${opponent.name}">
          <div class="battle-info">
            <h3>${npc.name}'s ${opponent.name} Lv${opponent.level}</h3>
            ${renderTypeBadges(opponent.types)}
            <div class="hp-bar"><div class="hp-fill" style="width: ${getHpPercent(opponent.currentHp, opponent.maxHp)}%"></div></div>
            <p>${renderIcon("heart", "HP")} ${opponent.currentHp}/${opponent.maxHp} HP</p>
            <p>${renderStatus(opponent.status)}</p>
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
  appendBattleLog(lines);
}

function showNpcResult(lines = []) {
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
    const btn = document.createElement("button");
    btn.className = "move-btn";
    btn.innerHTML = `<strong>${move.name}</strong><span>${move.type} | ${move.category} | ${move.currentPp}/${move.maxPp ?? move.pp}</span>`;
    btn.disabled = move.currentPp <= 0 || player.currentHp <= 0;
    btn.onclick = () => npcMove(move.name);
    moveButtonsDiv.appendChild(btn);
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
          `<button class="secondary-btn" ${pokemon.currentHp <= 0 || index === npcBattle.playerIndex ? "disabled" : ""} onclick="npcSwitch(${index})">${pokemon.name} ${pokemon.currentHp}/${pokemon.maxHp}</button>`,
      )
      .join("")}
  `;
}

async function npcMove(moveName) {
  const response = await fetch("/api/npc/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ moveName }),
  });
  const data = await response.json();
  if (data.error) {
    if (Array.isArray(data.log)) appendBattleLog(data.log);
    alert(data.error);
    if (data.error === "No active NPC battle") {
      npcBattle = null;
      showNpcResult(["Trainer battle finished."]);
      await loadAreaWorld(selectedArea);
      await loadProfile();
      await loadInventory();
    }
    return;
  }

  npcBattle = data.session;
  await loadInventory();
  if (data.won || data.lost) {
    showNpcResult(data.log);
    npcBattle = null;
    await loadProfile();
    await loadInventory();
    await loadAreaWorld(selectedArea);
  } else {
    showNpcBattle(data.log);
  }
}

async function npcSwitch(pokemonIndex) {
  const response = await fetch("/api/npc/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "switch", pokemonIndex }),
  });
  const data = await response.json();
  if (data.error) {
    alert(data.error);
    return;
  }
  npcBattle = data.session;
  showNpcBattle(data.log);
}

async function loadProfile() {
  const response = await fetch("/api/profile");
  playerState = await response.json();
  displayStats();
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
        <span>Badges</span>
        <strong>${playerState.badges?.length || 0}</strong>
        <small>${playerState.badges?.length ? playerState.badges.join(", ") : "No badges yet"}</small>
      </div>
    </div>
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
  const featuredItems = shopCatalog.filter((item) =>
    ["standard", "great", "ultra", "master", "potion"].includes(item.id),
  );
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
  const response = await fetch("/api/inventory");
  const data = await response.json();
  teamCache = (data.team || []).map(normalizePokemon);
  storageCache = (data.storage || []).map(normalizePokemon);

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
      <h3>Team (${data.length}/7)</h3>
      <button class="secondary-btn icon-button" onclick="healTeam()">${renderIcon("potion", "Potion")} Heal All</button>
    </div>
  `;

  if (data.length === 0) {
    html += "<p>No Pokémon in your team yet.</p>";
  } else {
    html += `<div class="party-grid">`;
    data.forEach((p, index) => {
      const isActive = index === activeInventoryIndex;
      const fainted = (p.currentHp ?? p.hp) <= 0;
      html += `<div class="inventory-item party-card${isActive ? " active" : ""}" onclick="selectPokemon(${index})">
        <img src="${getPokemonImage(p.id)}" alt="${p.name}">
        <div class="item-info">
          <div class="inventory-top">
            <strong>${p.name}${p.shiny ? " *" : ""}</strong> Lv${p.level}
            ${renderTypeBadges(p.types)}
            ${isActive ? '<span class="active-label">ACTIVE</span>' : ""}
          </div>
          <div class="hp-bar-small"><div class="hp-fill" style="width: ${getHpPercent(p.currentHp ?? p.hp, p.maxHp)}%"></div></div>
          <p>${renderIcon("heart", "HP")} ${p.currentHp ?? p.hp}/${p.maxHp} HP ${fainted ? renderStatus("fainted") : renderStatus(p.status)}</p>
          <div class="bag-actions">
            <button onclick="setActivePokemonByIndex(event, ${index})" class="mini-item-btn icon-button">Make Active</button>
            ${usableItems.length ? `<button onclick="setActiveScreen('inventory'); setActivePokemonByIndex(event, ${index})" class="mini-item-btn icon-button">Use Items</button>` : ""}
            <button onclick="releasePokemon(event, 'team', ${index})" class="mini-btn">Release</button>
          </div>
        </div>
      </div>`;
    });
    html += `</div>`;
  }
  document.getElementById("party-panel").innerHTML = html;
}

function displayStorage(storage) {
  const inventoryDiv = document.getElementById("party-panel");
  if (!inventoryDiv) return;

  let html = `
    <div class="inventory-header storage-header">
      <h3>Storage (${storage.length})</h3>
      <p>Stored Pokémon can be swapped into your team.</p>
    </div>
  `;

  if (storage.length === 0) {
    html += "<p>No stored Pokémon.</p>";
  } else {
    storage.forEach((p, index) => {
      const fainted = (p.currentHp ?? p.hp) <= 0;
      html += `<div class="inventory-item storage-item${fainted ? " fainted" : ""}">
        <img src="${getPokemonImage(p.id)}" alt="${p.name}">
        <div class="item-info">
          <div class="inventory-top">
            <strong>${p.name}${p.shiny ? " *" : ""}</strong> Lv${p.level}
            ${renderTypeBadges(p.types)}
          </div>
          <div class="hp-bar-small"><div class="hp-fill" style="width: ${getHpPercent(p.currentHp ?? p.hp, p.maxHp)}%"></div></div>
          <p>${renderIcon("heart", "HP")} ${p.currentHp ?? p.hp}/${p.maxHp} HP ${fainted ? renderStatus("fainted") : renderStatus(p.status)}</p>
          <div class="bag-actions">
            <button onclick="swapWithStorage(${index})" class="mini-btn swap-btn">Swap into Team</button>
            <button onclick="releasePokemon(event, 'storage', ${index})" class="mini-btn">Release</button>
          </div>
        </div>
      </div>`;
    });
  }

  inventoryDiv.insertAdjacentHTML("beforeend", html);
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
                        ["healing", "status"].includes(item.category)
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
        <img src="${getPokemonImage(storedPokemon.id)}" alt="${storedPokemon.name}">
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
                <img src="${getPokemonImage(pokemon.id)}" alt="${pokemon.name}">
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

function selectPokemon(index) {
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
    activeInventoryIndex = index;
    activePokemon = normalizePokemon(selected);
    currentPlayerHP = activePokemon.currentHp;
    playerStatus = activePokemon.status || "none";
    displayCurrentPlayer();
    showBattle();
    isSwitching = false;
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

async function useItem(event, itemId, pokemonIndex) {
  event.stopPropagation();
  const response = await fetch("/api/use-item", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemId, pokemonIndex }),
  });
  const data = await response.json();
  if (data.error) {
    alert(data.error);
    return;
  }
  playerState = data.state;
  await loadInventory();
  displayStats();
  displayCurrentPlayer();
  renderBattlePlaceholder(data.message);
}

async function useItemOnActive(itemId) {
  if (!Number.isInteger(activeInventoryIndex)) {
    alert("Choose a Pokemon in Party first.");
    return;
  }
  await useItem({ stopPropagation() {} }, itemId, activeInventoryIndex);
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
          loadInventory();
        }
      });
  }
}

async function swapWithStorage(storageIndex) {
  if (teamCache.length < 7) {
    await confirmStorageSwap(teamCache.length, storageIndex);
    return;
  }

  pendingSwapStorageIndex = storageIndex;
  openOverlay("swap");
}

async function confirmStorageSwap(
  teamIndex,
  explicitStorageIndex = pendingSwapStorageIndex,
) {
  if (!Number.isInteger(teamIndex) || teamIndex < 0 || teamIndex > 6) {
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

document.getElementById("explore-btn")?.addEventListener("click", async () => {
  if (!selectedArea) {
    alert("Please select an area first!");
    return;
  }
  if (!activePokemon || activePokemon.currentHp <= 0) {
    alert("Your active Pokemon has fainted. Heal or choose another Pokemon.");
    return;
  }

  try {
    const response = await fetch("/api/encounter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area: selectedArea }),
    });
    const data = await response.json();
    wild = normalizePokemon(data);
    currentPlayerHP = activePokemon.currentHp;
    currentWildHP = wild.currentHp;
    playerStatus = activePokemon.status || "none";
    wildStatus = wild.status || "none";
    showBattle();
  } catch (error) {
    console.error("Error:", error);
  }
});

function showBattle() {
  openWildEncounterLayer();
  document.getElementById("encounter").innerHTML = `
    <div class="wild-encounter-head">
      <div>
        <span>Wild Encounter</span>
        <h2>${wild.name}${wild.shiny ? " *" : ""} appeared!</h2>
      </div>
      <p class="weather-info">${formatAreaName(wild.area)} | Weather: ${wild.weather}${wild.shiny ? " | Shiny encounter!" : ""}</p>
    </div>
    <div class="battle-container">
      <div class="battle-pokemon">
        <img src="${getPokemonImage(activePokemon.id)}" alt="${activePokemon.name}">
        <div class="battle-info">
          <h3>${activePokemon.name} Lv${activePokemon.level}</h3>
          ${renderTypeBadges(activePokemon.types)}
          <div class="hp-bar"><div class="hp-fill" style="width: ${getHpPercent(currentPlayerHP, activePokemon.maxHp)}%"></div></div>
          <p class="hp-line">${renderIcon("heart", "HP")} ${currentPlayerHP}/${activePokemon.maxHp} HP</p>
          <p class="status-line">${renderStatus(playerStatus)}</p>
        </div>
      </div>
      <div class="vs">VS</div>
      <div class="battle-pokemon">
        <img src="${getPokemonImage(wild.id)}" alt="${wild.name}">
        <div class="battle-info">
          <h3>${wild.name}${wild.shiny ? " *" : ""} Lv${wild.level}</h3>
          ${renderTypeBadges(wild.types)}
          <div class="hp-bar"><div class="hp-fill" style="width: ${getHpPercent(currentWildHP, wild.maxHp)}%"></div></div>
          <p class="hp-line">${renderIcon("heart", "HP")} ${currentWildHP}/${wild.maxHp} HP</p>
          <p class="status-line">${renderStatus(wildStatus)}</p>
        </div>
      </div>
    </div>
    <div id="type-advantage" class="type-advantage"></div>
    <div id="move-buttons" class="move-buttons"></div>
    <button onclick="switchPokemon()" class="secondary-btn">Switch Pokémon</button>
    <div id="wild-switch-panel"></div>
    <div id="catch-panel"></div>
    <div id="battle-log"></div>
  `;
  updateTypeAdvantage();
  showMoveButtons();
  showCatchOptions();
  isInBattle = true;
}

function showMoveButtons(disabled = false) {
  const moveButtonsDiv = document.getElementById("move-buttons");
  if (!moveButtonsDiv) return;

  moveButtonsDiv.innerHTML = "";
  activePokemon.moves.forEach((move) => {
    const btn = document.createElement("button");
    btn.className = "move-btn";
    btn.innerHTML = `<strong>${move.name}</strong><span>${move.type} | ${move.category} | ${move.currentPp}/${move.maxPp ?? move.pp}</span>`;
    btn.disabled = disabled || move.currentPp <= 0 || currentPlayerHP <= 0;
    btn.onclick = () => attack(move.name);
    moveButtonsDiv.appendChild(btn);
  });
}

function switchPokemon() {
  isSwitching = true;
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
              <button class="wild-switch-card" ${disabled ? "disabled" : ""} onclick="selectPokemon(${index})">
                <img src="${getPokemonImage(pokemon.id)}" alt="${pokemon.name}">
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
  if (currentPlayerHP <= 0) {
    alert("Your active Pokemon has fainted. Heal or choose another Pokemon.");
    return;
  }
  if (currentWildHP <= 0) {
    alert("The wild Pokemon already fainted.");
    return;
  }

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
    }),
  });
  const data = await response.json();
  if (data.error) {
    alert(data.error);
    return;
  }

  currentPlayerHP = data.playerHP;
  currentWildHP = data.wildHP;
  playerStatus = data.playerStatus;
  wildStatus = data.wildStatus;
  activePokemon.currentHp = currentPlayerHP;
  activePokemon.status = playerStatus;
  activePokemon.moves = data.playerMoves.map(normalizeMove);
  wild = normalizePokemon(data.wild);

  appendBattleLog(data.log);
  updateBattleDisplay();
  displayCurrentPlayer();
  showMoveButtons(!!data.winner);
  showCatchOptions(!!data.winner);
  await loadInventory();

  if (data.winner === "player") {
    const xpGain =
      data.xpAward ??
      Math.floor((wild.xpYield || 50) * Math.max(2, wild.level || 1));
    appendBattleLog([`${activePokemon.name} gained ${xpGain} XP.`]);
    if (data.moneyReward) {
      await loadProfile();
    }
    await gainXP(xpGain);
    appendBattleLog([
      `Wild ${wild.name} fainted. You cannot catch a fainted Pokemon.`,
    ]);
  } else if (data.winner === "wild") {
    appendBattleLog(["You lost the battle. Heal up and try again."]);
  }
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
      <button class="icon-button" ${disabled ? "disabled" : ""} onclick="throwBall('standard')">${renderIcon("standard", "Poke Ball")} Poke Ball (${getItemCount("standard")})</button>
      <button class="icon-button" ${disabled ? "disabled" : ""} onclick="throwBall('great')">${renderIcon("great", "Great Ball")} Great Ball (${getItemCount("great")})</button>
      <button class="icon-button" ${disabled ? "disabled" : ""} onclick="throwBall('ultra')">${renderIcon("ultra", "Ultra Ball")} Ultra Ball (${getItemCount("ultra")})</button>
      <button class="icon-button" ${disabled ? "disabled" : ""} onclick="throwBall('master')">${renderIcon("master", "Master Ball")} Master Ball (${getItemCount("master")})</button>
      <button class="secondary-btn icon-button" onclick="endEncounter()">${renderIcon("run", "Run")} Run</button>
    </div>
  `;
}

async function throwBall(type) {
  if (getItemCount(type) <= 0) {
    alert("You don't have any " + type + " balls!");
    return;
  }
  if (!wild || currentWildHP <= 0) {
    alert("You cannot catch a fainted Pokemon.");
    return;
  }

  const hpPercent = currentWildHP / wild.maxHp;
  const response = await fetch("/api/catch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: wild.id,
      pokeball: type,
      wildHPPercent: hpPercent,
      status: wildStatus,
      shiny: wild.shiny,
    }),
  });
  const data = await response.json();
  if (data.error) {
    alert(data.error);
    return;
  }
  if (data.state) playerState = data.state;
  appendBattleLog([`${data.message} (${data.catchRate}% chance)`]);
  displayStats();
  showCatchOptions();

  if (data.success) {
    showMoveButtons(true);
    showCatchOptions(true);
    await loadInventory();
    setTimeout(() => {
      clearWildEncounterState();
      renderBattlePlaceholder("Great catch! Choose an area and explore again.");
      setActiveScreen("explore");
      renderRouteWorld();
    }, 1200);
  }
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
  if (data.leveledUp) {
    appendBattleLog([
      `${data.pokemon.name} leveled up to ${data.pokemon.level}!`,
    ]);
  }
  if (data.evolved) {
    appendBattleLog([
      `${data.evolvedFrom || "Your Pokemon"} evolved into ${data.evolvedTo || data.pokemon.name}!`,
    ]);
  }
  await loadInventory();
}

function endEncounter() {
  clearWildEncounterState();
  renderBattlePlaceholder(
    "You returned safely. Pick an area to explore again.",
  );
  setActiveScreen("explore");
  renderRouteWorld();
}

function appendBattleLog(lines) {
  const logDiv = document.getElementById("battle-log");
  if (!logDiv) return;
  lines.forEach((line) => {
    const p = document.createElement("p");
    p.textContent = line;
    logDiv.appendChild(p);
  });
  logDiv.scrollTop = logDiv.scrollHeight;
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

function getPokemonImage(id) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
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
    ocean: "💧",
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
  if (spriteKey === "guide") return trainerSprites.guide;
  if (spriteKey === "guide-sailor") return trainerSprites.fisherman;
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

init();
