import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  AccountingSummaryQuery,
  CreateFinancialEntryInput,
  FinancialEntryListQuery,
} from '@dokane/contracts';
import type {
  AccountingSummaryDto,
  AccountingSummaryQuery as AccountingSummaryQueryType,
  CreateFinancialEntryInput as CreateFinancialEntryInputType,
  FinancialEntryDto,
  FinancialEntryListQuery as FinancialEntryListQueryType,
  FinancialEntryListResult,
  ReceivablesResult,
} from '@dokane/contracts';
import { Ctx, RequireEntitlement, RequirePermission } from '../../common/decorators';
import type { TenantContext } from '../../common/tenant-context';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { AccountingService } from './accounting.service';

@Controller('accounting')
@RequireEntitlement('accounting')
export class AccountingController {
  constructor(private readonly accounting: AccountingService) {}

  @RequirePermission('accounting.entries.view')
  @Get('entries')
  list(
    @Ctx() ctx: TenantContext,
    @Query(new ZodValidationPipe(FinancialEntryListQuery)) query: FinancialEntryListQueryType,
  ): Promise<FinancialEntryListResult> {
    return this.accounting.listEntries(ctx, query);
  }

  @RequirePermission('accounting.entries.manage')
  @Post('entries')
  create(
    @Ctx() ctx: TenantContext,
    @Body(new ZodValidationPipe(CreateFinancialEntryInput)) body: CreateFinancialEntryInputType,
  ): Promise<FinancialEntryDto> {
    return this.accounting.createEntry(ctx, body);
  }

  @RequirePermission('accounting.entries.view')
  @Get('summary')
  summary(
    @Ctx() ctx: TenantContext,
    @Query(new ZodValidationPipe(AccountingSummaryQuery)) query: AccountingSummaryQueryType,
  ): Promise<AccountingSummaryDto> {
    return this.accounting.summary(ctx, query);
  }

  @RequirePermission('accounting.entries.view')
  @Get('receivables')
  receivables(@Ctx() ctx: TenantContext, @Query('channelId') channelId?: string): Promise<ReceivablesResult> {
    return this.accounting.receivables(ctx, channelId);
  }
}
