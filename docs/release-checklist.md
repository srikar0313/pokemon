# Release Checklist

Use this checklist before deploying Pokemon Adventure. Deployment itself is
outside this release-polish phase.

## Local Verification

1. Install the exact locked dependencies with `npm ci`.
2. Keep `PERSISTENCE_MODE=json` for a no-database development run.
3. Run `npm test` and confirm every offline suite passes.
4. Run `npm start` and manually verify registration or local startup, Explore,
   battle, capture, Party/PC, evolution, Gyms, League, story, and post-game.
5. Test at 360px, 390px, 768px, and desktop widths with keyboard navigation and
   Reduced Motion enabled once.

## PostgreSQL Verification

Docker is optional. For the included local service:

```bash
docker compose up -d
npm run db:migrate
npm run db:import-legacy
npm run persistence:test
```

Keep the three JSON save files as a backup until the imported account has been
verified. Use `npm run db:claim-legacy -- --email trainer@example.com` only for
the account that should own the imported save. The import and claim commands
are idempotent and must not be used as substitutes for a database backup.

## Required Environment

- `PERSISTENCE_MODE`: `json` or `postgres`.
- `DATABASE_URL`: required for PostgreSQL mode; never commit its credentials.
- `SESSION_DAYS`: positive session lifetime in days; defaults to 30.
- `TRUST_PROXY`: set to `1` only behind one trusted reverse proxy so secure
  cookies and client IP rate limiting receive the correct protocol/address.
- `NODE_ENV`: set to `production` in production to enable secure cookies.

`PLAYER_ID` is used by JSON/local tooling and legacy import workflows. Runtime
Pokemon, move, evolution, area, encounter, Gym, and story reference data remain
local JSON and must ship with the application.

## Production Checks

- Terminate HTTPS at the application or trusted load balancer.
- Set `NODE_ENV=production`, `PERSISTENCE_MODE=postgres`, and a managed secret
  for `DATABASE_URL`.
- Set `TRUST_PROXY=1` only when the deployment has exactly one trusted proxy.
- Apply committed Prisma migrations before routing traffic to the new release.
- Confirm the health/startup logs show PostgreSQL mode and no fallback warning.
- Register two temporary accounts and verify Party, storage, inventory, story,
  League, and post-game state remain isolated after logout/login and restart.
- Confirm invalid login, duplicate registration, expired session, and database
  outage responses are player-friendly and expose no stack traces.
- Verify player-local day/night behavior from at least two timezone offsets.
- Confirm static assets, Three.js fallback, audio mute, and Reduced Motion work.
- Run the full progression smoke path on the production candidate, including a
  loss/retry path for Gym, League, and the legendary story encounter.

## Backups And Rollback

- Take a `pg_dump` before migrations and retain it according to the hosting
  provider's backup policy.
- Back up static game JSON and any legacy JSON saves kept for recovery.
- Record the deployed Git SHA and Prisma migration set.
- Roll back application code only to a version compatible with the applied
  schema. Restore the database backup if a migration cannot be rolled back
  safely.

## Known Limitations

- JSON mode is a single-player development fallback, not concurrent hosting.
- PostgreSQL integration tests skip their real-database section when
  `DATABASE_URL` is unavailable.
- Day/night uses validated browser timestamp and timezone headers with a
  server-local fallback for non-browser clients.
- PokéAPI is a development-time data source only; runtime operation is offline.
- Complex canonical abilities and evolution requirements explicitly marked
  display-only or unsupported remain intentionally unavailable.
- WebGL, audio, and motion effects degrade gracefully; they are presentation
  layers and never decide gameplay outcomes.

## Release Sign-Off

```bash
npm test
npm run validate
npm run smoke
npm run presentation:test
npm run persistence:test
```

Do not begin AWS rollout until these commands pass, a real PostgreSQL test has
run against the release schema, backups are confirmed, and the manual checks
above are signed off.
