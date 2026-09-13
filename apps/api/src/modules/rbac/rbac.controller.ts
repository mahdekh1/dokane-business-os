import { Body, Controller, Get, Post } from '@nestjs/common';
import { CreateRoleInput } from '@dokane/contracts';
import type { CreateRoleInput as CreateRoleInputType, RoleDto } from '@dokane/contracts';
import { Ctx, RequirePermission } from '../../common/decorators';
import type { TenantContext } from '../../common/tenant-context';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { RbacService } from './rbac.service';

@Controller('roles')
export class RbacController {
  constructor(private readonly rbac: RbacService) {}

  @RequirePermission('roles.view')
  @Get()
  list(@Ctx() ctx: TenantContext): Promise<RoleDto[]> {
    return this.rbac.listRoles(ctx);
  }

  @RequirePermission('roles.manage')
  @Post()
  create(
    @Ctx() ctx: TenantContext,
    @Body(new ZodValidationPipe(CreateRoleInput)) body: CreateRoleInputType,
  ): Promise<RoleDto> {
    return this.rbac.createCustomRole(ctx, body);
  }
}
