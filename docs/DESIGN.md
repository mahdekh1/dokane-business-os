# Design System

Version: 1.0 · Date: 2026-09-13

The approved visual system for the Dokane console, admin, and auth surfaces.
Business mini-sites use per-business branding (the `branding` table) and are
specified in [MINISITE.md](./MINISITE.md); this document covers the **platform**
chrome.

## Direction

Chosen from Common / Modern / Elegant explorations: **Modern** — a
product-forward treatment with a bold brand panel on auth, a classic labelled
left sidebar in the console, rounded surfaces, and a confident grotesque type
voice. (Approved mocks: login, signup, console shell A, platform admin.)

## Platform brand kit (customizable)

The platform's identity lives as CSS tokens in
[`apps/web/app/globals.css`](../apps/web/app/globals.css) `:root` (with dark
overrides). Editing these re-skins the whole console — this is the mechanism a
platform admin will drive later.

| Token | Light | Role |
|-------|-------|------|
| `--brand` | `#0E6A57` | primary — actions, links, active nav |
| `--brand-2` | `#0A5344` | hover/press |
| `--on-brand` | `#EAF3EF` | text on brand |
| `--accent` | `#D98E4B` | secondary/decor, used sparingly |
| `--canvas` | `#F3F2ED` | app background |
| `--surface` | `#FFFFFF` | cards, top bar |
| `--field` | `#F5F4EF` | inputs |
| `--ink` | `#17150F` | text |
| `--muted` | `#6F6A60` | secondary text |
| `--border` | `#E4DFD5` | hairlines |
| `--nav` | `#0E100E` | sidebar (teal-ink) |

Dark theme redefines the same tokens (see globals.css). Semantic colors
(approved/pending/suspended = green/amber/red) are kept distinct from `--accent`.

**Type:** display **Fraunces** (`--font-display`, wordmark + editorial
headings), UI **Hanken Grotesk** (`--font-ui`, everything else). Loaded via
`next/font/google` in the root layout. Deliberately not Inter/Space Grotesk.

**Logo:** a rounded-square "D" mark with a clay dot (`src/components/logo.tsx`) —
placeholder for the real logo asset when provided.

Tailwind maps these tokens to utilities (`bg-brand`, `text-ink`, `border-line`,
`font-display`, …) in `tailwind.config.ts`, so components stay token-driven.

## Layouts

- **Auth** (`app/(auth)/*`): split — a bold teal brand panel (gradient + dotted
  texture, logo, headline, benefit chips) beside a calm form; language switcher
  for RTL/i18n. `AuthShell` shares the panel between login and signup.
- **Console** (`app/(app)/layout.tsx`): **classic left sidebar** (Option A) on
  `--nav`, with a labelled nav **built from `GET /modules`** (only `active`
  modules; order in `src/lib/module-nav.ts`), Dashboard on top and Settings at
  the foot, plus a plan card. Top bar carries the **business switcher** (sets the
  `X-Business-Id` header via `src/lib/session.ts`), `+ New`, notifications, and
  the user avatar (sign out).
- **Platform admin** (`app/(platform)/*`): the same sidebar with a "Platform
  admin" badge and platform nav (Overview, Businesses, Approvals, Users, Audit,
  Settings); no business switcher. *(Access control is wired in Task 2.1.)*

## Notes

- Built with **Tailwind + the token layer**, not full shadcn/ui; shadcn
  primitives can be layered in later for complex widgets (dialogs, menus,
  tables) without changing the token system.
- Auth session is client-side (`localStorage`) for the MVP; the httpOnly-cookie
  hardening path is noted in [POST_MVP_CHANGES.md](./POST_MVP_CHANGES.md).
- Every surface ships light + dark and keyboard focus states.
