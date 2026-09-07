# Pokémon Browser RPG

A full-stack Pokémon-style RPG built with Node.js, Express, and plain HTML/CSS/JavaScript. Explore seven themed areas, catch and train a persistent party, battle trainers and Gym Leaders, complete quests, challenge the Elite Four, and track the full collection in the Pokédex.

## Gameplay

- Seven areas: Forest, Cave, Volcano, Lake, Mountain, Desert, and Graveyard
- Weighted biome, rarity, weather, and time-of-day encounters
- Wild, NPC, Gym, Elite Four, and Champion battles
- Six-Pokémon party with PC storage and persistent HP, PP, friendship, forms, and abilities
- Canonical branching evolutions with level, item, friendship, time, move, gender, stat, and single-player trade equivalents
- Shops, healing items, evolution items, coins, quests, badges, and progression
- Species-aware Pokédex with forms, evolution families, availability filters, and pagination

## Pokémon Architecture

The runtime catalog contains **491 species**: National Pokédex #1-400, the project's existing later-generation species, and every family member needed to close their evolution graphs. Stable local IDs preserve existing saves while `speciesId` provides canonical National Pokédex identity.

Static game configuration lives in `pokemon.json` and `data/*.json`. Generated canonical metadata lives under `data/pokeapi/`:

- `canonical-pokemon.json`: stats, types, artwork, forms, abilities, and level-up learnsets
- `canonical-moves.json`: normalized move metadata
- `evolutions.json`: branching canonical evolution graph
- `species-map.json`: stable local ID to canonical species ID mapping
- `obtainability.json`: deterministic wild/evolution/special availability

PokéAPI is used only by development scripts. **The running game never calls PokéAPI.**

## Setup

```bash
npm ci
npm start
```

Open `http://localhost:3000`.

## Validation

```bash
npm test
npm run validate
npm run smoke
npm run obtainability:audit
npm run pokeapi:audit
```

`npm test` is deterministic and offline. CI runs `npm ci` followed by `npm test` without rebuilding from live PokéAPI data.

## Development Data Pipeline

Cached PokéAPI data can be rebuilt during development:

```bash
npm run pokeapi:build
```

Import additional species by National Pokédex ID or name:

```bash
npm run pokemon:add -- --species 401,402
npm run pokemon:add -- --species kricketot,kricketune
```

The importer preserves existing local IDs, adds required evolution-family members, regenerates canonical data, and leaves newly requested species catalog-only with no spawn until they receive an intentional world assignment. Use `--dry-run` to resolve and inspect a request without changing files.
