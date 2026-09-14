# Module Framework

Version: 2.0 · Date: 2026-09-13

This is the authority for the module contract every feature follows. The module
framework is the core product: features are pluggable modules on top of it.

---

## 1. What a module is

A module is a self-contained capability that exposes a standard contract. It owns
its data, its API, its UI, its permissions, its events, and the AI-agent tools it
offers. It communicates with other modules only through published contracts and
events (see [ARCHITECTURE.md](./ARCHITECTURE.md) §3).

```
Module = {
  manifest      # id, name, version, dependencies, required entitlement
  backend       # NestJS feature module: services, controllers, repository
  models        # Prisma models in the module's own schema namespace
  contracts     # Zod schemas (typed FE ↔ BE), namespaced by module
  ui            # Next.js route group + navigation entries, lazy-loaded
  permissions   # permission codes registered into RBAC
  events        # domain events emitted / consumed
  agentTools    # AI-agent tools this module offers (read/write, permission-gated)
  entitlement   # which plan tier / add-on unlocks the module
}
```

## 2. The manifest

Every module declares a manifest. The registry reads manifests to build the
Modules page, the navigation, the permission catalog, and the agent tool set.

```ts
// <module>.manifest.ts (shape)
export const catalogManifest: ModuleManifest = {
  id: 'catalog',
  name: 'Catalog',
  version: '1.0.0',
  dependsOn: [],                       // module ids required first
  requiredEntitlement: 'catalog',      // entitlement key unlocked by a plan/add-on
  permissions: [
    'catalog.offerings.view',
    'catalog.offerings.create',
    'catalog.offerings.update',
    'catalog.offerings.delete',
  ],
  navigation: [{ path: '/app/catalog', labelKey: 'catalog.nav.offerings', icon: 'box' }],
  events: { emits: ['catalog.offering.created'], consumes: [] },
  agentTools: ['catalog.draft_offering_content'],
};
```

`packages/module-sdk` provides the `ModuleManifest` type and the registration
helpers so every module has the same shape.

## 3. Lifecycle

```
Author module  ──►  Register manifest  ──►  Tenant enables (if entitled)
                                                   │
                    ┌──────────────────────────────┤
                    ▼              ▼           ▼    ▼
              routes + nav   permissions   events  agent tools
              become active  appear in     wired   available
                             RBAC catalog
```

- **Enable** requires the tenant to hold the module's `requiredEntitlement`.
- Enabling registers the module's routes, navigation, permissions and agent
  tools for that tenant. Disabling hides them (data is retained; see soft
  deletion in [SECURITY.md](./SECURITY.md)).
- A module with unmet `dependsOn` cannot be enabled until its dependencies are.

## 4. Two access layers — entitlement vs permission

These are **orthogonal** and must not be conflated.

| Layer | Question | Set by | Lives in |
|-------|----------|--------|----------|
| **Entitlement** | Can this tenant use the module at all? | Plan tier or add-on | Module Registry & Billing |
| **Permission** | Can this member perform this action within the enabled module? | The member's role | RBAC ([RBAC.md](./RBAC.md)) |

The permission catalog is **composed from enabled modules**: enabling CRM makes
`crm.*` permissions available to assign to roles. Roles and their permission sets
are **editable per tenant**.

## 5. Module boundaries (the rules)

1. A module reads and writes **only its own models**. To use another module's
   data, it calls that module's published service interface or subscribes to its
   events.
2. Cross-module reactions happen through the **event bus**, never direct calls
   into another module's repository.
3. Shared, cross-cutting data (offerings, customers, orders, money) lives in
   clearly-owned modules with published contracts — not copied into consumers.
4. A module is designed so it could be extracted to its own service by swapping
   the in-process event transport for a network broker, with no contract change.

## 6. Module catalog

See [PRD.md](./PRD.md) §7 for the full catalog and MVP status. Ownership of the
cross-cutting domains:

| Domain | Owning module |
|--------|---------------|
| Offerings (products/services, types, variants) | Catalog |
| Stock, movements, low-stock | Inventory |
| Sales channels + per-channel reporting | Sales Channels |
| Orders (manual + online), fulfillment, payment status | Orders (within/near Online Store; see [ORDERS_AND_MONEY.md](./ORDERS_AND_MONEY.md)) |
| Income/expense ledger, receivables | Basic Accounting |
| Customers (base record) | Core (always present) |
| Leads, pipeline, source analytics | CRM |
| Projects & tasks | Project Management |
| Public site pages, theming hooks, SEO | Mini-site |
| Notification channels & templates | Notifications |
| AI gateway, tool registry, agent | AI |

**Navigation grouping (agreed 2026-09-14).** `Mini-site` and `Online Store` are
separate modules but present under **one "Storefront" nav group** in the console
(public pages + online commerce are one surface to the owner). `Sales Channels`
is its own group — In-store, Online Store, and Connect to Marketplace. Every
module renders as a **nav group** (its sub-routes + a Settings tab), not a flat
link. See PRD §5 and IMPLEMENTATION_PLAN Phase 2.5.

## 7. Scaffolded vs built

- **MVP-built** modules implement their full contract.
- **Scaffolded stub** modules register a valid manifest and can be enabled, but
  their services return placeholders. This proves the framework and reserves the
  navigation/permission/entitlement space.
- **Infra-only** modules (POS) ship the data model and manifest but no UI.

A scaffolded module graduating to built is a normal implementation task — it does
not require framework changes, which is the point of the module SDK.
