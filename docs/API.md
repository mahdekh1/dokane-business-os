# API

Version: 2.0 · Date: 2026-09-13

REST for the MVP. Conventions below apply to every module; each module owns its
route group under `/api/v1/<module>`.

---

## 1. Authorization flow (every protected request)

```
Authentication → User → Membership → Business active? →
Module entitled? → Permission? → Tenant context → Service → Database
```

- Tenant is derived from the authenticated membership — **never** from a
  frontend-supplied `business_id`.
- Request bodies are validated against Zod schemas from `packages/contracts`.
  Unknown/dangerous fields are rejected (mass-assignment guard).
- Client-supplied prices/totals are never authoritative; the server computes
  them.

## 2. Route surface

```
# Core / platform
/api/v1/auth
/api/v1/business
/api/v1/users
/api/v1/roles
/api/v1/locations
/api/v1/modules            # registry + enable/disable
/api/v1/billing
/api/v1/platform/businesses
/api/v1/platform/users
/api/v1/platform/audit

# Business modules
/api/v1/catalog            # categories, offerings, variants, media
/api/v1/inventory          # items, adjustments, movements
/api/v1/channels
/api/v1/orders
/api/v1/payments
/api/v1/accounting         # financial entries, reports
/api/v1/customers          # CRM customers
/api/v1/leads              # CRM leads
/api/v1/projects           # + tasks
/api/v1/storefront         # mini-site content, theme, SEO
/api/v1/notifications
/api/v1/reports
/api/v1/ai                 # agent, tools
/api/v1/audit

# Public (mini-site) — tenant resolved by slug/host, no auth
/api/v1/public/store/:slug
/api/v1/public/store/:slug/offering/:id
/api/v1/public/media/*
```

## 3. Resource conventions

```
GET    /api/v1/catalog/offerings
POST   /api/v1/catalog/offerings
GET    /api/v1/catalog/offerings/:id
PATCH  /api/v1/catalog/offerings/:id
DELETE /api/v1/catalog/offerings/:id     # soft delete / deactivate
```

- List endpoints paginate and filter server-side; never load all rows to the
  client.
- IDs are UUIDs; internal sequence numbers are not exposed unnecessarily.

## 4. Orders & payments

- `POST /api/v1/orders` creates a manual or online order (`entry_mode`); the
  server validates offerings, retrieves authoritative prices, checks inventory,
  computes totals, and applies the allowed initial status.
- `POST /api/v1/orders/:id/payments` records a payment (supports **partial**);
  payment status is re-derived and a `payment.received` event is emitted.
- `POST /api/v1/orders/:id/transitions` advances fulfillment within the
  channel-aware allowed-transition map.
- Invoice endpoint exists but is **dormant** (see
  [ORDERS_AND_MONEY.md](./ORDERS_AND_MONEY.md) §8).

## 5. Idempotency

Critical writes accept an `Idempotency-Key` header — order creation, payment
recording, and future webhooks. The key is stored with the result; a repeated
request returns the original result instead of creating a duplicate.

## 6. Errors

Consistent error shape with a machine code and message, e.g.
`INSUFFICIENT_STOCK`, `NOT_ENTITLED`, `FORBIDDEN`, `VALIDATION_ERROR`. Never leak
another tenant's existence via error differences.

## 7. Media

Product/offering media: multipart `POST /api/v1/catalog/offerings/:id/media`,
served via `/api/v1/public/media/*`. Storage is behind the storage-driver
abstraction (local disk for MVP, S3-ready). See [SECURITY.md](./SECURITY.md) §5.
