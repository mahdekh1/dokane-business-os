# Dokane Business OS — Documentation

> A modular, multi-tenant business platform. A business subscribes to a plan and
> enables the modules it needs — Online Store, Inventory, CRM, Accounting,
> Project Management, and more — around a shared foundation of offerings,
> customers, orders and money.

Version: 2.0 · Date: 2026-09-13

Dokane Business OS is **product-agnostic**: a tenant can be a store, a clinic, a
service provider, or anything that sells products or services. It is
**region-agnostic** — internationalization and RTL are capabilities, not a
locale default.

The future **Dokane Marketplace** is a *separate product* that connects to the
Business OS as an additional **sales channel** through an explicit connector. It
is not built here.

## Reading order

Start with the **PRD**, then **ARCHITECTURE**, then **MODULES** — those three
frame everything else.

| Doc | Purpose |
|-----|---------|
| [PRD.md](./PRD.md) | Product authority: vision, actors, scope, module catalog, packaging, success criteria |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Modular monolith, processes, event bus, queue, outbox, repo/service structure, stack |
| [MODULES.md](./MODULES.md) | The module framework/SDK contract, lifecycle, entitlements vs permissions, module catalog |
| [DATA_MODEL.md](./DATA_MODEL.md) | Core schema + per-module schema namespaces, key entities |
| [API.md](./API.md) | REST conventions, versioning, auth flow, idempotency, per-module surface |
| [RBAC.md](./RBAC.md) | Actors, roles, permission catalog, per-tenant custom roles, entitlement layer |
| [SECURITY.md](./SECURITY.md) | Tenant isolation layers, authorization, storage, appsec, isolation tests |
| [ORDERS_AND_MONEY.md](./ORDERS_AND_MONEY.md) | Sales channels, offerings, two-axis order status, partial payments, accounting, receivables, dormant invoicing |
| [CRM.md](./CRM.md) | Leads & customers, source tracking, lifecycle |
| [NOTIFICATIONS.md](./NOTIFICATIONS.md) | Channel abstraction (WhatsApp/Email), stub adapters, templates, event triggers |
| [AI.md](./AI.md) | The thin AI agent, gateway, tool registry, module-registered tools, privacy, future WhatsApp intake, MCP |
| [MINISITE.md](./MINISITE.md) | Public mini-site: four pages, brand theming, SEO |
| [PROJECT_MGMT.md](./PROJECT_MGMT.md) | Projects & tasks, statuses |
| [ROADMAP.md](./ROADMAP.md) | MVP scope and phased module rollout |
| [DELIVERY.md](./DELIVERY.md) | Stack detail, Lovable/Claude Code split, required skills, environments, CI/CD |
| [TEST_PLAN.md](./TEST_PLAN.md) | Testing strategy across unit/integration/E2E/security |
| [MVP_SCOPE.md](./MVP_SCOPE.md) | One-page consolidation of every MVP decision |
| [POST_MVP_CHANGES.md](./POST_MVP_CHANGES.md) | MVP features built in reduced form, and what changes when we grow past the MVP |
| [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) | Detailed step-by-step build plan; Claude CLI ⇄ Lovable responsibility split, per-step prompts and sync commands |
| [DIAGRAMS.md](./DIAGRAMS.md) | Architecture diagrams and flows (Mermaid) |

## Authority

- **PRD.md** is the product authority. It defines what is in and out of scope.
- **SECURITY.md** is the authority for tenant isolation and authorization.
- **MODULES.md** is the authority for the module contract every feature follows.

No document may be silently redefined by an implementation. Changes go through a
pull request against these docs.

## Delivery agents

Implementation is divided between **Lovable** (frontend scaffolding) and
**Claude Code** (architecture, backend, security, framework). See
[DELIVERY.md](./DELIVERY.md). No other coding agents are part of this plan.
