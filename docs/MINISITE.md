# Mini-site

Version: 2.0 · Date: 2026-09-13

Each business gets a public, server-rendered mini-site — themed with its brand
and built for search engines. The Store page is the online **sales channel**;
ordering hands off to WhatsApp in the MVP.

---

## 1. Pages

A base template of four pages:

| Page | Purpose |
|------|---------|
| **Main** | Home — business identity, featured offerings, links to the other pages |
| **Store** | Catalog browse (categories, offerings, details, availability); the online sales channel |
| **Contact** | Address, hours, phone, contact form / WhatsApp link |
| **Landing** | A focused promotional page (campaign, featured program/offer) |

Which pages are available depends on the plan (see [PRD.md](./PRD.md) §3):
Starter gets Main + Contact; Growth adds Store + Landing.

## 2. Branding (per business)

The site is themed by the business **brand palette**:

- `primary_color` — actions, links, primary buttons.
- `secondary_color` — accents/decoration.
- `font_family_heading`, `font_family_body`.
- `logo_url`.

Themes apply through CSS custom properties so a business's colors and fonts flow
through the whole site consistently. (This mirrors a two-color brand token
approach: a primary/action color and a secondary/decor color.)

## 3. SEO (built in, not bolted on)

- Server-side rendering for indexability.
- Per-page `<title>`, meta description, and Open Graph / social tags.
- Clean slugs (`/store/:slug`, offering detail by slug).
- `sitemap.xml` and `robots.txt` per site.
- JSON-LD structured data (Organization; Product for offerings).
- Per-business, published/unpublished control.

## 4. Ordering — WhatsApp handoff (MVP)

The Store does **not** do self-serve checkout in the MVP. Instead:

```
Customer browses Store → builds a cart →
"Order on WhatsApp" → pre-filled message (items, quantities) →
business receives it → confirms and collects payment its own way →
staff records a MANUAL order + payment in the console
```

- Uses the Notifications module to construct the handoff message/link (see
  [NOTIFICATIONS.md](./NOTIFICATIONS.md)).
- The resulting order is a **manual** order on the online-store channel; income
  is recorded when payment is received (see [ORDERS_AND_MONEY.md](./ORDERS_AND_MONEY.md)).
- Self-serve online checkout is a later enhancement; the channel and order model
  already support an `ONLINE` entry mode when it arrives.

## 5. Tenant resolution & safety

- The public site resolves the tenant from a **trusted slug/host mapping**, never
  from client-supplied IDs.
- Only public-appropriate fields are exposed. Never expose cost, internal
  inventory metadata, tenant IDs, or audit data. See [SECURITY.md](./SECURITY.md).
- Business slug is globally unique. Custom domains are future (via a separate
  domain-mapping table, not fields on the business).

## 6. Permissions

`storefront.manage` (edit site content, theme, pages, SEO settings).
