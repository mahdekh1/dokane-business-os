import { Body, Controller, Get, Patch } from '@nestjs/common';
import { UpdateBrandingInput } from '@dokane/contracts';
import type { BrandingDto, UpdateBrandingInput as UpdateBrandingInputType } from '@dokane/contracts';
import { Ctx, RequirePermission } from '../../common/decorators';
import type { TenantContext } from '../../common/tenant-context';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { BrandingService } from './branding.service';

@Controller('branding')
export class BrandingController {
  constructor(private readonly branding: BrandingService) {}

  @RequirePermission('storefront.manage')
  @Get()
  get(@Ctx() ctx: TenantContext): Promise<BrandingDto> {
    return this.branding.get(ctx.businessId);
  }

  @RequirePermission('storefront.manage')
  @Patch()
  update(
    @Ctx() ctx: TenantContext,
    @Body(new ZodValidationPipe(UpdateBrandingInput)) body: UpdateBrandingInputType,
  ): Promise<BrandingDto> {
    return this.branding.update(ctx.businessId, body);
  }
}
