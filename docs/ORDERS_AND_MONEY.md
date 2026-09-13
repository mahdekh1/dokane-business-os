# Orders, Channels & Money

Version: 2.0 · Date: 2026-09-13

This document specifies the sales-channel model, the offering model, the order
lifecycle, payments (including partial), and the basic accounting ledger. It is
the heart of the operational and financial domain.

---

## 1. Sales channels

`SalesChannel` is a first-class entity per business. The online store, each
physical store, and the future marketplace are all channels.

```
Business
 ├── Channel: Online Store        (entry_mode ONLINE, self-serve)
 ├── Channel: Physical – Main      (entry_mode MANUAL; later POS)
 ├── Channel: Physical – Branch 2  (entry_mode MANUAL; later POS)
 └── Channel: Marketplace          (future connector)
```

**Channel type:** `ONLINE_STORE | PHYSICAL | MARKETPLACE`.

**Shared vs separated:**
- **Shared:** Offerings and Inventory are business-level. One product master, one
  stock pool per location. This is why cross-channel overselling cannot happen.
- **Separated:** channel settings, storefront, orders and reporting.
- The online store maps to a designated fulfillment location's stock.

Every `Order` and every `FinancialEntry` carries `channel_id`. Global reporting
sums across channels; per-channel reporting filters by `channel_id`. One
dimension, no duplication.

---

## 2. Offerings

Offerings are the shared master data for what a business sells — products **or**
services. See [PRD.md](./PRD.md) §4 for the type system.

- `type`: `PHYSICAL | VIRTUAL | SERVICE` (MVP); `PACKAGE | PROMOTION | PROGRAM`
  (later) — a discriminator, so new types add behavior without schema churn.
- Simple or **variant** (variant matrix; each variant has its own
  SKU/barcode/price/stock).
- Offerings are referenced by orders via **snapshots** (see §4) so historical
  orders never change when an offering is later edited.

---

## 3. The two-axis order status model

An order's state is **two orthogonal state machines**, not one enum. This is the
key design decision — it cleanly represents every real combination (delivered but
unpaid, prepaid but undelivered, deposits, counter sales).

### Axis A — Fulfillment / lifecycle
```
DRAFT → PENDING → CONFIRMED → PROCESSING → READY/SHIPPED → COMPLETED
                                                    ↘ CANCELLED
```

### Axis B — Payment (derived from payment records; see §5)
```
UNPAID → PARTIALLY_PAID → PAID → (REFUNDED / PARTIALLY_REFUNDED)
```

One `Order` model serves both **manual** and **online** orders. The difference is
`entry_mode` (`ONLINE` self-serve vs `MANUAL` staff-entered) and which
**transitions** are allowed:

| Situation | Fulfillment | Payment |
|-----------|-------------|---------|
| Online order placed | `PENDING` | `UNPAID` |
| Counter sale (manual) | jumps to `COMPLETED` | `PAID` |
| Phone/WhatsApp order to fulfill later (manual) | `CONFIRMED` → `COMPLETED` | staff-driven |
| Delivered on credit (manual) | `COMPLETED` | `UNPAID` → later `PAID` |
| Prepaid, not yet delivered | `PROCESSING` | `PAID` |
| Deposit taken | `CONFIRMED` | `PARTIALLY_PAID` |

A channel-aware **allowed-transitions map** enforces which transitions each order
kind may make. Manual entries may fast-path; online orders follow the full flow.

---

## 4. Order and order items

```
Order
  id, business_id, channel_id, location_id?, customer_id?
  entry_mode            ONLINE | MANUAL
  fulfillment_status    (Axis A)
  payment_status        (Axis B, derived)
  subtotal, discount, tax_amount, total   (integer minor units)
  amount_paid           (derived: Σ payments)
  amount_due            (derived: total − amount_paid)
  currency
  created_by?, created_at, updated_at

OrderItem
  id, business_id, order_id
  offering_id?, variant_id?
  name_snapshot, sku_snapshot        # frozen at time of sale
  unit_price, quantity, discount, line_total
```

Snapshots freeze name/SKU/price so a later edit to an offering never rewrites
history.

---

## 5. Payments — partial by design

An **Order has many Payments** (not one-to-one). This makes partial payments,
deposits and installments first-class — especially for manual orders.

```
Payment
  id, business_id, order_id
  method            CASH | BIT  (MVP; extensible: CARD, OTHER, …)
  amount, currency
  received_at
  reference?        # e.g. Bit confirmation note
  status            RECEIVED  (REFUNDED later)
```

Derived on the order:
```
amount_paid    = Σ Payment.amount (RECEIVED)
amount_due     = total − amount_paid
payment_status = amount_paid == 0        → UNPAID
                 0 < amount_paid < total → PARTIALLY_PAID
                 amount_paid ≥ total      → PAID
```

Example:
```
Order.total = 500
  ├─ Payment 200 (Cash, day 1)  → income entry ₪200
  └─ Payment 150 (Bit,  day 3)  → income entry ₪150
amount_paid = 350 · amount_due = 150 · payment_status = PARTIALLY_PAID
```

Payment methods are an extensible enum; MVP surfaces **Cash** and **Bit**.

---

## 6. Basic accounting — cash-basis ledger

The Accounting module keeps a simple ledger of financial entries. It is **not**
full accounting and does **not** issue legal documents.

```
FinancialEntry
  id, business_id
  type            INCOME | EXPENSE
  amount, currency
  entry_date
  category?       # e.g. "rent", "supplies", "sales"
  channel_id?
  method?         # for income: CASH | BIT
  source_type?    ORDER_PAYMENT | MANUAL
  source_id?      # payment id when auto-generated
  created_by, created_at
```

### The trigger rule (important)

**Income follows payment received, not order completion** — this is cash-basis
and correctly handles delivered-but-unpaid orders.

```
Payment RECEIVED (any amount, any order)
        │  emits "payment.received"
        ▼
Accounting subscribes → creates INCOME FinancialEntry
        (amount = payment amount, channel = order.channel)
```

- **Online store income is automatic**: online order → payment received → income.
- **Manual income** has two easy paths: (a) a manual order whose payment is
  recorded → same automatic income, or (b) a **quick income entry** logged
  directly by staff without an order.
- **Expenses are always manual** in MVP (rent, supplies, etc.).

A **Sale is simply an INCOME entry.** There is no parallel "sales" table — one
source of truth for money.

---

## 7. Three reconciled numbers

Because fulfillment and payment are separate axes, the owner sees three distinct,
always-reconciling figures:

| Number | Source | Answers |
|--------|--------|---------|
| **Sales / revenue** | value of `COMPLETED` orders (Axis A) | "How much did I sell?" |
| **Income / cash collected** | INCOME entries = payments received (Axis B) | "How much money came in?" |
| **Receivables (outstanding)** | orders with `amount_due > 0` | "Who owes me, and how much?" |

`Sales − Income = Receivables`. All three are available **globally and per
channel** via `channel_id`.

MVP is cash-basis. An accrual option can be added later without remodeling,
because both axes are already tracked.

---

## 8. Invoice generation — scaffolded, dormant

The **Payments & Invoices** module ships the invoicing infrastructure but it does
nothing yet.

```
Invoice                     # dormant
  id, business_id, order_id
  number                    # from a per-tenant numbering sequence
  status                    DRAFT
  lines (snapshot), tax_lines, totals, currency
  issued_at?

InvoiceSequence             # per-tenant numbering, reserved
```

- A `generateInvoice(order)` **service interface and endpoint exist** and orders
  carry the wiring, but the capability is **gated off / no-op** — it produces no
  document and issues nothing.
- Turning it on later means enabling the module and swapping in real issuance
  logic; the plumbing (entity, numbering, order wiring) is already present.

---

## 9. Transactional integrity

Order-affecting writes are transactional. For a completed sale that touches
stock:

```
BEGIN TX
  create/advance order + items
  record payment(s)
  decrement inventory (only if fulfillment implies stock movement)
  create inventory movement(s)
  insert outbox rows (order.completed / payment.received)
COMMIT
```

- Failure rolls back the whole unit.
- **Idempotency keys** protect retryable writes (order creation, payment
  recording) so a repeated request returns the original result rather than
  creating a duplicate.
- Inventory uses transactional locking to prevent overselling; the loser of a
  race for the last unit receives `INSUFFICIENT_STOCK`.
- Slow/external work (notifications, invoicing later, AI) is enqueued, never run
  inside the transaction.
