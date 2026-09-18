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

- **Claude Code builds the whole stack** — backend and frontend. Keep it
  contracts-first: define the Zod contract in `packages/contracts` (+ API +
  migration) before the UI that consumes it.
- **UI pages** are built directly in `apps/web`. Invoke the design skills —
  `frontend-design` (approach/quality) + `ui-ux-pro-max:ui-styling` (Tailwind/
  components), and `artifact-design` for any published mock — and follow the
  established design system in `docs/DESIGN.md` (Modern lane, brand-kit tokens in
  `apps/web/app/globals.css`). For new UI, mock → get approval → build. See
  [docs/DELIVERY.md](./docs/DELIVERY.md).
- **Commit directly to `main`** for now (single builder). End commit messages with
  the `Co-Authored-By: Claude` trailer. Push over SSH (`git@github.com:...`).
- **Verify behavior, not just types** — run the real tests/HTTP against the live DB
  and report honestly what was and wasn't verified. Mark completed tasks in
  `docs/IMPLEMENTATION_PLAN.md`.

## Status (2026-09-14)

Phase 0 ✅ · **Phase 1 ✅** (schema, auth, tenant guards, RBAC, module registry/
entitlements, event bus/outbox, audit, seed + isolation, `apps/web` shell) ·
**Phase 2 ✅** (onboarding + approval lifecycle, Modules page, branding) ·
**Phase 2.5 ✅** (IA + onboarding alignment): onboarding collects business email +
required category (taxonomy + "Other"); category drives Modules-page suggestions;
console shell is grouped **accordion nav** with the **Storefront** (mini_site +
online_store) and **Sales Channels** IA (each module a group with its own
Settings, gated by active modules); every user has an **Account/profile** surface
(avatar menu → `/account`; `PATCH /me`, `POST /me/password`). Nav model in
`apps/web/src/lib/module-nav.ts`; not-yet-built module sub-routes render a
placeholder via `app/(app)/[...slug]`. Design system in `docs/DESIGN.md` (Modern
lane). Dev logins after `pnpm --filter @dokane/api seed`: admin@dokane.test
(platform), owner.a@dokane.test (Growth), owner.b@dokane.test (Starter),
owner.c@dokane.test (pending), staff.a@dokane.test (all `password123`).
**Phase 3 ⏳ (backend done)**: **Catalog** = physical + digital **goods** (offerings,
variants on a canonical `variantKey`, categories); **Services** + **Courses** are
their own scaffolded modules (own domains later). **Inventory** (locations, one
`adjustStock` path writes a movement per change, oversell-proof). **Media** storage
driver (local disk now, S3-ready) + upload + public serve. Core **Customers**
registry (`getOrCreateByContact`). All tenant-scoped + A/B-tested (API suite 83/13).
**Catalog UI ✅** (3.2 + 3.5): offerings list (search/filter/paginate/empty
state), create/edit form (physical|digital, money-in-minor-units input, inline
category create, variant-matrix editor keyed by the contracts `variantKey`
helper so price/SKU survive attribute edits), image upload wired to the media
endpoint; a `mediaUrl()` helper resolves public media paths against the API
origin in dev and keeps them relative in prod. **Categories page**
(`/catalog/categories`): list w/ product counts, add, rename, show/hide
(slug stays stable on rename). **Inventory UI ✅**: stock by location,
movements ledger (labels + location), low-stock view, adjust modal (posts an
ADJUSTMENT through the single oversell-guarded `adjustStock` path), read-only
locations in settings. Demo catalogs seeded for ABC Store (retail, stocked)
and Fashion Store (Starter, catalog only). Verified live as owner.a/owner.b.
**Phase 4 ✅**: **Channels** (core, auto-provisioned;
ONLINE_STORE needs a fulfillment location). **Orders** — one model, two axes
(fulfillment caller-driven + payment derived), server-computed totals + item
snapshots, channel-aware transitions, Idempotency-Key. **Payments** — many per
order, derived status, `payment.received` via outbox. **Stock on fulfillment** —
one `applyDeltaTx` path writes SALE on the first stock-consuming transition
(exactly-once), RETURN on cancel, oversell-proof. **Accounting** — cash-basis
ledger; core subscriber writes idempotent INCOME on payment; summary =
sales/income/expenses/receivables/net, global or per-channel. **Invoices** —
scaffolded, dormant (NOT_ENABLED). Money plumbing is core (any plan can sell);
Channels/Accounting *modules* only gate their management surfaces. API suite
106/106. **Orders/Money UI ✅ (4.7)**: orders list + manual builder (server
totals) + detail (two-axis, transitions, partial-payment dialog); accounting
(3 reconciled tiles + income/expense + receivables + record-expense); dashboard
money tiles (global/per-channel). New core **Orders** nav group. **Next**:
Phase 5 (CRM & Project Management).
Run: `docker compose up -d`, then api `pnpm --filter @dokane/api start` (:3001) +
web `pnpm --filter @dokane/web dev` (:3000); the API needs `WEB_ORIGIN` for CORS.
