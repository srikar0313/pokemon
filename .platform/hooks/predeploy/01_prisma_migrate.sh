#!/usr/bin/env bash
set -euo pipefail

if [[ "${NODE_ENV:-}" != "production" ]]; then
  echo "[deploy] Refusing production migration without NODE_ENV=production."
  exit 1
fi

if [[ "${PERSISTENCE_MODE:-}" != "postgres" || -z "${DATABASE_URL:-}" ]]; then
  echo "[deploy] PERSISTENCE_MODE=postgres and DATABASE_URL are required."
  exit 1
fi

echo "[deploy] Applying committed Prisma migrations."
npm run db:migrate
