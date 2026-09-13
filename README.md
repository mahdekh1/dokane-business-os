# Dokane Business OS

A modular, multi-tenant business platform. Subscribe to a plan and enable the
modules you need — Online Store, Inventory, CRM, Accounting, Project Management
and more — around a shared foundation of offerings, customers, orders and money.

Full specification: **[docs/README.md](./docs/README.md)** (start with
[PRD](./docs/PRD.md), [ARCHITECTURE](./docs/ARCHITECTURE.md),
[MODULES](./docs/MODULES.md)). Build plan:
[IMPLEMENTATION_PLAN.md](./docs/IMPLEMENTATION_PLAN.md).

## Monorepo layout

```
apps/
  web/        Next.js (App Router) — console, admin, public mini-sites
  api/        NestJS modular monolith
  worker/     BullMQ job consumers
packages/
  contracts/  Zod schemas shared FE ↔ BE
  ui/         Shared components + design tokens
  module-sdk/ Module manifest + registration helpers
  config/     Shared config + env parsing
```

## Prerequisites

- Node **>= 18.17** (CI runs Node 20; Node 20 recommended locally)
- pnpm 10+
- Docker (for Postgres + Redis; used from Phase 1 onward)

## Getting started

```bash
cp .env.example .env
pnpm install
docker compose up -d      # Postgres + Redis (Phase 1+)
pnpm dev                  # runs web, api, worker
```

Health check once the API is up:

```bash
curl http://localhost:3001/health   # {"status":"ok"}
```

## Scripts

`pnpm dev` · `pnpm build` · `pnpm typecheck` · `pnpm lint` · `pnpm test`
(orchestrated across the workspace by Turborepo).

## Delivery

Implementation is split between **Claude CLI** (architecture, backend, security,
framework, tests) and **Lovable** (frontend scaffolding), working
contracts-first. See [docs/DELIVERY.md](./docs/DELIVERY.md).
