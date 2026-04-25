const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();
const port = 3000;

app.use(express.static("frontend"));
app.use(express.json());

const rarityWeights = {
  common: 60,
  uncommon: 25,
  rare: 10,
  legendary: 3,
  mythical: 2,
};

const weatherBoosts = {
  Fire: ["sunny"],
  Water: ["rain"],
  Electric: ["rain"],
  Ice: ["snow"],
  Rock: ["sandstorm"],
  Ground: ["sandstorm"],
  Grass: ["rain", "sunny"],
};

const ballRates = {
  standard: 1.0,
  great: 1.5,
  ultra: 2.0,
  master: 4.0,
};

const statusModifiers = {
  asleep: 2.0,
  frozen: 2.0,
  paralyzed: 1.5,
  burned: 1.5,
  poisoned: 1.5,
  badpoison: 1.5,
  none: 1.0,
};

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
    Rock: 1,
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

function getTimeOfDay() {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 18 ? "day" : "night";
}

function getCurrentWeather() {
  const roll = Math.random();
  if (roll < 0.5) return "sunny";
  if (roll < 0.8) return "rain";
  if (roll < 0.95) return "snow";
  return "sandstorm";
}

function getPokemonTypes(pokemon) {
  if (Array.isArray(pokemon.types) && pokemon.types.length > 0) {
    return pokemon.types;
  }
  return pokemon.type ? [pokemon.type] : [];
}

function getTypeEffectiveness(attackerType, defenderType) {
  if (!attackerType || !defenderType) return 1;
  return typeChart[attackerType]?.[defenderType] ?? 1;
}

function getWeatherMatch(types, weather) {
  return types.some((type) => (weatherBoosts[type] || []).includes(weather));
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function calculateSpawnWeight(pokemon, selectedArea, currentTime, weather) {
  let weight = rarityWeights[pokemon.rarity] || 0;
  const habitats = Array.isArray(pokemon.habitats)
    ? pokemon.habitats
    : pokemon.habitats
      ? [pokemon.habitats]
      : [];
  const times = Array.isArray(pokemon.times)
    ? pokemon.times
    : pokemon.times
      ? [pokemon.times]
      : [];
  const types = getPokemonTypes(pokemon);

  if (habitats.includes(selectedArea)) weight += 30;
  if (times.includes(currentTime)) weight += 15;
  if (getWeatherMatch(types, weather)) weight += 10;
  return Math.max(1, weight);
}

function weightedSelection(items) {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;
  for (let item of items) {
    random -= item.weight;
    if (random <= 0) return item.pokemon;
  }
  return items[0].pokemon;
}

function calculateDamage(
  { attack, defense, type, level, status },
  { defense: defStat, type: oppType },
  movePower = 50,
) {
  const moveType = type;
  const stab = type === moveType ? 1.5 : 1;
  const effectiveness = getTypeEffectiveness(moveType, oppType);
  const randomFactor = getRandomInt(85, 100) / 100;
  const critical = Math.random() < 0.0625 ? 1.5 : 1;
  const burnReduction = status === "burned" ? 0.5 : 1;

  const base = (((2 * level) / 5 + 2) * attack * movePower) / defStat;
  const damage = Math.floor(
    (base / 50 + 2) *
      stab *
      effectiveness *
      randomFactor *
      critical *
      burnReduction,
  );
  return {
    damage: Math.max(1, damage),
    effectiveness,
    critical: critical > 1,
    burnReduced: burnReduction < 1,
  };
}

function calculateCatchProbability(
  wildPokemon,
  pokeball = "standard",
  currentHP,
  status = "none",
) {
  const maxHP = wildPokemon.maxHp || wildPokemon.hp || 1;
  const baseCatchRate = wildPokemon.baseCatchRate || 1;
  const ballRate = ballRates[pokeball] || 1.0;
  const statusRate = statusModifiers[status] || 1.0;
  const captureRate =
    (1 + (3 * maxHP - 2 * currentHP) * baseCatchRate * ballRate * statusRate) /
    (3 * maxHP) /
    256;
  return Math.min(1.0, captureRate);
}

app.get("/api/areas", (req, res) => {
  res.json([
    "forest",
    "lake",
    "cave",
    "volcano",
    "mountain",
    "desert",
    "graveyard",
  ]);
});

app.get("/api/pokeballs", (req, res) => {
  res.json(Object.entries(ballRates).map(([type, rate]) => ({ type, rate })));
});

app.get("/api/pokemon", (req, res) => {
  fs.readFile(
    path.join(__dirname, "..", "pokemon.json"),
    "utf8",
    (err, data) => {
      if (err) {
        res.status(500).json({ error: "Failed to read Pokemon data" });
      } else {
        res.json(JSON.parse(data));
      }
    },
  );
});

app.post("/api/encounter", (req, res) => {
  const { area } = req.body;
  if (!area) {
    return res.status(400).json({ error: "Area is required" });
  }

  fs.readFile(
    path.join(__dirname, "..", "pokemon.json"),
    "utf8",
    (err, data) => {
      if (err) {
        return res.status(500).json({ error: "Failed to read Pokemon data" });
      }

      const allPokemon = JSON.parse(data);
      const currentTime = getTimeOfDay();
      const weather = getCurrentWeather();

      const weightedPokemon = allPokemon.map((pokemon) => ({
        pokemon,
        weight: calculateSpawnWeight(pokemon, area, currentTime, weather),
      }));

      const encountered = weightedSelection(weightedPokemon);
      const shiny = Math.random() < 1 / 4096;
      const encounterData = {
        ...encountered,
        currentHp: encountered.maxHp || encountered.hp,
        area,
        level: encountered.level || 1,
        weather,
        shiny,
      };
      res.json(encounterData);
    },
  );
});

app.post("/api/battle", (req, res) => {
  const {
    playerHP,
    wildHP,
    playerAttack,
    playerDefense,
    playerType,
    wildAttack,
    wildDefense,
    wildType,
    playerLevel = 1,
    wildLevel = 1,
    playerStatus = "none",
    wildStatus = "none",
  } = req.body;

  let log = [];
  const player = {
    attack: playerAttack,
    defense: playerDefense,
    type: playerType,
    hp: playerHP,
    level: playerLevel,
    status: playerStatus,
  };
  const wild = {
    attack: wildAttack,
    defense: wildDefense,
    type: wildType,
    hp: wildHP,
    level: wildLevel,
    status: wildStatus,
  };

  const playerResult = calculateDamage(player, wild, 50);
  let newWildHP = Math.max(0, wildHP - playerResult.damage);
  if (playerResult.critical) log.push("A critical hit!");
  if (playerResult.effectiveness > 1) log.push("It's super effective!");
  if (playerResult.effectiveness < 1 && playerResult.effectiveness > 0)
    log.push("It's not very effective...");
  if (playerResult.effectiveness === 0) log.push("It had no effect!");
  log.push(`Player dealt ${playerResult.damage} damage.`);

  let winner = null;
  if (newWildHP <= 0) {
    newWildHP = 0;
    winner = "player";
    log.push("Player wins!");
    return res.json({ playerHP, wildHP: newWildHP, winner, log });
  }

  const wildResult = calculateDamage(wild, player, 50);
  let newPlayerHP = Math.max(0, playerHP - wildResult.damage);
  if (wildResult.critical) log.push("Wild Pokémon landed a critical hit!");
  if (wildResult.effectiveness > 1)
    log.push("The wild Pokémon's attack is super effective!");
  if (wildResult.effectiveness < 1 && wildResult.effectiveness > 0)
    log.push("The wild Pokémon's attack is not very effective...");
  if (wildResult.effectiveness === 0)
    log.push("The wild Pokémon's attack had no effect!");
  log.push(`Wild dealt ${wildResult.damage} damage.`);

  if (newPlayerHP <= 0) {
    newPlayerHP = 0;
    winner = "wild";
    log.push("Wild wins!");
  }

  res.json({ playerHP: newPlayerHP, wildHP: newWildHP, winner, log });
});

app.post("/api/catch", (req, res) => {
  const {
    id,
    pokeball = "standard",
    wildHPPercent = 1.0,
    status = "none",
  } = req.body;

  fs.readFile(
    path.join(__dirname, "..", "pokemon.json"),
    "utf8",
    (err, data) => {
      if (err) {
        return res.status(500).json({ error: "Failed to read Pokemon data" });
      }

      const pokemon = JSON.parse(data);
      const target = pokemon.find((p) => p.id === id);
      if (!target) {
        return res.status(404).json({ error: "Pokemon not found" });
      }

      const currentHP = Math.max(
        1,
        Math.round((target.maxHp || target.hp) * wildHPPercent),
      );
      const catchProbability = calculateCatchProbability(
        target,
        pokeball,
        currentHP,
        status,
      );
      const success = catchProbability >= 1 || Math.random() < catchProbability;

      if (success) {
        fs.readFile(
          path.join(__dirname, "..", "inventory.json"),
          "utf8",
          (err2, invData) => {
            if (err2) {
              return res
                .status(500)
                .json({ error: "Failed to read inventory" });
            }

            const inventory = JSON.parse(invData);
            const caughtPokemon = {
              ...target,
              currentHp: currentHP,
              level: target.level || 1,
              xp: target.xp || 0,
              shiny: !!req.body.shiny,
            };
            inventory.push(caughtPokemon);

            fs.writeFile(
              path.join(__dirname, "..", "inventory.json"),
              JSON.stringify(inventory, null, 2),
              (err3) => {
                if (err3) {
                  return res
                    .status(500)
                    .json({ error: "Failed to save inventory" });
                }
                res.json({
                  success: true,
                  message: `Caught ${target.name}!`,
                  pokemon: caughtPokemon,
                  catchRate: Math.round(catchProbability * 100),
                });
              },
            );
          },
        );
      } else {
        res.json({
          success: false,
          message: "Pokemon escaped!",
          catchRate: Math.round(catchProbability * 100),
        });
      }
    },
  );
});

app.get("/api/inventory", (req, res) => {
  fs.readFile(
    path.join(__dirname, "..", "inventory.json"),
    "utf8",
    (err, data) => {
      if (err) {
        res.status(500).json({ error: "Failed to read inventory" });
      } else {
        let inventory = JSON.parse(data);
        const hasPikachu = inventory.some((p) => p.id === 25);
        if (!hasPikachu) {
          inventory.unshift({
            id: 25,
            name: "Pikachu",
            type: "Electric",
            rarity: "uncommon",
            hp: 35,
            maxHp: 35,
            attack: 55,
            defense: 40,
            xpYield: 112,
            habitats: ["forest"],
            times: ["day"],
            baseCatchRate: 190,
            level: 1,
            xp: 0,
            currentHp: 35,
            types: ["Electric"],
            shiny: false,
          });
          fs.writeFile(
            path.join(__dirname, "..", "inventory.json"),
            JSON.stringify(inventory, null, 2),
            (err2) => {
              if (err2) {
                console.error("Failed to add starter Pikachu to inventory");
              }
            },
          );
        }
        res.json(inventory);
      }
    },
  );
});

const evolutionTriggers = {
  Bulbasaur: { level: 16, name: "Ivysaur" },
  Charmander: { level: 16, name: "Charmeleon" },
  Squirtle: { level: 16, name: "Wartortle" },
  Pidgey: { level: 16, name: "Pidgeotto" },
  Eevee: { level: 16, name: "Vaporeon" },
};

app.post("/api/xp", (req, res) => {
  const { pokemonIndex, xpAmount } = req.body;

  fs.readFile(
    path.join(__dirname, "..", "inventory.json"),
    "utf8",
    (err, invData) => {
      if (err) {
        return res.status(500).json({ error: "Failed to read inventory" });
      }

      const inventory = JSON.parse(invData);
      if (pokemonIndex < 0 || pokemonIndex >= inventory.length) {
        return res.status(400).json({ error: "Invalid Pokemon index" });
      }

      const pokemon = inventory[pokemonIndex];
      pokemon.xp = (pokemon.xp || 0) + xpAmount;
      let leveledUp = false;
      let evolved = false;

      while (pokemon.xp >= (pokemon.level || 1) * 100) {
        const xpNeeded = (pokemon.level || 1) * 100;
        pokemon.xp -= xpNeeded;
        pokemon.level = (pokemon.level || 1) + 1;
        pokemon.maxHp = Math.floor((pokemon.maxHp || pokemon.hp) * 1.1);
        pokemon.attack = Math.floor((pokemon.attack || 1) * 1.1);
        pokemon.defense = Math.floor((pokemon.defense || 1) * 1.1);
        leveledUp = true;
      }
      const evolution = evolutionTriggers[pokemon.name];
      if (evolution && pokemon.level >= evolution.level) {
        pokemon.name = evolution.name;
        pokemon.attack = Math.floor(pokemon.attack * 1.05);
        pokemon.defense = Math.floor(pokemon.defense * 1.05);
        pokemon.maxHp = Math.floor(pokemon.maxHp * 1.05);
        evolved = true;
      }

      fs.writeFile(
        path.join(__dirname, "..", "inventory.json"),
        JSON.stringify(inventory, null, 2),
        (err3) => {
          if (err3) {
            return res.status(500).json({ error: "Failed to save inventory" });
          }
          res.json({
            success: true,
            pokemon: inventory[pokemonIndex],
            leveledUp,
            evolved,
          });
        },
      );
    },
  );
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
