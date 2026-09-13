# AI — Agent, Gateway & Tools

Version: 2.0 · Date: 2026-09-13

AI is a controlled capability layer, not a feature explosion. The MVP ships a
**thin in-app assistant** for the business owner. The architecture is built so
capability grows with enabled modules and so a future WhatsApp intake is a small
step, not a rebuild.

---

## 1. Architecture

```
User
 │
AI Agent (in-app chat)
 │
AI Gateway            # provider abstraction, prompt/version, usage, audit, data minimization
 │
Tool Registry         # tools contributed by modules
 │
Authorized Application Services
 │
Database
```

**AI never touches SQL.** It calls tools; each tool calls the same authorized
services the UI uses.

## 2. Module-registered tools (the key idea)

Each module declares its **agent tools** in its manifest, alongside its API,
permissions and events. So:

- The agent's capabilities **scale automatically** as a tenant enables modules.
- Every tool executes with the caller's **tenant + permission context** and
  independently verifies authorization. The agent can never exceed what the user
  could do in the UI, and AI is never trusted to enforce permissions itself.
- Tools are typed with Zod contracts; the same registry can be exposed over
  **MCP** later with no rework.

```ts
interface AgentTool {
  name: string;                 // e.g. "accounting.business_pulse"
  mode: 'READ' | 'WRITE';
  requiredPermission: string;   // checked against the caller's role
  input: ZodSchema;
  run(ctx: TenantContext, input): Promise<ToolResult>;
}
```

## 3. Read vs write

- **READ** tools run freely (subject to permission).
- **WRITE** tools require **explicit user confirmation** before committing. The
  agent proposes the action; the user approves; then it runs.
- Every tool invocation is **audited** (`ai_audit`).

## 4. MVP task set (reads + confirmed writes)

Read-only:
1. **Business pulse** (`READ`, `reports.view`) — sales, cash collected,
   receivables, order count, **by channel**.
2. **Reorder radar** (`READ`, `inventory.view`) — low-stock items + suggested
   reorder quantity (suggestion only).
3. **Who owes me** (`READ`, `orders.view`) — receivables list + total.
4. **Movers & dead stock** (`READ`, `reports.view`) — best/slow sellers over a
   period.

Assisted-write (confirmation required):
5. **Draft product content** (`WRITE`, `catalog.products.update`) — generate an
   offering's name/description/SEO for review before save.
6. **Log it for me** (`WRITE`, `accounting.entries.create` / `pm.tasks.create`) —
   record an expense or create a task, on confirmation.

## 5. Data privacy

Before any external provider call: minimize and aggregate data, remove
unnecessary PII, never send credentials/payment secrets, never send another
tenant's data. Store usage metadata (`ai_usage`) and audit (`ai_audit`); do not
necessarily store full prompts/responses when they contain sensitive business
data. Provider policies must be evaluated before production use.

## 6. Configuration

```
ai_settings  id, business_id, enabled, provider, model
```

AI is **per-tenant disable-able**. Provider is abstracted (no single provider
baked into domain code).

## 7. Future — WhatsApp intake

Designed for, not built in MVP:

```
Inbound WhatsApp message
 └─► Notifications emits "message.received"
      └─► AI Agent classifies intent (price / availability / order / complaint)
           ├─ READ tools: check stock, look up customer
           └─ WRITE tools (human-in-the-loop first): draft reply, create lead / draft order
```

This reuses the same gateway, tool registry and read/write-with-confirmation
model. Autonomy is expanded only behind explicit confirmation workflows.

## 8. Permissions

`ai.use` (talk to the agent), `ai.configure` (enable/disable, set provider).
