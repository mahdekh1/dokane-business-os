# Phase 1–2.5 — Manual Test Checklist

Version: 1.1 · Date: 2026-09-14

Run these flows against the running app to verify Phases 1–2.5 (auth, tenancy,
RBAC, modules, business lifecycle, onboarding + business email/category, module
suggestions, grouped console nav, branding, and the user account/profile). Tick
as you go. Automated coverage for the security-critical rules lives in the API
specs (see [ARCHITECTURE_REVIEW.md](./ARCHITECTURE_REVIEW.md)); this checklist is
the manual/visual pass.

## Run it

```bash
docker compose up -d
pnpm --filter @dokane/api seed          # resets demo data
pnpm --filter @dokane/api build && (cd apps/api && API_PORT=3001 WEB_ORIGIN=http://localhost:3000 node dist/main.js) &
pnpm --filter @dokane/web dev            # http://localhost:3000
```

Open **http://localhost:3000**.

**Seeded logins** — all password `password123`:

| Email | Role | Notes |
|-------|------|-------|
| `admin@dokane.test` | Platform admin | routes to `/admin` |
| `owner.a@dokane.test` | Owner of ABC Store | Growth plan, modules enabled |
| `staff.a@dokane.test` | Staff of ABC Store | limited permissions |
| `owner.b@dokane.test` | Owner of Fashion Store | Starter plan |
| `owner.c@dokane.test` | Owner of Nour Pharmacy | **PENDING approval** |

---

## A. Authentication
- [ ] **Sign up** a new account (`/signup`) → lands on the "Create your business" empty state.
- [ ] **Log out** (avatar, top-right) → back to `/login`.
- [ ] **Log in** as `owner.a@dokane.test` → dashboard.
- [ ] **Wrong password** → "Invalid email or password" (no crash).
- [ ] Reloading the page keeps you logged in (session persists).

## B. Onboarding + pending state
- [ ] As the **new account** from A, click **Set up business** → `/onboarding`.
- [ ] Submit with a blank name/address/phone/**email** → validation error (no create).
- [ ] Enter a **Store URL** with spaces/caps → hint shown; only `a-z 0-9 -` accepted.
- [ ] Pick a **Business category** from the list; choose **Other** → a "Tell us your
      category" field appears and is required.
- [ ] **Business email** is required and validated (a non-email is rejected).
- [ ] Create the business → **"Waiting for approval"** screen (PENDING_APPROVAL).
- [ ] Try the same Store URL again (another business) → "That store URL is taken".
- [ ] As `admin@dokane.test`, open that business's **Review** page → the **Category**
      (label, or the free text for Other) and **Business email** show correctly.

## C. Platform admin — gating + lifecycle
- [ ] Log in as **`owner.a`** and visit `/admin` directly → bounced to `/dashboard` (not a platform admin).
- [ ] Log in as **`admin@dokane.test`** → lands on `/admin`; metrics reflect real counts.
- [ ] **Nour Pharmacy** appears under Pending applications → click **Review**.
- [ ] Review page shows business + owner details; click **Approve** → returns to overview, business now **Active**, metrics update.
- [ ] Open an approved business → **Suspend** → status Suspended; then **Reactivate** → Active.
- [ ] Approve/Review a pending business via **Request changes** (with a note) → status Changes requested.
- [ ] Approve or reject that business → status updates; invalid actions are refused.

## D. Owner sees status changes
- [ ] Log in as `owner.c@dokane.test` **before** approval → "Waiting for approval".
- [ ] After **admin approves** Nour Pharmacy, log in as `owner.c` → full dashboard (no longer pending).
- [ ] After **admin suspends** a business, its owner sees "Business suspended".

## E. Modules + entitlements
- [ ] As `owner.a`, open **Manage plan** (sidebar card) → `/modules`.
- [ ] Header shows the real plan ("Growth plan · N of 10 modules active").
- [ ] Modules are grouped **Active / Available / Locked**.
- [ ] Click **Enable** on an Available module (e.g. Notifications) → it becomes Active and appears in the sidebar nav.
- [ ] Locked modules (Projects, AI on Growth) show **Upgrade to unlock** and can't be enabled.
- [ ] As `owner.b` (Starter), fewer modules are available; more are Locked.
- [ ] **Suggested for the category**: available modules that suit the business category
      (e.g. Catalog + Mini-site for a Fashion/Starter business) float to the top with a
      **Suggested** chip + highlight. Locked/active modules never show the chip.

## F. Branding
- [ ] As `owner.a`, open **Settings** → `/settings/branding`.
- [ ] Change the **primary/secondary colours** → the **Storefront preview** updates live.
- [ ] Change **heading/body fonts** → preview re-renders in the chosen fonts.
- [ ] **Save changes** → "Saved"; reload the page → values persist.
- [ ] Switch to another business (business switcher) → its branding is independent.

## G. Tenancy + RBAC
- [ ] Business switcher (top bar) lists your businesses; switching changes the sidebar/plan.
- [ ] Log in as `staff.a` → can see the dashboard but has fewer nav items / no roles or settings access where not permitted.
- [ ] (API) A user cannot load another business's data by changing `X-Business-Id` — returns 403.

## H. Console shell + grouped nav (IA)
- [ ] Sidebar nav is **built from enabled modules** (server-driven), not hard-coded.
- [ ] Each module is a **collapsible group**; expanding it shows its sub-pages + a
      **Settings** item. The active group auto-expands.
- [ ] **Storefront** is one group (mini-site pages + online store); **Sales Channels**
      is a separate group with In-store / Online Store / Connect to Marketplace.
- [ ] The **Online Store** entry under Sales Channels deep-links into Storefront and
      does **not** double-highlight or force the Channels group open.
- [ ] Disabled modules (e.g. Projects/AI on Growth) show **no** group.
- [ ] Sub-routes not built yet show a **"Coming soon"** placeholder; `/settings/branding`
      still shows the real Branding screen.
- [ ] Dashboard tiles + recent orders render (sample data, labelled).
- [ ] Light/dark follows your OS theme.

## I. Account / profile
- [ ] Top-right **avatar → Account & profile** opens `/account`.
- [ ] Edit **first/last name, phone, language** → **Save changes** → "Saved"; reload →
      values persist.
- [ ] **Email** is shown but read-only.
- [ ] **Change password** with the wrong current password → "current password is
      incorrect"; with the right one → "Password updated", and you can log in with the
      new password (old one no longer works).

---

Report anything that misbehaves and I'll fix it before Phase 3.
