# Database Persistence

The game supports JSON single-player development and authenticated PostgreSQL
persistence. Gameplay
engines continue to use ordinary JavaScript objects; they do not know whether
the state came from JSON or PostgreSQL.

## What PostgreSQL Stores

PostgreSQL stores mutable runtime state:

- user accounts and expiring server-side sessions
- trainer profile, coins, player level, XP, and completion state
- owned Pokemon, stable `ownedId`, canonical `speciesId`, legacy local ID,
  party/PC location and order, moves and PP, form, shiny, ability, and status
- item quantities and badges
- story flags, completed/rewarded events, milestones, and locations
- recurring-character progress, including Rhea's wins/losses and scenes
- League completion and the immutable Hall of Fame snapshot
- saved party presets

Important searchable values use relational columns. Flexible game-owned data,
such as complete Pokemon state, move lists, Pokédex identity collections, form
metadata, and Hall of Fame snapshots, uses PostgreSQL JSON where preserving the
existing object shape is safer.

Static reference content remains in local JSON. This includes the Pokemon and
move catalogues, evolution data, items catalogue, areas, encounters, Gyms,
Elite Four, story definitions, and recurring-character definitions.

## Persistence Modes

`PERSISTENCE_MODE=json` is the default and preserves the existing save files:

- `player_state.json`
- `inventory.json`
- `storage.json`

Set `PERSISTENCE_MODE=postgres` and `DATABASE_URL` to use PostgreSQL. This mode
requires an authenticated account for every gameplay API. If
PostgreSQL mode is requested without `DATABASE_URL`, the server prints a clear
warning and falls back to JSON. New accounts receive normal game defaults; the
server never silently claims the JSON save for an account.

In PostgreSQL mode, the server hydrates the authenticated player's aggregate
for each request context. Each API request continues to use the existing synchronous game-state contract.
Before its JSON response is sent, all state touched by that request is flushed
in one Prisma transaction. Capture, Party/PC moves, item use, Gym rewards,
story rewards, and Champion completion therefore commit their related changes
atomically without Prisma calls being scattered through battle routes.

## Local Setup

Copy `.env.example` to `.env` and choose PostgreSQL mode:

```dotenv
DATABASE_URL="postgresql://pokemon:pokemon@localhost:5432/pokemon?schema=public"
PERSISTENCE_MODE="postgres"
PLAYER_ID="local-player"
SESSION_DAYS="30"
```

Start the included PostgreSQL service, apply migrations, import the existing
JSON save once, and run the game:

```bash
docker compose up -d
npm run db:migrate
npm run db:import-legacy
npm start
```

Docker is optional. The same commands work with any PostgreSQL instance whose
connection string is supplied through `DATABASE_URL`.

## Prisma Workflow

```bash
npm run db:generate
npm run db:migrate
npm run persistence:test
```

`db:migrate` uses committed migrations and is suitable for local or hosted
environments. Schema changes should be represented by a new migration; do not
edit an already-applied migration.

The normal offline `npm test` run includes persistence coordinator tests. When
`DATABASE_URL` is available, `npm run persistence:test` also creates an
isolated temporary player, verifies real transaction/save/reload behavior, and
removes that player afterward.

## Legacy Import

```bash
npm run db:import-legacy
```

The importer reads the three current JSON save files and preserves owned IDs,
local/canonical ID distinctions, party order, storage order, moves and PP,
shiny/forms, inventory, badges, story/Rhea progress, party presets, and the
League/Hall of Fame state. The import marker and player write happen in the
same transaction. Running the command again reports `already imported` and
does not duplicate Pokemon or rewards.

Importing creates an unattached development save. It is never assigned to the
first registered account automatically. After creating the intended account,
claim it explicitly:

```bash
npm run db:claim-legacy -- --email trainer@example.com
```

The claim transaction removes that account's unused fresh save and attaches
the imported `local-player` record, including all related Pokemon, inventory,
story, rival, League, Hall of Fame, and preset rows. A claim marker prevents a
second account from claiming the same save.

Keep the JSON files as a backup until the imported PostgreSQL player has been
verified in the UI. To intentionally re-import, restore to a fresh database or
remove the specific import marker and player only after taking a backup.

## Backups

Use normal PostgreSQL backup tooling such as `pg_dump` before schema upgrades
or destructive maintenance. Back up both the database and the static JSON data
for a complete project snapshot. Credentials belong only in `.env` or the
deployment environment and must never be committed.
