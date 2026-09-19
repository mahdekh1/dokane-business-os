import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CreateLeadInput, LeadListQuery, UpdateLeadInput } from '@dokane/contracts';
import type {
  CreateLeadInput as CreateLeadInputType,
  LeadDto,
  LeadListQuery as LeadListQueryType,
  LeadListResult,
  UpdateLeadInput as UpdateLeadInputType,
} from '@dokane/contracts';
import { Ctx, RequireEntitlement, RequirePermission } from '../../common/decorators';
import type { TenantContext } from '../../common/tenant-context';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { CrmService } from './crm.service';

@Controller('crm/leads')
@RequireEntitlement('crm')
export class CrmController {
  constructor(private readonly crm: CrmService) {}

  @RequirePermission('crm.leads.view')
  @Get()
  list(
    @Ctx() ctx: TenantContext,
    @Query(new ZodValidationPipe(LeadListQuery)) query: LeadListQueryType,
  ): Promise<LeadListResult> {
    return this.crm.list(ctx, query);
  }

  @RequirePermission('crm.leads.view')
  @Get(':id')
  get(@Ctx() ctx: TenantContext, @Param('id') id: string): Promise<LeadDto> {
    return this.crm.get(ctx, id);
  }

  @RequirePermission('crm.leads.manage')
  @Post()
  create(
    @Ctx() ctx: TenantContext,
    @Body(new ZodValidationPipe(CreateLeadInput)) body: CreateLeadInputType,
  ): Promise<LeadDto> {
    return this.crm.create(ctx, body);
  }

  @RequirePermission('crm.leads.manage')
  @Patch(':id')
  update(
    @Ctx() ctx: TenantContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateLeadInput)) body: UpdateLeadInputType,
  ): Promise<LeadDto> {
    return this.crm.update(ctx, id, body);
  }

  @RequirePermission('crm.leads.manage')
  @Post(':id/convert')
  convert(@Ctx() ctx: TenantContext, @Param('id') id: string): Promise<LeadDto> {
    return this.crm.convert(ctx, id);
  }
}
