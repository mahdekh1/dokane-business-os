import { Body, Controller, Get, Post } from '@nestjs/common';
import { CreateBusinessInput } from '@dokane/contracts';
import type { BusinessDto, CreateBusinessInput as CreateBusinessInputType } from '@dokane/contracts';
import { Ctx, RequirePermission, UserId } from '../../common/decorators';
import type { TenantContext } from '../../common/tenant-context';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessesService } from './businesses.service';

@Controller('business')
export class BusinessesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businesses: BusinessesService,
  ) {}

  /** Register a new business (any authenticated user). Enters PENDING_APPROVAL. */
  @Post()
  create(
    @UserId() userId: string,
    @Body(new ZodValidationPipe(CreateBusinessInput)) body: CreateBusinessInputType,
  ): Promise<BusinessDto> {
    return this.businesses.createBusiness(userId, body);
  }

  /** The current tenant's business profile. */
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
