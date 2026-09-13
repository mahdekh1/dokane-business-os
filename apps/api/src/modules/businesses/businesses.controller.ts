import { Controller, Get } from '@nestjs/common';
import { Ctx, RequirePermission } from '../../common/decorators';
import type { TenantContext } from '../../common/tenant-context';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Minimal tenant-scoped read endpoint. Exists now to exercise the tenancy +
 * RBAC guards; the full businesses module (lifecycle, onboarding) is Task 2.1.
 */
@Controller('business')
export class BusinessesController {
  constructor(private readonly prisma: PrismaService) {}

  @RequirePermission('business.view')
  @Get()
  current(@Ctx() ctx: TenantContext) {
    return this.prisma.business.findUnique({
      where: { id: ctx.businessId },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        currency: true,
        timezone: true,
      },
    });
  }
}
