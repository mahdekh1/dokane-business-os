import { Controller, Param, Post } from '@nestjs/common';
import { Ctx, RequirePermission } from '../../common/decorators';
import type { TenantContext } from '../../common/tenant-context';
import { InvoicesService } from './invoices.service';

/** Dormant issuance endpoint — always returns NOT_ENABLED (Task 4.6). */
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @RequirePermission('orders.manage')
  @Post(':orderId')
  generate(@Ctx() ctx: TenantContext, @Param('orderId') orderId: string): Promise<never> {
    return this.invoices.generateInvoice(ctx, orderId);
  }
}
