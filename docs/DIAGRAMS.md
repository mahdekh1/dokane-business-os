# Architecture Diagrams & Flows

Version: 2.0 · Date: 2026-09-13

Visual companion to the specs. Diagrams use Mermaid (renders on GitHub). Text
authority remains the linked docs.

---

## 1. Runtime architecture

```mermaid
flowchart TB
    U[Browser / Public visitor] --> CDN[CDN / HTTPS / WAF]
    CDN --> WEB[apps/web · Next.js<br/>console · admin · public mini-sites]
    WEB -->|REST /api/v1| API[apps/api · NestJS<br/>authz · tenant ctx · rules · tx]
    API --> PG[(PostgreSQL)]
    API --> REDIS[(Redis · BullMQ)]
    API --> OS[(Object Storage<br/>local driver → S3)]
    REDIS --> WK[apps/worker · BullMQ consumers]
    WK --> PG
    WK --> EXT[WhatsApp · Email · AI provider · image resize]
```

## 2. Inter-module messaging (bus + queue + outbox)

```mermaid
flowchart LR
    subgraph API[apps/api monolith]
      OM[Orders module] -->|emit order.completed| BUS((in-process event bus))
      BUS --> ACC[Accounting module]
      BUS --> CRM[CRM module]
      OM -. same TX .-> OUT[(outbox table)]
    end
    OUT --> RELAY[outbox relay]
    RELAY --> Q[(Redis / BullMQ)]
    Q --> WK[apps/worker subscribers]
    WK --> NOTIF[Notifications send]
```

## 3. Authorization — entitlement then permission

```mermaid
flowchart TD
    R[Request] --> A{Authenticated?}
    A -- no --> X1[401]
    A -- yes --> M{Has membership<br/>in this business?}
    M -- no --> X2[403]
    M -- yes --> B{Business active?}
    B -- no --> X3[403 suspended/pending]
    B -- yes --> E{Tenant entitled<br/>to module?}
    E -- no --> X4[403 NOT_ENTITLED]
    E -- yes --> P{Role has<br/>required permission?}
    P -- no --> X5[403 FORBIDDEN]
    P -- yes --> S[Tenant-scoped service → DB]
```

## 4. Tenant resolution

```mermaid
flowchart LR
    subgraph Authed[Authenticated app]
      J[JWT / session] --> USR[User] --> MEM[BusinessMembership] --> CTX[Tenant context] --> SVC[Service] --> DBq[(tenant-scoped query)]
    end
    subgraph Public[Public mini-site]
      H[hostname / slug] --> LK[trusted slug→business map] --> BIZ[Business] --> CAT[public catalog only]
    end
```

## 5. Order — two orthogonal state machines

**Axis A — fulfillment**

```mermaid
stateDiagram-v2
    [*] --> DRAFT
    DRAFT --> PENDING
    PENDING --> CONFIRMED
    CONFIRMED --> PROCESSING
    PROCESSING --> READY_SHIPPED
    READY_SHIPPED --> COMPLETED
    DRAFT --> CANCELLED
    PENDING --> CANCELLED
    CONFIRMED --> CANCELLED
    PROCESSING --> CANCELLED
    COMPLETED --> [*]
    CANCELLED --> [*]
```

**Axis B — payment (derived from payment records)**

```mermaid
stateDiagram-v2
    [*] --> UNPAID
    UNPAID --> PARTIALLY_PAID
    PARTIALLY_PAID --> PAID
    UNPAID --> PAID
    PAID --> PARTIALLY_REFUNDED
    PAID --> REFUNDED
```

## 6. Payment → cash-basis income (the trigger rule)

```mermaid
sequenceDiagram
    actor Staff
    participant API as Orders API
    participant DB as PostgreSQL
    participant BUS as Event bus
    participant ACC as Accounting
    Staff->>API: POST /orders/:id/payments {amount, method}
    API->>DB: BEGIN TX · insert payment · insert outbox(payment.received) · COMMIT
    API-->>Staff: payment_status re-derived (e.g. PARTIALLY_PAID)
    DB->>BUS: relay outbox → payment.received
    BUS->>ACC: handle(payment.received)
    ACC->>DB: insert FinancialEntry(INCOME, amount, channel)
    Note over ACC,DB: income = money received, not order value.<br/>remainder stays a receivable
```

## 7. Order / money — ERD slice

```mermaid
erDiagram
    SALES_CHANNEL ||--o{ ORDER : has
    ORDER ||--o{ ORDER_ITEM : contains
    ORDER ||--o{ PAYMENT : "0..*"
    ORDER ||--o| INVOICE : "dormant"
    CUSTOMER ||--o{ ORDER : places
    PAYMENT ||--o| FINANCIAL_ENTRY : "produces INCOME"
    OFFERING ||--o{ ORDER_ITEM : "snapshotted into"
    FINANCIAL_ENTRY {
      enum type "INCOME|EXPENSE"
      int amount
      uuid channel_id
    }
    ORDER {
      enum entry_mode "ONLINE|MANUAL"
      enum fulfillment_status
      enum payment_status
      int total
      int amount_paid
      int amount_due
    }
```

## 8. Mini-site WhatsApp order handoff (MVP)

```mermaid
sequenceDiagram
    actor Customer
    participant Site as Mini-site Store
    participant WA as WhatsApp
    actor Shop as Shop owner
    participant Console as Console
    Customer->>Site: browse catalog, build cart
    Customer->>Site: "Order on WhatsApp"
    Site->>WA: open pre-filled message (items, qty)
    Customer->>Shop: sends message
    Shop->>Customer: confirm + collect payment (own way)
    Shop->>Console: record MANUAL order + payment
    Note over Console: order.channel = online store · entry_mode = MANUAL
```

## 9. AI agent tool call

```mermaid
flowchart TD
    Owner[Owner chat] --> AG[AI Agent]
    AG --> GW[AI Gateway<br/>provider · minimize · audit]
    GW --> TR[Tool Registry<br/>tools from enabled modules]
    TR --> T{Tool mode}
    T -- READ --> SVC[Authorized service → DB]
    T -- WRITE --> CONF{User confirms?}
    CONF -- no --> STOP[Not executed]
    CONF -- yes --> SVC
    SVC --> AUD[(ai_audit)]
```

## 10. Business onboarding lifecycle

```mermaid
stateDiagram-v2
    [*] --> PENDING_APPROVAL: signup + create business
    PENDING_APPROVAL --> CHANGES_REQUESTED: admin
    CHANGES_REQUESTED --> PENDING_APPROVAL: resubmit
    PENDING_APPROVAL --> REJECTED: admin
    PENDING_APPROVAL --> APPROVED: admin
    APPROVED --> SUSPENDED: admin
    SUSPENDED --> APPROVED: admin
    APPROVED --> [*]: onboarding wizard → active
```

## 11. Module lifecycle

```mermaid
flowchart LR
    AUTH[Author module + manifest] --> REG[Registry reads manifest]
    REG --> AVAIL[Appears on Modules page]
    AVAIL --> ENT{Tenant entitled?}
    ENT -- no --> LOCK[Locked · upgrade prompt]
    ENT -- yes --> EN[Tenant enables]
    EN --> WIRE[routes · nav · permissions · events · agent tools active]
```

## 12. Lovable ⇄ Claude CLI delivery loop (contracts-first)

```mermaid
sequenceDiagram
    participant C as Claude CLI
    participant G as GitHub repo
    participant L as Lovable
    C->>G: define Zod contracts + API + migrations (feat/be-*), push
    C->>G: open PR → main after tests + security review
    G-->>L: Lovable "Sync from GitHub" (pull main)
    L->>G: build UI against contracts (feat/ui-*), push
    G-->>C: Claude pulls feat/ui-*, reviews security/perf, wires, tests
    C->>G: merge to main
    Note over C,L: main is the shared interface; contracts change only via Claude
```
