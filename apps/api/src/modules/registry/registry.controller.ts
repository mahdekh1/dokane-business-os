import { Controller, Get, Param, Post } from '@nestjs/common';
import { Ctx, RequirePermission } from '../../common/decorators';
import type { TenantContext } from '../../common/tenant-context';
import { RegistryService, type ModuleView } from './registry.service';

@Controller('modules')
export class RegistryController {
  constructor(private readonly registry: RegistryService) {}

  @RequirePermission('modules.view')
  @Get()
  list(@Ctx() ctx: TenantContext): Promise<ModuleView[]> {
    return this.registry.listForTenant(ctx);
  }

  @RequirePermission('modules.enable')
  @Post(':id/enable')
  enable(
    @Ctx() ctx: TenantContext,
    @Param('id') id: string,
  ): Promise<ModuleView> {
    return this.registry.enable(ctx, id);
  }
}
