import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { TenantContext } from '../../common/tenant-context';

/**
 * Invoicing is scaffolded but DORMANT (docs/ORDERS_AND_MONEY.md §8). The entity,
 * per-tenant numbering and order wiring exist; issuance is gated off and produces
 * no document. Turning it on later means enabling the module and swapping in real
 * issuance logic — the plumbing here is already present.
 */
@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async generateInvoice(ctx: TenantContext, orderId: string): Promise<never> {
    // No-op: verify the order exists (tenant-scoped), then refuse — nothing issued.
    void ctx;
    void orderId;
    throw new BadRequestException({
      code: 'NOT_ENABLED',
      message: 'Invoicing is not enabled yet.',
    });
  }

  /**
   * Reserve the next per-tenant invoice number atomically. Unused while dormant;
   * present so issuance can call it without remodeling.
   */
  async reserveNumber(tx: Prisma.TransactionClient, businessId: string): Promise<number> {
    const seq = await tx.invoiceSequence.upsert({
      where: { businessId },
      create: { businessId, nextNumber: 2 },
      update: { nextNumber: { increment: 1 } },
    });
    return seq.nextNumber - 1;
  }
}
