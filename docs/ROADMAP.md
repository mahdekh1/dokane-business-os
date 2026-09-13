# Roadmap

Version: 2.0 · Date: 2026-09-13

Build order and MVP scope. Do not start a dependent phase until the previous
phase passes its tests. Modules communicate only through contracts and events,
so a later module never forces a rewrite of an earlier one.

---

## Phase 0 — Specification
PRD, this doc set, ERD, API conventions, security model. (This repository.)

## Phase 1 — Foundation
Repository + environments; PostgreSQL + Prisma; auth; tenancy; RBAC; the
**module SDK and registry**; entitlements/plans; audit foundation; two demo
businesses with proven isolation.

## Phase 2 — Business workflow
Onboarding, platform admin, business approval lifecycle, the **Modules page**
(enable by entitlement), branding.

## Phase 3 — Catalog & Inventory (MVP-built)
Offerings (types, variants), categories, media (local-disk driver); inventory
per location, movement ledger, low-stock.

## Phase 4 — Channels, Orders & Money (MVP-built)
Sales channels; the two-axis order model (manual + online); partial payments;
basic accounting ledger (income on payment received; expenses manual);
receivables; per-channel + global reporting. Invoice infra scaffolded, dormant.

## Phase 5 — CRM & Project Management (MVP-built)
Customers + leads with source tracking; projects + tasks with statuses.

## Phase 6 — Mini-site (MVP-built)
Four pages, brand theming, SEO, WhatsApp order handoff.

## Phase 7 — Notifications (core, MVP)
Channel abstraction with stub adapters; templates; event triggers; log.

## Phase 8 — AI agent (MVP-built)
Gateway, tool registry, module-registered tools; 4 read tools + 2
confirmed-write tools; per-tenant enable; audit.

## Phase 9 — Hardening
Security audit, tenant-isolation tests, concurrency/idempotency tests, E2E,
deployment.

---

## Scaffolded stubs (register now, build on demand)
Calendar · HR · POS (infra/data-model only) · Payments & Invoices (structure,
dormant) · Sales-Channel connector · Social & Growth.

## Future (demand-driven)
- Self-serve online checkout + online payment processing
- Real WhatsApp Business API + email provider (replace stub adapters)
- WhatsApp AI intake (agent reads messages, acts with human-in-the-loop)
- POS UI + hardware (barcode-as-keyboard, receipt printer, cash drawer)
- Payments & Invoices activation (legal invoicing, provider integration)
- ERP (purchasing, manufacturing, accounting depth), Analytics/BI
- **Dokane Marketplace connector** — the marketplace is a separate product; it
  connects to the Business OS as an additional sales channel. The OS remains the
  source of truth for offerings, inventory and orders.

Expansion is driven by demonstrated merchant demand, not built ahead of it.
