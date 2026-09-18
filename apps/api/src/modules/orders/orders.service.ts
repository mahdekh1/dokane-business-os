import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  allowedFulfillmentTransitions,
  derivePaymentStatus,
  type CreateOrderInput,
  type EntryMode,
  type FulfillmentStatus,
  type OrderDto,
  type OrderItemDto,
  type OrderListQuery,
  type OrderListResult,
  type OrderSummaryDto,
  type PaymentDto,
} from '@dokane/contracts';
import type { Order, OrderItem, Payment, Prisma, SalesChannel } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { TenantContext } from '../../common/tenant-context';
import { ChannelsService } from '../channels/channels.service';
import { CustomersService } from '../customers/customers.service';

interface ResolvedLine {
  offeringId: string | null;
  variantId: string | null;
  nameSnapshot: string;
  skuSnapshot: string | null;
  unitPrice: number;
  quantity: number;
  discount: number;
  lineTotal: number;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly channels: ChannelsService,
    private readonly customers: CustomersService,
  ) {}

  async create(ctx: TenantContext, input: CreateOrderInput, idempotencyKey?: string): Promise<OrderDto> {
    if (idempotencyKey) {
      const existing = await this.prisma.order.findFirst({
        where: { businessId: ctx.businessId, idempotencyKey },
      });
      if (existing) return this.get(ctx, existing.id);
    }

    const channel = await this.channels.resolveForOrder(ctx.businessId, input.channelId);
    const entryMode: EntryMode = channel.type === 'ONLINE_STORE' ? 'ONLINE' : 'MANUAL';
    const locationId = channel.type === 'ONLINE_STORE' ? channel.fulfillmentLocationId : channel.locationId;

    // Online orders always start PENDING; manual entries may set an initial state.
    const fulfillmentStatus: FulfillmentStatus =
      entryMode === 'ONLINE' ? 'PENDING' : (input.fulfillmentStatus ?? 'CONFIRMED');

    const customerId = await this.resolveCustomer(ctx, input, entryMode);
    const lines = await this.resolveLines(ctx, input.items);
    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    const orderDiscount = Math.min(input.discount ?? 0, subtotal);
    const total = Math.max(0, subtotal - orderDiscount);
    const business = await this.prisma.business.findUniqueOrThrow({ where: { id: ctx.businessId }, select: { currency: true } });

    try {
      const order = await this.prisma.$transaction(async (tx) => {
        const o = await tx.order.create({
          data: {
            businessId: ctx.businessId,
            channelId: channel.id,
            locationId: locationId ?? null,
            customerId,
            entryMode,
            fulfillmentStatus,
            paymentStatus: 'UNPAID',
            subtotal,
            discount: orderDiscount,
            taxAmount: 0,
            total,
            amountPaid: 0,
            currency: business.currency,
            note: input.note ?? null,
            idempotencyKey: idempotencyKey ?? null,
            createdBy: ctx.userId,
            items: {
              create: lines.map((l) => ({
                businessId: ctx.businessId,
                offeringId: l.offeringId,
                variantId: l.variantId,
                nameSnapshot: l.nameSnapshot,
                skuSnapshot: l.skuSnapshot,
                unitPrice: l.unitPrice,
                quantity: l.quantity,
                discount: l.discount,
                lineTotal: l.lineTotal,
              })),
            },
          },
          select: { id: true },
        });
        return o;
      });
      return this.get(ctx, order.id);
    } catch (err) {
      // Unique (businessId, idempotencyKey) race → return the winner.
      if (this.isUniqueViolation(err) && idempotencyKey) {
        const winner = await this.prisma.order.findFirst({ where: { businessId: ctx.businessId, idempotencyKey } });
        if (winner) return this.get(ctx, winner.id);
      }
      throw err;
    }
  }

  async transition(ctx: TenantContext, id: string, target: FulfillmentStatus): Promise<OrderDto> {
    const order = await this.prisma.order.findFirst({ where: { id, businessId: ctx.businessId } });
    if (!order) throw new NotFoundException({ code: 'ORDER_NOT_FOUND' });
    const allowed = allowedFulfillmentTransitions(order.entryMode as EntryMode, order.fulfillmentStatus as FulfillmentStatus);
    if (!allowed.includes(target)) {
      throw new BadRequestException({ code: 'ILLEGAL_TRANSITION', message: `Cannot move from ${order.fulfillmentStatus} to ${target}.` });
    }
    await this.prisma.order.update({ where: { id }, data: { fulfillmentStatus: target } });
    return this.get(ctx, id);
  }

  async list(ctx: TenantContext, query: OrderListQuery): Promise<OrderListResult> {
    const where: Prisma.OrderWhereInput = {
      businessId: ctx.businessId,
      ...(query.channelId ? { channelId: query.channelId } : {}),
      ...(query.fulfillmentStatus ? { fulfillmentStatus: query.fulfillmentStatus } : {}),
      ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
      ...(query.entryMode ? { entryMode: query.entryMode } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { _count: { select: { items: true } } },
      }),
      this.prisma.order.count({ where }),
    ]);
    const channelName = await this.channelNames(ctx.businessId);
    const customerName = await this.customerNames(ctx.businessId, rows.map((r) => r.customerId));
    const items: OrderSummaryDto[] = rows.map((o) => ({
      id: o.id,
      channelName: channelName.get(o.channelId)?.name ?? '',
      channelType: channelName.get(o.channelId)?.type ?? '',
      customerName: o.customerId ? customerName.get(o.customerId) ?? null : null,
      entryMode: o.entryMode as EntryMode,
      fulfillmentStatus: o.fulfillmentStatus as FulfillmentStatus,
      paymentStatus: o.paymentStatus as OrderSummaryDto['paymentStatus'],
      itemCount: o._count.items,
      total: o.total,
      amountDue: Math.max(0, o.total - o.amountPaid),
      currency: o.currency,
      createdAt: o.createdAt.toISOString(),
    }));
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async get(ctx: TenantContext, id: string): Promise<OrderDto> {
    const order = await this.prisma.order.findFirst({
      where: { id, businessId: ctx.businessId },
      include: { items: true, payments: { orderBy: { receivedAt: 'asc' } } },
    });
    if (!order) throw new NotFoundException({ code: 'ORDER_NOT_FOUND' });
    const channel = await this.prisma.salesChannel.findUnique({ where: { id: order.channelId } });
    const customer = order.customerId
      ? await this.prisma.customer.findUnique({ where: { id: order.customerId }, select: { name: true } })
      : null;
    return this.toDto(order, order.items, order.payments, channel, customer?.name ?? null);
  }

  // ---- helpers ----

  private toDto(
    o: Order,
    items: OrderItem[],
    payments: Payment[],
    channel: SalesChannel | null,
    customerName: string | null,
  ): OrderDto {
    return {
      id: o.id,
      channelId: o.channelId,
      channelName: channel?.name ?? '',
      channelType: channel?.type ?? '',
      locationId: o.locationId,
      customerId: o.customerId,
      customerName,
      entryMode: o.entryMode as EntryMode,
      fulfillmentStatus: o.fulfillmentStatus as FulfillmentStatus,
      paymentStatus: o.paymentStatus as OrderDto['paymentStatus'],
      subtotal: o.subtotal,
      discount: o.discount,
      taxAmount: o.taxAmount,
      total: o.total,
      amountPaid: o.amountPaid,
      amountDue: Math.max(0, o.total - o.amountPaid),
      currency: o.currency,
      note: o.note,
      items: items.map((i) => this.itemDto(i)),
      payments: payments.map((p) => this.paymentDto(p)),
      allowedTransitions: allowedFulfillmentTransitions(o.entryMode as EntryMode, o.fulfillmentStatus as FulfillmentStatus),
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
    };
  }

  private itemDto(i: OrderItem): OrderItemDto {
    return {
      id: i.id,
      offeringId: i.offeringId,
      variantId: i.variantId,
      nameSnapshot: i.nameSnapshot,
      skuSnapshot: i.skuSnapshot,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      discount: i.discount,
      lineTotal: i.lineTotal,
    };
  }

  private paymentDto(p: Payment): PaymentDto {
    return {
      id: p.id,
      method: p.method as PaymentDto['method'],
      amount: p.amount,
      currency: p.currency,
      reference: p.reference,
      status: p.status as PaymentDto['status'],
      receivedAt: p.receivedAt.toISOString(),
    };
  }

  private async resolveCustomer(ctx: TenantContext, input: CreateOrderInput, entryMode: EntryMode): Promise<string | null> {
    const c = input.customer;
    if (!c) return null;
    if (c.customerId) {
      const found = await this.prisma.customer.findFirst({ where: { id: c.customerId, businessId: ctx.businessId }, select: { id: true } });
      if (!found) throw new BadRequestException({ code: 'CUSTOMER_NOT_FOUND' });
      return found.id;
    }
    if (c.email || c.phone || c.name) {
      const created = await this.customers.getOrCreateByContact(ctx, {
        email: c.email, phone: c.phone, name: c.name,
        source: entryMode === 'ONLINE' ? 'ONLINE' : 'MANUAL',
      });
      return created.id;
    }
    return null;
  }

  private async resolveLines(ctx: TenantContext, items: CreateOrderInput['items']): Promise<ResolvedLine[]> {
    const lines: ResolvedLine[] = [];
    for (const it of items) {
      if (it.variantId) {
        const v = await this.prisma.offeringVariant.findFirst({
          where: { id: it.variantId, businessId: ctx.businessId },
          include: { offering: { select: { name: true, sku: true } } },
        });
        if (!v) throw new BadRequestException({ code: 'OFFERING_NOT_FOUND', message: 'Unknown product variant.' });
        const attrs = (v.attributes ?? {}) as Record<string, string>;
        const name = `${v.offering.name} — ${v.name ?? Object.values(attrs).join(' / ')}`;
        lines.push(this.line(null, v.id, name, v.sku ?? v.offering.sku ?? null, v.price, it.quantity, it.discount ?? 0));
      } else {
        const o = await this.prisma.offering.findFirst({
          where: { id: it.offeringId, businessId: ctx.businessId },
          select: { id: true, name: true, sku: true, price: true },
        });
        if (!o) throw new BadRequestException({ code: 'OFFERING_NOT_FOUND', message: 'Unknown product.' });
        lines.push(this.line(o.id, null, o.name, o.sku ?? null, o.price, it.quantity, it.discount ?? 0));
      }
    }
    return lines;
  }

  private line(
    offeringId: string | null,
    variantId: string | null,
    nameSnapshot: string,
    skuSnapshot: string | null,
    unitPrice: number,
    quantity: number,
    discount: number,
  ): ResolvedLine {
    const lineTotal = Math.max(0, unitPrice * quantity - discount);
    return { offeringId, variantId, nameSnapshot, skuSnapshot, unitPrice, quantity, discount, lineTotal };
  }

  private async channelNames(businessId: string): Promise<Map<string, { name: string; type: string }>> {
    const rows = await this.prisma.salesChannel.findMany({ where: { businessId }, select: { id: true, name: true, type: true } });
    return new Map(rows.map((c) => [c.id, { name: c.name, type: c.type }]));
  }

  private async customerNames(businessId: string, ids: (string | null)[]): Promise<Map<string, string>> {
    const uniq = [...new Set(ids.filter((x): x is string => !!x))];
    if (uniq.length === 0) return new Map();
    const rows = await this.prisma.customer.findMany({ where: { businessId, id: { in: uniq } }, select: { id: true, name: true } });
    return new Map(rows.map((c) => [c.id, c.name]));
  }

  private isUniqueViolation(err: unknown): boolean {
    return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002';
  }

  // Kept for later derivation callers (payments update amountPaid → status).
  protected recomputePaymentStatus(amountPaid: number, total: number): OrderDto['paymentStatus'] {
    return derivePaymentStatus(amountPaid, total);
  }
}
