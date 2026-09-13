import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PERMISSION_KEY,
  REQUIRE_BUSINESS_KEY,
} from '../decorators';
import type { TenantContext } from '../tenant-context';

interface TenantRequest {
  headers: Record<string, string | string[] | undefined>;
  userId?: string;
  tenant?: TenantContext;
}

/**
 * Global guard. For routes that need a tenant (marked with @RequireBusiness or
 * @RequirePermission), resolves the caller's membership in the business named by
 * X-Business-Id and attaches a TenantContext. The header only SELECTS among the
 * caller's own memberships — a business the user is not a member of yields 403
 * (never leaking whether it exists). Enforces @RequirePermission if present.
 *
 * Entitlement checks (@RequireEntitlement) are wired in Task 1.5 once the module
 * registry exists; the seam is this same guard.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const requiredPermission = this.reflector.getAllAndOverride<string | undefined>(
      PERMISSION_KEY,
      targets,
    );
    const explicitBusiness = this.reflector.getAllAndOverride<boolean | undefined>(
      REQUIRE_BUSINESS_KEY,
      targets,
    );
    const needsTenant = Boolean(requiredPermission) || explicitBusiness === true;
    if (!needsTenant) {
      return true;
    }

    const req = context.switchToHttp().getRequest<TenantRequest>();
    const userId = req.userId;
    if (!userId) {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED' });
    }

    const rawHeader = req.headers['x-business-id'];
    const businessId = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    if (!businessId) {
      throw new ForbiddenException({
        code: 'NO_BUSINESS_CONTEXT',
        message: 'X-Business-Id header is required',
      });
    }

    const membership = await this.prisma.businessMembership.findUnique({
      where: { businessId_userId: { businessId, userId } },
      include: {
        business: { select: { status: true } },
        role: { include: { permissions: { include: { permission: true } } } },
      },
    });

    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenException({ code: 'FORBIDDEN' });
    }
    if (
      membership.business.status === 'SUSPENDED' ||
      membership.business.status === 'REJECTED'
    ) {
      throw new ForbiddenException({ code: 'BUSINESS_INACTIVE' });
    }

    const permissions = new Set(
      membership.role.permissions.map((rp) => rp.permission.code),
    );

    req.tenant = {
      userId,
      businessId,
      membershipId: membership.id,
      roleId: membership.roleId,
      businessStatus: membership.business.status,
      permissions,
    };

    if (requiredPermission && !permissions.has(requiredPermission)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Missing permission: ${requiredPermission}`,
      });
    }

    return true;
  }
}
