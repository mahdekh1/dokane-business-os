import { Controller, Get } from '@nestjs/common';
import type { PlanSummary } from '@dokane/contracts';
import { Ctx, RequirePermission } from '../../common/decorators';
import type { TenantContext } from '../../common/tenant-context';
import { EntitlementService } from './entitlement.service';

@Controller('billing')
export class BillingController {
  constructor(private readonly entitlements: EntitlementService) {}

  /** The current tenant's plan (for the Modules page + sidebar). */
  @RequirePermission('modules.view')
  @Get('plan')
  async plan(@Ctx() ctx: TenantContext): Promise<PlanSummary> {
    const plan = await this.entitlements.getPlan(ctx.businessId);
    return plan ?? { tier: 'NONE', name: 'No plan' };
  }
}
