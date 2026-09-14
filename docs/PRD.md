# Dokane Business OS — Product Requirements

Version: 2.0 · Date: 2026-09-13

This document is the product authority for Dokane Business OS. It defines the
vision, the actors, what is in and out of scope, the module catalog, and how the
product is packaged and sold. Engineering authority lives in
[ARCHITECTURE.md](./ARCHITECTURE.md), [MODULES.md](./MODULES.md) and
[SECURITY.md](./SECURITY.md).

---

## 1. Vision

> A modular, multi-tenant business platform. A business subscribes to a plan and
> switches on the modules it needs, around one shared foundation of offerings,
> customers, orders and money.

Dokane Business OS lets any small business — a **store, a clinic, a service
provider** — run its operation from one place, adding capability as it grows
rather than buying a new tool for every need.

The design principle is **Odoo-like modularity with a deliberately small core**:
the product *is* the module framework plus packaging. Individual features (CRM,
Inventory, Online Store, Accounting, HR, …) are pluggable modules on top.

### What it is not (MVP)

- Not an ERP suite — advanced manufacturing/purchasing/accounting are future modules.
- Not a full accounting/tax/invoicing system — invoicing is scaffolded but dormant.
- Not the Dokane Marketplace — that is a separate product and a future sales channel.
- Not a payment processor — payments are recorded, not processed, in the MVP.

### Region and language

The product is **region-agnostic**. Internationalization and right-to-left (RTL)
layout are first-class **capabilities**, not a locale default. No business rule
is hard-coded to any country, currency, or region.

---

## 2. Actors

Identity and role are **separate concepts**. A `User` is a person; a role is
granted per business through a membership.

| Actor | Scope | Can |
|-------|-------|-----|
| **Platform Admin** | Global | Owns everything; full permission across all tenants; approves/suspends businesses; manages platform config and audit. *(Future: scoped, audited tenant access.)* |
| **User** | Identity | A registered person. Holds memberships in one or more businesses, each with its own role. May be an owner of one business and a team member of another. |
| **Business Owner** | Tenant | Full CRUD over the business and its enabled modules: team, roles, billing, module enablement, all business data. |
| **Team Member** | Tenant | Limited CRUD, scoped by the permissions assigned to their role. |

```
User (identity) ──< BusinessMembership >── Business
                        │ role_id
                        ▼
                     Role ──< permissions (editable per tenant)
```

Full role and permission detail is in [RBAC.md](./RBAC.md).

---

## 3. Packaging & entitlements

Two independent layers govern access:

- **Entitlement** — *can this tenant use a module at all?* Set by the subscribed
  **plan** (or an à-la-carte add-on).
- **Permission** — *can this member perform an action within an enabled module?*
  Set by the member's **role**, editable per tenant.

A tenant sees a **Modules page** listing every module as **active**, **available
(upgrade to unlock)**, or **locked**. Proposed tiers:

| Tier | Modules |
|------|---------|
| **Starter** | Mini-site (Main + Contact), Catalog, Branding |
| **Growth** | + Online Store (Store + Landing), Inventory, Notifications, SEO, CRM, Basic Accounting, **Calendar** |
| **Business** | + Team & HR, Project Management, AI Insights/Agent, Sales Channels |
| **Enterprise** | + ERP, POS, custom modules |

Tiers are a starting point and are configured in the Billing/Module Registry
module, not hard-coded across the app.

---

## 4. Offerings — products *and* services

A business does not only sell physical products. The sellable-thing model is
**polymorphic and business-type-aware**.

- **Offering** — the master record for anything a business offers, shared across
  all sales channels.
- **Type discriminator**, extensible without schema change:
  - MVP: `PHYSICAL`, `VIRTUAL` (digital), `SERVICE`
  - Later: `PACKAGE`/`BUNDLE`, `PROMOTION` (e.g. 2-for-1), `PROGRAM`/`ENROLLMENT`
- **Simple or variant** — an offering may have a variant matrix (e.g. size ×
  color), each variant with its own SKU/barcode/price/stock.

A store enables Online Store + Inventory; a clinic enables Calendar + Programs —
both draw from the same Offerings core.

**Onboarding captures the business's offering types** (agreed 2026-09-14): a
required multi-select of **Physical goods · Services · Courses & programs ·
Digital products** (a business can pick several — a clinic offers Services and
sells Courses). Stored on the business (`offeringTypes`), it seeds the Catalog
offering editor (Phase 3) and, together with the business category, drives the
module suggestions on the Modules page. **Calendar** is a first-class MVP module
(Growth+) for appointment/session businesses, with Google/Apple Calendar sync
(scaffolded now; OAuth in its build phase).

---

## 5. Sales channels

`SalesChannel` is a first-class entity per business. The **online store**, each
**physical store**, and the future **marketplace** are all channels.

- **Products and inventory are shared** across channels (one master, one stock
  pool per location).
- **Channel settings, storefront, orders and reporting are separated** per
  channel.
- Every order and every money entry carries a `channel_id`, so **global** and
  **per-channel** reporting come from one dimension with no duplication.
- In the console, **Sales Channels** is the "where you sell" surface: In-store,
  Online Store, and **Connect to Marketplace** (the marketplace is a channel a
  business opts into, not a separate product).

**Storefront vs Sales Channels (IA, agreed 2026-09-14).** The business's own web
presence — the **mini-site** public pages (Main/Store/Contact/Landing, brand, SEO)
plus the **online store** commerce (cart, online orders, WhatsApp handoff) — is
presented to owners as **one "Storefront" surface**, even though `mini_site` and
`online_store` remain separate modules underneath. "Sales Channels" stays distinct:
it is where a business turns selling locations on/off and connects to the
marketplace. See [MODULES.md](./MODULES.md) §6 and IMPLEMENTATION_PLAN Phase 2.5.

Details in [ORDERS_AND_MONEY.md](./ORDERS_AND_MONEY.md).

---

## 6. Orders and money (summary)

- One **Order** model serves both **manual** (staff-entered) and **online**
  (self-serve) orders, distinguished by `entry_mode`.
- Order state is **two orthogonal axes**: **fulfillment** (`DRAFT → … →
  COMPLETED / CANCELLED`) and **payment** (`UNPAID → PARTIALLY_PAID → PAID →
  REFUNDED`).
- **Partial payments** are first-class (an order has many payment records) —
  important for manual orders, deposits and installments.
- Money is **cash-basis**: an income entry is created when payment is
  **received**, not when the order completes. A completed-but-unpaid order is a
  **receivable**.
- MVP payment methods: **Cash** and **Bit transfer** (extensible).
- **Invoice generation** is scaffolded in infrastructure (entity, numbering,
  service interface, order wiring) but **dormant** — it produces nothing yet.

---

## 7. Module catalog

| Module | MVP status | Notes |
|--------|-----------|-------|
| Identity & Access, Team | Core | Users, memberships, roles, RBAC |
| Tenancy & Business profile | Core | The tenant, onboarding, approval lifecycle |
| Module Registry & Billing | Core | Entitlements, plans, the Modules page |
| Notifications | Core | WhatsApp/Email abstraction, stub adapters |
| Branding & Theming | Core | Per-business color + font palette |
| AI framework & Agent | Core / MVP-built | Gateway, tool registry, thin owner assistant |
| Audit | Core | Append-only event log |
| Catalog (Offerings) | **MVP-built** | Products/services, types, variants |
| Inventory | **MVP-built** | Stock per location, movement ledger, low-stock |
| Online Store | **MVP-built** | Storefront channel, orders, shipping, WhatsApp handoff |
| Sales Channels | **MVP-built** | Channel entity + per-channel reporting |
| Basic Accounting | **MVP-built** | Income/expense ledger, receivables |
| CRM | **MVP-built** | Leads/customers, source, lifecycle |
| Project Management | **MVP-built** | Projects & tasks with statuses |
| Mini-site | **MVP-built** | Four public pages, brand, SEO |
| Calendar | Scaffolded stub (Growth+) | Appointments/bookings/sessions; Google + Apple Calendar sync (manifest + nav + "Connect" placeholder now, OAuth in its build phase) |
| HR | Scaffolded stub | Employees, attendance |
| POS | Scaffolded (infra only) | Registers/sessions data model; UI out of MVP |
| Payments & Invoices | Scaffolded (structure) | Dormant invoicing + processor abstraction |
| Sales-Channel connector | Scaffolded stub | Future marketplace/other integrations |
| Social & Growth | Scaffolded stub | Campaigns, promos, links |
| ERP | Future | Purchasing, manufacturing, accounting depth |
| Analytics / BI | Future | Advanced reporting |

"Scaffolded stub" means the module registers into the framework and can be
enabled, but its behavior is a placeholder. "Infra only" means the data model
exists for a later UI.

---

## 8. The AI agent (MVP)

A **thin, in-app assistant** for the business owner, backed by the AI Gateway and
Tool Registry. Its capabilities scale with enabled modules, because **each module
registers its own agent tools**. Every tool runs with the user's tenant and
permission context — the agent can never exceed what the user could do in the UI.
Reads run freely; writes require explicit confirmation; everything is audited.

MVP task set (reads + confirmed writes):

1. **Business pulse** — sales, cash collected, receivables, orders, by channel.
2. **Reorder radar** — low-stock items + suggested reorder quantity.
3. **Who owes me** — receivables list and total.
4. **Movers & dead stock** — best and slow sellers over a period.
5. **Draft product content** — generate offering name/description/SEO for review.
6. **Log it for me** — record an expense or create a task, on confirmation.

**Future:** inbound WhatsApp messages flow to the agent, which classifies intent
and drafts replies or actions (human-in-the-loop first). See [AI.md](./AI.md).

---

## 9. Success criteria

**Technical**
- Zero known critical cross-tenant vulnerabilities.
- Module enable/disable driven by entitlement; actions gated by permission.
- Reliable, transactional order/payment/inventory operations.
- Automated regression tests, including tenant isolation and RBAC.
- Recoverable production database; observable system.

**Product**
- A new business can register, get approved, choose a plan, enable modules, add
  offerings and inventory, publish a mini-site, take a manual or online order,
  record payment (including partial), and see sales by channel — without an
  implementation consultant.
- The owner can ask the AI agent about the business and get a useful answer.

**Business**
- Businesses complete onboarding, enable modules, return to the product, and are
  willing to pay for higher tiers.

Expansion (POS UI, Payments processing, ERP, Marketplace connector) is driven by
demonstrated demand, not built ahead of it.
