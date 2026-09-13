import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ENTITLEMENT_KEY } from '../../common/decorators';
import type { TenantContext } from '../../common/tenant-context';
import { EntitlementService } from './entitlement.service';

/**
 * Global guard. For routes marked @RequireEntitlement, verifies the resolved
 * tenant holds the entitlement. Runs after TenantGuard (which sets req.tenant).
 * Inert until feature modules attach @RequireEntitlement (Phase 3+).
 */
@Injectable()
export class EntitlementGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlements: EntitlementService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const key = this.reflector.getAllAndOverride<string | undefined>(
      ENTITLEMENT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!key) {
      return true;
    }

    const req = context
      .switchToHttp()
      .getRequest<{ tenant?: TenantContext }>();
    if (!req.tenant) {
      throw new ForbiddenException({ code: 'NO_BUSINESS_CONTEXT' });
    }

    const entitled = await this.entitlements.resolveEntitlements(
      req.tenant.businessId,
    );
    if (!entitled.has(key)) {
      throw new ForbiddenException({ code: 'NOT_ENTITLED' });
    }
    return true;
  }
}
