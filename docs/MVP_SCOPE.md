# MVP Scope — Consolidated

Version: 2.0 · Date: 2026-09-13

A single-page consolidation of every decision from design. This is the
authoritative "what is in the MVP" list. Full detail lives in the linked docs;
things that will change when we grow past the MVP are in
[POST_MVP_CHANGES.md](./POST_MVP_CHANGES.md).

---

## Product

**Dokane Business OS** — a modular, multi-tenant business platform. A business
subscribes to a plan and enables the modules it needs. Region-agnostic;
i18n/RTL are capabilities, not a locale default. The Dokane Marketplace is a
*separate future product* that connects as an additional sales channel.

## Architecture (locked)

| Decision | Value |
|----------|-------|
| Style | Modular monolith, service-ready |
| Processes | `apps/web` (Next.js) · `apps/api` (NestJS) · `apps/worker` (BullMQ) |
| Messaging | In-process event bus + Redis/BullMQ queue + transactional outbox |
| Stack | NestJS · Next.js App Router · PostgreSQL · Prisma · Zod contracts · Redis |
| Storage | Driver abstraction — **local-disk driver** for MVP, S3 driver ready |
| Money | Integer minor units + currency; cash-basis |
| Auth model | App-owned authorization; tenant derived from membership, never client input |

## Actors

Platform Admin (global) · User (identity, multi-business) · Business Owner (full
CRUD) · Team Member (limited CRUD). Roles and permissions **editable per tenant**.
Two access layers: **entitlement** (plan unlocks module) ≠ **permission** (role
allows action).

## Modules built in the MVP

- **Core:** Identity/Access + Team · Tenancy/Business + approval lifecycle ·
  Module Registry + Billing (Modules page) · Notifications framework · Branding ·
  AI framework · Audit.
- **MVP-built:** Catalog (offerings, types, variants) · Inventory (per-location,
  movement ledger, low-stock) · Sales Channels · Orders (manual + online) ·
  Basic Accounting (income/expense, receivables) · CRM · Project Management ·
  Mini-site (4 pages) · AI Agent.

## Modules scaffolded only (register + enable-able, placeholder behavior)

Calendar · HR · **POS (infra/data-model only)** · **Payments & Invoices
(structure, dormant)** · Sales-Channel connector · Social & Growth.

## Key domain rules

- **Offerings** are products *or* services; types `PHYSICAL/VIRTUAL/SERVICE`
  now, extensible to `PACKAGE/PROMOTION/PROGRAM`. Simple or variant.
- **Sales channels** are first-class; products/inventory shared, settings/orders/
  reporting separated. Every order + money entry carries `channel_id` → global
  and per-channel reporting from one dimension.
- **Orders** = one model, two axes: fulfillment (`DRAFT→…→COMPLETED/CANCELLED`) ×
  payment (`UNPAID→PARTIALLY_PAID→PAID→REFUNDED`). `entry_mode` = ONLINE | MANUAL.
- **Partial payments** first-class (order has many payments).
- **Money is cash-basis**: income entry on **payment received**, not order
  completion. Completed-unpaid = **receivable**. Three reconciled numbers: Sales,
  Income, Receivables.
- **Payment methods (MVP):** Cash + Bit (extensible enum).
- **Invoicing:** infra scaffolded, **dormant** — produces nothing yet.
- **CRM:** one registry, leads + customers, `source` tracked.
- **Mini-site:** Main / Store / Contact / Landing; brand color+font palette; SEO
  built in; **WhatsApp order handoff** (no self-serve checkout in MVP).
- **AI agent:** thin in-app assistant; module-registered tools, tenant+permission
  scoped, audited; 4 read tools + 2 confirmed-write tools.
- **Notifications:** WhatsApp/Email channel abstraction, **stub adapters** day one.

## Delivery

**Claude Code** builds the whole stack — architecture, backend, security,
framework, tests, and frontend. Contracts-first (define Zod contracts + API
before the UI). UI pages are built in `apps/web` with the design skills
(`frontend-design`, `ui-ux-pro-max:ui-styling`) via mock → approve → build; the
design system is in [DESIGN.md](./DESIGN.md). See [DELIVERY.md](./DELIVERY.md)
and [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md).

## Definition of done

A new business can register → get approved → pick a plan → enable modules → add
offerings + inventory → publish a mini-site → take a manual or online (WhatsApp)
order → record a partial then full payment → see income + receivables + sales by
channel → ask the AI agent about the business. Tenant isolation and RBAC proven
by tests; system observable and recoverable.
