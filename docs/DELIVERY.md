# Delivery

Version: 2.0 · Date: 2026-09-13

How the work is stacked, split between agents, staffed, and shipped.

---

## 1. Technology stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Frontend | Next.js (App Router), React, TypeScript, Tailwind, shadcn/ui, React Hook Form, TanStack Query | SSR for mini-site SEO; RTL-ready |
| Backend | NestJS, TypeScript | Guards/interceptors for authz + tenant context; DI for module boundaries |
| Contracts | Zod in `packages/contracts` | Shared FE ↔ BE typing, per-module namespaces |
| Database | PostgreSQL + Prisma | Relational integrity, transactions, jsonb where useful |
| Queue/cache | Redis + BullMQ | `apps/worker` consumers |
| Storage | Storage-driver abstraction | Local-disk driver (MVP) → S3 driver (ready) |
| Auth | App-owned authorization; authn via robust app auth or managed provider | authn and authz stay separate |

## 2. Delivery model

**Claude Code builds the whole stack** — backend and frontend. There is no
separate UI vendor. Work **contracts-first**: define the Zod contract in
`packages/contracts` (plus the API endpoint and any migration) before the UI
that consumes it, so the frontend is typed against a stable interface.

### Backend / framework
- Architecture and the **module SDK / framework**
- Backend/domain logic, DB schema + migrations
- Tenancy, RBAC, entitlements, the event bus / queue / outbox
- Transactions, idempotency, concurrency
- Security, integrations, tests, code review, refactoring

### Frontend (UI pages)
Built directly in `apps/web` (Next.js App Router). **Invoke the design skills**
so pages are production-grade, not generic:

- **`frontend-design`** — aesthetic direction and quality (avoids "AI-slop" UIs).
- **`ui-ux-pro-max:ui-styling`** — Tailwind + component implementation
  (shadcn/ui when a primitive earns it).
- **`ui-ux-pro-max` / `design-system`** — palettes, type pairings, tokens.
- **`artifact-design`** — when publishing an interactive mock for approval.

Follow the established system in [DESIGN.md](./DESIGN.md) (Modern lane; the
platform brand kit lives as tokens in `apps/web/app/globals.css`). Workflow for
any new UI: **mock → get user approval → build in `apps/web` → verify in the
running app**. Nav and gating are always **server-driven** (from `GET /modules`
and the guards) — never client-side authorization.

## 3. Required skills / roles

- **Backend:** TypeScript, NestJS, Prisma/PostgreSQL, Redis/BullMQ, event-driven
  design, multi-tenancy, transactions & concurrency.
- **Frontend:** Next.js App Router, React, TypeScript, Tailwind, i18n/RTL, SEO.
- **UI design (skills):** `frontend-design`, `ui-ux-pro-max:ui-styling`,
  `ui-ux-pro-max` / `design-system`, `artifact-design` (for mockups) — used to
  build every UI page to a production-grade bar against the DESIGN.md system.
- **Platform / DevOps:** Docker, CI/CD, managed PostgreSQL, Redis, object
  storage (S3), observability.
- **Security:** multi-tenant isolation, authorization, application security.
- **Integrations:** WhatsApp Business API, email provider, AI providers, MCP.
- **Product / UX & brand:** flows, theming, accessibility.
- **QA:** integration + E2E, tenant-isolation and RBAC test design.

## 4. Environments

- **Local:** `.env.local`, local database, seed (platform admin, Business A,
  Business B, sample offerings). Runs via Docker.
- **Staging:** production-like infra, test data.
- **Production:** separate database, storage, secrets, domain, monitoring. Never
  share the production database with development.

## 5. Environment variables

```
DATABASE_URL
AUTH_SECRET
STORAGE_DRIVER            # local | s3
STORAGE_LOCAL_DIR         # when driver=local
STORAGE_ENDPOINT / STORAGE_BUCKET / STORAGE_ACCESS_KEY / STORAGE_SECRET_KEY  # when driver=s3
REDIS_URL
EMAIL_PROVIDER / EMAIL_API_KEY
WHATSAPP_PROVIDER / WHATSAPP_API_KEY
AI_PROVIDER / AI_API_KEY / AI_MODEL
APP_URL
MINISITE_BASE_DOMAIN
```

Provide `.env.example`; never commit real secrets.

## 6. CI/CD

```
PR → lint → typecheck → unit → integration → security checks → build
   → deploy staging → E2E → production
```

Database migrations are version-controlled. See [TEST_PLAN.md](./TEST_PLAN.md).

The concrete deployment target and step-by-step runbook (Hostinger KVM VPS, Docker
Compose + Caddy, per-phase redeploy) live in [DEPLOYMENT.md](./DEPLOYMENT.md).

## 7. Money, time, deletion (invariants)

- Money: integer minor units + currency; never floating point.
- Timestamps stored UTC, displayed in business/user timezone.
- Soft-delete / deactivate entities with historical references; never
  hard-delete orders; audit logs are append-only.

## 8. Backups & observability

Automated DB backups with a **tested restore** (not just "we have backups").
Monitor API/DB latency, failed auth, failed order/payment writes, inventory
conflicts, queue failures, AI errors and usage. Structured logs carry
`request_id`, `user_id`, `tenant_id`, operation, duration, status — never
secrets.
