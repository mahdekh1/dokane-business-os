# CRM

Version: 2.0 · Date: 2026-09-13

One customer registry per business, spanning all sales channels, with lead
tracking and source attribution. MVP-built module.

---

## 1. Purpose

- A single record for each customer, whether they bought online or in person.
- Track **where customers and leads came from** — a real question for owners
  deciding where to spend effort.
- Feed the AI agent ("new leads this week", "who owes me money" combines CRM +
  Orders).

## 2. Customers (core table — the CRM module builds on it)

The `customers` table is a **core** concern that exists whether or not the CRM
module is enabled, so Orders can reference a customer without depending on CRM.
The CRM module adds leads, the pipeline and source analytics on top; the base
record and `getOrCreateByContact` live in the core customers module (see
[DATA_MODEL.md](./DATA_MODEL.md) §8).

```
customers  id, business_id, name, email?, phone?, address?, source, created_at, updated_at
```

- One customer record spans channels: a person who orders online and later buys
  in store is the **same** record, with linked orders from both channels.
- `source`: `ONLINE | MANUAL | WALK_IN | REFERRAL | WHATSAPP | …` (extensible).
- **Online orders auto-create/link** a customer with `source = ONLINE` (matched
  by email/phone where available).
- Staff create manual customers with a chosen source.

## 3. Leads

```
leads  id, business_id, name, contact, source, status, note?, converted_customer_id?
```

Lead lifecycle:

```
NEW → CONTACTED → QUALIFIED → CONVERTED
                            ↘ LOST
```

On `CONVERTED`, a customer record is created (or linked) and
`converted_customer_id` is set.

## 4. Events

- Emits: `crm.customer.created`, `crm.lead.converted`.
- Consumes: `order.placed` (auto-create/link customer, `source = ONLINE`).

## 5. Permissions

`crm.customers.view|create|update|delete`, `crm.leads.view|create|update`.

## 6. Agent tools

- `crm.new_customers` (read) — new customers/leads in a period, by source.
- Combines with Orders for "who owes me" (receivables by customer).

## 7. Out of scope (MVP)

Pipelines with custom stages, marketing automation, segmentation, and a global
cross-tenant consumer identity. Customers are strictly tenant-scoped.
