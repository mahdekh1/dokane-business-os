#!/usr/bin/env bash
# One-command deploy / redeploy on the VPS. Run from the repo root.
#   ./deploy.sh            → pull, build, migrate (on API start), restart, clean
#   ./deploy.sh --no-pull  → skip git pull (deploy current checkout)
#   ./deploy.sh --no-clean → skip reclaiming dangling images + build cache
# Flags may be combined in any order.
set -euo pipefail
cd "$(dirname "$0")"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

PULL=1
CLEAN=1
for arg in "$@"; do
  case "$arg" in
    --no-pull)  PULL=0 ;;
    --no-clean) CLEAN=0 ;;
    *) echo "ERROR: unknown flag '$arg' (use --no-pull, --no-clean)" >&2; exit 1 ;;
  esac
done

if [ ! -f .env.production ]; then
  echo "ERROR: .env.production not found. Copy .env.production.example to .env.production and fill it in." >&2
  exit 1
fi

if [ "$PULL" = 1 ]; then
  echo "==> Pulling latest code"
  git pull --ff-only
fi

echo "==> Building images"
$COMPOSE build

echo "==> Starting stack (API runs 'prisma migrate deploy' on start)"
$COMPOSE up -d

# Reclaim disk AFTER the new stack is up, so nothing in use is removed. Each
# rebuild leaves the previous image dangling (<none>) and grows the build
# cache; these two prunes never touch tagged images in use or named volumes
# (your Postgres data lives in a volume and is safe).
if [ "$CLEAN" = 1 ]; then
  echo "==> Reclaiming disk (dangling images + build cache)"
  docker image prune -f
  docker builder prune -f
  echo "==> Disk usage"
  docker system df
fi

echo "==> Status"
$COMPOSE ps
echo
echo "Done. Open the app at the address in SITE_ADDRESS (http://<server-ip>/ by default)."
echo "Logs:   $COMPOSE logs -f api web caddy"
echo "Health: $COMPOSE exec api node -e \"fetch('http://localhost:3001/health').then(r=>r.text()).then(console.log)\""
