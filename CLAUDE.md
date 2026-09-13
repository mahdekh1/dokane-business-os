# Dokane Business OS — working guide for Claude

A modular, multi-tenant business platform. **Read the specs before building:**
[docs/README.md](./docs/README.md) is the index; the authorities are
[docs/PRD.md](./docs/PRD.md) (product), [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md),
[docs/MODULES.md](./docs/MODULES.md), [docs/SECURITY.md](./docs/SECURITY.md), and the
build plan [docs/IMPLEMENTATION_PLAN.md](./docs/IMPLEMENTATION_PLAN.md) (checkboxes
track progress).

## Environment

- **Node ≥ 18.17 — use Node 20.** Homebrew `node@20` is on PATH via `~/.zshrc`.
  If a shell shows v18, prepend `export PATH="/usr/local/opt/node@20/bin:$PATH"`.
- **pnpm 10** (workspaces + Turborepo). Install with `pnpm install`.
- **Docker** runs Postgres 16 + Redis 7: `docker compose up -d`. Create the test
  DB once: `docker compose exec -T postgres psql -U dokane -d dokane -c "CREATE DATABASE dokane_test;"`
- Copy env: `cp .env.example .env`; the API also reads `apps/api/.env` (gitignored;
  holds `DATABASE_URL`, `DATABASE_URL_TEST`, `AUTH_SECRET`).

## Layout

- `apps/api` — NestJS modular monolith (REST under `/api/v1`; `/health` unprefixed).
- `apps/web` — Next.js App Router (console, admin, public mini-sites).
- `apps/worker` — BullMQ consumers (outbox relay moves here later).
- `packages/contracts` — Zod schemas shared FE↔BE. `packages/module-sdk` — the
  `ModuleManifest` type. `packages/ui`, `packages/config`.

## Commands

```bash
pnpm build        # turbo build (all)
pnpm typecheck    # all
pnpm test         # all (api tests hit the TEST db)
pnpm --filter @dokane/api test          # api only
pnpm --filter @dokane/api migrate:dev   # prisma migrate dev
```

- After a **Prisma schema change**: `pnpm --filter @dokane/api migrate:dev --name <x>`,
  then apply to the test DB:
  `cd apps/api && DATABASE_URL="$DATABASE_URL_TEST" pnpm exec prisma migrate deploy`.
- After editing **`packages/contracts`** or **`packages/module-sdk`**: rebuild them
  (`pnpm --filter @dokane/contracts build`) or run `pnpm build`.

## Non-obvious rules (don't relearn the hard way)

- **NestJS needs the Nest compiler**, not tsx/esbuild — esbuild drops decorator
  metadata and DI silently breaks. `api` dev/build/start use `nest start`/`nest build`.
- **Tests run against `dokane_test`** (see `apps/api/test/setup-env.ts`), never the
  app DB. Each spec cleans up its own rows (unique `*_${Date.now()}` tags).
- **Jest maps `@dokane/contracts` and `@dokane/module-sdk` to their `src`** — no
  need to build them before running tests; tsc/turbo builds still need them built.
- **Tenant safety:** every tenant row has `business_id`; tenant context comes from
  the caller's membership resolved by `TenantGuard` from the `X-Business-Id` header
  (validated against the user's own memberships). Never trust a client tenant id.
- **Two access layers:** entitlement (plan → module, `EntitlementService`/registry)
  is separate from permission (role → action, RBAC). Guards run
  throttle → auth → tenant → entitlement.
- **Money = integer minor units** + currency; never floats. **Timestamps UTC.**
- **Every stock change writes a movement; POS/order/payment writes are transactional;**
  slow/external work goes through the **outbox + queue**, never inside a request tx.
- **Region-agnostic:** no locale/country hard-coding; i18n/RTL are capabilities.

## Delivery workflow

- Two tools: **Claude Code** (architecture, backend, security, framework, tests)
  and **Lovable** (frontend scaffolding), **contracts-first** — Claude ships the
  Zod contract + API + migration, then Lovable builds UI against it. Lovable never
  edits `packages/contracts`, `apps/api`, Prisma schema/migrations, or auth/rbac/
  tenancy. See [docs/DELIVERY.md](./docs/DELIVERY.md).
- **Commit directly to `main`** for now (single builder). End commit messages with
  the `Co-Authored-By: Claude` trailer. Push over SSH (`git@github.com:...`).
- **Verify behavior, not just types** — run the real tests/HTTP against the live DB
  and report honestly what was and wasn't verified. Mark completed tasks in
  `docs/IMPLEMENTATION_PLAN.md`.

## Status (2026-09-13)

Phase 0 ✅ (scaffold + CI). Phase 1 backend **complete**: 1.1 schema ✅ · 1.2 auth
✅ · 1.3 tenant guards ✅ · 1.4 RBAC ✅ · 1.5 module registry + entitlements ✅ ·
1.6 event bus + outbox ✅ · 1.7 audit ✅ · 1.9 seed + isolation gate ✅. **Only
1.8 (app shells + auth UI) remains — Lovable's task** (see IMPLEMENTATION_PLAN.md
Task 1.8). Dev logins after `pnpm --filter @dokane/api seed`: owner.a@dokane.test
/ owner.b@dokane.test / staff.a@dokane.test (all `password123`). Next after 1.8:
Phase 2.
