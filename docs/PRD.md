# Dokane Retail OS — MVP Master Implementation Plan

Version: 1.0
Date: 2026-08-22

## 0. Purpose

This document is the single source of truth for bringing the Dokane Retail OS MVP from zero to a usable, secure, multi-tenant SaaS.

The product is a Retail Operating System for small retail businesses, initially focused on Israel.

The MVP is NOT:
- an ERP replacement
- a Shopify replacement
- a marketplace
- an accounting system
- a generic business-management suite

The MVP proves one core proposition:

> A small retail business can manage products, inventory, customers and sales through POS and a basic online storefront from one simple system, while the platform operator safely manages all businesses without tenant data leakage.

The future marketplace is architecturally anticipated but is NOT implemented in the MVP.

The platform must also be designed from day one to support AI features safely and incrementally.

---

# 1. Product Strategy

## 1.1 Positioning

Recommended positioning:

> Dokane — everything your retail business needs to sell, in one place.

Longer-term:

> Run your store. Sell online. Reach more customers.

The initial target is small product-based retailers, especially businesses with one to several physical locations and some online sales.

Examples:
- clothing
- shoes
- cosmetics
- gifts
- home goods
- accessories
- specialty retail

## 1.2 Competitive strategy

Do not compete with Odoo on breadth.
Do not compete with Shopify on ecommerce breadth.
Do not compete with Square/Lightspeed purely on POS.

The opportunity is:

> A simple, localized retail operating system combining POS + inventory + customers + online store + business operations, with a future marketplace that can become a distribution advantage.

## 1.3 MVP hypothesis

The MVP should test whether merchants value replacing a collection of disconnected systems with one simple system.

Typical existing stack may include:
- POS
- Shopify/Wix
- accounting/invoicing software
- spreadsheets
- payment provider
- WhatsApp/Instagram
- manual inventory reconciliation

The product should make the core retail workflow dramatically simpler.

---

# 2. Scope

## 2.1 MVP features

### Authentication
- signup
- login
- logout
- password reset
- email verification where supported
- session management

### Business onboarding
- business registration
- business profile
- approval workflow
- onboarding checklist

### Multi-tenancy
- strict tenant isolation
- tenant memberships
- roles
- permissions

### Platform administration
- platform dashboard
- business applications
- approve/reject/request changes
- suspend/reactivate
- platform statistics
- audit logs

### Business administration
- business profile
- users
- invitations
- roles
- locations

### Catalog
- categories
- products
- variants
- SKU
- barcode
- price
- cost
- images
- active/inactive
- inventory tracking

### Inventory
- stock by location
- initial stock
- stock adjustment
- stock movement history
- low-stock threshold
- low-stock dashboard

### Customers
- tenant-specific customer CRUD

### Orders
- POS orders
- online orders
- order history
- cancellation
- basic refund/return model

### Payments
- cash
- card/manual
- other/manual
- payment records
- provider abstraction for future integrations

### POS
- select location
- cashier session
- product search
- barcode scanner input
- cart
- quantity
- customer
- discount
- payment
- complete sale
- receipt/order confirmation
- register close

### Online storefront
- business public URL
- business information
- product catalog
- product details
- cart
- checkout
- online order creation

### Dashboard/reporting
- today's sales
- today's orders
- product count
- low stock
- sales by channel
- recent orders
- best-selling products

### Audit
- security-sensitive and business-critical events

---

# 3. Explicitly Out of MVP

Do NOT implement:
- marketplace
- marketplace connector
- marketplace commissions
- marketplace checkout
- marketplace seller accounts
- CRM
- HR
- payroll
- manufacturing
- advanced procurement
- advanced warehouse management
- loyalty
- subscriptions
- marketing automation
- AI chatbot as a core feature
- complex website builder
- native mobile apps
- complex shipping engine
- full accounting
- full tax engine
- multi-country tax support
- direct integrations with every payment provider
- custom domain automation
- printer-specific drivers

AI is an architectural capability in MVP, not a reason to expand scope.

---

# 4. Users and Roles

## 4.1 Platform Admin

Global scope.

Can:
- view businesses
- review applications
- approve/reject/request changes
- suspend/reactivate
- view platform statistics
- view platform audit logs
- manage platform configuration

Platform Admin must not casually modify tenant data. Any tenant support access must be explicit and auditable.

## 4.2 Business Owner

Tenant scope.

Can:
- manage business
- manage users
- manage locations
- manage products
- manage inventory
- manage customers
- manage orders
- use POS
- manage storefront
- view reports

## 4.3 Business Manager

Can:
- products
- inventory
- customers
- orders
- POS
- reports

Cannot:
- transfer ownership
- manage sensitive platform/business administration

## 4.4 Inventory Manager

Can:
- view products
- update products as permitted
- manage inventory
- perform stock adjustments
- view movement history

Cannot:
- manage users
- perform platform operations

## 4.5 Cashier

Can:
- use POS
- view products
- create/select customers
- create orders
- perform permitted checkout/refund actions

Cannot:
- edit product cost
- manually modify inventory
- manage users
- view sensitive reports

---

# 5. Permission Model

Do not scatter role checks throughout the code.

Use permissions.

Example permissions:

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

Platform:
platform.businesses.view
platform.businesses.approve
platform.businesses.reject
platform.businesses.suspend
platform.users.view
platform.audit.view

UI hiding is never a security control. Backend authorization is mandatory.

---

# 6. Multi-Tenant Security Model

The Business is the tenant.

Conceptually:

Business
- Users/Memberships
- Locations
- Categories
- Products
- Inventory
- Customers
- Orders
- Payments
- Storefront

Every tenant-owned entity must have a strong relationship to Business/Tenant.

Preferred database model:
- tenant_id on tenant-owned records
- foreign keys
- indexes on tenant_id
- Row Level Security if using PostgreSQL/Supabase
- server-side tenant resolution from authenticated membership

NEVER trust tenant_id supplied by frontend input.

A request like:
POST /products
{
  tenant_id: "another-business"
}
must not allow cross-tenant writes.

Tenant context must be derived from authentication.

Platform Admin is global and normally has no tenant_id.

Business users have tenant membership.

---

# 7. Tenant Isolation Test

Create at least:

Tenant A: ABC Shoes
Tenant B: Fashion Store

Each has:
- users
- products
- customers
- inventory
- orders

Tests must prove:
- A cannot read B products
- A cannot update B products
- A cannot delete B products
- A cannot read B inventory
- A cannot update B inventory
- A cannot read B customers
- A cannot read B orders
- A cannot access B reports
- changing IDs does not bypass isolation
- query parameters do not bypass isolation
- frontend manipulation does not bypass isolation

---

# 8. Business Lifecycle

Use explicit status values:

PENDING_APPROVAL
CHANGES_REQUESTED
APPROVED
REJECTED
SUSPENDED

Primary flow:

REGISTER
→ CREATE BUSINESS
→ PENDING_APPROVAL
→ PLATFORM REVIEW
→ APPROVED
→ ACTIVE/usable

Rejected businesses can be resubmitted according to the eventual product policy.

Suspended businesses cannot transact.

Do not model lifecycle using multiple conflicting booleans.

---

# 9. Onboarding Flow

## Step 1 — Account

User:
- first name
- last name
- email
- password
- phone

## Step 2 — Business

- business name
- business type
- phone
- email
- address
- country
- currency
- timezone

Israel defaults:
- country: Israel
- currency: ILS
- timezone: Asia/Jerusalem

These are defaults, not hard-coded business rules.

## Step 3 — Approval

Business starts PENDING_APPROVAL.

Owner sees:
"Your business registration has been submitted and is waiting for approval."

## Step 4 — Admin review

Admin can:
- approve
- reject
- request changes

## Step 5 — Setup wizard

After approval:

1. Business information
2. Create first location
3. Add/import products
4. Add inventory
5. Configure storefront
6. Ready to sell

Show progress.

---

# 10. Core User Flows

## Flow A — Registration

Signup
→ account
→ business
→ pending approval

## Flow B — Approval

Platform Admin
→ pending applications
→ review
→ approve/reject/request changes

## Flow C — Initial Setup

Owner
→ location
→ categories
→ products
→ inventory
→ storefront

## Flow D — POS Sale

Cashier
→ select location
→ open register
→ scan/search product
→ cart
→ customer optional
→ discount optional
→ payment
→ order
→ inventory decrement
→ inventory movements
→ payment record
→ receipt

## Flow E — Online Sale

Customer
→ storefront
→ product
→ cart
→ checkout
→ online order
→ inventory decrement
→ customer record

## Flow F — Management

Owner/Manager
→ products
→ inventory
→ customers
→ orders
→ reports

## Flow G — Platform

Admin
→ businesses
→ approvals
→ users
→ statistics
→ audit

---

# 11. Data Model

Initial entities:

User
Business
BusinessMembership
Role
Permission
RolePermission

Location

Category
Product
ProductVariant
ProductImage

InventoryItem
InventoryMovement

Customer

Order
OrderItem
Payment

Storefront
StorefrontSettings

AuditLog

Future architectural entities, not MVP:
SalesChannel
MarketplaceConnection
MarketplaceListing
MarketplaceOrder

## Product

Fields:
- id
- tenant_id
- name
- description
- category_id
- sku
- barcode
- price
- cost
- track_inventory
- active
- created_at
- updated_at

## ProductVariant

- id
- product_id
- sku
- barcode
- name
- price
- cost
- active

Do not build an overly complex product-option engine.

SKU/barcode uniqueness should be tenant-scoped.

## InventoryItem

- tenant_id
- location_id
- product_id or product_variant_id
- quantity
- low_stock_threshold

## InventoryMovement

- tenant_id
- location_id
- product/product_variant
- movement_type
- quantity
- reference_type
- reference_id
- created_by
- created_at

Types:
INITIAL_STOCK
SALE
RETURN
ADJUSTMENT
TRANSFER_IN
TRANSFER_OUT

Every stock change must create a movement.

## Order

- tenant_id
- location_id where relevant
- customer_id
- channel
- status
- subtotal
- discount
- tax_placeholder
- total
- created_by
- created_at

Channels:
POS
ONLINE_STORE

Important: reserve the concept of MARKETPLACE for later.

## Payment

Create a provider-independent abstraction.

Methods:
CASH
CARD
OTHER

Fields should allow future:
- provider
- external transaction ID
- status
- amount
- currency
- metadata

---

# 12. Transactional Integrity

POS checkout is critical.

Conceptually:

BEGIN TRANSACTION

create order
create order items
create payment
decrease inventory
create inventory movements

COMMIT

Failure must roll back the transaction.

Avoid:
- payment without order
- order without inventory update
- inventory update without movement

Use idempotency for operations that can be retried.

Prevent overselling when inventory tracking is enabled.

---

# 13. POS and Hardware Strategy

MVP should be hardware-ready, not hardware-complete.

Barcode scanners:
- most USB/Bluetooth scanners emulate keyboard input
- support fast barcode entry

Printers:
- define receipt/printer abstraction
- do not build every printer driver in MVP

Cash drawers:
- future hardware adapter

Payment terminals:
- provider abstraction
- integrate selected providers later

Architecture:

POS
→ Receipt/Device abstraction
→ provider/device adapter

Do not tie the domain model directly to one hardware vendor.

---

# 14. Online Store

Every approved active business gets a public URL such as:

business-slug.dokane.com

Storefront:
- logo
- business name
- categories
- products
- product details
- variants
- price
- availability
- cart
- checkout

The storefront resolves the tenant from a controlled slug/hostname mapping.

Never accept arbitrary tenant IDs from customers.

Custom domains are future functionality.

---

# 15. Customer Model

Customers are tenant-specific.

A customer can have separate customer records in different businesses.

Fields:
- tenant_id
- name
- email
- phone
- address
- created_at
- updated_at

Do not create a global consumer identity system in MVP.

---

# 16. Reporting

Business dashboard:
- today's sales
- today's orders
- products
- low-stock products
- sales by channel
- recent orders
- best sellers

Platform dashboard:
- total businesses
- pending businesses
- active businesses
- suspended businesses
- total users
- total products
- total orders

Reports must be tenant-scoped.

Use database aggregation, pagination and indexes rather than loading all records into the browser.

---

# 17. Audit Logging

AuditLog:
- actor_id
- actor_type
- tenant_id
- action
- entity_type
- entity_id
- metadata
- created_at

Examples:
BUSINESS_APPROVED
BUSINESS_REJECTED
BUSINESS_SUSPENDED
USER_CREATED
USER_DISABLED
ROLE_CHANGED
PRODUCT_CREATED
PRODUCT_UPDATED
PRODUCT_DELETED
INVENTORY_ADJUSTED
ORDER_CREATED
ORDER_CANCELLED
REFUND_CREATED

Application-level audit logs should be append-only.

---

# 18. AI-Readiness

AI is a platform capability, not an MVP feature explosion.

The architecture should allow AI to add value later without giving an AI agent uncontrolled access to production data.

## 18.1 AI principles

AI must:
- respect tenant isolation
- respect user permissions
- have explicit tool scopes
- have auditable actions
- distinguish read vs write operations
- require confirmation for destructive/financial actions
- never bypass normal authorization
- never receive data from another tenant
- support provider abstraction
- support disabling AI per tenant

## 18.2 AI architecture

Recommended abstraction:

AI Assistant
→ AI Gateway
→ Tool/Capability Layer
→ existing authorized application services

Do NOT allow:
AI
→ raw database

Instead:

AI
→ tool: search_products
→ tool: get_inventory
→ tool: get_sales_summary
→ tool: create_draft_product
→ tool: suggest_reorder
→ tool: explain_sales

Every tool receives authenticated tenant/user context.

## 18.3 Future AI features

Potential high-value features:
- natural-language sales reports
- "Which products are running low?"
- "What sold best last week?"
- reorder suggestions
- product description generation
- category suggestions
- product data cleanup
- anomaly detection
- sales trend explanations
- customer/order assistance
- storefront content generation
- smart product search
- demand forecasting
- pricing recommendations

Do not implement all of these in MVP.

## 18.4 MVP AI foundation

Implement:
- AI provider interface
- AI configuration
- feature flags
- AI audit events
- tool registry abstraction
- permission checks
- tenant context
- prompt/version storage
- usage tracking abstraction
- safe structured output handling

Optionally implement one low-risk demo:
"Explain my sales today"

It should be read-only.

---

# 19. AI Data Privacy

Never send unnecessary tenant data to an external model.

Use:
- minimal context
- aggregation where possible
- redaction
- explicit provider configuration
- tenant-level AI opt-out
- audit trail

Do not assume an AI provider is allowed to retain or train on merchant data.

Provider policies and contracts must be evaluated before production use.

---

# 20. Israel Considerations

The initial product is Israel-first.

Potential areas:
- Hebrew
- RTL
- ILS
- Asia/Jerusalem timezone
- Israeli payment providers
- invoices/receipts
- tax/VAT
- accounting integrations

Do NOT pretend MVP is a compliant Israeli accounting system until the regulatory work is explicitly completed.

If Dokane itself becomes a computerized accounting system issuing regulated accounting documents, investigate the Israeli Tax Authority requirements and software registration/uniform-file process with an Israeli CPA/tax specialist and legal/compliance advisor.

Prefer initially:
- payment abstraction
- accounting/invoicing integration boundary
- clearly defined non-accounting order/payment records

---

# 21. Localization

Design for RTL from the beginning.

Requirements:
- Hebrew-ready UI
- Arabic-ready UI
- English-ready UI
- translation keys, not hardcoded strings
- locale-aware dates
- currency formatting
- RTL layout support

Do not wait until after the UI is built to add RTL.

---

# 22. UX Principles

The product should feel like a retail application, not an ERP.

Prioritize:
- simple navigation
- clear empty states
- fast POS
- minimal setup
- useful defaults
- mobile/tablet-friendly POS
- responsive management UI
- accessible forms
- clear validation
- confirmation for destructive actions

Avoid:
- giant configuration screens
- unnecessary terminology
- complex workflows
- feature overload

---

# 23. Navigation

## Platform

/admin
/admin/dashboard
/admin/businesses
/admin/businesses/pending
/admin/businesses/:id
/admin/users
/admin/audit
/admin/settings

## Tenant

/app/dashboard
/app/onboarding
/app/products
/app/products/:id
/app/categories
/app/inventory
/app/inventory/movements
/app/customers
/app/orders
/app/orders/:id
/app/pos
/app/reports
/app/storefront
/app/settings/business
/app/settings/users
/app/settings/locations
/app/settings/roles

## Public

/store/:slug
/store/:slug/product/:id
/store/:slug/cart
/store/:slug/checkout
/store/:slug/order/:id

---

# 24. Technical Architecture

Use a clean modular architecture.

Recommended conceptual modules:

auth
tenancy
businesses
users
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

Keep domain logic out of UI components.

The API/service layer should own:
- authorization
- tenant resolution
- validation
- business rules
- transactions

The database should enforce:
- foreign keys
- uniqueness
- tenant relationships
- appropriate constraints

---

# 25. Marketplace Future Architecture

Do not implement Marketplace in MVP.

But design the system so that:

Business
→ Sales Channels
→ POS
→ Online Store
→ Future Marketplace

Orders already have channel.

Future concept:

MarketplaceConnection
MarketplaceListing

A business can connect its catalog to a marketplace.

The marketplace itself should later be a separate application/service.

Concept:

Business OS
    |
    | connector
    v
Marketplace

The business remains the source of truth for:
- products
- inventory
- business information

The marketplace becomes a sales/distribution channel.

---

# 26. MVP Definition of Done

The MVP is complete when:

1. User can register.
2. User can create a business.
3. Business enters pending approval.
4. Platform Admin can review it.
5. Platform Admin can approve it.
6. Owner can complete onboarding.
7. Owner can create a location.
8. Owner can create categories.
9. Owner can create products and variants.
10. Owner can add inventory.
11. Inventory movements are recorded.
12. Owner can manage customers.
13. Cashier can open POS.
14. Cashier can scan/search products.
15. Cashier can complete a sale.
16. Order, payment and inventory changes are transactional.
17. Customer can shop through public storefront.
18. Online order is created.
19. Inventory updates correctly.
20. Business sees dashboard metrics.
21. Platform Admin sees platform metrics.
22. Roles/permissions work server-side.
23. Cross-tenant access attempts fail.
24. Audit events are recorded.
25. AI foundation is present without bypassing authorization.
26. RTL/localization architecture is in place.
27. No marketplace functionality is required.

---

# 27. Development Strategy

Do NOT give Lovable or Claude one huge "build everything" prompt.

Use sequential milestones.

The order is deliberate:

1. Product/architecture specification
2. Database + tenancy
3. Authentication
4. RBAC
5. Business approval
6. Catalog
7. Inventory
8. Customers
9. Orders/payments
10. POS
11. Storefront
12. Dashboard
13. Audit
14. AI foundation
15. security testing
16. integration testing
17. UX polish
18. deployment

Do not proceed to a dependent milestone until its previous milestone passes tests.

---

# 28. Agent Roles

## Lovable

Use Lovable primarily for:
- application scaffolding
- UI
- pages
- navigation
- forms
- CRUD screens
- user flows
- basic frontend/backend integration
- rapid iteration

Do not let Lovable invent the data model or security model.

## Claude

Use Claude primarily for:
- architecture
- database review
- backend/domain logic
- authorization
- security
- tests
- transaction correctness
- code review
- refactoring
- edge cases

## Codex

Use Codex for:
- precise code changes
- implementation of well-defined tasks
- tests
- migrations
- debugging
- repository-wide refactoring
- fixing issues identified by Claude

---

# 29. MASTER PROMPT — Lovable Stage 1

Paste this first.

[BEGIN PROMPT]

We are building Dokane Retail OS.

Use the attached/available PRD as the authoritative product specification.

Do not invent features.

Do not build a marketplace.

Do not build an ERP.

Do not implement accounting.

First build the application foundation and architecture.

Requirements:
- multi-tenant SaaS
- PostgreSQL/Supabase if appropriate
- strict tenant isolation
- platform admin scope
- tenant user scope
- RBAC
- audit foundation
- RTL/localization-ready
- modular architecture
- responsive UI

Create:
- authentication foundation
- database schema
- tenant/business model
- memberships
- roles
- permissions
- platform admin area
- tenant application shell
- routing
- authorization middleware/policies
- seed data

Create demo:
Platform Admin
Business A
Business B

Verify that Business A and Business B cannot access each other's data.

Do not implement advanced business features yet.

Before making assumptions, use the PRD.

[END PROMPT]

---

# 30. MASTER PROMPT — Claude Stage 1 Review

[BEGIN PROMPT]

Act as the principal architect and security reviewer for Dokane Retail OS.

Review the current repository against the PRD.

Focus only on:
- multi-tenancy
- tenant isolation
- authentication
- authorization
- RBAC
- database integrity
- platform admin separation
- audit foundation
- architecture

Do not add product features.

Find:
- cross-tenant vulnerabilities
- insecure frontend-only checks
- tenant_id trust issues
- missing constraints
- incorrect relationships
- privilege escalation
- weak session handling
- missing indexes
- unsafe database access

Produce a severity-ranked review.

Then fix critical and high-severity issues.

Add automated tests for tenant isolation and RBAC.

[END PROMPT]

---

# 31. MASTER PROMPT — Lovable Stage 2

[BEGIN PROMPT]

Implement authentication and complete business onboarding according to the PRD.

Build:
- signup
- login
- password reset
- email verification if supported
- create business
- pending approval
- approval status UI
- admin business application list
- admin review
- approve
- reject
- request changes
- suspend/reactivate
- onboarding checklist

Do not implement catalog, POS or marketplace yet.

Use the existing architecture and authorization model.

Do not modify tenant isolation rules.

[END PROMPT]

---

# 32. MASTER PROMPT — Claude Stage 2

[BEGIN PROMPT]

Review the authentication and onboarding implementation.

Test:
- unauthorized access
- business status restrictions
- role boundaries
- approval workflow
- suspended business behavior
- session handling
- tenant isolation

Verify that:
- pending businesses cannot transact
- rejected businesses cannot transact
- suspended businesses cannot transact
- only Platform Admin can approve
- tenant users cannot access platform endpoints

Fix issues and add tests.

[END PROMPT]

---

# 33. MASTER PROMPT — Lovable Stage 3

[BEGIN PROMPT]

Implement:
- locations
- categories
- products
- product variants
- product images
- product CRUD
- search
- filtering
- pagination

Follow the PRD exactly.

Every record must be tenant-scoped.

Implement clean UX and empty states.

Do not implement inventory movements yet except the data foundation needed by the next stage.

[END PROMPT]

---

# 34. MASTER PROMPT — Claude Stage 3

[BEGIN PROMPT]

Review catalog implementation.

Check:
- tenant isolation
- SKU uniqueness per tenant
- barcode uniqueness per tenant
- foreign keys
- deletion behavior
- authorization
- validation
- pagination
- query efficiency
- image security
- variant ownership

Add tests and fix issues.

[END PROMPT]

---

# 35. MASTER PROMPT — Lovable Stage 4

[BEGIN PROMPT]

Implement inventory according to the PRD.

Include:
- stock by location
- initial stock
- stock adjustment
- low-stock thresholds
- inventory movement history
- stock search/filter
- movement types

Every stock change must create an inventory movement.

Use transactions.

Do not implement advanced warehouse management or purchasing.

[END PROMPT]

---

# 36. MASTER PROMPT — Claude Stage 4

[BEGIN PROMPT]

Review inventory implementation as a transactional systems engineer.

Test:
- concurrent stock changes
- negative inventory rules
- tenant isolation
- location ownership
- product ownership
- movement consistency
- adjustment authorization
- audit integration

Ensure no code path can modify stock without a corresponding movement.

Fix and test.

[END PROMPT]

---

# 37. MASTER PROMPT — Lovable Stage 5

[BEGIN PROMPT]

Implement:
- tenant-specific customers
- orders
- order items
- payment records
- payment abstraction

Support:
POS
ONLINE_STORE

Payment methods:
CASH
CARD
OTHER

Do not integrate specific payment providers yet.

Implement order status and cancellation/refund foundations.

Do not implement marketplace orders.

[END PROMPT]

---

# 38. MASTER PROMPT — Claude Stage 5

[BEGIN PROMPT]

Review order/payment domain logic.

Focus on:
- transaction consistency
- idempotency
- tenant isolation
- ownership
- order totals
- payment totals
- cancellation rules
- refund foundations
- concurrency

Add tests.

Do not add new features.

[END PROMPT]

---

# 39. MASTER PROMPT — Lovable Stage 6

[BEGIN PROMPT]

Implement the Retail POS MVP.

Flow:
select location
→ open register session
→ search/scan
→ cart
→ customer optional
→ discount
→ payment
→ complete order
→ inventory decrement
→ movement
→ payment
→ receipt

Make POS fast and simple.

Support keyboard-style barcode scanners.

Do not implement printer-specific drivers.

Do not implement marketplace.

[END PROMPT]

---

# 40. MASTER PROMPT — Claude Stage 6

[BEGIN PROMPT]

Perform a deep POS review.

Test:
- duplicate checkout requests
- double payment
- concurrent checkout
- insufficient inventory
- inventory rollback
- unauthorized refunds
- cashier permissions
- register session behavior
- cross-tenant access

The checkout operation must be safe under retries and failures.

Fix critical issues and add automated tests.

[END PROMPT]

---

# 41. MASTER PROMPT — Lovable Stage 7

[BEGIN PROMPT]

Implement the basic online storefront.

Public business URL:
business-slug.dokane.com

Implement:
- business header
- logo
- categories
- products
- product details
- variants
- availability
- cart
- checkout
- customer information
- online order creation

Order channel must be ONLINE_STORE.

Resolve tenant only through trusted storefront slug/hostname mapping.

Do not expose tenant IDs.

Do not implement custom domains yet.

Do not implement marketplace.

[END PROMPT]

---

# 42. MASTER PROMPT — Claude Stage 7

[BEGIN PROMPT]

Review storefront and public checkout security.

Test:
- tenant enumeration
- malicious slug changes
- cross-tenant product access
- order manipulation
- price manipulation
- inventory manipulation
- checkout replay
- customer data exposure

Never trust client-submitted prices or totals.

Server must calculate authoritative order totals.

Fix and test.

[END PROMPT]

---

# 43. MASTER PROMPT — Lovable Stage 8

[BEGIN PROMPT]

Implement:
- business dashboard
- sales metrics
- order metrics
- low stock
- best sellers
- recent orders
- sales by channel
- platform admin dashboard

Keep reporting simple.

Use efficient backend queries.

Do not add advanced analytics.

[END PROMPT]

---

# 44. MASTER PROMPT — Claude Stage 8

[BEGIN PROMPT]

Review reporting.

Verify:
- tenant-scoped aggregation
- no data leakage
- correct totals
- timezone handling
- date boundaries
- pagination
- query efficiency

Add tests for tenant A/B reporting separation.

[END PROMPT]

---

# 45. MASTER PROMPT — Lovable Stage 9

[BEGIN PROMPT]

Implement audit log UI and complete audit coverage.

Platform Admin can see platform audit events.

Authorized tenant users can see their tenant audit events.

Audit records must be append-only from normal application APIs.

Add clear event descriptions.

Do not expose sensitive secrets in audit metadata.

[END PROMPT]

---

# 46. MASTER PROMPT — AI FOUNDATION

Use after core functionality is stable.

[BEGIN PROMPT]

Implement AI-readiness for Dokane Retail OS without turning AI into a major MVP feature.

Create an AI abstraction layer:

AI Provider
→ AI Gateway
→ Tool Registry
→ Authorized Application Services

AI must never access the database directly.

Every AI tool must execute with:
- authenticated user
- tenant context
- permission context

Implement abstractions for:
- AI provider configuration
- model configuration
- feature flags
- usage tracking
- AI audit events
- prompt/version metadata
- tool registry
- tenant AI enable/disable

Implement only one optional read-only feature:

"Explain my sales today."

It may use authorized aggregated sales data and return a natural-language explanation.

AI must not:
- modify inventory
- modify prices
- create orders
- issue refunds
- modify users
- change permissions

without a future explicit confirmation workflow.

Design tools so future features can include:
- inventory questions
- reorder suggestions
- product descriptions
- sales analysis
- anomaly detection
- forecasting

Do not send unnecessary tenant data to AI providers.

[END PROMPT]

---

# 47. MASTER PROMPT — Claude AI Security Review

[BEGIN PROMPT]

Review Dokane's AI foundation as a security architect.

Verify:
- tenant isolation
- permission enforcement
- prompt injection resistance
- tool authorization
- no direct database access
- data minimization
- secret protection
- auditability
- provider abstraction
- AI disable capability
- read/write separation

Assume a malicious tenant user attempts to make the AI reveal another tenant's data or perform unauthorized actions.

Add tests.

Do not add autonomous write actions.

[END PROMPT]

---

# 48. MASTER PROMPT — Final Claude Security Audit

[BEGIN PROMPT]

Perform a complete pre-MVP security audit of Dokane Retail OS.

Treat this as a production multi-tenant SaaS.

Test:

Authentication
Authorization
RBAC
Tenant isolation
Platform Admin boundaries
API security
Database security
IDOR
Mass assignment
Input validation
CSRF where applicable
XSS
SQL injection
File upload security
Image access
Rate limiting
Session security
Password reset
Invitation security
Audit logs
POS transaction safety
Payment consistency
Inventory concurrency
Storefront security
Order manipulation
Price manipulation
AI tool security

Create Tenant A and Tenant B and actively attempt cross-tenant access.

Report:
CRITICAL
HIGH
MEDIUM
LOW

Fix all critical/high issues.

Add regression tests for every fixed vulnerability.

Do not add product features.

[END PROMPT]

---

# 49. MASTER PROMPT — Final Product QA

[BEGIN PROMPT]

Act as a senior QA engineer.

Execute the complete MVP flows from the PRD.

Test at minimum:

1. Signup
2. Business creation
3. Admin approval
4. Business onboarding
5. Location creation
6. Product CRUD
7. Variant CRUD
8. Inventory initialization
9. Inventory adjustment
10. POS sale
11. POS sale with barcode
12. Online storefront
13. Online checkout
14. Customer creation
15. Order management
16. Dashboard
17. Role restrictions
18. Tenant isolation
19. Audit logging
20. AI read-only sales explanation

Test error paths:
- invalid input
- duplicate SKU
- duplicate barcode
- insufficient inventory
- duplicate checkout
- expired session
- disabled user
- suspended business
- unauthorized role
- missing product
- deleted/inactive product

Fix defects without expanding scope.

[END PROMPT]

---

# 50. MASTER PROMPT — Final Codex Cleanup

[BEGIN PROMPT]

You are a senior production engineer.

The Dokane Retail OS MVP is feature-complete.

Do not add features.

Review the repository for:
- dead code
- duplicated logic
- inconsistent naming
- insecure shortcuts
- missing error handling
- missing database indexes
- N+1 queries
- unnecessary API calls
- frontend/backend validation inconsistencies
- poor transaction boundaries
- missing tests
- environment/configuration problems
- secrets committed to source
- logging of sensitive data

Refactor carefully without changing product behavior.

Run the full test suite.

Provide a final engineering report:
- changes made
- remaining risks
- deployment requirements
- environment variables
- database migrations
- backup requirements
- monitoring recommendations

[END PROMPT]

---

# 51. Deployment Checklist

Before real users:

## Infrastructure
- production database
- backups
- migrations
- HTTPS
- domain
- DNS
- object storage
- email service
- monitoring
- error tracking
- logs

## Security
- production secrets
- secure cookies/session configuration
- rate limiting
- CORS
- CSP where applicable
- file upload restrictions
- database security
- RLS if applicable
- admin MFA if supported
- backup recovery test

## SaaS operations
- business approval
- user invitations
- account recovery
- support process
- tenant suspension
- audit trail

## Observability
Track:
- API errors
- failed logins
- failed checkouts
- payment failures
- inventory conflicts
- slow queries
- background job failures
- AI errors
- AI usage

---

# 52. Backup and Recovery

MVP must have:
- automated database backups
- retention policy
- recovery procedure
- tested restore

Inventory and orders are business-critical.

Do not consider "we have backups" sufficient without testing restoration.

---

# 53. Important Missing Items to Address Before Production

These are not necessarily MVP UI features, but they should not be forgotten.

## Email
Needed for:
- verification
- invitations
- password reset
- approval notifications
- rejection/change requests

## File storage
Needed for:
- product images
- business logo

Must be tenant-aware.

## Background jobs
Useful for:
- email
- image processing
- future AI jobs
- reports
- integrations

## Idempotency
Important for:
- checkout
- payments
- external webhooks later

## Timezones
Store timestamps consistently, display in business/user timezone.

## Money
Never use floating point for monetary values.

Use integer minor units or a decimal strategy.

Example:
ILS 599.90 should not be stored as a binary floating point.

## Concurrency
Inventory and checkout must handle simultaneous sales.

## Soft deletion
Consider soft deletion/deactivation for:
- products
- users
- locations

Avoid deleting historical business data that orders depend upon.

---

# 54. Suggested MVP Technology Shape

The exact stack can be selected separately, but the architecture should support:

Frontend:
- React/Next.js or equivalent
- responsive UI
- RTL
- typed API client

Backend:
- typed service/API layer
- domain modules
- authorization layer
- transaction support

Database:
- PostgreSQL preferred

Storage:
- object storage for images

Authentication:
- managed auth or robust application auth

AI:
- provider abstraction
- tool layer
- audit

The important point is not the framework. It is:
- strong tenancy
- strong authorization
- transactional domain logic
- modularity

---

# 55. MVP Release Sequence

Recommended sequence:

Sprint/Stage 0:
PRD + architecture + ERD + API contract

Stage 1:
Auth + tenancy + RBAC + platform admin

Stage 2:
Business onboarding/approval

Stage 3:
Catalog

Stage 4:
Inventory

Stage 5:
Customers + orders + payments

Stage 6:
POS

Stage 7:
Storefront

Stage 8:
Dashboard/reporting

Stage 9:
Audit

Stage 10:
AI foundation

Stage 11:
Security audit

Stage 12:
QA

Stage 13:
Deployment

---

# 56. Required Artifacts Before Implementation

Create these documents in the repository:

/docs/PRD.md
/docs/ARCHITECTURE.md
/docs/DATA_MODEL.md
/docs/ERD.md
/docs/API.md
/docs/RBAC.md
/docs/SECURITY.md
/docs/AI.md
/docs/ROADMAP.md
/docs/TEST_PLAN.md

The PRD is the product authority.

SECURITY.md is the authority for tenant isolation and authorization.

Do not let AI coding agents silently redefine these documents.

---

# 57. Final Product Boundary

The MVP can be summarized as:

              DOKANE RETAIL OS

                   PLATFORM
                      |
                Platform Admin
                      |
        +-------------+-------------+
        |             |             |
     Business A    Business B    Business C
        |             |             |
      Users         Users         Users
        |             |             |
     Catalog       Catalog       Catalog
     Inventory     Inventory     Inventory
     Customers     Customers     Customers
     Orders        Orders        Orders
     POS           POS           POS
     Storefront    Storefront    Storefront

                   FUTURE

              Sales Channels
                    |
          +---------+---------+
          |                   |
         POS              Online Store
                              |
                         Marketplace
                              |
                       Separate Application

The MVP stops before the marketplace.

---

# 58. Product Success Criteria

Technical success:
- zero known critical cross-tenant vulnerabilities
- reliable transactions
- automated regression tests
- recoverable production database
- observable system

User success:
A new retailer should be able to go from:

"nothing configured"

to:

"I can sell a product through POS and online"

without requiring an implementation consultant.

Business success:
Validate:
- merchants complete onboarding
- merchants create real products
- merchants use POS
- merchants use inventory
- merchants use online store
- merchants return to the product
- merchants are willing to pay

Only after these signals should Dokane expand aggressively.

---

# 59. Next Product Phase

After MVP validation, evaluate actual merchant feedback before adding features.

Likely V1+ candidates:
- Israeli accounting/invoicing integration
- payment provider integration
- receipt printer integration
- cash drawer
- advanced purchase orders
- multi-location transfers
- custom domains
- better reporting
- customer loyalty
- AI inventory assistant
- AI sales assistant
- marketplace connector

Marketplace remains a separate product/service.

The long-term architecture is:

Retail OS
→ Omnichannel commerce
→ Marketplace distribution
→ Marketplace network effects

But the first milestone is simply:

> Build the best simple Retail OS for the target merchant.

