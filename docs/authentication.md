# Authentication

Authentication is enabled automatically when the game runs with
`PERSISTENCE_MODE=postgres`. JSON mode remains the existing unauthenticated,
single-player local workflow.

## Data Relationship

Each registered `User` has one `Player` save. User and Player identifiers are
generated UUIDs; email is never used as a save key. A Player owns all Pokemon,
inventory, badges, story progress, recurring-character progress, League state,
Hall of Fame data, and party presets through player-scoped database relations.

The imported `local-player` record remains unattached until an administrator
explicitly claims it. Public registration never selects or copies that save.

## Passwords

Passwords are hashed with `bcryptjs` using 12 rounds. The server normalizes
email addresses to lowercase, validates email shape, and requires passwords
between 8 and 128 characters. Plaintext passwords are never stored, returned,
or logged. Login failures use the same response for an unknown email and an
incorrect password.

## Server-Side Sessions

Registration and login create a cryptographically random 256-bit opaque token.
Only its SHA-256 hash is stored in `AuthSession`; the raw token exists only in
the browser cookie. Sessions expire and expired rows are rejected and cleaned
up when encountered. Logout deletes the matching database session and clears
the cookie.

The `pokemon_session` cookie uses `HttpOnly`, `SameSite=Lax`, and `Path=/`.
It uses `Secure` in production and carries the same expiry as the database
session. The token is never exposed to frontend JavaScript.

## Request-Scoped Saves

Authentication middleware resolves the cookie to `req.auth.userId` and
`req.auth.playerId`. Clients cannot submit a Player ID. All PostgreSQL gameplay
APIs require this context.

Persistence uses `AsyncLocalStorage` to keep the existing synchronous engine
interface while selecting the authenticated player's cache. Active NPC, Gym,
and Elite battle sessions use the same server-derived player identity. Before
an API response is sent, all save changes from that request are written in one
Prisma transaction. One player's cache, battles, and transaction queue cannot
be addressed by another player's request.

## API

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Registration atomically creates the User, default Player save, starter Pokemon,
inventory/story defaults, and AuthSession. Duplicate emails return a conflict.
Login/register endpoints have a small in-memory per-IP rate limit, and request
bodies are limited to 64 KB.

The frontend shows a login/register gate only when PostgreSQL requires
authentication. Expired gameplay requests return `401` and return the browser
to that gate. JSON mode displays a local-save indicator and bypasses accounts.

If registration reports that the database is not ready, verify `DATABASE_URL`
and apply the committed schema before restarting the server:

```bash
npm run db:migrate
```

## Legacy Save Claiming

First import the JSON files, register the target account, then explicitly claim
the imported save:

```bash
npm run db:import-legacy
npm run db:claim-legacy -- --email trainer@example.com
```

The target account must exist. The command attaches the imported
`local-player` and removes only the target account's unused fresh save. The
operation and one-time claim marker share a transaction, preventing partial or
duplicate claims.

## Environment

```dotenv
DATABASE_URL="postgresql://pokemon:pokemon@localhost:5432/pokemon?schema=public"
PERSISTENCE_MODE="postgres"
SESSION_DAYS="30"
NODE_ENV="development"
```

`PLAYER_ID` is used only by JSON/legacy tooling and is not accepted from web
requests.

## Production Considerations

- Use TLS for PostgreSQL and HTTPS so cookies are Secure.
- Use a restricted database role and rotate database credentials.
- Keep `.env`, passwords, cookies, and tokens out of source control and logs.
- Run committed migrations before starting application instances.
- Use a shared rate-limit store if the service later runs on multiple nodes.
- Schedule removal of expired sessions and regular PostgreSQL backups.
- Add stricter CSRF/origin controls if cross-site deployment needs change.
