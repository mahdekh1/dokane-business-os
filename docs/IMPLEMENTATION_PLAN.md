# Dokane Business OS — MVP Implementation Plan

> **For agentic workers:** this plan is executed by two tools — **Claude CLI**
> (Claude Code) for architecture/backend/security/tests, and **Lovable** for
> frontend scaffolding. Steps use checkbox (`- [ ]`) syntax for tracking. Work
> **contracts-first**: Claude defines the typed contract + API + migrations for a
> feature, then Lovable builds its UI against that contract.

**Goal:** Ship the Dokane Business OS MVP — a modular, multi-tenant platform with
a working module framework and the MVP-built modules (Catalog, Inventory,
Channels, Orders/Money, CRM, Project Management, Mini-site, Notifications, AI
agent).

**Architecture:** Modular monolith, service-ready — `apps/web` (Next.js) +
`apps/api` (NestJS) + `apps/worker` (BullMQ), PostgreSQL/Prisma, Redis, an
in-process event bus and a transactional outbox. Modules communicate only through
Zod contracts and events.

**Tech Stack:** TypeScript · NestJS · Next.js (App Router) · PostgreSQL · Prisma ·
Zod · Redis/BullMQ · Tailwind + shadcn/ui · pnpm workspaces · Docker · Jest +
Supertest · Playwright.

---

## Global Constraints

Every task's requirements implicitly include these. Copy verbatim.

- **Tenant safety:** every tenant-owned row has `business_id`; tenant context is
  derived from the authenticated membership, **never** from client input. No
  endpoint accepts `business_id` from body/query/URL.
- **Two access layers:** entitlement (plan → module) is checked before
  permission (role → action); both server-side.
- **Money:** integer minor units + separate currency code. Never floating point.
- **Time:** store UTC, display in business/user timezone.
- **Transactions:** order/payment/inventory writes are atomic; every stock change
  writes an inventory movement; slow/external work is enqueued, never inside a
  transaction.
- **Idempotency:** order creation and payment recording accept `Idempotency-Key`.
- **Soft delete:** deactivate entities with historical references; never
  hard-delete orders; audit logs append-only.
- **i18n/RTL:** no hard-coded user-facing strings; translation keys; logical CSS
  (`margin-inline-start`, not `margin-left`).
- **No client-authoritative prices/totals:** server computes them.
- **Every feature ships with tests** (unit + integration; E2E for flows) and a
  security check from [SECURITY.md](./SECURITY.md) before merge.

**Design decisions resolved in the 2026-09-13 architecture review** (applied
throughout this plan):
- **Customers is a core table** (created before Orders, Task 3.6); the **CRM
  module** adds leads/pipeline/source on top.
- **Tenant actor/assignee references** (`created_by`, `assignee_id`, …) point to
  `business_memberships.id`, not `users.id`.
- **Catalog permissions/events use `catalog.offerings.*` / `catalog.offering.*`**
  (not "products"); the model is `offerings`.
- **Sales channels carry `fulfillment_location_id`** (required for
  `ONLINE_STORE`) as the stock source for online orders.
- **A membership's role** must be a system BUSINESS-scope role or a custom role
  of the same business (guard + DB check).
- **Approving a business provisions a default Starter subscription.**
- **Discounts are minor-unit amounts; `tax_amount` is a `0` placeholder;
  refunds are inert** in the MVP.
- **Persisted media stores a storage key**, not an absolute URL.

Authority docs: [ARCHITECTURE.md](./ARCHITECTURE.md) · [MODULES.md](./MODULES.md)
· [DATA_MODEL.md](./DATA_MODEL.md) · [SECURITY.md](./SECURITY.md) ·
[ORDERS_AND_MONEY.md](./ORDERS_AND_MONEY.md) · [RBAC.md](./RBAC.md).

---

## Working model — how Claude CLI and Lovable sync

**Repository is the single source of truth. `main` is protected.** Contracts in
`packages/contracts` are the interface between the two tools.

**Branch naming**
- Claude CLI backend/framework: `be/<phase>-<slug>` (e.g. `be/03-catalog`).
- Claude CLI contracts: folded into the backend branch (contracts ship *before*
  the UI that needs them).
- Lovable UI: `ui/<phase>-<slug>` (e.g. `ui/03-catalog`).

**The loop for every feature**
1. **Claude CLI** creates `be/*`: Prisma models + migration, Zod contracts, API
   (controller/service/repo), guards, events, unit + integration tests. Opens a
   PR, runs tests + a tenant-isolation check, merges to `main`.
2. **Lovable** syncs `main` (Lovable → *GitHub → Sync/Pull*), creates its UI on
   `ui/*` **against the merged contracts**, pushes via its GitHub integration.
3. **Claude CLI** pulls `ui/*`, reviews for security/performance (no secrets in
   client, no client-authoritative money, no N+1 in server components), wires any
   loose ends, runs typecheck + web tests, merges to `main`.

**Standard sync commands (Claude CLI side)**

```bash
# Start a backend feature
git checkout main && git pull --rebase origin main
git checkout -b be/<phase>-<slug>
# ... implement + test ...
git push -u origin be/<phase>-<slug>
gh pr create --fill --base main --title "feat(api): <slug>"
# after green CI + self-review:
gh pr merge --squash --delete-branch

# Receive Lovable's UI branch
git fetch origin
git checkout ui/<phase>-<slug> && git pull origin ui/<phase>-<slug>
pnpm install
pnpm --filter web typecheck && pnpm --filter web test
# review, then integrate
git checkout main && git pull --rebase origin main
git merge --no-ff ui/<phase>-<slug> && git push origin main
```

**Lovable side (UI actions, not a terminal)**
- Before building: **GitHub → Sync** to pull the latest `main` (so the merged
  contracts and API are present).
- Configure Lovable's Supabase/DB connection **off**; Lovable calls the NestJS
  API via the typed client in `packages/contracts`. Lovable must not invent a
  data model or call the database directly.
- After building: Lovable pushes to `ui/<phase>-<slug>` through its GitHub
  integration; then notify Claude CLI to review/merge.

**Guardrail:** Lovable never edits `packages/contracts`, `apps/api`, Prisma
schema, migrations, or anything under `**/auth`, `**/rbac`, `**/tenancy`. If a UI
need requires a contract change, Claude CLI makes it on a `be/*` branch first.

**Per-task legend**
- **Owner** — Claude CLI or Lovable.
- **Prompt** — copy-paste instruction for that tool.
- **Verify** — command(s) + expected result.
- **Sync** — the git handoff for this task (uses the standard commands above).

---

# Phase 0 — Repository & tooling

### Task 0.1 — Monorepo scaffold
**Owner:** Claude CLI · **Files:** `package.json`, `pnpm-workspace.yaml`,
`turbo.json`, `apps/{web,api,worker}`, `packages/{contracts,ui,module-sdk,config}`,
`docker-compose.yml`, `.env.example`, `tsconfig.base.json`.
**Deliverable:** installable pnpm workspace; Postgres + Redis via docker-compose;
`apps/api` boots a NestJS "health" endpoint; `apps/web` boots Next.js; `apps/worker`
boots a BullMQ worker connecting to Redis.
**Security/Perf:** `.env.example` only (no real secrets); pin dependency
versions; enable strict TypeScript.
**Prompt — Claude CLI:**
> Scaffold a pnpm + Turborepo monorepo named `dokane`. Create `apps/web`
> (Next.js App Router + TypeScript + Tailwind + shadcn/ui), `apps/api` (NestJS +
> TypeScript, strict), `apps/worker` (Node + BullMQ), and packages `contracts`
> (Zod), `ui`, `module-sdk`, `config`. Add `docker-compose.yml` with Postgres 16
> and Redis 7. Add a `/health` route to api returning `{status:'ok'}` and a
> worker that logs "worker up" on boot. Provide `.env.example` with the variables
> from DELIVERY.md §5. Wire root scripts: `dev`, `build`, `typecheck`, `test`,
> `lint`. Do not add product code yet.
**Verify:**
```bash
docker compose up -d && pnpm install && pnpm --filter api build
pnpm --filter api start & sleep 3 && curl -s localhost:3000/health   # {"status":"ok"}
```
**Sync:** `be/00-scaffold` → PR → merge `main`. Then Lovable *Sync from GitHub*.
- [ ] Scaffold created and boots

### Task 0.2 — CI pipeline
**Owner:** Claude CLI · **Files:** `.github/workflows/ci.yml`.
**Deliverable:** PR pipeline: install → lint → typecheck → unit → integration
(with a Postgres service) → build. Migrations run against the CI DB.
**Security/Perf:** cache pnpm; run integration tests against an ephemeral DB;
fail the build on type errors.
**Prompt — Claude CLI:**
> Add a GitHub Actions workflow `ci.yml` triggered on PRs to `main`. Steps:
> checkout, setup pnpm + Node 20, `pnpm install --frozen-lockfile`, `lint`,
> `typecheck`, start a Postgres 16 service, run `prisma migrate deploy` against
> it, `pnpm test`, `pnpm build`. Cache the pnpm store.
**Verify:** open a trivial PR; CI is green.
**Sync:** `be/00-ci` → PR → merge.
- [ ] CI green on a test PR

---

# Phase 1 — Foundation (tenancy, auth, RBAC, module SDK)

> This is the highest-risk phase. Isolation and authorization correctness here
> protect everything above. Extra test rigor is mandatory.

### Task 1.1 — Prisma base schema: users, businesses, memberships, roles, permissions
**Owner:** Claude CLI · **Files:** `apps/api/prisma/schema.prisma`, migration,
`apps/api/src/prisma/prisma.service.ts`.
**Interfaces — Produces:** Prisma models `User`, `Business`, `BusinessMembership`,
`Role`, `Permission`, `RolePermission` per [DATA_MODEL.md](./DATA_MODEL.md) §1.
**Deliverable:** migrated schema with tenant-scoped indexes and the
`(business_id, user_id)` unique on memberships.
**Security/Perf:** `business_id` FK + index on every tenant table added later;
enum-like `status` columns; no cascading delete on historical data.
**Prompt — Claude CLI:**
> Implement the Prisma schema for §1 of DATA_MODEL.md (users, businesses,
> business_memberships, roles, permissions, role_permissions). Use UUID PKs,
> `createdAt/updatedAt`, the business status enum, and unique
> `(businessId,userId)` on memberships. Add a PrismaService. Generate a migration
> and apply it. No business logic yet.
**Verify:**
```bash
pnpm --filter api exec prisma migrate deploy
pnpm --filter api exec prisma validate    # Schema valid
```
**Sync:** `be/01-schema-core` → PR → merge.
- [ ] Migration applies; schema valid

### Task 1.2 — Authentication
**Owner:** Claude CLI · **Files:** `apps/api/src/modules/auth/*`,
`packages/contracts/src/auth.ts`.
**Interfaces — Produces:** `POST /api/v1/auth/{signup,login,logout,refresh}`;
issues a session/JWT carrying `userId` only (no tenant). Zod: `SignupInput`,
`LoginInput`, `AuthTokens`.
**Deliverable:** working signup/login with hashed passwords (argon2/bcrypt),
session issuance, refresh, logout.
**Security/Perf:** password hashing with a strong KDF; rate-limit login and
password reset; secure/httpOnly cookies or short-lived tokens; never log
credentials; generic error on bad login (no user enumeration).
**Prompt — Claude CLI:**
> Build an `auth` module: signup (create User, hash password with argon2), login
> (verify, issue tokens), refresh, logout. The token encodes `userId` only —
> **no tenant**. Add Zod contracts in `packages/contracts/src/auth.ts` and export
> a typed client. Add rate limiting on login and a generic "invalid credentials"
> error. Unit-test the hashing and token service; integration-test the endpoints.
**Verify:**
```bash
pnpm --filter api test auth
# integration: signup → login returns tokens; bad password → 401 generic
```
**Sync:** `be/01-auth` → PR → merge.
- [ ] Auth endpoints pass integration tests

### Task 1.3 — Tenant context + guards (the isolation core)
**Owner:** Claude CLI · **Files:** `apps/api/src/modules/tenancy/*`,
`apps/api/src/common/guards/{auth,membership,entitlement,permission}.guard.ts`,
`apps/api/src/common/tenant-context.ts`.
**Interfaces — Produces:** a `TenantContext {userId, businessId, role,
permissions}` resolved per request; decorators `@RequireBusiness()`,
`@RequirePermission('code')`, `@RequireEntitlement('key')`; a `@Ctx()` param
decorator injecting `TenantContext`.
**Deliverable:** guards that (a) authenticate, (b) resolve the membership for the
requested business from the **authenticated user**, (c) reject if business
inactive, (d) check entitlement, (e) check permission. The business is selected
by an explicit header (e.g. `X-Business-Id`) that is **validated against the
user's memberships**, never trusted blindly.
**Security/Perf:** the header only *selects among the user's own memberships*; a
business the user is not a member of yields 403 as if it did not exist. Cache the
permission set per request.
**Prompt — Claude CLI:**
> Implement tenant resolution and guards. A request may carry `X-Business-Id`;
> resolve the caller's `BusinessMembership` for that business — if none, 403.
> Build an ordered guard chain: AuthGuard → MembershipGuard (loads
> TenantContext, checks business active) → EntitlementGuard(@RequireEntitlement)
> → PermissionGuard(@RequirePermission). Provide a `@Ctx()` decorator. Write
> integration tests proving a user cannot resolve a business they are not a
> member of, and that `X-Business-Id` pointing at another tenant yields 403.
**Verify — include this test:**
```ts
it('rejects X-Business-Id for a business the user is not a member of', async () => {
  const { tokenA } = await seedUserInBusiness('A');
  const bizB = await seedBusiness('B');
  const res = await request(app).get('/api/v1/business')
    .set('Authorization', `Bearer ${tokenA}`)
    .set('X-Business-Id', bizB.id);
  expect(res.status).toBe(403);
});
```
```bash
pnpm --filter api test tenancy   # all pass, including the above
```
**Sync:** `be/01-tenancy` → PR → merge.
- [ ] Isolation guard tests pass

### Task 1.4 — RBAC: roles, permissions, per-tenant custom roles
**Owner:** Claude CLI · **Files:** `apps/api/src/modules/rbac/*`,
`packages/contracts/src/rbac.ts`.
**Interfaces — Produces:** default system roles seeding; `GET/POST/PATCH
/api/v1/roles`; permission catalog composed from enabled modules; `roles.manage`
permission.
**Deliverable:** default roles (OWNER/MANAGER/INVENTORY_MANAGER/STAFF +
PLATFORM_ADMIN); ability to create a tenant-custom role and assign permissions
from enabled modules.
**Security/Perf:** system roles immutable but cloneable; assigning a permission
not in the tenant's enabled-module catalog is rejected.
**Prompt — Claude CLI:**
> Implement RBAC per RBAC.md: seed system roles + their permissions, expose role
> CRUD scoped to a tenant (custom roles carry businessId), and compose the
> assignable permission catalog from the tenant's enabled modules. Reject
> assigning a permission whose module is not enabled. Test: OWNER has all;
> a custom "Cashier" role without `catalog.offerings.create` is refused when
> creating a product.
**Verify:**
```bash
pnpm --filter api test rbac
```
**Sync:** `be/01-rbac` → PR → merge.
- [ ] RBAC tests pass

### Task 1.5 — Module SDK + registry + entitlements
**Owner:** Claude CLI · **Files:** `packages/module-sdk/src/*`,
`apps/api/src/modules/registry/*`, schema additions (`plans`, `entitlements`,
`plan_entitlements`, `subscriptions`, `addon_entitlements`, `module_states`).
**Interfaces — Produces:** `ModuleManifest` type; `registerModule()`; a registry
service exposing enabled modules, nav, permission catalog and agent tools for a
tenant; `GET /api/v1/modules`, `POST /api/v1/modules/:id/enable`.
**Deliverable:** modules declare manifests; a tenant with the right entitlement
can enable a module; enabling activates its permissions/nav.
**Security/Perf:** enable requires `modules.enable` permission AND the module's
`requiredEntitlement`; dependency check before enable.
**Prompt — Claude CLI:**
> Build the module SDK: a `ModuleManifest` type (id, name, version, dependsOn,
> requiredEntitlement, permissions, navigation, events, agentTools) and a
> `registerModule` helper. Add registry entities (plans, entitlements,
> plan_entitlements, subscriptions, addon_entitlements, module_states). Implement
> `GET /modules` (returns active/available/locked per the tenant's entitlements)
> and `POST /modules/:id/enable` (checks `modules.enable` permission,
> requiredEntitlement, and dependsOn). Test enable-succeeds-when-entitled and
> enable-fails-when-not.
**Verify:**
```bash
pnpm --filter api test registry
```
**Sync:** `be/01-module-sdk` → PR → merge.
- [ ] Registry + entitlement tests pass

### Task 1.6 — Event bus + transactional outbox
**Owner:** Claude CLI · **Files:** `apps/api/src/common/events/*`,
`outbox` model + migration, `apps/worker/src/relay.ts`, BullMQ setup.
**Interfaces — Produces:** `EventBus.emit(event, payload)` that writes an outbox
row inside the current transaction; a relay that publishes outbox rows to BullMQ;
a typed subscriber registration.
**Deliverable:** an event emitted inside a DB transaction is delivered to a
worker subscriber exactly once after commit; rollback drops it.
**Security/Perf:** outbox relay is idempotent (marks rows processed); backoff on
failures; no external calls in the request transaction.
**Prompt — Claude CLI:**
> Implement a transactional outbox: `EventBus.emit` inserts an `outbox` row in
> the active Prisma transaction. A relay in `apps/worker` polls unprocessed rows,
> publishes to a BullMQ queue, marks them processed (idempotent). Provide typed
> subscriber registration. Test: emitting inside a rolled-back transaction
> delivers nothing; inside a committed one delivers exactly once.
**Verify — include this test:**
```ts
it('does not deliver events from a rolled-back transaction', async () => {
  await expect(prisma.$transaction(async (tx) => {
    await bus.emit(tx, 'test.evt', { x: 1 });
    throw new Error('rollback');
  })).rejects.toThrow();
  await runRelayOnce();
  expect(received).toHaveLength(0);
});
```
```bash
pnpm --filter api test events && pnpm --filter worker test relay
```
**Sync:** `be/01-events` → PR → merge.
- [ ] Outbox exactly-once + rollback tests pass

### Task 1.7 — Audit foundation
**Owner:** Claude CLI · **Files:** `apps/api/src/modules/audit/*`, `audit_logs`
model.
**Deliverable:** an append-only `AuditService.record(ctx, action, entity, meta)`;
subscribers write audit rows for security-sensitive events.
**Security/Perf:** metadata never contains secrets; append-only from app APIs.
**Prompt — Claude CLI:**
> Add an `audit` module with an append-only `AuditService.record`. Wire it to log
> business approval/suspension, user create/disable, role change, and module
> enable. Redact any secret-like fields. Test that a record is written and cannot
> be updated via the service.
**Verify:** `pnpm --filter api test audit`
**Sync:** `be/01-audit` → PR → merge.
- [ ] Audit tests pass

### Task 1.8 — App shells (console, admin) + auth UI
**Owner:** Lovable · **Files:** `apps/web/app/(auth)/*`, `apps/web/app/(app)/*`,
`apps/web/app/(platform)/*`, shared layout, the typed API client usage.
**Deliverable:** login/signup screens; an authenticated business console shell
with dynamic navigation driven by `GET /modules`; a platform-admin shell.
Business selector uses the user's memberships and sets `X-Business-Id`.
**Security/Perf:** tokens in httpOnly cookies (Claude provides the endpoint
contract); no secrets in client bundle; nav is built from the server's
module/permission response, not hard-coded.
**Prompt — Lovable:**
> Using the typed client in `packages/contracts`, build: (1) auth pages
> (login, signup) calling `/api/v1/auth`; (2) an authenticated console layout
> with a sidebar whose items come from `GET /api/v1/modules` (only active
> modules, only nav the user's permissions allow); (3) a business switcher from
> the user's memberships that sets the `X-Business-Id` header on the API client;
> (4) a separate platform-admin layout. Use RTL-ready logical CSS and translation
> keys — no hard-coded strings. Do not call any database directly; only the API.
**Verify (Claude CLI after merge):**
```bash
pnpm --filter web typecheck && pnpm --filter web test
# manual: login → console shows only enabled modules' nav
```
**Sync:** Lovable `ui/01-shell` → Claude reviews (no client-side authz decisions,
nav server-driven) → merge `main`.
- [ ] Shells render; nav is server-driven

### Task 1.9 — Seed + tenant-isolation test suite (Business A/B)
**Owner:** Claude CLI · **Files:** `apps/api/prisma/seed.ts`,
`apps/api/test/isolation.e2e-spec.ts`.
**Deliverable:** seed platform admin + Business A + Business B with users; the
full isolation suite from [SECURITY.md](./SECURITY.md) §8 (all must fail to
cross tenants).
**Security/Perf:** run in CI; treat any passing cross-tenant access as a build
failure.
**Prompt — Claude CLI:**
> Write a seed creating a platform admin, Business A and Business B, each with an
> owner and a staff user and sample offerings. Implement the SECURITY.md §8
> isolation E2E suite: A attempting to read/update/delete B's offering,
> inventory, customer, order, reports, storefront admin, module-enable and
> payment — each must be 403/404. Test with swapped URL IDs, manipulated bodies,
> query params and direct calls. Add to CI.
**Verify:** `pnpm --filter api test:e2e isolation` — every cross-tenant attempt
fails.
**Sync:** `be/01-isolation` → PR → merge. **Phase-1 gate.**
- [ ] Isolation suite green; **do not proceed until this passes**

---

# Phase 2 — Business workflow (onboarding, approval, Modules page, branding)

### Task 2.1 — Business creation + lifecycle
**Owner:** Claude CLI · **Files:** `apps/api/src/modules/businesses/*`, contracts.
**Interfaces — Produces:** `POST /api/v1/business` (creates business +
PENDING_APPROVAL + owner membership); platform endpoints
`POST /api/v1/platform/businesses/:id/{approve,reject,request-changes,suspend,reactivate}`.
**Deliverable:** the lifecycle state machine with guards preventing
transact-while-not-approved.
**Security/Perf:** only PLATFORM_ADMIN can approve/reject/suspend; lifecycle is a
single status enum, not booleans.
**Prompt — Claude CLI:**
> Implement business creation (status PENDING_APPROVAL, create OWNER membership)
> and platform lifecycle transitions (approve/reject/request-changes/
> suspend/reactivate) gated by `platform.businesses.*`. Add a guard so
> non-APPROVED businesses cannot create orders/payments/inventory (reuse in later
> modules). Audit each transition. Test the full state machine and the
> transact-blocked rule.
**Verify:** `pnpm --filter api test businesses`
**Sync:** `be/02-businesses` → PR → merge.
- [ ] Lifecycle + block-when-not-approved tests pass

### Task 2.2 — Onboarding + platform review UI
**Owner:** Lovable · **Files:** `apps/web/app/(app)/onboarding/*`,
`apps/web/app/(platform)/businesses/*`.
**Deliverable:** signup→create-business wizard; "pending approval" state; admin
list of applications with approve/reject/request-changes; onboarding checklist.
**Security/Perf:** all actions via API; show server-provided status only.
**Prompt — Lovable:**
> Build the onboarding wizard (account → business details → pending screen) and
> the platform-admin businesses list with approve/reject/request-changes actions,
> all against the businesses API. Add a post-approval onboarding checklist
> (create location → enable modules → add offerings → publish site). RTL-ready,
> translation keys.
**Verify (Claude):** `pnpm --filter web typecheck && pnpm --filter web test`
**Sync:** `ui/02-onboarding` → review → merge.
- [ ] Onboarding + admin review flow works end-to-end

### Task 2.3 — Modules page + billing (entitlements)
**Owner:** Claude CLI (API) + Lovable (UI) · **Files:** registry endpoints (from
1.5), `apps/web/app/(app)/modules/*`.
**Deliverable:** a Modules page listing modules as active/available/locked with
enable + upgrade prompts; plan/subscription display.
**Security/Perf:** enable calls check permission + entitlement server-side; UI
never enables a locked module client-side.
**Prompt — Lovable:**
> Build the Modules page from `GET /api/v1/modules`: cards showing
> active/available/locked, an Enable button (calls `POST /modules/:id/enable`) for
> entitled modules, and an upgrade prompt for locked ones. Show the current plan.
**Verify:** enabling a module updates the nav (server-driven) on reload.
**Sync:** `ui/02-modules` → review → merge.
- [ ] Modules page reflects entitlements; enable works

### Task 2.4 — Branding & theming
**Owner:** Claude CLI (API) + Lovable (UI) · **Files:**
`apps/api/src/modules/branding/*`, `packages/ui/src/theme/*`,
`apps/web/app/(app)/settings/branding/*`.
**Deliverable:** per-business brand (primary/secondary color, heading/body fonts,
logo) stored and exposed; theme applied via CSS custom properties across console
and mini-site.
**Security/Perf:** validate colors/font choices; logo upload via the media
endpoint (Task 3.4).
**Prompt — Claude CLI:** Implement branding storage + `GET/PATCH
/api/v1/business/branding`; emit CSS variables from the values.
**Prompt — Lovable:** Build the branding settings screen and a theme provider that
reads brand values and sets `--color-primary`, `--color-secondary`, font
variables. Apply to the mini-site too.
**Verify:** changing a color updates the console + mini-site theme.
**Sync:** `be/02-branding` → merge; then `ui/02-branding` → merge.
- [ ] Brand values drive the theme

---

# Phase 3 — Catalog & Inventory

### Task 3.1 — Catalog schema + offerings API (with types & variants)
**Owner:** Claude CLI · **Files:** `apps/api/src/modules/catalog/*`, schema
(`categories`, `offerings`, `offering_variants`, `offering_media`), contracts,
`catalog.manifest.ts`.
**Interfaces — Produces:** CRUD for categories/offerings/variants; offering `type`
discriminator; variant canonical key helper; tenant-scoped SKU/barcode
uniqueness; permissions `catalog.*`.
**Deliverable:** create/list/update/soft-delete offerings (simple + variant),
paginated + filtered.
**Security/Perf:** tenant-scoped unique `(business_id, sku)`/`(business_id,
barcode)`; variant attributes matched on a **sorted canonical key** (jsonb
normalizes key order); pagination + indexes; reject unknown fields.
**Prompt — Claude CLI:**
> Implement the catalog module per DATA_MODEL.md §4: categories, offerings (with
> `type` PHYSICAL/VIRTUAL/SERVICE and an extensible discriminator), variants with
> a sorted canonical attribute key, and media rows. Enforce tenant-scoped
> SKU/barcode uniqueness. CRUD with pagination/filter, soft delete. Register the
> catalog manifest (permissions `catalog.offerings.*`, nav, event
> `catalog.offering.created`, agentTool `catalog.draft_offering_content` stub).
> Tests: variant key stability
> across key order; duplicate SKU rejected; cross-tenant SKU allowed.
**Verify — include:**
```ts
it('matches a variant regardless of attribute key order', () => {
  expect(variantKey({color:'red',size:'M'})).toBe(variantKey({size:'M',color:'red'}));
});
```
```bash
pnpm --filter api test catalog
```
**Sync:** `be/03-catalog` → PR → merge.
- [ ] Catalog tests pass (variant key, uniqueness, isolation)

### Task 3.2 — Catalog UI
**Owner:** Lovable · **Files:** `apps/web/app/(app)/catalog/*`.
**Deliverable:** offerings list (search/filter/paginate), create/edit form with
type selector and a variant matrix editor, category management, media upload.
**Security/Perf:** use server pagination; the variant matrix uses the same
canonical key helper from contracts to preserve rows; never send `business_id`.
**Prompt — Lovable:**
> Build the catalog UI against the catalog contracts: a paginated offerings table
> with search/filter, a create/edit form (type selector; price in minor units via
> a money input that stores integers), a variant matrix editor that regenerates
> rows using the `variantKey` helper from `packages/contracts` (so existing
> variant price/SKU/stock survive), category CRUD, and image upload to the media
> endpoint. RTL-ready, translation keys.
**Verify (Claude):** typecheck + web tests; manual variant edit preserves rows.
**Sync:** `ui/03-catalog` → review → merge.
- [ ] Catalog UI works; variant editing preserves rows

### Task 3.3 — Inventory (items, movements, low-stock)
**Owner:** Claude CLI · **Files:** `apps/api/src/modules/inventory/*`, schema
(`inventory_items`, `inventory_movements`), contracts.
**Interfaces — Produces:** `GET /inventory`, `POST /inventory/adjustments`,
`GET /inventory/movements`; `adjustStock(ctx, stockableItem, locationId, delta,
reason)` that **always writes a movement** in the same transaction.
**Deliverable:** per-location stock; initial stock; adjustments; movement history;
low-stock threshold + query.
**Security/Perf:** movement on every change (enforced in one service path);
transactional locking to prevent lost updates; location + offering ownership
checks.
**Prompt — Claude CLI:**
> Implement inventory per DATA_MODEL.md §6. All stock changes go through
> `adjustStock`, which writes an `inventory_movement` in the same transaction —
> there must be no other code path that mutates quantity. Support INITIAL_STOCK
> and ADJUSTMENT now (SALE/RETURN come from orders). Add low-stock threshold and a
> low-stock query. Tests: adjusting stock creates exactly one movement;
> concurrent adjustments don't lose updates (row lock).
**Verify:** `pnpm --filter api test inventory`
**Sync:** `be/03-inventory` → PR → merge.
- [ ] Every change writes a movement; concurrency safe

### Task 3.4 — Media storage driver + upload endpoint
**Owner:** Claude CLI · **Files:** `apps/api/src/modules/media/*`,
`packages/config/src/storage/{driver.ts,local.ts,s3.ts}`.
**Interfaces — Produces:** `StorageDriver` interface; `LocalDiskDriver` (MVP) and
an `S3Driver` (ready, unused); `POST /api/v1/catalog/offerings/:id/media`; served
at `/api/v1/public/media/*`.
**Deliverable:** validated, tenant-scoped, server-keyed uploads via the local
driver.
**Security/Perf:** validate MIME/extension/size; server-generated storage keys;
never trust filename; stream, don't buffer whole files into memory.
**Prompt — Claude CLI:**
> Implement a `StorageDriver` interface with `put/get/delete/url`. Provide a
> `LocalDiskDriver` (tenant-scoped path, server-generated key) selected by
> `STORAGE_DRIVER=local`, and a stubbed `S3Driver` selected by `s3`. Build the
> media upload endpoint with MIME/extension/size validation, streaming, and a
> public media route. Tests: rejects a non-image; stores under a tenant path;
> generated key ignores the client filename.
**Verify:** `pnpm --filter api test media`
**Sync:** `be/03-media` → PR → merge.
- [ ] Uploads validated + tenant-scoped via driver

### Task 3.5 — Lovable UI for Lovable→API media (wire-up review)
**Owner:** Claude CLI · **Deliverable:** confirm the catalog UI (3.2) uploads
through the media endpoint and renders public URLs; fix any client-side
buffering.
**Prompt — Claude CLI:** Review `ui/03-catalog` media handling; ensure uploads use
multipart to the API and render `/api/v1/public/media/*` URLs; no base64 blobs in
state.
**Verify:** upload a product image; it persists and renders after reload.
- [ ] Media wired correctly

### Task 3.6 — Customers (core table + minimal API)
**Owner:** Claude CLI · **Files:** `apps/api/src/modules/customers/*`, schema
(`customers`), contracts.
**Interfaces — Produces:** the **core** `customers` table + `customer` CRUD used
by Orders and later by CRM; `getOrCreateByContact(ctx, {email?, phone?, source})`.
**Deliverable:** a customer registry that exists independently of the CRM module,
so Orders (Phase 4) can reference `customer_id` without depending on CRM.
**Security/Perf:** tenant-scoped; indexes `(business_id,email)`/`(business_id,phone)`;
`source` defaults to `MANUAL`.
**Why here:** Orders reference customers; the base table must exist before Phase 4.
CRM (Task 5.1) adds leads, the pipeline and source analytics **on top of this**.
**Prompt — Claude CLI:**
> Create the core `customers` module (table per DATA_MODEL.md §8: name, email?,
> phone?, address?, `source`). Expose customer CRUD and a
> `getOrCreateByContact(ctx, {email?, phone?, source})` used by orders and CRM.
> This module is always present (not entitlement-gated). Test tenant isolation
> and dedupe-by-contact.
**Verify:** `pnpm --filter api test customers`
**Sync:** `be/03-customers` → PR → merge.
- [ ] Core customers table + API present before Orders

---

# Phase 4 — Channels, Orders & Money

### Task 4.1 — Sales channels
**Owner:** Claude CLI · **Files:** `apps/api/src/modules/channels/*`, schema
(`sales_channels`), contracts.
**Interfaces — Produces:** channel CRUD; a default online-store channel + a
physical channel per location; `channels.*` permissions.
**Deliverable:** first-class channels; every order/money entry will reference one.
**Security/Perf:** channel ownership checks; index `(business_id)`.
**Prompt — Claude CLI:**
> Implement sales channels per DATA_MODEL.md §5 (type ONLINE_STORE/PHYSICAL/
> MARKETPLACE, `location_id?`, `fulfillment_location_id?`, settings jsonb).
> Require `fulfillment_location_id` for ONLINE_STORE (its stock source).
> Auto-create an online-store channel and a physical channel per location on
> business setup. CRUD + tests, including that an ONLINE_STORE channel without a
> fulfillment location is rejected.
**Verify:** `pnpm --filter api test channels`
**Sync:** `be/04-channels` → PR → merge.
- [ ] Channels created + owned per tenant

### Task 4.2 — Orders: schema + two-axis status + creation
**Owner:** Claude CLI · **Files:** `apps/api/src/modules/orders/*`, schema
(`orders`, `order_items`), contracts, an `allowedTransitions` map.
**Interfaces — Produces:** `POST /api/v1/orders` (manual/online), items with
snapshots, server-computed totals; fulfillment transition endpoint; payment
status derived (Task 4.3).
**Deliverable:** create an order with authoritative pricing + item snapshots; a
channel-aware fulfillment transition map; idempotent creation.
**Security/Perf:** server retrieves prices (never client totals); `Idempotency-Key`
on create; transaction wraps order + items; reject if business not APPROVED.
**Prompt — Claude CLI:**
> Implement orders per ORDERS_AND_MONEY.md §§3-4: one `Order` with `entry_mode`
> (ONLINE|MANUAL), `fulfillment_status` (Axis A) and a derived `payment_status`
> (Axis B). On create, look up authoritative prices, snapshot name/sku/unit_price
> into order_items, compute totals server-side, wrap in a transaction, honor
> `Idempotency-Key`. Implement a channel-aware `allowedTransitions` map and a
> transition endpoint. Tests: client-sent total is ignored; manual counter order
> can jump to COMPLETED; illegal transition rejected; duplicate idempotency key
> returns the first order.
**Verify — include:**
```ts
it('ignores client-supplied totals and computes server-side', async () => {
  const res = await createOrder({ items:[{offeringId:o.id, quantity:2}], total: 1 });
  expect(res.body.total).toBe(2 * o.price);
});
```
```bash
pnpm --filter api test orders
```
**Sync:** `be/04-orders` → PR → merge.
- [ ] Orders: server totals, snapshots, transitions, idempotency

### Task 4.3 — Payments (partial) + payment-status derivation
**Owner:** Claude CLI · **Files:** `apps/api/src/modules/orders/payments.*`,
schema (`payments`), contracts.
**Interfaces — Produces:** `POST /api/v1/orders/:id/payments`;
`amount_paid`/`amount_due`/`payment_status` derived; emits `payment.received`.
**Deliverable:** an order can take **multiple** payments (Cash/Bit); status
derives correctly; `payment.received` fires in the same transaction (outbox).
**Security/Perf:** `orders.payment.record` permission; amount > 0; can't overpay
beyond total unless allowed; refuse payment on cancelled order; idempotent.
**Prompt — Claude CLI:**
> Add payments as children of an order (methods CASH, BIT). Recompute
> `amount_paid = Σ payments`, `amount_due`, and derive `payment_status`
> (UNPAID/PARTIALLY_PAID/PAID). Emit `payment.received` via the outbox in the same
> transaction. Enforce `orders.payment.record`. Tests: two partial payments →
> PARTIALLY_PAID then PAID; delivered-but-unpaid order stays UNPAID with a
> positive `amount_due`.
**Verify — include:**
```ts
it('derives PARTIALLY_PAID then PAID across two payments', async () => {
  await pay(order.id, 200); expect(await status(order.id)).toBe('PARTIALLY_PAID');
  await pay(order.id, 300); expect(await status(order.id)).toBe('PAID');
});
```
```bash
pnpm --filter api test payments
```
**Sync:** `be/04-payments` → PR → merge.
- [ ] Partial payments + status derivation correct

### Task 4.4 — Inventory decrement on fulfillment (transactional)
**Owner:** Claude CLI · **Files:** orders service ↔ inventory service.
**Deliverable:** when an order reaches a stock-consuming state, inventory is
decremented and a `SALE` movement is written in the **same transaction**; refuse
on insufficient stock; cancellation of a decremented order writes a `RETURN`.
**Security/Perf:** row-lock the inventory; `INSUFFICIENT_STOCK` for the loser of a
race; no oversell.
**Prompt — Claude CLI:**
> Wire order fulfillment to inventory: on the stock-consuming transition,
> decrement stock and write a SALE movement in the same transaction (via
> `adjustStock`); if insufficient, abort with `INSUFFICIENT_STOCK`. On cancel of a
> decremented order, write a RETURN movement. Test concurrent sale of the last
> unit — one succeeds, one gets INSUFFICIENT_STOCK; no negative stock.
**Verify — include:**
```ts
it('prevents overselling the last unit under concurrency', async () => {
  await setStock(item, 1);
  const [a, b] = await Promise.allSettled([sell(item), sell(item)]);
  const ok = [a,b].filter(r => r.status==='fulfilled').length;
  expect(ok).toBe(1);
  expect(await stock(item)).toBe(0);
});
```
```bash
pnpm --filter api test orders-inventory
```
**Sync:** `be/04-order-stock` → PR → merge.
- [ ] No oversell; movements consistent

### Task 4.5 — Basic Accounting (income on payment, expenses manual, receivables)
**Owner:** Claude CLI · **Files:** `apps/api/src/modules/accounting/*`, schema
(`financial_entries`), contracts.
**Interfaces — Produces:** subscriber on `payment.received` → INCOME entry;
`POST /api/v1/accounting/entries` (manual income/expense); reports: income vs
expense by period and by channel; receivables query (orders with `amount_due>0`).
**Deliverable:** the cash-basis ledger; three reconciled numbers (Sales, Income,
Receivables), globally and per channel.
**Security/Perf:** `accounting.entries.*` permissions; income amount equals the
payment amount and carries the order's channel; report queries aggregate in SQL.
**Prompt — Claude CLI:**
> Implement basic accounting per ORDERS_AND_MONEY.md §§6-7. Subscribe to
> `payment.received` and create an INCOME `financial_entry` (amount = payment
> amount, channel = order.channel, source = ORDER_PAYMENT). Allow manual
> income/expense entries. Build reports: income/expense by period and channel, and
> a receivables query. Test: a received payment produces an income entry of the
> same amount; a completed-unpaid order appears in receivables and NOT in income.
**Verify — include:**
```ts
it('records income only when paid, not when completed', async () => {
  await complete(order.id);                 // fulfillment COMPLETED, unpaid
  expect(await incomeTotal()).toBe(0);
  expect(await receivablesTotal()).toBe(order.total);
  await pay(order.id, order.total);
  expect(await incomeTotal()).toBe(order.total);
  expect(await receivablesTotal()).toBe(0);
});
```
```bash
pnpm --filter api test accounting
```
**Sync:** `be/04-accounting` → PR → merge.
- [ ] Cash-basis income + receivables reconcile

### Task 4.6 — Invoice infra (dormant)
**Owner:** Claude CLI · **Files:** `apps/api/src/modules/invoices/*` (scaffold),
schema (`invoices`, `invoice_sequences`).
**Deliverable:** entities + per-tenant numbering + a `generateInvoice(order)`
interface + order wiring, all **gated off / no-op**.
**Security/Perf:** the endpoint returns `NOT_ENABLED`; no document produced.
**Prompt — Claude CLI:**
> Scaffold the Payments & Invoices module: `Invoice` + `InvoiceSequence` entities,
> a `generateInvoice(order)` service interface, and an endpoint that currently
> returns `NOT_ENABLED`. Register the manifest as a scaffolded stub. No issuance
> logic. Test the endpoint is inert.
**Verify:** `pnpm --filter api test invoices` (endpoint returns NOT_ENABLED)
**Sync:** `be/04-invoices-stub` → PR → merge.
- [ ] Invoice infra present but dormant

### Task 4.7 — Orders/Money UI
**Owner:** Lovable · **Files:** `apps/web/app/(app)/orders/*`,
`apps/web/app/(app)/accounting/*`.
**Deliverable:** orders list (filter by channel/status), manual order creation,
order detail with fulfillment transitions and **partial payment recording**;
accounting screens (record expense, income/expense report, receivables list);
dashboard tiles for Sales/Income/Receivables **by channel**.
**Security/Perf:** money inputs store integer minor units; totals shown come from
the server; no client-side status jumps not offered by the API.
**Prompt — Lovable:**
> Build the orders UI: a filterable list (channel, fulfillment, payment), a manual
> order builder (pick offerings, quantities; server computes totals), an order
> detail page with allowed fulfillment transitions and a "record payment" dialog
> supporting partial amounts and method (Cash/Bit). Build accounting screens:
> record expense/income, an income-vs-expense report with a channel filter, and a
> receivables list. Add dashboard tiles for Sales, Income and Receivables with a
> global/per-channel toggle. Use the money input that stores minor units.
**Verify (Claude):** typecheck + web tests; manual: partial payment updates
receivables + income tiles.
**Sync:** `ui/04-orders-money` → review → merge. **Phase-4 gate:** run the
orders/payments/accounting E2E.
- [ ] Orders + money flows work end-to-end

---

# Phase 5 — CRM & Project Management

### Task 5.1 — CRM module (leads, pipeline, source) on core customers
**Owner:** Claude CLI · **Files:** `apps/api/src/modules/crm/*`, schema (`leads`),
contracts, subscriber on `order.placed`.
**Depends on:** Task 3.6 (core `customers` already exists — CRM does not create it).
**Deliverable:** `leads` CRUD + lifecycle; the CRM UI layer over core customers
(source shown/filterable); auto create/link a customer with `source=ONLINE` on
`order.placed` via the core `getOrCreateByContact`.
**Security/Perf:** `crm.*` permissions; dedupe by email/phone on auto-link
(delegated to the core customers service).
**Prompt — Claude CLI:**
> Implement the CRM module per CRM.md **on top of the core customers module**
> (Task 3.6) — do not recreate the customers table. Add `leads` with the
> lifecycle (NEW→CONTACTED→QUALIFIED→CONVERTED/LOST); conversion calls the core
> `getOrCreateByContact` to create/link a customer. Add a subscriber on
> `order.placed` that upserts a customer (`source=ONLINE`). Tests: online order
> creates one linked customer; lead conversion links to a customer.
**Verify:** `pnpm --filter api test crm`
**Sync:** `be/05-crm` → PR → merge.
- [ ] CRM + auto-link on order tested

### Task 5.2 — Project Management API
**Owner:** Claude CLI · **Files:** `apps/api/src/modules/pm/*`, schema
(`projects`, `tasks`), contracts.
**Deliverable:** projects + tasks with the statuses from
[PROJECT_MGMT.md](./PROJECT_MGMT.md); assignment to team members; events
`pm.task.assigned/completed`.
**Security/Perf:** `pm.*` permissions; assignee must be a member of the business.
**Prompt — Claude CLI:**
> Implement Project Management per PROJECT_MGMT.md: project + task CRUD with the
> defined status enums, priority, assignee (validate membership), due date, and
> the assigned/completed events. Tests: illegal status transition rejected;
> assignee outside the business rejected.
**Verify:** `pnpm --filter api test pm`
**Sync:** `be/05-pm` → PR → merge.
- [ ] PM statuses + assignment tested

### Task 5.3 — CRM + PM UI
**Owner:** Lovable · **Files:** `apps/web/app/(app)/customers/*`,
`apps/web/app/(app)/projects/*`.
**Deliverable:** customers/leads lists + forms with source; lead pipeline by
status; projects list + a kanban task board.
**Prompt — Lovable:**
> Build CRM UI (customers list/detail, leads with a status pipeline, source shown
> and filterable) and PM UI (projects list, a kanban board of tasks by status with
> drag between columns calling the transition endpoint, assignee + due date). All
> via the CRM/PM contracts. RTL-ready.
**Verify (Claude):** typecheck + web tests.
**Sync:** `ui/05-crm-pm` → review → merge.
- [ ] CRM + PM UIs work

---

# Phase 6 — Mini-site (public)

### Task 6.1 — Storefront settings + public catalog API
**Owner:** Claude CLI · **Files:** `apps/api/src/modules/storefront/*`, schema
(`storefront_settings`), public read services, contracts.
**Interfaces — Produces:** `storefront.manage` CRUD for pages/theme/SEO;
`GET /api/v1/public/store/:slug` + offering detail — **public-safe fields only**.
**Deliverable:** published/unpublished sites; tenant resolved by trusted slug;
public API excludes cost/inventory internals/tenant IDs.
**Security/Perf:** slug globally unique; public endpoints unauthenticated but read
a controlled projection; cache public reads.
**Prompt — Claude CLI:**
> Implement storefront settings (slug, title, description, logo, published, page
> content, SEO fields) with `storefront.manage`. Build public read endpoints that
> resolve the business by slug and return only public-safe offering fields (no
> cost, no internal inventory, no tenant IDs). Test that cost and internal fields
> are never present in the public payload, and an unpublished site 404s.
**Verify — include:**
```ts
it('never exposes cost or tenant id publicly', async () => {
  const res = await request(app).get(`/api/v1/public/store/${slug}`);
  expect(JSON.stringify(res.body)).not.toMatch(/"cost"|"businessId"/);
});
```
```bash
pnpm --filter api test storefront
```
**Sync:** `be/06-storefront` → PR → merge.
- [ ] Public API leaks nothing internal

### Task 6.2 — Mini-site pages + branding + SEO
**Owner:** Lovable · **Files:** `apps/web/app/store/[slug]/*` (Main, Store,
Contact, Landing), `sitemap.xml`, `robots.txt`, JSON-LD.
**Deliverable:** the four SSR pages themed by brand; SEO meta/OG/JSON-LD;
sitemap/robots; category browse + offering detail.
**Security/Perf:** SSR for indexability; only the public API; no tenant IDs in
URLs beyond the slug; images via public media URLs.
**Prompt — Lovable:**
> Build the public mini-site with four server-rendered pages (Main, Store,
> Contact, Landing) themed by the business brand palette. Store lists categories +
> offerings and an offering detail page, all from the public API. Add per-page
> title/description/OG tags, JSON-LD (Organization + Product), and generate
> `sitemap.xml` + `robots.txt`. RTL-ready, translation keys.
**Verify (Claude):** Lighthouse SEO sane; view-source shows meta + JSON-LD; no
internal fields in HTML.
**Sync:** `ui/06-minisite` → review → merge.
- [ ] Mini-site renders, themed, SEO present

### Task 6.3 — WhatsApp order handoff
**Owner:** Claude CLI (message build) + Lovable (button/flow) · **Files:**
storefront cart, Notifications message builder.
**Deliverable:** Store cart → "Order on WhatsApp" opens a pre-filled message; the
resulting manual order is recorded in the console.
**Security/Perf:** message built from server data (prices authoritative); no PII
in URL query beyond what the customer types in WhatsApp.
**Prompt — Claude CLI:** Add a Notifications helper that builds a WhatsApp handoff
message (items, quantities, business number) from server-side cart data.
**Prompt — Lovable:** Add a cart on the Store page and an "Order on WhatsApp"
button that opens the pre-filled message via the helper.
**Verify:** clicking opens WhatsApp with correct items; owner records a manual
online-store order.
**Sync:** `be/06-wa-handoff` → merge; `ui/06-wa-handoff` → merge.
- [ ] WhatsApp handoff works

---

# Phase 7 — Notifications (core)

### Task 7.1 — Notifications framework + stub adapters
**Owner:** Claude CLI · **Files:** `apps/api/src/modules/notifications/*`,
`apps/worker` send jobs, schema (`notification_templates`, `notification_log`),
adapters.
**Deliverable:** `ChannelAdapter` interface; `WhatsAppStubAdapter` +
`EmailStubAdapter` (log to `notification_log`); templates; queue-backed send;
event subscriptions (e.g. `order.placed` → confirmation).
**Security/Perf:** sends enqueued (never in a request/transaction); log every
attempt; no secrets in logs.
**Prompt — Claude CLI:**
> Implement Notifications per NOTIFICATIONS.md: a `ChannelAdapter` interface,
> WhatsApp + Email **stub** adapters that write to `notification_log`, keyed
> localized templates, a queue-backed `send`, and subscriptions to domain events.
> Tests: emitting `order.placed` enqueues a send and logs it; the adapter
> interface is provider-agnostic.
**Verify:** `pnpm --filter api test notifications && pnpm --filter worker test send`
**Sync:** `be/07-notifications` → PR → merge.
- [ ] Notifications enqueue + log via stubs

### Task 7.2 — Notifications settings UI
**Owner:** Lovable · **Files:** `apps/web/app/(app)/settings/notifications/*`.
**Deliverable:** template management + a notification log view.
**Prompt — Lovable:** Build screens to view/edit notification templates and browse
the notification log (channel, status, timestamp), via the notifications API.
**Sync:** `ui/07-notifications` → review → merge.
- [ ] Notification settings UI works

---

# Phase 8 — AI agent

### Task 8.1 — AI gateway + tool registry + module tools
**Owner:** Claude CLI · **Files:** `apps/api/src/modules/ai/*`, schema
(`ai_settings`, `ai_usage`, `ai_audit`, `ai_prompts`), tool registration in each
MVP module's manifest.
**Interfaces — Produces:** `AiGateway` (provider abstraction, minimize, audit);
`ToolRegistry` collecting `agentTools` from enabled modules; the 4 read tools + 2
confirmed-write tools; `POST /api/v1/ai/chat`.
**Deliverable:** the agent answers via tools that run with tenant+permission
context; writes require a confirmation token; all invocations audited; per-tenant
enable.
**Security/Perf:** each tool re-checks its `requiredPermission`; the agent never
receives another tenant's data; data minimized before provider calls; write tools
inert without explicit confirmation.
**Prompt — Claude CLI:**
> Implement the AI module per AI.md: an `AiGateway` with provider abstraction,
> usage + audit logging and data minimization; a `ToolRegistry` that aggregates
> `agentTools` from enabled modules; the read tools (business_pulse, reorder_radar,
> who_owes_me, movers) and confirmed-write tools (draft_offering_content, log_entry)
> — each declaring `requiredPermission` and re-checking it with the caller's
> context. Writes require a confirmation token. Add `ai_settings` per-tenant
> enable. Tests: a read tool without the permission is refused; a write tool does
> nothing without confirmation; a tool cannot be invoked for another tenant.
**Verify — include:**
```ts
it('refuses a write tool without confirmation', async () => {
  const res = await aiInvoke('log_entry', { type:'EXPENSE', amount:200 }, { confirm:false });
  expect(res.committed).toBe(false);
});
```
```bash
pnpm --filter api test ai
```
**Sync:** `be/08-ai` → PR → merge.
- [ ] Agent tools tenant/permission-scoped; writes gated

### Task 8.2 — AI assistant UI
**Owner:** Lovable · **Files:** `apps/web/app/(app)/assistant/*`.
**Deliverable:** an in-app chat panel; read answers render inline; write proposals
show a confirm dialog before committing.
**Security/Perf:** confirmation is explicit and per-action; no tool executes from
UI without the server's confirmation flow.
**Prompt — Lovable:**
> Build an AI assistant chat panel calling `POST /api/v1/ai/chat`. Render read
> results (pulse, reorder, receivables, movers). For write proposals (draft
> content, log expense/task), show a confirmation dialog; on confirm, call the
> tool with the confirmation token. Show it only when the AI module is enabled.
**Verify (Claude):** typecheck; manual: "how's today?" returns a summary; "log
₪200 rent" asks to confirm before writing.
**Sync:** `ui/08-assistant` → review → merge.
- [ ] Assistant works; writes confirmed

---

# Phase 9 — Hardening & release

### Task 9.1 — Full security audit pass
**Owner:** Claude CLI · **Deliverable:** run the [TEST_PLAN.md](./TEST_PLAN.md) §4
attacks across all modules; fix criticals/highs; add a regression test per fix.
**Prompt — Claude CLI:**
> Perform the security audit from TEST_PLAN.md §4 (IDOR, tenant switching, mass
> assignment, price/order/inventory manipulation, storefront enumeration, file
> upload, AI cross-tenant) against every module. Produce a severity-ranked report,
> fix critical/high, and add a regression test for each fixed issue. Do not weaken
> security to pass a test.
**Verify:** `pnpm --filter api test:e2e` all green; report saved.
**Sync:** `be/09-security` → PR → merge.
- [ ] Security audit clean; regressions added

### Task 9.2 — Performance pass
**Owner:** Claude CLI · **Deliverable:** verify indexes from
[DATA_MODEL.md](./DATA_MODEL.md); check report queries with `EXPLAIN`; remove any
N+1; ensure public mini-site reads are cached.
**Prompt — Claude CLI:**
> Review query plans for the dashboard, reports, catalog list and public store.
> Add/verify indexes, remove N+1 (batch/`include`), and cache public reads.
> Confirm no slow query on the seeded dataset scaled 100x.
**Verify:** `EXPLAIN` shows index usage; no full scans on hot paths.
**Sync:** `be/09-perf` → PR → merge.
- [ ] Hot paths indexed; no N+1

### Task 9.3 — E2E happy path + deployment
**Owner:** Claude CLI · **Files:** `apps/web/e2e/*` (Playwright), deploy config.
**Deliverable:** the [TEST_PLAN.md](./TEST_PLAN.md) §3 E2E automated; deploy to
staging; backup + tested restore.
**Prompt — Claude CLI:**
> Automate the §3 E2E in Playwright (signup → approve → enable modules → offerings
> → inventory → manual order → partial then full payment → receivables/income →
> mini-site → WhatsApp handoff → dashboard by channel → AI pulse). Configure
> staging deploy for web/api/worker + managed Postgres/Redis/storage. Document a
> backup + tested restore.
**Verify:** E2E green on staging; restore drill documented.
**Sync:** `be/09-e2e` → PR → merge. **Release gate.**
- [ ] E2E green; staging deployed; restore tested

---

## Self-review checklist (run before handing off execution)

- [ ] **Spec coverage:** every MVP module in [MVP_SCOPE.md](./MVP_SCOPE.md) maps to
  a task above.
- [ ] **Isolation:** Phase-1 gate (Task 1.9) blocks all later phases.
- [ ] **Money:** Tasks 4.2-4.5 enforce server totals, partial payments,
  cash-basis income, receivables.
- [ ] **Ownership split:** every task names Claude CLI or Lovable; Lovable never
  touches contracts/auth/rbac/tenancy/migrations.
- [ ] **Each task** has a tool prompt, a verify command, and a sync handoff.

## Execution handoff

This plan is executed with two tools in the contracts-first loop above. For each
Claude CLI task, work in a `be/*` branch, drive it test-first, and merge only on
green CI + a passing isolation/security check. For each Lovable task, sync `main`,
build against the merged contracts on a `ui/*` branch, then hand to Claude CLI for
security/performance review and merge.
