# Data Model

Version: 2.0 · Date: 2026-09-13

Conceptual schema for Dokane Business OS. Each module owns its own tables (its
schema namespace); cross-module references use IDs, and cross-module *reactions*
use events, never direct table reads. Order/money detail lives in
[ORDERS_AND_MONEY.md](./ORDERS_AND_MONEY.md).

Conventions (full list in [ARCHITECTURE.md](./ARCHITECTURE.md) and
[SECURITY.md](./SECURITY.md)):
- UUID primary keys; `created_at`/`updated_at` on entities.
- Every tenant-owned row carries `business_id` (FK, indexed).
- Money as integer minor units + separate currency; never floating point.
- Explicit enum-like status values; no boolean soup for lifecycles.
- Soft deletion / deactivation for entities with historical references.
- **Actor / assignee references** inside a tenant (`created_by`, `opened_by`,
  `owner_id`, `assignee_id`, …) reference `business_memberships.id`, which
  guarantees the actor belongs to the business. Platform-level actors reference
  `users.id`.
- **Persisted media references store a storage *key*, not an absolute URL**; the
  URL is derived through the storage driver at read time, so a local→S3 move
  leaves no stale URLs. (Applies to `offering_media`, and to logo references on
  `businesses` / `branding` / storefront settings.)

---

## 1. Platform & identity

```
users                id, email (UNIQUE global), first_name, last_name, phone, status, created_at, updated_at
businesses           id, name, slug, business_type, phone, email, address*,
                     currency, timezone, status, logo_url, created_at, updated_at
business_memberships id, business_id, user_id, role_id, status, created_at, updated_at
                     UNIQUE(business_id, user_id)
roles                id, business_id?, name, scope (PLATFORM|BUSINESS), description, is_system
permissions          id, code, module_id, description
role_permissions     role_id, permission_id   UNIQUE(role_id, permission_id)
```

`business.status`: `PENDING_APPROVAL | CHANGES_REQUESTED | APPROVED | REJECTED |
SUSPENDED`. Platform roles have `business_id = NULL`; tenant-custom roles carry a
`business_id` (see [RBAC.md](./RBAC.md)). A membership's `role_id` must reference
either a system BUSINESS-scope role (`business_id IS NULL`) or a custom role of
the **same** `business_id` — enforced by guard and a DB check.

## 2. Packaging & modules

```
plans                id, name, tier, active
entitlements         id, key, name, description          # e.g. "catalog", "crm"
plan_entitlements    plan_id, entitlement_id
subscriptions        id, business_id, plan_id, status, started_at, renews_at
addon_entitlements   id, business_id, entitlement_id     # à-la-carte unlocks
module_states        id, business_id, module_id, enabled, enabled_at
```

A module is enable-able for a tenant when the tenant holds its
`requiredEntitlement` (via plan or add-on). Approving a business provisions a
default **Starter** `subscription`, so entitlements and `module_states` resolve
from day one.

## 3. Locations & branding

```
locations            id, business_id, name, code, address, phone, status
                     UNIQUE(business_id, code)
branding             id, business_id, primary_color, secondary_color,
                     font_family_heading, font_family_body, logo_url
```

## 4. Catalog (Offerings)

```
categories           id, business_id, name, slug, description, parent_id?, active
offerings            id, business_id, category_id?, type (PHYSICAL|VIRTUAL|SERVICE|…),
                     name, description, sku?, barcode?, price, cost?,
                     track_inventory, active, created_at, updated_at
                     tenant-scoped UNIQUE(business_id, sku), UNIQUE(business_id, barcode)
offering_variants    id, business_id, offering_id, name, sku?, barcode?,
                     price, cost?, attributes (jsonb), active
offering_media       id, business_id, offering_id, storage_key, sort_order, alt_text
```

Variant `attributes` is `jsonb`; match variants on a **sorted canonical key**,
never raw `JSON.stringify` (jsonb normalizes key order on write).

## 5. Sales channels

```
sales_channels       id, business_id, type (ONLINE_STORE|PHYSICAL|MARKETPLACE),
                     name, location_id?, fulfillment_location_id?, settings (jsonb), active
```

For `ONLINE_STORE`, `fulfillment_location_id` is **required** — it is the stock
source decremented by online orders. For `PHYSICAL`, `location_id` is its store.

## 6. Inventory

```
inventory_items      id, business_id, location_id, offering_id?, variant_id?,
                     quantity, low_stock_threshold
                     exactly one of offering_id / variant_id is the stockable item
                     UNIQUE(business_id, location_id, stockable_item)
inventory_movements  id, business_id, location_id, offering_id?, variant_id?,
                     movement_type, quantity_delta, reference_type, reference_id,
                     created_by, created_at
```

`movement_type`: `INITIAL_STOCK | SALE | RETURN | ADJUSTMENT | TRANSFER_IN |
TRANSFER_OUT`. **Every stock change creates a movement.**

Enforce the "exactly one of `offering_id`/`variant_id`" rule and the uniqueness
with a generated `(stockable_type, stockable_id)` pair (or two partial unique
indexes + a CHECK); "stockable_item" above is that pair, not a literal column.

## 7. Orders & money

See [ORDERS_AND_MONEY.md](./ORDERS_AND_MONEY.md) for full detail.

```
orders               id, business_id, channel_id, location_id?, customer_id?,
                     entry_mode (ONLINE|MANUAL), fulfillment_status, payment_status,
                     subtotal, discount, tax_amount, total, currency,
                     created_by?, created_at, updated_at
order_items          id, business_id, order_id, offering_id?, variant_id?,
                     name_snapshot, sku_snapshot, unit_price, quantity, discount, line_total
payments             id, business_id, order_id, method (CASH|BIT|…), amount, currency,
                     received_at, reference?, status
financial_entries    id, business_id, type (INCOME|EXPENSE), amount, currency, entry_date,
                     category?, channel_id?, method?, source_type?, source_id?, created_by
invoices             id, business_id, order_id, number, status, lines (jsonb),
                     tax_lines (jsonb), totals, currency, issued_at?    -- DORMANT
invoice_sequences    id, business_id, next_number                       -- DORMANT
```

Notes:
- `orders.customer_id` references the **core** `customers` table (§8), not a
  CRM-owned table.
- `discount` (order and item) is an integer **minor-unit amount** in the MVP
  (percentage discounts are post-MVP); `tax_amount` is a stored `0` placeholder
  (no tax engine in the MVP).
- `payments.currency` must equal `orders.currency`. `payments.status` is
  **per-payment** (`RECEIVED`; `REFUNDED` post-MVP); `orders.payment_status` is
  the **derived aggregate**.
- Refund states (`REFUNDED`, `PARTIALLY_REFUNDED`) and the `RETURN` movement
  exist in the enums but are **inert in the MVP** — no flow produces them
  (refunds are post-MVP; see [POST_MVP_CHANGES.md](./POST_MVP_CHANGES.md)).

## 8. Customers (core) & CRM

`customers` is a **core** table (always present) so Orders can reference it
without depending on the CRM module being enabled. The **CRM module** adds leads,
the pipeline and source analytics on top.

```
customers            id, business_id, name, email?, phone?, address?, source, created_at, updated_at
leads                id, business_id, name, contact, source, status, note?, converted_customer_id?
```

`source`: `ONLINE | MANUAL | WALK_IN | REFERRAL | WHATSAPP | …`. Lead `status`:
`NEW | CONTACTED | QUALIFIED | CONVERTED | LOST`. See [CRM.md](./CRM.md).

## 9. Project Management

```
projects             id, business_id, name, description?, status, owner_id?, created_at
tasks                id, business_id, project_id, title, description?, status, priority,
                     assignee_id?, due_date?, created_at, updated_at
```

Project `status`: `PLANNING | ACTIVE | ON_HOLD | COMPLETED | CANCELLED |
ARCHIVED`. Task `status`: `TODO | IN_PROGRESS | IN_REVIEW | DONE | BLOCKED |
CANCELLED`. See [PROJECT_MGMT.md](./PROJECT_MGMT.md).

## 10. Notifications

```
notification_templates  id, business_id?, channel (WHATSAPP|EMAIL), key, subject?, body, locale
notification_log        id, business_id, channel, template_key, to, status, payload (jsonb),
                        sent_at?, error?, created_at
```

## 11. AI

```
ai_settings          id, business_id, enabled, provider, model
ai_usage             id, business_id, user_id, feature, provider, model, tokens?, created_at
ai_audit             id, business_id, user_id, tool, input_summary, outcome, created_at
ai_prompts           id, key, version, template
```

Do not necessarily store full prompts/responses when they contain sensitive
business data. See [AI.md](./AI.md).

## 12. POS (infra only, no MVP UI)

```
pos_registers        id, business_id, location_id, name, status
pos_sessions         id, business_id, register_id, opened_by, opened_at, opening_cash,
                     closed_by?, closed_at?, closing_cash?, status (OPEN|CLOSED)
```

## 13. Audit

```
audit_logs           id, business_id?, actor_user_id?, actor_type, action,
                     entity_type, entity_id, metadata (jsonb), created_at
```

Platform events have `business_id = NULL`. Append-only from normal application
APIs. Never store passwords, tokens, or payment secrets in metadata.

---

## Indexes (minimum)

```
business_memberships(business_id, user_id)
offerings(business_id, sku)   offerings(business_id, barcode)   offerings(business_id, active)
categories(business_id, slug)
inventory_items(business_id, location_id)
inventory_movements(business_id, created_at)
customers(business_id, email)   customers(business_id, phone)
orders(business_id, created_at)  orders(business_id, channel_id)  orders(business_id, fulfillment_status)
payments(business_id, order_id)  payments(business_id, received_at)
financial_entries(business_id, entry_date)  financial_entries(business_id, channel_id)
tasks(business_id, project_id, status)
audit_logs(business_id, created_at)
```

Revisit with real query plans as data grows.
