let activePokemon = {
  id: 25,
  name: "Pikachu",
  type: "Electric",
  hp: 35,
  maxHp: 35,
  currentHp: 35,
  attack: 55,
  defense: 40,
  level: 1,
  xp: 0,
  rarity: "uncommon",
  source: "starter",
};
let activeInventoryIndex = null;
let wild, currentPlayerHP, currentWildHP;
let selectedArea = null;
let pokeballs = { standard: 10, great: 5, ultra: 2, master: 1 };

async function init() {
  try {
    await displayCurrentPlayer();
    displayAreas();
    loadInventory();
  } catch (error) {
    console.error("Error:", error);
  }
}

function displayCurrentPlayer() {
  const typeColor = getTypeColor(activePokemon.type);
  const fainted = activePokemon.currentHp <= 0;
  document.getElementById("current-player").innerHTML = `
    <div class="player-card${fainted ? " fainted" : ""}">
      <img src="${getPokemonImage(activePokemon.id)}" alt="${activePokemon.name}" style="width:80px; height:80px;">
      <div class="player-info">
        <h2>${activePokemon.name}</h2>
        <p>Type: <span style="background: ${typeColor}; padding: 2px 8px; border-radius: 4px; color: white;">${activePokemon.type}</span></p>
        <p>Level: ${activePokemon.level} | XP: ${activePokemon.xp}</p>
        <p>HP: ${activePokemon.currentHp}/${activePokemon.maxHp} | ATK: ${activePokemon.attack} | DEF: ${activePokemon.defense}</p>
        <p>Status: ${fainted ? "<strong>Fainted</strong>" : "Ready to battle"}</p>
        <div class="hp-bar"><div class="hp-fill" style="width: ${(activePokemon.currentHp / activePokemon.maxHp) * 100}%"></div></div>
      </div>
    </div>
  `;
  document.getElementById("explore-btn").disabled = fainted || !selectedArea;
}

function displayAreas() {
  fetch("/api/areas")
    .then((r) => r.json())
    .then((areas) => {
      let html = "<h3>Select Area</h3>";
      areas.forEach((area) => {
        const emoji = getAreaEmoji(area);
        html += `<button onclick="selectArea(event, '${area}')" class="area-btn">${emoji} ${area.toUpperCase()}</button>`;
      });
      document.getElementById("areas").innerHTML = html;
    });
}

function selectArea(event, area) {
  selectedArea = area;
  document.getElementById("explore-btn").style.display = "inline-block";
  document
    .querySelectorAll(".area-btn")
    .forEach((btn) => btn.classList.remove("active"));
  event.currentTarget.classList.add("active");
  document.getElementById("explore-btn").disabled =
    activePokemon.currentHp <= 0;
}

function loadInventory() {
  fetch("/api/inventory")
    .then((r) => r.json())
    .then(displayInventory);
}

function displayInventory(data) {
  let html = "<h3>Inventory (" + data.length + ")</h3>";
  if (data.length === 0) {
    html += "<p>No Pokémon caught yet!</p>";
  } else {
    data.forEach((p, index) => {
      const typeColor = getTypeColor(p.type);
      const isActive = index === activeInventoryIndex;
      const fainted = (p.currentHp ?? p.hp) <= 0;
      html += `<div class="inventory-item${isActive ? " active" : ""}" onclick="selectPokemon(${index})">
        <img src="${getPokemonImage(p.id)}" alt="${p.name}" style="width:40px; height:40px;">
        <div class="item-info">
          <div class="inventory-top">
            <strong>${p.name}</strong> Lv${p.level} <span style="color: ${typeColor};">${p.type}</span>
            ${isActive ? '<span class="active-label">ACTIVE</span>' : ""}
          </div>
          <div class="hp-bar-small"><div class="hp-fill" style="width: ${((p.currentHp ?? p.hp) / p.maxHp) * 100}%"></div></div>
          <p>${p.currentHp ?? p.hp}/${p.maxHp} HP ${fainted ? "(Fainted)" : ""}</p>
        </div>
      </div>`;
    });
  }
  document.getElementById("inventory").innerHTML = html;
}

function selectPokemon(index) {
  fetch("/api/inventory")
    .then((r) => r.json())
    .then((data) => {
      const selected = data[index];
      if (!selected) {
        alert("Could not select that Pokémon.");
        return;
      }
      activeInventoryIndex = index;
      activePokemon = {
        ...selected,
        currentHp: selected.currentHp ?? selected.hp,
        source: "inventory",
      };
      displayCurrentPlayer();
      loadInventory();
      if (activePokemon.currentHp <= 0) {
        alert(
          `${activePokemon.name} has fainted. Select another Pokémon before battling.`,
        );
      }
    });
}

document.getElementById("explore-btn")?.addEventListener("click", async () => {
  if (!selectedArea) {
    alert("Please select an area first!");
    return;
  }
  if (activePokemon.currentHp <= 0) {
    alert("Your active Pokémon has fainted. Choose another Pokémon first.");
    return;
  }

  try {
    const response = await fetch("/api/encounter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area: selectedArea }),
    });
    const data = await response.json();
    wild = data;
    currentPlayerHP = activePokemon.currentHp;
    currentWildHP = wild.currentHp;
    showBattle();
  } catch (error) {
    console.error("Error:", error);
  }
});

function showBattle() {
  const playerTypeColor = getTypeColor(activePokemon.type);
  const wildTypeColor = getTypeColor(wild.type);

  document.getElementById("encounter").innerHTML = `
    <h2>Battle in ${wild.area}!</h2>
    <p class="weather-info">Weather: ${wild.weather} ${wild.shiny ? " | ✨ Shiny encounter!" : ""}</p>
    <div class="battle-container">
      <div class="battle-pokemon">
        <img src="${getPokemonImage(activePokemon.id)}" alt="${activePokemon.name}">
        <div class="battle-info">
          <h3>${activePokemon.name} Lv${activePokemon.level}</h3>
          <span style="background: ${playerTypeColor}; color: white; padding: 4px 8px; border-radius: 4px;">${activePokemon.type}</span>
          <div class="hp-bar"><div class="hp-fill" style="width: ${(currentPlayerHP / activePokemon.maxHp) * 100}%"></div></div>
          <p>${currentPlayerHP}/${activePokemon.maxHp} HP</p>
        </div>
      </div>
      <div class="vs">VS</div>
      <div class="battle-pokemon">
        <img src="${getPokemonImage(wild.id)}" alt="${wild.name}">
        <div class="battle-info">
          <h3>${wild.name}${wild.shiny ? " ✨" : ""} Lv${wild.level}</h3>
          <span style="background: ${wildTypeColor}; color: white; padding: 4px 8px; border-radius: 4px;">${wild.type}</span>
          <div class="hp-bar"><div class="hp-fill" style="width: ${(currentWildHP / wild.hp) * 100}%"></div></div>
          <p>${currentWildHP}/${wild.hp} HP</p>
        </div>
      </div>
    </div>
    <div id="type-advantage" class="type-advantage"></div>
    <button id="attack-btn" onclick="attack()">Attack</button>
    <div id="battle-log"></div>
  `;
  updateTypeAdvantage();
}

function updateTypeAdvantage() {
  const typeAdvantages = {
    Fire: ["Grass", "Bug", "Steel"],
    Water: ["Fire", "Ground", "Rock"],
    Grass: ["Water", "Ground", "Rock"],
    Electric: ["Water", "Flying"],
  };

  let message = "";
  if (typeAdvantages[activePokemon.type]?.includes(wild.type)) {
    message += `🔥 Your ${activePokemon.type} is super effective! `;
  }
  if (typeAdvantages[wild.type]?.includes(activePokemon.type)) {
    message += `❄️ ${wild.type} is super effective against you! `;
  }

  document.getElementById("type-advantage").innerHTML = message
    ? `<p class="advantage">${message}</p>`
    : "";
}

function attack() {
  if (currentPlayerHP <= 0) {
    alert(
      "Your active Pokémon has fainted. Choose another Pokémon before battling.",
    );
    return;
  }

  fetch("/api/battle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      playerHP: currentPlayerHP,
      wildHP: currentWildHP,
      playerAttack: activePokemon.attack,
      playerDefense: activePokemon.defense,
      playerType: activePokemon.type,
      wildAttack: wild.attack,
      wildDefense: wild.defense,
      wildType: wild.type,
    }),
  })
    .then((r) => r.json())
    .then((data) => {
      currentPlayerHP = data.playerHP;
      currentWildHP = data.wildHP;
      activePokemon.currentHp = currentPlayerHP;

      const logDiv = document.getElementById("battle-log");
      data.log.forEach((line) => {
        const p = document.createElement("p");
        p.textContent = line;
        logDiv.appendChild(p);
      });

      updateBattleDisplay();
      displayCurrentPlayer();

      if (data.winner === "player") {
        document.getElementById("attack-btn").disabled = true;
        const xpGain = Math.floor(wild.xpYield * (wild.level || 1));
        gainXP(xpGain);
        showCatchOptions();
      } else if (data.winner === "wild") {
        document.getElementById("attack-btn").disabled = true;
        alert("You lost the battle!");
      }
    });
}

function updateBattleDisplay() {
  const hpPercent = (currentWildHP / wild.hp) * 100;
  const playerHpPercent = (currentPlayerHP / activePokemon.maxHp) * 100;

  const hpBars = document.querySelectorAll(".battle-container .hp-fill");
  if (hpBars.length >= 2) {
    hpBars[0].style.width = playerHpPercent + "%";
    hpBars[1].style.width = hpPercent + "%";
  }

  const battlePokemons = document.querySelectorAll(".battle-pokemon");
  if (battlePokemons.length >= 2) {
    battlePokemons[0].querySelector("p").textContent =
      `${currentPlayerHP}/${activePokemon.maxHp} HP`;
    battlePokemons[1].querySelector("p").textContent =
      `${currentWildHP}/${wild.hp} HP`;
  }
}

function showCatchOptions() {
  const catchDiv = document.getElementById("battle-log");
  catchDiv.innerHTML += `
    <div class="catch-options">
      <h3>Throw a Pokéball!</h3>
      <button onclick="throwBall('standard')">Pokéball (${pokeballs.standard})</button>
      <button onclick="throwBall('great')">Great Ball (${pokeballs.great})</button>
      <button onclick="throwBall('ultra')">Ultra Ball (${pokeballs.ultra})</button>
      <button onclick="throwBall('master')">Master Ball (${pokeballs.master})</button>
    </div>
  `;
}

function throwBall(type) {
  if (pokeballs[type] <= 0) {
    alert("You don't have any " + type + " balls!");
    return;
  }

  const hpPercent = currentWildHP / wild.hp;
  fetch("/api/catch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: wild.id,
      pokeball: type,
      wildHPPercent: hpPercent,
    }),
  })
    .then((r) => r.json())
    .then((data) => {
      pokeballs[type]--;
      const resultDiv = document.getElementById("battle-log");
      const p = document.createElement("p");
      p.innerHTML = `<strong>${data.message}</strong> (${data.catchRate}% chance)`;
      resultDiv.appendChild(p);

      if (data.success) {
        setTimeout(() => {
          loadInventory();
          document.getElementById("encounter").innerHTML =
            "<p>Great catch! Return to explore more areas.</p>";
        }, 2000);
      }
    });
}

function gainXP(amount) {
  if (activeInventoryIndex !== null) {
    fetch("/api/xp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pokemonIndex: activeInventoryIndex,
        xpAmount: amount,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        activePokemon = {
          ...activePokemon,
          ...data.pokemon,
          currentHp: activePokemon.currentHp,
        };
        if (data.leveledUp) {
          alert(
            `🎉 ${activePokemon.name} leveled up to ${activePokemon.level}!`,
          );
        }
        document.getElementById("battle-log").innerHTML +=
          `<p>⭐ Gained ${amount} XP!</p>`;
        displayCurrentPlayer();
        loadInventory();
      });
  } else {
    activePokemon.xp += amount;
    const levelRequirement = activePokemon.level * 100;
    let leveledUp = false;
    if (activePokemon.xp >= levelRequirement) {
      activePokemon.level += 1;
      activePokemon.xp = 0;
      activePokemon.maxHp = Math.floor(activePokemon.maxHp * 1.1);
      activePokemon.attack = Math.floor(activePokemon.attack * 1.1);
      activePokemon.defense = Math.floor(activePokemon.defense * 1.1);
      leveledUp = true;
    }
    if (leveledUp) {
      alert(`🎉 ${activePokemon.name} leveled up to ${activePokemon.level}!`);
    }
    document.getElementById("battle-log").innerHTML +=
      `<p>⭐ Gained ${amount} XP!</p>`;
    displayCurrentPlayer();
  }
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
    lake: "💧",
    cave: "⛰️",
    volcano: "🌋",
    mountain: "⛏️",
    desert: "🏜️",
    graveyard: "👻",
  };
  return emojis[area] || "📍";
}

init();
