# Deployment

Version: 1.0 · Date: 2026-09-15

How Dokane is deployed to a **Hostinger KVM VPS** with Docker Compose, while local
development stays exactly as it is. The same process redeploys each finished phase.

## Topology

One VPS runs five containers (defined in [`docker-compose.prod.yml`](../docker-compose.prod.yml)):

```
Internet ──▶ Caddy (:80 / :443)
                ├─ /api/*  ─▶ api  (NestJS  :3001)
                └─ /*      ─▶ web  (Next.js :3000)
             api ─▶ postgres (:5432, internal)   api ─▶ redis (:6379, internal)
```

- **Same-origin by design.** The browser calls `/api/v1/...` on the same host, so
  there is **no CORS** and the server IP is never baked into the web build
  (`NEXT_PUBLIC_API_URL=/api/v1`). Caddy routes `/api/*` to the API, everything else
  to the web app.
- **HTTPS is one line.** With no domain, Caddy serves plain HTTP on `:80`. Set
  `SITE_ADDRESS` to a domain and Caddy auto-provisions a Let's Encrypt certificate.
- Postgres and Redis are **not** published to the internet (no host ports) — only the
  API reaches them on the internal Docker network. Data lives in named volumes.
- The API container runs `prisma migrate deploy` on start, so every deploy applies
  pending migrations automatically (see [`apps/api/docker-entrypoint.sh`](../apps/api/docker-entrypoint.sh)).

## Local development is unchanged

Nothing here touches your local flow. Local dev still uses the separate
[`docker-compose.yml`](../docker-compose.yml) (Postgres + Redis only) with
`pnpm dev`. The production files (`docker-compose.prod.yml`, the Dockerfiles,
`.env.production`) are only used on the server.

---

## One-time VPS setup

1. **Create the VPS** in hPanel → VPS: a **KVM** plan, template **Ubuntu 24.04**.
   Note its public **IP**. SSH in: `ssh root@YOUR_SERVER_IP`.

2. **Install Docker** (includes the Compose plugin) and git:
   ```bash
   curl -fsSL https://get.docker.com | sh
   apt-get update && apt-get install -y git
   ```

3. **Firewall** — allow SSH + web, nothing else public:
   ```bash
   ufw allow 22 && ufw allow 80 && ufw allow 443 && ufw --force enable
   ```
   (Postgres/Redis stay internal — do not open 5432/6379.)

4. **Clone the repo** (use a deploy key or a PAT for a private repo):
   ```bash
   git clone git@github.com:<owner>/dokane-business-os.git
   cd dokane-business-os
   ```

5. **Configure secrets** — copy the template and fill it in:
   ```bash
   cp .env.production.example .env.production
   # generate a real AUTH_SECRET:
   openssl rand -base64 48
   nano .env.production
   ```
   Set at minimum: `POSTGRES_PASSWORD` (strong), `AUTH_SECRET` (the value above),
   `WEB_ORIGIN=http://YOUR_SERVER_IP`, and keep `SITE_ADDRESS=:80` for the first run.

---

## Deploy

From the repo root on the VPS:

```bash
./deploy.sh
```

This pulls the latest code, builds the images, runs migrations (on API start), and
brings the stack up. Open **http://YOUR_SERVER_IP/** — the login page should load and
the API answers under `/api/v1`.

### First run — seed demo data (optional, for testing only)

There is no self-service platform-admin creation yet, so to log in during the pilot,
seed the demo accounts (⚠️ **demo data — not for a real production tenant**):

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec api node dist/seed.js
```

Logins (all `password123`): `admin@dokane.test` (platform), `owner.a@dokane.test`
(Growth), `owner.b@dokane.test` (Starter), `owner.c@dokane.test` (pending).
When we build real onboarding-to-first-admin, this step goes away.

### Verify / operate

```bash
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"
$COMPOSE ps                       # container status
$COMPOSE logs -f api web caddy    # tail logs
# API health (the slim image has no curl/wget, so use Node's fetch):
$COMPOSE exec api node -e "fetch('http://localhost:3001/health').then(r=>r.text()).then(console.log)"
# Public routing from the host (Caddy → web, and → API):
curl -sS http://localhost/            | head -c 120   # web login page HTML
curl -sS http://localhost/api/v1/me                  # API (401 without a token = reachable)
```

---

## Redeploy a finished phase

Every closed phase ships the same way:

```bash
cd dokane-business-os
./deploy.sh          # git pull → build → migrate → up -d
```

Only changed images rebuild; new migrations apply automatically on API start.
Roll back by checking out the previous tag/commit and running `./deploy.sh --no-pull`
(note: a rolled-back deploy does **not** revert already-applied migrations —
data migrations need a considered down-path, out of scope for the MVP).

## Add a domain + HTTPS (when ready)

1. Point a DNS **A record** for your domain at the VPS IP (and a `www` if you want).
2. Edit `.env.production`:
   ```
   SITE_ADDRESS=dokane.example.com
   WEB_ORIGIN=https://dokane.example.com
   ```
3. `./deploy.sh --no-pull`. Caddy obtains and renews the certificate automatically;
   the site is now on **https://dokane.example.com**. (`NEXT_PUBLIC_API_URL` stays
   `/api/v1` — still same-origin, now over HTTPS.)

## Backups

The database is the thing to back up (named volume `dokane_pg`). A simple daily dump:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production \
  exec -T postgres pg_dump -U dokane dokane | gzip > "dokane-$(date +%F).sql.gz"
```

Copy the dumps off the box (and automate via cron) before relying on this in production.
Restore into a fresh DB with `gunzip -c dump.sql.gz | ... psql -U dokane dokane`.

## Security checklist

- Real `POSTGRES_PASSWORD` and `AUTH_SECRET`; `.env.production` is git-ignored — never commit it.
- 5432/6379 are never published; only 22/80/443 are open.
- Use SSH keys (disable password login) and keep the box patched (`apt upgrade`).
- Rotate `AUTH_SECRET` only with a plan (it invalidates existing sessions).

## Known limitations (pilot)

- Images are built on the VPS and are not size-optimized yet (full workspace copy).
  A slimming pass (pnpm deploy / Next standalone) and a CI-build-and-push pipeline are
  a follow-up once the flow is proven.
- Single box: API, web, DB and Redis share one VPS. Splitting the DB onto managed
  Postgres and adding a second app node is a later scaling step.
- No zero-downtime rollout yet; `up -d` briefly restarts changed containers.
