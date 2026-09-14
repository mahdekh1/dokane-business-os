# Architecture Review — Phases 1–2.5 (MUST-requirement compliance)

Version: 1.0 · Date: 2026-09-14

Purpose: verify what's built through **Phase 2.5** against the mandatory rules in
[SECURITY.md](./SECURITY.md), [ARCHITECTURE.md](./ARCHITECTURE.md) §8, and
[TEST_PLAN.md](./TEST_PLAN.md), before starting Phase 3. Legend:
**✅ Met** · **🟡 Deferred** (correct-by-construction now; enforcement/feature lands
in a named later phase, no live gap) · **⛔ Gap** (must fix now).

No **⛔** items outstanding. Automated coverage: **55 tests / 9 suites** green.

---

## 1. Guard chain (as built)

Global `APP_GUARD` order in `apps/api/src/app.module.ts` matches the spec:

```
ThrottlerGuard → AuthGuard → PlatformGuard → TenantGuard → EntitlementGuard
```

`TenantGuard` (`common/guards/tenant.guard.ts`) resolves the tenant **only** from
the caller's `BusinessMembership` selected by `X-Business-Id`; a business the user
does not belong to yields `403` without revealing existence, and `SUSPENDED` /
`REJECTED` businesses yield `BUSINESS_INACTIVE`. Bodies are parsed by
`ZodValidationPipe` (strips unknown keys → mass-assignment safe).

---

## 2. SECURITY.md compliance

| # | Requirement | Status | Evidence (code) | Test |
|---|-------------|--------|-----------------|------|
| §1 | Tenant context derived from membership, never from client input | ✅ | `tenant.guard.ts` resolves membership from `X-Business-Id`, validated against the user | `security.spec` (A→B on every endpoint → 403), `rbac-tenancy.spec` |
| §1 | Never trust a `business_id` in body/query/URL | ✅ | `createBusiness` takes no tenant id (derived from caller); tenant routes ignore body ids | `security.spec` "createBusiness ignores injected status/id" |
| §2.1 | Services take a **context object**, not a raw request id | ✅ | Controllers pass `@Ctx() TenantContext`; services never read `X-Business-Id` | `businesses.service.ts`, `registry.service.ts` |
| §2.2 | Tenant-scoped unique indexes / FKs | 🟡 | `Business.slug` unique, `(businessId,userId)` membership unique, `(businessId,moduleId)` module-state unique. `(business_id, sku)` etc. land with **Catalog/Inventory (Phase 3)** | `schema.prisma` |
| §2.4 | Every tenant-owned module has A/B isolation tests | 🟡 | Every tenant endpoint that exists now is attacked; offerings/inventory/orders get their own A/B tests when built (**Phase 3+**) | `security.spec`, `rbac-tenancy.spec` |
| §3 | Entitlement **and** permission both enforced server-side | ✅ | `TenantGuard` enforces `@RequirePermission`; `registry.enable` + `EntitlementGuard` enforce entitlement | `security.spec` (NOT_ENTITLED), `registry.spec`, `rbac-tenancy.spec` (STAFF refused) |
| §3 | Backend authz mandatory; UI hiding is not a control | ✅ | All guards server-side; the Modules page cannot enable a locked module (server rejects) | `security.spec`, `registry.spec` |
| §3 | Reject unknown/dangerous fields (mass assignment) | ✅ | `ZodValidationPipe` strips undeclared keys; every write body is Zod-validated | `security.spec` (injected `status`/`isPlatformAdmin` ignored) |
| §4 | Suspended / non-approved businesses cannot transact | 🟡 | `TenantGuard` blocks `SUSPENDED`/`REJECTED` now (tested). `PENDING` has **no subscription** (approve provisions it) so module enable is naturally `NOT_ENTITLED`; an explicit APPROVED-gate for transactional writes lands with **Orders/Inventory (Phase 3–4)** | `security.spec` (SUSPENDED → `BUSINESS_INACTIVE`), `businesses.spec` (invalid transition) |
| §4 | Lifecycle state machine is a single enum, transitions validated | ✅ | `businesses.service.transition()` allow-lists source states per action | `businesses.spec` (approve-when-approved → 400) |
| §5 | Media via storage-driver abstraction, tenant-scoped keys, MIME/size validation | 🟡 | No uploads in Phase 1–2.5; the driver + endpoint are **Phase 3.4** | — |
| §6 | AI calls tools that re-check tenant+permission; data minimization | 🟡 | AI is **Phase 8**; not present | — |
| §7 | Rate limiting | ✅ | `ThrottlerModule.forRoot([{ ttl: 60s, limit: 100 }])` + global `ThrottlerGuard` | (config) |
| §7 | Password hashing; secrets never committed; parameterized queries | ✅ | argon2 (`password.service.ts`, `me.controller.ts`); `.env*` gitignored; Prisma (parameterized) | `auth.service.spec`, `me.spec` |
| §7 | CORS locked to the web origin | ✅ | `main.ts` `enableCors({ origin: WEB_ORIGIN… })` with an explicit header allow-list | (config) |
| §8 | Required A/B isolation attacks all **fail** | ✅ (for current surface) | A→read/modify B business, modules, branding, plan; A→enable a module for B; non-admin→platform detail/approve | `security.spec` (12 attacks) |
| §9 | Security-sensitive events written to append-only `audit_logs`, no secrets | ✅ | `BUSINESS_CREATED/APPROVED/REJECTED/…`, `MODULE_ENABLED`; audit redacts | `businesses.spec` (approval audited), `registry.spec` (enable audited), `audit.service.spec` |

---

## 3. ARCHITECTURE.md §8 — "must never" checks (current surface)

| Rule | Status | Note |
|------|--------|------|
| Never remove `business_id` from tenant rows | ✅ | Every tenant table carries it |
| Never move authorization to the frontend | ✅ | Guards are server-side; UI mirrors, never gates |
| Never trust client-supplied prices/totals | 🟡 | No money yet (**Phase 4**); pricing math is server-derived by design |
| Never bypass transactions | ✅ | `createBusiness` writes business + membership in one `$transaction` |
| Never mutate inventory without a movement | 🟡 | Inventory is **Phase 3**; rule to be enforced there |
| Never delete historical orders | 🟡 | Orders are **Phase 4**; soft-delete-only policy pre-agreed |
| Never connect AI directly to SQL | 🟡 | AI is **Phase 8** |
| Never hard-code payment/notification provider | ✅ | None hard-coded; adapters are pluggable by design |
| Never hard-code a locale | ✅ | No locale/country hard-coding in the API |
| No giant generic settings JSON blob | ✅ | Config is typed (branding model, module manifests, plan entitlements) |

---

## 4. Money / units / time (spot-check)

- **Money = integer minor units + currency**: no money is handled yet (Phase 4);
  the rule is documented and will be enforced when Orders/Payments land. ✅ (n/a now)
- **Timestamps UTC**: Prisma `DateTime` stored UTC. ✅

---

## 5. Test coverage summary (Phases 0–2.5)

| Suite | Covers |
|-------|--------|
| `auth.service.spec` | signup/login, bad password → generic 401 |
| `rbac-tenancy.spec` | tenancy resolution, member-only access, RBAC (OWNER vs STAFF), custom-role assignability |
| `security.spec` | **12 attacks** — A/B isolation on every current endpoint, entitlement, SUSPENDED block, mass assignment, signup priv-esc, platform IDOR |
| `businesses.spec` | create → PENDING + owner membership, category "Other" free-text, email/category validation, lifecycle transitions, approval audited, platform gating |
| `registry.spec` | entitlement locking, enable + dependency order, category suggestions, enable audited |
| `me.spec` | profile read/update, invalid language → 400, password change (wrong → 401, right → 204 + login) |
| `audit.service.spec` | append-only audit + redaction |
| `outbox.spec` | transactional outbox relay |
| `prisma.service.spec` | connection lifecycle |

Run: `pnpm --filter @dokane/api test` → **55 passed / 9 suites**. Web typecheck
clean (`pnpm --filter @dokane/web exec tsc --noEmit`).

---

## 6. Verdict

The Phase 1–2.5 surface **meets every MUST requirement that applies to it**, with
automated proof for the security-critical rules. The **🟡** items are all
features/enforcement that belong to later phases (Catalog/Inventory §3, Orders &
Money §4, Media §3.4, AI §8) — none is a live gap on today's endpoints. When each
lands it MUST bring: its own A/B isolation tests, tenant-scoped unique indexes,
the APPROVED-gate for transactional writes, integer-minor-unit money, and
movement-on-every-stock-change (per [TEST_PLAN.md](./TEST_PLAN.md) §5 and this
review). Recommended to keep this document updated per phase as the compliance
ledger.
