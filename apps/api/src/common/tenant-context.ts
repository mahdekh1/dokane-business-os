import type { BusinessStatus } from '@prisma/client';

/**
 * Per-request tenant context, resolved from the authenticated user's membership
 * in the business named by the `X-Business-Id` header. Never built from
 * client-supplied tenant identifiers directly — see TenantGuard.
 */
export interface TenantContext {
  userId: string;
  businessId: string;
  membershipId: string;
  roleId: string;
  businessStatus: BusinessStatus;
  permissions: Set<string>;
}
