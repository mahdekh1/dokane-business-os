# Architecture

Version: 2.0 · Date: 2026-09-13

This is the engineering authority for how Dokane Business OS is built. It defines
the architecture style, the runtime processes, how modules communicate, and the
repository/service structure.

---

## 1. Style — modular monolith, service-ready

Dokane Business OS is a **modular monolith**: one codebase with strictly-bounded
modules that can be **extracted to independent services later without a rewrite**.

This is not "one process." The system runs as **multiple processes from one
codebase** and uses a **real message queue**, giving proper asynchronous
messaging without the operational cost of microservices.

Why not microservices now: per-service databases, an API gateway, inter-service
transport, distributed tracing and failure handling are real costs that a
single-team early-stage product should not buy before it needs them. The module
boundaries below make that split cheap when scale demands it.

---

## 2. Runtime processes

```
                       Internet
                          │
                 CDN / HTTPS / WAF
                          │
      ┌───────────────────┼───────────────────┐
      │                   │                    │
  apps/web            apps/api             apps/worker
  (Next.js)          (NestJS API)         (BullMQ consumers)
      │                   │                    │
      └──────► reads ◄────┤                    │
                          │                    │
                   PostgreSQL  ◄───────────────┘
                          ▲
                          │
                  Object Storage (media)
                          
                   Redis (queue + cache)
```

- **`apps/web`** — Next.js App Router. Business console, platform admin, and
  public mini-sites (server-rendered for SEO).
- **`apps/api`** — NestJS modular backend. Owns authorization, tenant
  resolution, validation, business rules and transactions.
- **`apps/worker`** — consumes queued jobs (email, WhatsApp, image processing,
  AI jobs, exports, future webhooks). Same codebase, separate deployable.
- **PostgreSQL** — primary datastore.
- **Redis** — BullMQ queue and cache.
- **Object storage** — media (see [SECURITY.md](./SECURITY.md) §storage).

---

## 3. Inter-module communication

Modules never call into each other's services or read each other's tables. They
communicate through two mechanisms.

### 3.1 In-process event bus (synchronous decoupling)

A module emits a domain event; other modules subscribe. Enforced with NestJS
`EventEmitter2` / the CQRS event bus.

```
InventoryModule  ──emit──►  "inventory.low_stock"  ──►  NotificationsModule
OrderModule      ──emit──►  "order.completed"      ──►  Accounting, CRM, AIInsights
```

### 3.2 Message queue (asynchronous work)

Anything slow, external or retryable is enqueued by `apps/api` and consumed by
`apps/worker`.

```
apps/api ──enqueue──► Redis (BullMQ) ──consume──► apps/worker ──► WhatsApp / Email / AI / resize
```

### 3.3 Transactional outbox (reliability)

To guarantee an event fires **if and only if** its data change committed, the
emitting module writes an `outbox` row inside the same DB transaction as its
business write. A relay publishes outbox rows to the queue.

```
BEGIN TX
  save order
  insert outbox row ("order.completed")
COMMIT
        │
   relay polls outbox ──► queue ──► worker/subscribers
```

### 3.4 Contracts

Event payloads and API bodies are typed with **Zod schemas** in
`packages/contracts`, namespaced per module. These schemas are the stable
contract; when a module is later extracted to a service, the in-process bus is
swapped for a network broker (NATS/RabbitMQ/SQS) and the contracts do not change.

---

## 4. Repository structure

```
apps/
  web/        # Next.js: business console, platform admin, public mini-sites
  api/        # NestJS modular monolith
  worker/     # BullMQ job consumers

packages/
  contracts/  # Zod schemas, namespaced per module (shared FE ↔ BE)
  ui/         # Shared React components + design tokens/theming
  module-sdk/ # Module manifest types + registration helpers
  config/     # Shared config, env parsing, constants
```

### Backend module layout

```
apps/api/src/modules/<module>/
  <module>.manifest.ts   # id, version, deps, required entitlement, agent tools, permissions
  <module>.module.ts     # NestJS module wiring
  <module>.controller.ts # HTTP surface (no DB access here)
  <module>.service.ts    # business rules, transactions
  <module>.repository.ts # data access (Prisma)
  <module>.events.ts     # emitted/consumed events
  dto/                   # request/response DTOs (from contracts)
  <module>.spec.ts       # tests
```

Controllers never touch the database directly. Services own the rules and
transaction boundaries; repositories own data access. See
[MODULES.md](./MODULES.md) for the full module contract.

---

## 5. Technology stack

| Layer | Choice |
|-------|--------|
| Frontend | Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui, React Hook Form, TanStack Query |
| Backend | NestJS, TypeScript, guards + interceptors for authz/tenant context |
| Contracts | Zod (shared), end-to-end typing |
| Database | PostgreSQL, Prisma ORM |
| Queue/cache | Redis + BullMQ |
| Storage | Object storage via a driver abstraction (local-disk driver for MVP, S3 driver ready) |
| Auth | Application-owned authorization; authentication via robust app auth or a managed provider — authn and authz stay separate concepts |

Stack rationale and the delivery model are in [DELIVERY.md](./DELIVERY.md).

---

## 6. Multi-tenancy at the architecture level

- **Business = tenant.** Every tenant-owned row carries `business_id`.
- Tenant context is **derived from the authenticated membership**, never from
  client input. See [SECURITY.md](./SECURITY.md).
- Services receive a tenant context object; repositories scope every query by
  it. Public mini-sites resolve the tenant from a trusted slug/host mapping.

---

## 7. Money and time

- Money is stored as **integer minor units** plus a separate currency code.
  Never floating point.
- Timestamps are stored in UTC and displayed in the business/user timezone.

---

## 8. What agents must not do

An implementation must never: remove `business_id`, move authorization to the
frontend, trust client-supplied prices/totals, bypass transactions, mutate
inventory without a movement, delete historical orders, connect AI directly to
SQL, hard-code a payment provider or notification provider, hard-code any locale,
or create a giant generic settings JSON blob in place of typed configuration.
