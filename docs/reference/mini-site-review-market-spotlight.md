# Reference — mini-site model in `market-spotlight-site` (Lovable)

Version: 1.0 · Date: 2026-09-14 · **Status: parked until we build the Storefront module (Phase 6).**

A Lovable-built marketplace repo we reviewed for how it models a vendor mini-site
and its settings. Captured here so we can pick the discussion back up when we start
Dokane's Storefront/Mini-site. **Not a decision — an input.** Source repo (local):
`/Users/mahdekh/Documents/GitHub/market-spotlight-site` (read-only reference).

## What their mini-site is

- A **shop = the mini-site**: one `public.shops` row (Supabase/Postgres).
- Rendered as a **single tabbed storefront** (`src/routes/shops.$slug.tsx`):
  full-bleed hero + logo, then tabs **Products · About · Reviews · Policies · Contact**.
- Stack: Vite + TanStack Router/Start (SSR) + Supabase + Tailwind v4 + shadcn/radix,
  bilingual EN/AR via a `useI18n` `t(en, ar)` helper.

## How settings are defined (vendor dashboard)

`src/routes/_authenticated/shop-settings.tsx` — one page, left rail of **12 sections
in 3 groups** (a strong reference for our Storefront + Settings sub-nav):

| Group | Sections |
|-------|----------|
| **Storefront** | Branding · Content (About & policies) · Promotion · Social links · Vacation mode |
| **Selling** | Shipping · Coupons · Package (plan) |
| **Growth** | SEO · Followers · Analytics · Announcements |

Data model (`src/lib/shop-settings.ts`): typed columns for identity/content
(name, slug, tagline, category, city, cover_url, logo_url/logo_text, about,
policies_text, seo_title/description/keywords) **plus jsonb blobs** — `brand`,
`promo`, `social`, `shipping`, `permissions` — each read through a **typed accessor**
(`brandOf`, `promoOf`, `socialOf`, `shippingOf`) that parses the blob with safe
defaults. Shapes: `SocialLinks` (instagram/facebook/youtube/tiktok/website/whatsapp/
email/phone), `PromoSettings` (enabled/eyebrow/title/body/cta_label/cta_url/image_url),
`BrandSettings` (use_defaults/primary/accent/background/heading_font/body_font),
`ShippingSettings` (platform|custom, flat_rate, free_over, eta, pickup).

Patterns worth stealing / comparing:
- **Brand theming = CSS variables.** `brandStyle(shop)` emits `--primary`, `--accent`,
  `--background`, `--font-display`, `--font-sans` on the storefront root. **Same
  token-override approach as Dokane branding.**
- **Inherit-or-override.** Shipping inherits `PLATFORM_SHIPPING` unless `mode:'custom'`;
  brand has `use_defaults`. Mirrors our "mini-site inherits platform brand."
- **Template system.** A `template` column + `TEMPLATES` list (built for many, ships one:
  "editorial"). Plus `IMAGE_SIZES` (recommended upload dims surfaced in the UI) and
  `FONT_CHOICES`.
- **Platform-controlled fields live on the same row** (`permissions`: can_sell,
  publish_direct, featured, manual_orders; `commission_type/value`; `plan_id`), gated by
  RLS — not a separate authorization layer.

## Dokane vs theirs

| | market-spotlight (Lovable) | Dokane (ours) |
|---|---|---|
| Mini-site storage | one `shops` row, jsonb blobs + typed accessors | typed `Branding` table; mini_site is a **module** |
| Structure | single **tabbed** page | planned **4 pages** (Main/Store/Contact/Landing) — see [MINISITE.md](../MINISITE.md) |
| Theming | CSS vars from `brand` jsonb | CSS vars from Branding tokens (same idea) |
| Platform vs vendor fields | co-located on the row (RLS) | **separated** (entitlements + RBAC) |
| Config philosophy | jsonb-first, typed at app layer | ARCHITECTURE §8: *no giant generic settings JSON blob in place of typed configuration* |

## Open threads to resolve when we build the Storefront

1. **jsonb blobs vs typed tables.** Proposed middle: typed tables for anything with
   rules or money (brand ✅, shipping, plan); jsonb acceptable for presentational bags
   (social links, promo copy, SEO). Confirm where the line sits.
2. **Adopt their settings IA shape** for our Storefront/Settings sub-nav (Branding /
   Content / Promotion / Social / Vacation).
3. **Single tabbed storefront vs our 4 pages** — simplicity/cohesion vs SEO/flexibility.
   Decide for the pilot.
4. **Feature inventory to triage into MVP or later**: vacation mode, promo banner,
   followers, coupons, per-shop SEO, reviews/ratings, shop analytics events,
   platform→vendor announcements. Map each to a Dokane module (Notifications, CRM, …)
   or defer.
