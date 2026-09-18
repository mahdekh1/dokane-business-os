import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { derivePaymentStatus, type OrderDto, type RecordPaymentInput } from '@dokane/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBus } from '../../common/events/event-bus.service';
import type { TenantContext } from '../../common/tenant-context';
import { OrdersService } from './orders.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly events: EventBus,
  ) {}

  /**
   * Record a payment against an order. Recomputes amount_paid = Σ RECEIVED
   * payments and derives payment_status, and emits `payment.received` via the
   * outbox — all in one transaction (see docs/ORDERS_AND_MONEY.md §§5, 9).
   */
  async record(ctx: TenantContext, orderId: string, input: RecordPaymentInput): Promise<OrderDto> {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, businessId: ctx.businessId } });
    if (!order) throw new NotFoundException({ code: 'ORDER_NOT_FOUND' });
    if (order.fulfillmentStatus === 'CANCELLED') {
      throw new BadRequestException({ code: 'PAYMENT_ON_CANCELLED', message: 'Cannot take payment on a cancelled order.' });
    }
    const amountDue = Math.max(0, order.total - order.amountPaid);
    if (input.amount > amountDue) {
      throw new BadRequestException({
        code: 'OVERPAYMENT',
        message: `Payment exceeds the ${amountDue} still due.`,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          businessId: ctx.businessId,
          orderId,
          method: input.method,
          amount: input.amount,
          currency: order.currency,
          reference: input.reference ?? null,
          status: 'RECEIVED',
          createdBy: ctx.userId,
        },
      });
      const agg = await tx.payment.aggregate({
        where: { orderId, status: 'RECEIVED' },
        _sum: { amount: true },
      });
      const amountPaid = agg._sum.amount ?? 0;
      await tx.order.update({
        where: { id: orderId },
        data: { amountPaid, paymentStatus: derivePaymentStatus(amountPaid, order.total) },
      });
      await this.events.emit(tx, 'payment.received', {
        paymentId: payment.id,
        orderId,
        businessId: ctx.businessId,
        channelId: order.channelId,
        amount: input.amount,
        currency: order.currency,
        method: input.method,
        receivedAt: payment.receivedAt.toISOString(),
      });
    });

    return this.orders.get(ctx, orderId);
  }
}
