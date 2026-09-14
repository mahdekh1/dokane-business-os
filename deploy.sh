#!/usr/bin/env bash
# One-command deploy / redeploy on the VPS. Run from the repo root.
#   ./deploy.sh          → pull, build, migrate (on API start), restart
#   ./deploy.sh --no-pull → skip git pull (deploy current checkout)
set -euo pipefail
cd "$(dirname "$0")"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

if [ ! -f .env.production ]; then
  echo "ERROR: .env.production not found. Copy .env.production.example to .env.production and fill it in." >&2
  exit 1
fi

if [ "${1:-}" != "--no-pull" ]; then
  echo "==> Pulling latest code"
  git pull --ff-only
fi

echo "==> Building images"
$COMPOSE build

echo "==> Starting stack (API runs 'prisma migrate deploy' on start)"
$COMPOSE up -d

echo "==> Status"
$COMPOSE ps
echo
echo "Done. Open the app at the address in SITE_ADDRESS (http://<server-ip>/ by default)."
echo "Logs:   $COMPOSE logs -f api web caddy"
echo "Health: $COMPOSE exec api node -e \"fetch('http://localhost:3001/health').then(r=>r.text()).then(console.log)\""
