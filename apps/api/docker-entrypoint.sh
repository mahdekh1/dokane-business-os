#!/bin/sh
set -e

# Apply any pending database migrations, then start the API.
# `migrate deploy` only runs committed migrations — never generates new ones.
echo "[entrypoint] running prisma migrate deploy…"
pnpm exec prisma migrate deploy

echo "[entrypoint] starting API…"
exec node dist/main.js
