# Dokane Retail OS — Technical Specification
## Architecture, ERD, Database, APIs, Security & AI Foundation

Version: 1.0
Date: 2026-08-22

---

# 1. Executive Technical Decision

Dokane Retail OS should be built as a **multi-tenant SaaS application** with a modular monolith architecture for the MVP.

Recommended shape:

```text
                    Internet
                       |
                CDN / HTTPS / WAF
                       |
                 Web Application
                       |
                Application API
                       |
       +---------------+----------------+
       |               |                |
   PostgreSQL       Object Storage   Job Queue
       |                                |
       |                            Workers
       |
   Tenant Data
```

The MVP should NOT begin as microservices.

Use clear domain modules inside one application:

```text
auth
tenancy
businesses
rbac
locations
catalog
inventory
customers
orders
payments
pos
storefront
reporting
audit
ai
```

The architecture should make these modules separable later if scale requires it.

---

# 2. Recommended Technology Stack

## Frontend

Recommended:

- Next.js
- React
- TypeScript
- Tailwind CSS
- component library such as shadcn/ui
- React Hook Form
- Zod
- TanStack Query where useful

Why:

- strong ecosystem
- excellent fit for Lovable
- server/client rendering options
- good SEO for public storefronts
- TypeScript end-to-end
- easy RTL support

## Backend

Recommended:

- TypeScript
- Node.js
- NestJS OR a well-structured Next.js API layer for the earliest MVP

Preferred long-term choice:

**NestJS modular backend**

Reason:

The product is expected to become a serious business platform. Explicit modules, dependency injection, guards and domain boundaries will be valuable.

The frontend should not own business rules.

## Database

**PostgreSQL**

Strongly preferred.

Reasons:
- relational integrity
- transactions
- row-level security option
- mature indexing
- JSONB when useful
- reporting
- concurrency controls

## Authentication

For an early implementation, a managed authentication system such as Supabase Auth can reduce effort.

However:

Authentication and authorization must remain separate concepts.

Application authorization is owned by Dokane.

## Object Storage

S3-compatible object storage.

Used for:
- product images
- business logos
- future documents

Never store large images directly in PostgreSQL.

## Queue

Not mandatory for the first local prototype.

Production-ready architecture should allow:
- Redis
- BullMQ
- or equivalent

Used for:
- email
- image processing
- AI jobs
- future marketplace synchronization
- reports
- webhooks

## Deployment

Recommended initial shape:

```text
Vercel / equivalent
        |
Frontend

Cloud container platform
        |
NestJS API

Managed PostgreSQL
        |
Database

S3-compatible storage
        |
Images/files

Redis
        |
Background jobs
```

The exact providers can be selected later.

---

# 3. Architecture Style

Use a modular monolith.

```text
apps/
  web/
  api/
  worker/

packages/
  shared/
  ui/
  config/
```

Backend:

```text
api/src/
  modules/
    auth/
    tenancy/
    businesses/
    rbac/
    locations/
    catalog/
    inventory/
    customers/
    orders/
    payments/
    pos/
    storefront/
    reporting/
    audit/
    ai/
```

Each module should contain:

```text
controller
service
repository/data-access
domain types
validation
tests
```

Avoid direct database access from controllers.

---

# 4. System Boundaries

## Retail OS owns

- businesses
- users
- permissions
- products
- inventory
- customers
- POS
- online store
- orders
- payments
- reports

## Future Marketplace owns

- marketplace sellers/connections
- marketplace listings
- marketplace discovery
- marketplace checkout
- marketplace commissions
- marketplace orders
- marketplace customer experience

The Marketplace should consume/synchronize Retail OS data through an explicit connector/API.

Do not tightly couple the two databases.

---

# 5. Future Marketplace Integration

Future architecture:

```text
+----------------------+
|   Retail OS          |
|                      |
| Products             |
| Inventory            |
| Orders               |
| Business             |
+----------+-----------+
           |
       Connector/API
           |
+----------v-----------+
| Marketplace          |
|                      |
| Listings             |
| Search               |
| Marketplace Orders   |
| Commissions          |
+----------------------+
```

Retail OS remains the merchant's source of truth.

Future marketplace connection:

```text
MarketplaceConnection
MarketplaceListing
```

Do NOT create marketplace-specific columns throughout Product.

---

# 6. Tenancy Model

Core principle:

**Business = Tenant**

Every tenant-owned entity contains:

```text
tenant_id
```

Tenant-owned entities:

- locations
- categories
- products
- variants
- inventory
- customers
- orders
- payments
- storefront settings
- tenant audit records

Platform entities:

- platform admin users
- platform configuration
- platform audit records

---

# 7. Tenant Resolution

Never trust:

```text
tenant_id
```

from the frontend.

Instead:

```text
JWT/session
      |
Authenticated user
      |
BusinessMembership
      |
Tenant context
      |
Authorized service
      |
Database query
```

For public storefront:

```text
hostname/slug
      |
Storefront lookup
      |
Business
      |
Public catalog
```

---

# 8. Multi-Tenant Isolation Strategy

Use multiple layers.

## Layer 1 — Application authorization

Every service receives tenant context.

Example conceptual interface:

```text
ProductService.listProducts(tenantContext, filters)
```

Never:

```text
ProductService.listProducts(tenantIdFromRequest)
```

## Layer 2 — Database constraints

Foreign keys and tenant-aware relationships.

## Layer 3 — PostgreSQL RLS

If Supabase/PostgreSQL RLS is used, enforce tenant isolation at database level wherever practical.

## Layer 4 — Automated tests

Every tenant-owned module requires A/B isolation tests.

---

# 9. Database Schema

## users

```text
id UUID PK
email
first_name
last_name
phone
status
created_at
updated_at
```

## businesses

```text
id UUID PK
name
slug
business_type
phone
email
address_line1
address_line2
city
postal_code
country
currency
timezone
status
logo_url
created_at
updated_at
```

Statuses:

```text
PENDING_APPROVAL
CHANGES_REQUESTED
APPROVED
REJECTED
SUSPENDED
```

## business_memberships

```text
id UUID PK
business_id FK
user_id FK
role_id FK
status
created_at
updated_at
```

Unique:

```text
business_id + user_id
```

## roles

```text
id UUID PK
name
scope
description
```

Scope:

```text
PLATFORM
BUSINESS
```

## permissions

```text
id UUID PK
code
description
```

## role_permissions

```text
role_id FK
permission_id FK
```

Unique pair.

---

# 10. Locations

## locations

```text
id UUID PK
business_id FK
name
code
address
phone
status
created_at
updated_at
```

Unique:

```text
business_id + code
```

---

# 11. Catalog

## categories

```text
id UUID PK
business_id FK
name
slug
description
parent_id nullable
active
created_at
updated_at
```

## products

```text
id UUID PK
business_id FK
category_id nullable
name
description
sku
barcode
price
cost
track_inventory
active
created_at
updated_at
```

Tenant-scoped uniqueness:

```text
business_id + sku
business_id + barcode
```

## product_variants

```text
id UUID PK
business_id FK
product_id FK
name
sku
barcode
price
cost
active
created_at
updated_at
```

Important:

Even though Product already identifies a business, Variant should retain business_id if this materially simplifies tenant enforcement and query safety.

---

# 12. Product Images

## product_images

```text
id UUID PK
business_id FK
product_id FK
storage_key
url
sort_order
alt_text
created_at
```

Storage must be tenant-aware.

---

# 13. Inventory

## inventory_items

```text
id UUID PK
business_id FK
location_id FK
product_id nullable
variant_id nullable
quantity
low_stock_threshold
created_at
updated_at
```

Constraint:

Exactly one of:

```text
product_id
variant_id
```

should represent the stockable item.

Unique:

```text
business_id + location_id + stockable_item
```

## inventory_movements

```text
id UUID PK
business_id FK
location_id FK
product_id nullable
variant_id nullable
movement_type
quantity_delta
reference_type
reference_id
created_by
created_at
```

Movement types:

```text
INITIAL_STOCK
SALE
RETURN
ADJUSTMENT
TRANSFER_IN
TRANSFER_OUT
```

Every inventory change creates a movement.

---

# 14. Customers

## customers

```text
id UUID PK
business_id FK
name
email
phone
address
created_at
updated_at
```

No global customer identity in MVP.

---

# 15. Orders

## orders

```text
id UUID PK
business_id FK
location_id nullable
customer_id nullable
channel
status
subtotal
discount
tax_amount
total
currency
created_by nullable
created_at
updated_at
```

Channels:

```text
POS
ONLINE_STORE
```

Future:

```text
MARKETPLACE
```

Do not add marketplace-specific logic now.

Statuses:

```text
DRAFT
PENDING
PAID
COMPLETED
CANCELLED
REFUNDED
PARTIALLY_REFUNDED
```

## order_items

```text
id UUID PK
business_id FK
order_id FK
product_id nullable
variant_id nullable
product_name_snapshot
sku_snapshot
unit_price
quantity
discount
total
```

Store snapshots.

Historical orders should not change because a product name or price changed later.

---

# 16. Payments

## payments

```text
id UUID PK
business_id FK
order_id FK
method
provider nullable
external_transaction_id nullable
status
amount
currency
metadata JSONB
created_at
updated_at
```

Methods:

```text
CASH
CARD
OTHER
```

Statuses:

```text
PENDING
AUTHORIZED
CAPTURED
FAILED
REFUNDED
PARTIALLY_REFUNDED
```

Do not integrate a specific payment provider into the domain model.

---

# 17. POS

## pos_registers

```text
id UUID PK
business_id FK
location_id FK
name
status
created_at
```

## pos_sessions

```text
id UUID PK
business_id FK
register_id FK
opened_by
opened_at
opening_cash
closed_by nullable
closed_at nullable
closing_cash nullable
status
```

Statuses:

```text
OPEN
CLOSED
```

POS order links to a session where appropriate.

---

# 18. Storefront

## storefront_settings

```text
id UUID PK
business_id FK
slug
title
description
logo_url
published
created_at
updated_at
```

Business slug should be unique globally.

Future custom domains should use a separate mapping:

```text
storefront_domains
```

Do not put domain logic directly in Business.

---

# 19. Audit

## audit_logs

```text
id UUID PK
business_id nullable
actor_user_id nullable
actor_type
action
entity_type
entity_id
metadata JSONB
created_at
```

Platform events can have:

```text
business_id = NULL
```

Audit metadata must never contain:
- passwords
- tokens
- payment secrets
- full card information

---

# 20. ERD

```text
                         USERS
                           |
                           |
                 BUSINESS_MEMBERSHIPS
                           |
                           v
                       BUSINESS
                           |
          +----------------+----------------+
          |                |                |
          v                v                v
      LOCATIONS        CATEGORIES        CUSTOMERS
          |                |
          |                v
          |             PRODUCTS
          |                |
          |          PRODUCT_VARIANTS
          |                |
          +-------+--------+
                  |
                  v
             INVENTORY
                  |
                  v
         INVENTORY_MOVEMENTS


BUSINESS
   |
   +---- ORDERS
   |       |
   |       +---- ORDER_ITEMS
   |       |
   |       +---- PAYMENTS
   |
   +---- POS_REGISTERS
   |        |
   |        +---- POS_SESSIONS
   |
   +---- STOREFRONT_SETTINGS
   |
   +---- PRODUCT_IMAGES
   |
   +---- AUDIT_LOGS
```

---

# 21. Recommended Database Rules

Use:

- UUID primary keys
- foreign keys
- NOT NULL wherever possible
- CHECK constraints
- unique indexes
- tenant-aware indexes
- created_at/updated_at
- explicit enum-like status values

Never use:

- floating point for money
- hard deletion of historical orders
- arbitrary JSON for core business entities
- tenant IDs supplied by client
- database queries without tenant scope

---

# 22. Money Representation

Recommended:

```text
integer minor units
```

For ILS:

```text
599.90 ILS
→ 59990
```

Currency is stored separately.

This avoids floating-point errors.

---

# 23. API Architecture

Use REST for MVP.

Example:

```text
/api/v1/auth
/api/v1/business
/api/v1/users
/api/v1/locations
/api/v1/categories
/api/v1/products
/api/v1/inventory
/api/v1/customers
/api/v1/orders
/api/v1/payments
/api/v1/pos
/api/v1/storefront
/api/v1/reports
/api/v1/audit
/api/v1/ai
```

Platform:

```text
/api/v1/platform/businesses
/api/v1/platform/users
/api/v1/platform/audit
/api/v1/platform/reports
```

---

# 24. API Rules

Every protected request:

```text
Authentication
→ User
→ Membership
→ Permission
→ Tenant Context
→ Service
→ Database
```

Never:

```text
Frontend tenant_id
→ Database
```

Validate request bodies using a schema.

Reject unknown or dangerous fields.

---

# 25. Example Product API

```text
GET    /api/v1/products
POST   /api/v1/products
GET    /api/v1/products/:id
PATCH  /api/v1/products/:id
DELETE /api/v1/products/:id
```

Backend determines tenant from authenticated context.

---

# 26. Example Inventory API

```text
GET  /api/v1/inventory
POST /api/v1/inventory/adjustments
GET  /api/v1/inventory/movements
```

Adjustment:

```text
{
  stockable_item_id,
  location_id,
  quantity_delta,
  reason
}
```

Server derives:
- tenant
- actor
- current inventory
- movement

---

# 27. POS Checkout API

One critical endpoint:

```text
POST /api/v1/pos/checkout
```

Input:

```text
{
  location_id,
  session_id,
  customer_id,
  items,
  discount,
  payment
}
```

Server must:
1. authenticate
2. authorize
3. derive tenant
4. validate location
5. validate products
6. retrieve authoritative prices
7. check inventory
8. calculate totals
9. create order
10. create order items
11. create payment
12. decrement inventory
13. create movements
14. commit transaction

Client totals are never authoritative.

---

# 28. Idempotency

Critical write operations should support idempotency.

Especially:

```text
POS checkout
payment creation
future webhooks
```

Example:

```text
Idempotency-Key
```

Store the key with the result.

Repeated request returns the original result instead of creating a second sale.

---

# 29. Concurrency

Inventory must use transactional locking or an equivalent safe concurrency strategy.

Example:

Two cashiers attempt to sell the final item.

Only one succeeds.

The other receives:

```text
INSUFFICIENT_STOCK
```

Never allow:

```text
quantity = -1
```

unless a future explicit negative-inventory policy is introduced.

---

# 30. Frontend Architecture

```text
apps/web/

app/
  (auth)/
  (platform)/
  (tenant)/
  store/
```

Tenant application:

```text
dashboard
products
categories
inventory
customers
orders
pos
reports
storefront
settings
```

Platform:

```text
admin/dashboard
admin/businesses
admin/users
admin/audit
```

Public:

```text
store/[slug]
store/[slug]/product/[id]
store/[slug]/cart
store/[slug]/checkout
```

---

# 31. UI Component Strategy

Shared components:

```text
Button
Input
Select
Modal
Table
DataTable
Form
Pagination
EmptyState
LoadingState
ErrorState
ConfirmDialog
MoneyDisplay
StatusBadge
```

Business components:

```text
ProductForm
InventoryAdjustment
OrderSummary
POSCart
POSProductSearch
CheckoutDialog
```

Do not duplicate common components.

---

# 32. RTL

RTL must be built into the UI architecture.

Support:

```text
en
he
ar
```

Use translation keys.

Do not hardcode English strings.

Avoid assuming:

```text
margin-left
```

Prefer logical CSS:

```text
margin-inline-start
padding-inline-end
```

Test Hebrew and Arabic layouts.

---

# 33. Storefront Architecture

The storefront is public.

It must never have direct database access.

```text
Public request
→ slug/domain resolver
→ Business
→ published storefront
→ public catalog service
```

Only expose fields appropriate for public customers.

Never expose:
- cost
- internal inventory metadata
- tenant IDs
- internal audit data

---

# 34. POS Hardware Architecture

MVP:

Barcode scanners:

Treat common USB/Bluetooth scanners as keyboard input.

Printer abstraction:

```text
ReceiptPrinter
  print(receipt)
```

Future adapters:

```text
BrowserPrinterAdapter
LocalAgentPrinterAdapter
ESC_POSAdapter
VendorSpecificAdapter
```

Cash drawer:

```text
CashDrawer
  open()
```

Payment terminal:

```text
PaymentProvider
  authorize()
  capture()
  refund()
```

Domain code must depend on interfaces, not vendor SDKs.

---

# 35. Background Worker Architecture

Worker responsibilities:

```text
Email
Image processing
AI jobs
Future marketplace synchronization
Webhook processing
Reports
```

Example:

```text
API
 |
Queue
 |
Worker
 |
Service
```

Do not perform slow external operations inside critical checkout transactions.

---

# 36. AI Architecture

AI must be a separate capability layer.

```text
User
 |
AI Assistant
 |
AI Gateway
 |
Tool Registry
 |
Authorized Application Services
 |
Database
```

Never:

```text
AI → SQL
```

Tools:

```text
get_sales_summary
get_inventory_summary
search_products
get_order_summary
```

Future write tools:

```text
draft_product
suggest_inventory_adjustment
create_purchase_order
```

These require explicit permission and confirmation.

---

# 37. AI Tool Contract

Every tool receives:

```text
user_id
tenant_id
permissions
input
```

The tool independently verifies authorization.

AI should not be trusted to enforce permissions.

Example:

```text
Tool:
get_sales_summary

Requires:
reports.view
```

---

# 38. AI Data Protection

Before sending data to an AI provider:

- minimize data
- aggregate where possible
- remove unnecessary PII
- never send credentials
- never send payment secrets
- never send another tenant's data

Store:

```text
AI usage
AI feature
model
provider
tenant
user
timestamp
```

Do not necessarily store full prompts/responses if they contain sensitive business information.

---

# 39. Security Architecture

Required controls:

- HTTPS
- secure authentication
- session expiration
- password reset protection
- rate limiting
- authorization middleware
- tenant isolation
- input validation
- output encoding
- CSRF protection where applicable
- XSS protection
- SQL injection prevention
- file upload validation
- object storage access controls
- audit logging
- secrets management
- database backups

---

# 40. Admin Security

Platform Admin is highly privileged.

Recommended future controls:

- MFA
- restricted admin endpoints
- admin audit
- support impersonation only through explicit audited mode
- no silent tenant modification

Platform Admin should not automatically inherit all business permissions.

---

# 41. File Upload Security

Product images:

- validate MIME type
- validate extension
- limit size
- generate storage key server-side
- do not trust filename
- optionally resize/re-encode
- use signed/private URLs where appropriate

Never allow arbitrary executable uploads.

---

# 42. Testing Strategy

Four layers.

## Unit

Test:
- pricing
- permissions
- inventory
- order calculations
- status transitions

## Integration

Test:
- API + database
- tenant isolation
- transactions
- RBAC

## E2E

Test:
- signup
- approval
- product creation
- inventory
- POS
- storefront
- checkout

## Security

Explicitly attack:
- IDOR
- tenant switching
- privilege escalation
- mass assignment
- price manipulation
- order manipulation
- inventory manipulation

---

# 43. Required Tenant Isolation Tests

Create:

```text
Business A
Business B
```

Then attempt:

```text
A → read B product
A → update B product
A → delete B product
A → read B customer
A → read B order
A → modify B inventory
A → access B report
A → use B storefront administration
```

Every test must fail.

Also test with:
- changed URL IDs
- manipulated request bodies
- query parameters
- direct API calls

---

# 44. Environment Strategy

## Local

```text
.env.local
```

Local database.

Seed:
- platform admin
- Business A
- Business B
- sample products

## Staging

Production-like infrastructure.

Use fake/test data.

## Production

Separate:
- database
- storage
- secrets
- domain
- monitoring

Never share production database with development.

---

# 45. Environment Variables

Example:

```text
DATABASE_URL
AUTH_SECRET
STORAGE_ENDPOINT
STORAGE_BUCKET
STORAGE_ACCESS_KEY
STORAGE_SECRET_KEY

REDIS_URL

EMAIL_PROVIDER
EMAIL_API_KEY

AI_PROVIDER
AI_API_KEY
AI_MODEL

APP_URL
STOREFRONT_BASE_DOMAIN
```

Never commit real secrets.

Provide:

```text
.env.example
```

---

# 46. CI/CD

Pipeline:

```text
Pull Request
   |
Lint
   |
Typecheck
   |
Unit Tests
   |
Integration Tests
   |
Security Checks
   |
Build
   |
Deploy Staging
   |
E2E
   |
Production
```

Database migrations must be version-controlled.

---

# 47. Observability

Monitor:

- API latency
- errors
- database latency
- failed authentication
- failed checkout
- inventory conflicts
- background job failures
- payment failures
- AI failures

Use structured logs.

Include:

```text
request_id
user_id where appropriate
tenant_id where appropriate
operation
duration
status
```

Never log:
- passwords
- tokens
- payment card data
- secrets

---

# 48. Database Indexes

At minimum:

```text
business_memberships(business_id, user_id)

products(business_id, sku)
products(business_id, barcode)
products(business_id, active)

categories(business_id, slug)

inventory_items(business_id, location_id)

inventory_movements(business_id, created_at)

customers(business_id, email)
customers(business_id, phone)

orders(business_id, created_at)
orders(business_id, status)
orders(business_id, channel)

payments(business_id, created_at)

audit_logs(business_id, created_at)
```

Review indexes using real query plans once data grows.

---

# 49. Soft Deletion

Use active/status fields for most business entities.

Prefer deactivation over physical deletion when historical references exist.

Examples:

```text
Product.active = false
User.status = DISABLED
Location.status = INACTIVE
```

Orders should not be deleted.

Audit logs should not be deleted by normal application users.

---

# 50. Business Lifecycle Rules

```text
PENDING_APPROVAL
      |
      +---- REJECTED
      |
      +---- CHANGES_REQUESTED
      |
      v
APPROVED
      |
      v
SUSPENDED
```

Suspension should prevent:
- POS transactions
- online checkout
- inventory changes
- business user management

Read-only access can be decided separately.

---

# 51. RBAC

Initial roles:

## Platform

PLATFORM_ADMIN

## Business

OWNER
MANAGER
INVENTORY_MANAGER
CASHIER

Permissions:

```text
business.view
business.update

users.view
users.create
users.update
users.disable
users.invite

locations.view
locations.create
locations.update
locations.disable

categories.view
categories.create
categories.update
categories.delete

products.view
products.create
products.update
products.delete

inventory.view
inventory.adjust

customers.view
customers.create
customers.update
customers.delete

orders.view
orders.create
orders.cancel
orders.refund

payments.view
payments.create

pos.use
pos.open_session
pos.close_session

reports.view
storefront.manage

platform.businesses.view
platform.businesses.approve
platform.businesses.reject
platform.businesses.suspend
platform.audit.view
```

Roles map to permissions.

Do not hardcode role names throughout the application.

---

# 52. API Authorization Example

```text
POST /products

Authentication
      |
Authenticated user?
      |
Membership?
      |
Business active?
      |
products.create?
      |
Create product using membership.business_id
```

No frontend-supplied tenant ID.

---

# 53. Business Onboarding Architecture

```text
Signup
 |
Create User
 |
Create Business
 |
Create Owner Membership
 |
PENDING_APPROVAL
 |
Admin Review
 |
APPROVED
 |
Onboarding Wizard
 |
Location
 |
Products
 |
Inventory
 |
Storefront
 |
Ready
```

---

# 54. MVP Implementation Order

Do not parallelize everything.

## Phase 0

Architecture
- PRD
- technical specification
- ERD
- API conventions
- security model

## Phase 1

Foundation
- repository
- environments
- database
- auth
- tenancy
- RBAC

## Phase 2

Business workflow
- onboarding
- platform admin
- approval

## Phase 3

Catalog
- categories
- products
- variants
- images

## Phase 4

Inventory

## Phase 5

Customers
- orders
- payments

## Phase 6

POS

## Phase 7

Storefront

## Phase 8

Reporting
- audit

## Phase 9

AI foundation

## Phase 10

Security
- E2E
- load/concurrency
- deployment

---

# 55. Master Prompt #0 — Claude

Use this before implementation.

```text
You are the principal software architect for Dokane Retail OS.

The repository will contain two authoritative documents:

1. PRD / MVP Master Plan
2. Technical Specification

Do NOT implement product features yet.

Your job is to prepare the engineering architecture.

Review both documents and produce:

1. Repository structure
2. Application architecture
3. Database schema
4. ERD
5. Multi-tenant isolation model
6. Authentication model
7. RBAC model
8. API module structure
9. Frontend structure
10. POS transaction architecture
11. Storefront architecture
12. Background jobs
13. AI architecture
14. Security architecture
15. Testing architecture
16. Environment strategy

Critical constraints:

- Business is the tenant.
- Tenant ID must never be trusted from frontend input.
- Platform Admin is global.
- Tenant users operate only within their memberships.
- Authorization must happen server-side.
- PostgreSQL is the primary database.
- POS checkout must be transactional.
- Inventory changes must create inventory movements.
- Money must not use floating point.
- Orders preserve product/price snapshots.
- Marketplace is NOT part of MVP.
- The architecture must anticipate a future separate Marketplace application.
- AI must never access the database directly.
- AI tools must execute with authenticated user, tenant and permission context.

Before writing implementation code:

1. Identify ambiguities.
2. Identify dangerous assumptions.
3. Identify missing constraints.
4. Produce the proposed schema.
5. Produce the module dependency graph.
6. Produce the authorization flow.
7. Produce the transaction boundaries.
8. Produce the testing strategy.

Do not silently change the product requirements.

If a requirement is ambiguous, document the ambiguity and recommend the safest option.
```

---

# 56. Master Prompt #0 — Lovable

After Claude approves the architecture:

```text
We are implementing Dokane Retail OS according to the attached PRD and Technical Specification.

Do not redesign the architecture.

Do not invent features.

Do not implement Marketplace.

Do not implement accounting.

Do not implement advanced ERP features.

Build only Phase 1:

1. Application shell
2. Authentication
3. Business/Tenant model
4. Business memberships
5. Roles
6. Permissions
7. Platform Admin
8. Tenant dashboard
9. Tenant-aware routing
10. Initial database migrations
11. Seed data
12. Basic audit foundation

Create two demo businesses:

Business A
Business B

Create separate users for each.

The system must prove that users from Business A cannot access Business B data.

Use server-side authorization.

Never trust tenant_id from the frontend.

Before implementation, inspect the existing repository and preserve the established architecture.

At the end:
- run tests
- report files changed
- report migrations
- report known limitations
- do not proceed to catalog/inventory/POS.
```

---

# 57. Master Prompt #0 — Codex

After Lovable implementation:

```text
Act as a senior backend/security engineer.

Review the current Dokane Retail OS repository against the PRD and Technical Specification.

Do not add product features.

Focus on:

1. Multi-tenancy
2. Authentication
3. Authorization
4. RBAC
5. Database constraints
6. Tenant isolation
7. Platform Admin separation
8. Auditability
9. Tests

Create Tenant A and Tenant B test scenarios.

Attempt:
- IDOR
- manipulated tenant IDs
- URL ID substitution
- mass assignment
- privilege escalation
- direct API access
- unauthorized platform access

Fix critical and high severity issues.

Add automated regression tests.

Do not weaken security to make tests pass.

At the end provide:
- issues found
- fixes
- tests added
- remaining risks
```

---

# 58. Definition of Technical Readiness

Do not start catalog implementation until all are true:

```text
[ ] Auth works
[ ] Business creation works
[ ] Memberships work
[ ] RBAC works
[ ] Platform Admin works
[ ] Tenant isolation tested
[ ] Database constraints exist
[ ] API authorization exists
[ ] Audit foundation exists
[ ] CI runs
[ ] Tests run
[ ] Local setup documented
```

---

# 59. What NOT to Let AI Coding Agents Do

Do not allow an agent to casually:

- remove tenant_id
- disable RLS
- move authorization to frontend
- expose internal database IDs unnecessarily
- trust client prices
- trust client totals
- bypass transactions
- directly mutate inventory
- delete historical orders
- connect AI directly to SQL
- add marketplace logic to Product
- hardcode one payment provider
- hardcode one printer
- hardcode Hebrew strings
- create a giant generic "settings" JSON blob
- create microservices prematurely

---

# 60. Future Evolution

When the MVP is validated:

```text
                 Dokane Platform
                       |
          +------------+------------+
          |                         |
      Retail OS                Marketplace
          |                         |
       Business                 Consumers
          |
   +------+------+------+
   |      |      |      |
  POS  Online  Future  ...
       Store   Channels
```

Potential future modules:

```text
Purchasing
Advanced Inventory
Accounting Integration
Payments
Shipping
CRM
Loyalty
AI Assistant
Marketplace Connector
```

Only build based on actual merchant demand.

---

# 61. Final Architecture Principle

The most important architectural decision is:

> Build Dokane as a strong Retail OS first, while treating POS, Online Store and future Marketplace as sales channels around a common merchant/product/inventory/order foundation.

Do not build a marketplace first.

Do not build an ERP first.

Build the smallest system that lets a real retailer:

```text
Register
→ Get Approved
→ Configure Store
→ Add Products
→ Add Inventory
→ Sell at POS
→ Sell Online
→ Track Sales
```

If merchants repeatedly use those workflows, expand the platform around them.

