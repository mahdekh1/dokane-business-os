# Security

Version: 2.0 · Date: 2026-09-13

This is the authority for tenant isolation and authorization. No implementation
may weaken these rules to make a feature or a test pass.

---

## 1. Tenancy

- **Business = tenant.** Every tenant-owned row carries `business_id`.
- Tenant context is **derived from the authenticated membership**, never from
  client input.

```
JWT/session → authenticated user → BusinessMembership → tenant context
            → authorized service → tenant-scoped query
```

- **NEVER** trust a `business_id` (or any tenant identifier) supplied in a
  request body, query string, or URL. A request such as
  `POST /products {business_id: "another-business"}` must not enable a
  cross-tenant write.
- Public mini-sites resolve the tenant from a **trusted slug/host mapping**, not
  from client-supplied IDs. See [MINISITE.md](./MINISITE.md).

## 2. Isolation layers

1. **Application authorization** — every service receives a tenant context;
   repositories scope every query by it. Services take a context object, not a
   raw id from the request.
2. **Database constraints** — foreign keys and tenant-aware relationships;
   tenant-scoped unique indexes (e.g. `(business_id, sku)`).
3. **Row-level security (optional)** — enforce tenant scoping at the database
   level where practical.
4. **Automated tests** — every tenant-owned module has A/B isolation tests.

## 3. Authorization

- Two layers, both required: **entitlement** (tenant may use the module) and
  **permission** (member may perform the action). See [RBAC.md](./RBAC.md),
  [MODULES.md](./MODULES.md).
- Backend authorization is mandatory; UI hiding is not a control.
- Reject unknown/dangerous fields in request bodies (guard against mass
  assignment). Validate every body against a Zod schema.

## 4. Business lifecycle enforcement

`PENDING_APPROVAL → CHANGES_REQUESTED → APPROVED → REJECTED → SUSPENDED`.

Suspension (and non-approved states) must prevent: creating/advancing orders,
recording payments, inventory changes, and business user management. Pending and
rejected businesses cannot transact.

## 5. Media / file storage

- Access through a **storage-driver abstraction**. MVP uses a **local-disk
  driver**; an **S3-compatible driver** is ready behind the same interface.
  Moving out is a config/driver change, not a rewrite.
- Storage keys are **generated server-side** and **tenant-scoped**. Never trust
  the client filename.
- Validate MIME type, extension and size on upload. Optionally re-encode images.
  Never accept executable uploads.
- Use signed/private URLs where appropriate. Serve media through a controlled
  endpoint.

## 6. AI security

- AI never accesses the database directly. It calls **tools**, each of which
  independently verifies authorization with the user's tenant + permission
  context. See [AI.md](./AI.md).
- Data minimization before any external provider call; never send another
  tenant's data, credentials, or payment secrets.

## 7. General controls

HTTPS · secure session/cookie configuration and expiration · password-reset
protection · rate limiting · CSRF protection where applicable · output encoding
(XSS) · parameterized queries (SQL injection) · secrets management (never
committed) · structured logs that never contain passwords/tokens/card
data/secrets · database backups with a tested restore.

## 8. Required tenant-isolation tests

Create Business A and Business B, each with users, offerings, inventory,
customers and orders. Every one of these must **fail**:

```
A → read B offering        A → update B offering       A → delete B offering
A → read B inventory       A → modify B inventory
A → read B customer        A → read B order
A → access B reports       A → administer B storefront
A → enable a module for B  A → record a payment on B's order
```

Attempt each with: changed URL IDs, manipulated request bodies, query
parameters, and direct API calls. Changing IDs or frontend manipulation must not
bypass isolation.

## 9. Audit

Security-sensitive and business-critical events are written to `audit_logs`
(append-only from normal APIs). Examples: business approval/suspension, user
create/disable, role change, offering create/update/delete, inventory
adjustment, order create/cancel, payment recorded, refund, module enabled, AI
tool invocation. Metadata never contains secrets.
