# RBAC — Roles & Permissions

Version: 2.0 · Date: 2026-09-13

Access control has two orthogonal layers. This document owns the **permission**
layer (roles → actions). The **entitlement** layer (plan → module availability)
is owned by the Module Registry; see [MODULES.md](./MODULES.md) §4.

---

## 1. Actors (recap)

| Actor | Scope | Summary |
|-------|-------|---------|
| Platform Admin | Global | Full permission across all tenants; platform operations |
| User | Identity | A person; holds memberships across businesses |
| Business Owner | Tenant | Full CRUD on the business + its enabled modules |
| Team Member | Tenant | Limited CRUD per assigned role |

Identity (`User`) and role are separate. A user's capabilities in a given
business come from that business's `BusinessMembership.role`.

---

## 2. Permission model

- Permissions are codes of the shape `module.resource.action`, e.g.
  `catalog.products.create`, `orders.payment.record`, `crm.customers.view`.
- Permissions are **contributed by modules** (declared in the manifest) and only
  appear in a tenant's catalog when the module is **enabled**.
- Roles map to sets of permissions. A request is authorized only if the member's
  role holds the required permission **and** the tenant is entitled to the module.
- **Backend authorization is mandatory.** Hiding UI is never a security control.

```
Request → authenticated? → membership? → business active? →
          module entitled? → role has permission? → tenant-scoped service → DB
```

## 3. Default roles

Platform ships system roles as sensible defaults. `is_system` roles cannot be
deleted but can be copied.

**Platform scope**
- `PLATFORM_ADMIN`

**Business scope**
- `OWNER` — all business permissions
- `MANAGER` — most operational permissions; not billing/ownership transfer
- `INVENTORY_MANAGER` — catalog view + inventory
- `STAFF` — day-to-day operational subset

## 4. Per-tenant customization (required)

Roles and their permission sets are **editable per tenant**:

- An owner can **create custom roles** and assign any permission available from
  the tenant's enabled modules.
- Default (`is_system`) roles are cloneable into editable custom roles.
- Custom roles carry a `business_id`; system roles have `business_id = NULL`.
- Enabling a new module makes its permissions assignable; disabling hides them
  (existing assignments are retained but inert).

This is surfaced through a Roles UI in business settings.

## 5. Permission catalog (by module)

Composed dynamically from enabled modules. Representative set:

```
# Core
business.view, business.update
users.view, users.create, users.update, users.disable, users.invite
roles.view, roles.manage
locations.view, locations.create, locations.update, locations.disable
modules.view, modules.enable, billing.manage

# Catalog / Inventory
catalog.categories.view|create|update|delete
catalog.products.view|create|update|delete
inventory.view, inventory.adjust

# Channels / Orders / Money
channels.view, channels.manage
orders.view, orders.create, orders.update, orders.cancel, orders.refund
orders.payment.record
accounting.entries.view, accounting.entries.create
storefront.manage

# CRM
crm.customers.view|create|update|delete
crm.leads.view|create|update

# Project Management
pm.projects.view|create|update
pm.tasks.view|create|update|assign

# AI
ai.use, ai.configure

# Reporting / Audit
reports.view
audit.view

# Platform
platform.businesses.view|approve|reject|suspend
platform.users.view
platform.audit.view
```

## 6. Platform Admin

- Global scope; not bound to a `business_id`.
- Must not automatically inherit tenant business permissions in a way that hides
  who acted — tenant support access should be **explicit and audited** (future:
  an audited impersonation mode). See [SECURITY.md](./SECURITY.md).
- Recommended future controls: MFA, restricted admin endpoints.

## 7. Rules

- Never scatter role-name checks through the code; check **permissions**.
- Never trust a client-supplied `business_id`; derive tenant from the membership.
- Authorization runs server-side on every protected request.
