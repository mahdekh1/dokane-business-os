# Notifications

Version: 2.0 · Date: 2026-09-13

A core framework, present from day one, that sends messages over multiple
channels. Real provider integrations arrive later; the MVP ships **stub
adapters** so the rest of the system can depend on it now.

---

## 1. Design

```
Domain event ──► NotificationsModule ──► channel adapter ──► (queue) ──► send
   (e.g. order.placed)                     WhatsApp | Email
```

- **Channel abstraction:** a `ChannelAdapter` interface with `send(message)`.
  MVP channels: **WhatsApp** and **Email**. SMS and others later.
- **Stub adapters** for MVP: they log to `notification_log` and no-op the actual
  send (or use a dev provider), so flows are exercised end-to-end without a live
  provider. Swapping in the real WhatsApp Business API / email provider is a
  driver change.
- **Queue-backed:** sends are enqueued to `apps/worker`; never block a request
  or a checkout transaction on an external send.
- **Event-triggered:** the module subscribes to domain events and to explicit
  send requests.

## 2. Templates

```
notification_templates  id, business_id?, channel, key, subject?, body, locale
```

- Templates are keyed (e.g. `order.confirmation`) and localized. Platform ships
  defaults; a tenant may override.
- Rendering fills variables from the triggering event payload.

## 3. Log

```
notification_log  id, business_id, channel, template_key, to, status, payload, sent_at?, error?
```

Every attempt is recorded (`QUEUED | SENT | FAILED`) for observability and retry.

## 4. Adapter interface

```ts
interface ChannelAdapter {
  channel: 'WHATSAPP' | 'EMAIL';
  send(msg: RenderedMessage): Promise<SendResult>;
}
```

Implementations: `WhatsAppStubAdapter`, `EmailStubAdapter` (MVP) →
`WhatsAppBusinessAdapter`, `EmailProviderAdapter` (later). Domain code depends on
the interface, not a provider SDK.

## 5. Relationship to the Online Store + AI

- The **WhatsApp order handoff** from the mini-site uses this module to build a
  pre-filled message (MVP: constructs the message/link; live send when the real
  adapter lands). See [MINISITE.md](./MINISITE.md).
- The **future WhatsApp AI intake** builds on this module: inbound messages emit
  `message.received`, which the AI agent consumes. See [AI.md](./AI.md).

## 6. Permissions

`notifications.view`, `notifications.templates.manage`.
