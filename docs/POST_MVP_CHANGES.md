# Post-MVP Changes

Version: 2.0 · Date: 2026-09-13

Features that **exist in the MVP but are deliberately built in a reduced form**,
and what changes when we move past the MVP. These are not new features — they are
the same features maturing. Each was designed so the change is a **swap or an
activation, not a rewrite**, because the abstraction is already in place.

Legend: **Trigger** = what prompts the change · **Change** = what we do ·
**Why it's safe** = the seam that makes it non-breaking.

---

## 1. Notifications — stub adapters → live providers

- **MVP:** `WhatsAppStubAdapter` / `EmailStubAdapter` log to `notification_log`,
  no real send.
- **Trigger:** provider accounts ready (WhatsApp Business API, email provider).
- **Change:** implement `WhatsAppBusinessAdapter` / `EmailProviderAdapter` behind
  the existing `ChannelAdapter` interface; set env `WHATSAPP_PROVIDER` /
  `EMAIL_PROVIDER`.
- **Why it's safe:** callers depend on the interface + queue, not the provider.
- Ref: [NOTIFICATIONS.md](./NOTIFICATIONS.md).

## 2. Media storage — local disk → S3

- **MVP:** local-disk storage driver.
- **Trigger:** need for durability/CDN/scale, or multi-instance deploy.
- **Change:** set `STORAGE_DRIVER=s3` + bucket credentials; the S3 driver
  implements the same interface. Migrate existing files with a one-off job.
- **Why it's safe:** all reads/writes go through the storage-driver abstraction;
  storage keys are already server-generated and tenant-scoped.
- Ref: [SECURITY.md](./SECURITY.md) §5.

## 3. Payments — manual Cash/Bit → processor integration

- **MVP:** methods Cash + Bit, recorded manually (no processing).
- **Trigger:** demand for card/online payment capture.
- **Change:** add methods to the enum; implement `PaymentProvider`
  (`authorize/capture/refund`) adapters; wire webhooks (idempotent).
- **Why it's safe:** `method` is an extensible enum; payment records already
  carry `provider`, `external_transaction_id`, `status`, `metadata`.
- Ref: [ORDERS_AND_MONEY.md](./ORDERS_AND_MONEY.md) §5.

## 4. Bit as a method → region-configurable methods

- **MVP:** Cash + Bit surfaced (Bit is region-specific).
- **Trigger:** expansion beyond the initial region.
- **Change:** move enabled payment methods into per-tenant/region configuration;
  keep the platform rules region-neutral.
- **Why it's safe:** methods are already an extensible enum, not hard-coded logic.

## 5. Invoicing — dormant → active

- **MVP:** `Invoice` entity, numbering sequence, `generateInvoice()` interface and
  order wiring exist but are **gated off / no-op**.
- **Trigger:** legal/tax requirement in a target market (with CPA/legal input).
- **Change:** enable the Payments & Invoices module; implement issuance
  (document rendering, tax lines, any regulatory numbering/allocation).
- **Why it's safe:** the entity, per-tenant numbering, and order link are already
  present; only issuance logic is added.
- Ref: [ORDERS_AND_MONEY.md](./ORDERS_AND_MONEY.md) §8.

## 6. Accounting — cash-basis → accrual option

- **MVP:** cash-basis (income on payment received).
- **Trigger:** businesses needing accrual reporting / deeper accounting.
- **Change:** add an accrual recognition mode (recognize at order completion);
  reconcile against receivables.
- **Why it's safe:** both fulfillment and payment axes are already tracked, so
  accrual recognition needs no new state.

## 7. Online store — WhatsApp handoff → self-serve checkout

- **MVP:** Store builds a cart → WhatsApp handoff; staff records a manual order.
- **Trigger:** demand for customer self-service + online payment.
- **Change:** implement the `ONLINE` self-serve checkout that creates the order
  directly and (with §3) captures payment online.
- **Why it's safe:** the channel and order model already support `entry_mode =
  ONLINE`; only the self-serve flow is added.
- Ref: [MINISITE.md](./MINISITE.md) §4.

## 8. POS — infra only → full POS + hardware

- **MVP:** `pos_registers` / `pos_sessions` data model exists; no UI.
- **Trigger:** in-store transaction demand.
- **Change:** build POS UI (fast cart, barcode-as-keyboard already supported),
  register open/close with cash counting; add receipt-printer, cash-drawer and
  payment-terminal adapters behind their interfaces.
- **Why it's safe:** the session/register model and channel model exist; hardware
  is behind adapter interfaces from the start.

## 9. AI agent — in-app → WhatsApp intake + wider autonomy + MCP

- **MVP:** in-app assistant; 4 read + 2 confirmed-write tools; module-registered.
- **Trigger:** WhatsApp integration live; demand for automation.
- **Change:** inbound `message.received` → agent intent classification →
  draft/act with human-in-the-loop; add more module tools; expose the tool
  registry over **MCP**.
- **Why it's safe:** gateway, tool registry, tenant/permission scoping,
  read/write-with-confirmation and audit are already the model.
- Ref: [AI.md](./AI.md) §7.

## 10. Auth & admin — baseline → MFA + audited impersonation

- **MVP:** app-owned authorization; platform admin is global.
- **Trigger:** production hardening.
- **Change:** admin MFA; an explicit, audited support-impersonation mode; scoped
  admin endpoints.
- **Why it's safe:** authz is server-side and permission-based already.

## 11. Tenant isolation — app + FK → optional RLS enabled

- **MVP:** application authorization + FK constraints + tests (RLS optional).
- **Trigger:** defense-in-depth for production.
- **Change:** enable PostgreSQL row-level security on tenant tables.
- **Why it's safe:** every tenant row already carries `business_id`.

## 12. Mini-site — slug → custom domains

- **MVP:** `business-slug` based sites; slug globally unique.
- **Trigger:** businesses wanting their own domain.
- **Change:** add a `storefront_domains` mapping + verification; resolve tenant by
  host.
- **Why it's safe:** domain logic is kept out of the Business entity by design.

## 13. Scaffolded modules → built

Calendar, HR, Social & Growth, and the Sales-Channel connector are registered
stubs. **Change:** implement each module's services against its already-declared
manifest (permissions, events, nav, agent tools). No framework change required.

## 14. Reporting — basic → Analytics/BI; ERP

- **MVP:** dashboard metrics + per-channel sales.
- **Trigger:** demand for deeper insight/operations.
- **Change:** Analytics/BI module; ERP (purchasing, manufacturing, accounting
  depth) as new modules.

## 15. Marketplace connector

- **MVP:** not present; `MARKETPLACE` reserved as a channel type.
- **Trigger:** launch of the separate Dokane Marketplace product.
- **Change:** build the connector that syncs offerings/inventory/orders to the
  marketplace as a channel. The Business OS stays the source of truth.
- **Why it's safe:** orders already carry `channel_id`; marketplace is just
  another channel.
