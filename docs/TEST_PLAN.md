# Test Plan

Version: 2.0 · Date: 2026-09-13

Four layers. Verify behavior, not just types. Report honestly what was and was
not verified.

---

## 1. Unit
- Pricing and discount math; order totals from items.
- Payment-status derivation (`UNPAID / PARTIALLY_PAID / PAID`) from payment sums.
- Accounting: income entry created on payment received; amount matches the
  payment; receivable = `total − amount_paid`.
- Permission checks; entitlement checks.
- Order fulfillment transition rules (channel-aware allowed transitions).
- Inventory movement generation on every stock change.

## 2. Integration (API + database)
- Tenant isolation per module (A/B) — see §5.
- RBAC: role without a permission is refused; custom per-tenant role edits take
  effect.
- Entitlement: a not-entitled tenant cannot enable/use a module.
- Transactions: order + items + payment + inventory + movement commit or roll
  back together.
- Idempotency: repeated order/payment request with the same key returns the
  original result, no duplicate.
- Concurrency: two sales for the last unit — one succeeds, the other gets
  `INSUFFICIENT_STOCK`.
- Events/outbox: `payment.received` reliably produces an income entry;
  `order.placed` links a CRM customer.

## 3. End-to-end
Signup → business creation → admin approval → onboarding → enable modules →
create offerings + variants → initialize inventory → create a **manual** order →
record a **partial** payment → verify receivable → complete payment → verify
income → publish mini-site → WhatsApp handoff produces a manual online-store
order → dashboard shows sales **by channel** → AI agent "business pulse" returns
a correct summary.

## 4. Security (actively attack)
IDOR, tenant switching, manipulated `business_id` in body/query/URL, mass
assignment, privilege escalation, price/total manipulation, order manipulation,
inventory manipulation, storefront tenant enumeration, file-upload abuse, and AI
tool attempts to reach another tenant's data or perform unauthorized/unconfirmed
writes.

## 5. Required tenant-isolation tests (must all fail)

Create Business A and Business B, each with users, offerings, inventory,
customers and orders. Every attempt below must be rejected:

```
A → read/update/delete B offering
A → read/modify B inventory
A → read B customer / B order
A → access B reports
A → administer B storefront
A → enable a module for B
A → record a payment on B's order
```

Repeat each with changed URL IDs, manipulated bodies, query parameters, and
direct API calls.

## 6. AI-specific
- A malicious tenant user cannot make the agent reveal another tenant's data.
- WRITE tools do not commit without explicit confirmation.
- Every tool invocation is audited; data minimization holds before provider
  calls.

## 7. Gate

Add a regression test for every fixed vulnerability. CI runs unit → integration
→ security on every PR (see [DELIVERY.md](./DELIVERY.md) §6). Do not weaken
security to make a test pass.
