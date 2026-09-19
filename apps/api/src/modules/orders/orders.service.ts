import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  allowedFulfillmentTransitions,
  consumesStock,
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
import { EventBus } from '../../common/events/event-bus.service';
import type { TenantContext } from '../../common/tenant-context';
import { ChannelsService } from '../channels/channels.service';
import { CustomersService } from '../customers/customers.service';
import { InventoryService } from '../inventory/inventory.service';

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
    private readonly inventory: InventoryService,
    private readonly events: EventBus,
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

    const customer = await this.resolveCustomer(ctx, input, entryMode);
    const lines = await this.resolveLines(ctx, input.items);
    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    const orderDiscount = Math.min(input.discount ?? 0, subtotal);
    const total = Math.max(0, subtotal - orderDiscount);
    const business = await this.prisma.business.findUniqueOrThrow({ where: { id: ctx.businessId }, select: { currency: true } });

    const commitOnCreate = consumesStock(fulfillmentStatus);
    try {
      const order = await this.prisma.$transaction(async (tx) => {
        const o = await tx.order.create({
          data: {
            businessId: ctx.businessId,
            channelId: channel.id,
            locationId: locationId ?? null,
            customerId: customer.customerId,
            customerName: customer.customerName,
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
            stockCommitted: commitOnCreate,
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
          include: { items: true },
        });
        if (commitOnCreate) await this.commitStock(tx, o, o.items, 'SALE');
        // CRM (and later modules) react to this via the outbox. Carries the
        // contact so CRM can upsert/link a customer for online orders.
        await this.events.emit(tx, 'order.placed', {
          orderId: o.id,
          businessId: ctx.businessId,
          channelId: channel.id,
          entryMode,
          customerId: customer.customerId,
          name: customer.customerName ?? input.customer?.name ?? null,
          email: input.customer?.email ?? null,
          phone: input.customer?.phone ?? null,
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

    const commitNow = consumesStock(target) && !order.stockCommitted;
    const releaseNow = target === 'CANCELLED' && order.stockCommitted;
    await this.prisma.$transaction(async (tx) => {
      if (commitNow || releaseNow) {
        const items = await tx.orderItem.findMany({ where: { orderId: id } });
        await this.commitStock(tx, order, items, commitNow ? 'SALE' : 'RETURN');
      }
      await tx.order.update({
        where: { id },
        data: {
          fulfillmentStatus: target,
          ...(commitNow ? { stockCommitted: true } : {}),
          ...(releaseNow ? { stockCommitted: false } : {}),
        },
      });
    });
    return this.get(ctx, id);
  }

  /**
   * Apply an order's stock effect within the caller's transaction: SALE
   * decrements (aborting with INSUFFICIENT_STOCK if short), RETURN restocks.
   * Only items whose offering tracks inventory are touched (digital goods are
   * skipped). Every change writes a movement referencing the order.
   */
  private async commitStock(
    tx: Prisma.TransactionClient,
    order: { id: string; businessId: string; locationId: string | null; createdBy: string | null },
    items: { offeringId: string | null; variantId: string | null; quantity: number }[],
    direction: 'SALE' | 'RETURN',
  ): Promise<void> {
    const locationId = order.locationId ?? (await this.inventory.ensureDefaultLocation(order.businessId));
    const offeringIds = [...new Set(items.filter((i) => i.offeringId).map((i) => i.offeringId as string))];
    const variantIds = [...new Set(items.filter((i) => i.variantId).map((i) => i.variantId as string))];
    const offerings = offeringIds.length
      ? await tx.offering.findMany({ where: { businessId: order.businessId, id: { in: offeringIds } }, select: { id: true, trackInventory: true } })
      : [];
    const variants = variantIds.length
      ? await tx.offeringVariant.findMany({ where: { businessId: order.businessId, id: { in: variantIds } }, include: { offering: { select: { trackInventory: true } } } })
      : [];
    const offTrack = new Map(offerings.map((o) => [o.id, o.trackInventory]));
    const varTrack = new Map(variants.map((v) => [v.id, v.offering.trackInventory]));

    for (const it of items) {
      const tracks = it.offeringId ? offTrack.get(it.offeringId) : it.variantId ? varTrack.get(it.variantId) : false;
      if (!tracks) continue;
      const stockableKey = it.variantId ? `variant:${it.variantId}` : `offering:${it.offeringId}`;
      await this.inventory.applyDeltaTx(tx, {
        businessId: order.businessId,
        locationId,
        offeringId: it.offeringId,
        variantId: it.variantId,
        stockableKey,
        delta: direction === 'SALE' ? -it.quantity : it.quantity,
        movementType: direction,
        referenceType: 'order',
        referenceId: order.id,
        createdBy: order.createdBy,
      });
    }
  }

  async list(ctx: TenantContext, query: OrderListQuery): Promise<OrderListResult> {
    const where: Prisma.OrderWhereInput = {
      businessId: ctx.businessId,
      ...(query.channelId ? { channelId: query.channelId } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
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
    const items: OrderSummaryDto[] = rows.map((o) => ({
      id: o.id,
      channelName: channelName.get(o.channelId)?.name ?? '',
      channelType: channelName.get(o.channelId)?.type ?? '',
      customerName: o.customerName,
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
    return this.toDto(order, order.items, order.payments, channel);
  }

  // ---- helpers ----

  private toDto(
    o: Order,
    items: OrderItem[],
    payments: Payment[],
    channel: SalesChannel | null,
  ): OrderDto {
    return {
      id: o.id,
      channelId: o.channelId,
      channelName: channel?.name ?? '',
      channelType: channel?.type ?? '',
      locationId: o.locationId,
      customerId: o.customerId,
      customerName: o.customerName,
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

  /** Resolve the order's customer into an optional link + a display snapshot
   *  (see OrderCustomerInput): existing id, create+link, or ephemeral name. */
  private async resolveCustomer(
    ctx: TenantContext,
    input: CreateOrderInput,
    entryMode: EntryMode,
  ): Promise<{ customerId: string | null; customerName: string | null }> {
    const c = input.customer;
    if (!c) return { customerId: null, customerName: null };
    if (c.customerId) {
      const found = await this.prisma.customer.findFirst({ where: { id: c.customerId, businessId: ctx.businessId }, select: { id: true, name: true } });
      if (!found) throw new BadRequestException({ code: 'CUSTOMER_NOT_FOUND' });
      return { customerId: found.id, customerName: found.name };
    }
    const name = c.name?.trim() || null;
    if (!c.email && !c.phone && !name) return { customerId: null, customerName: null };
    if (c.save === false) {
      // Ephemeral — snapshot the label only, no customer record.
      return { customerId: null, customerName: name };
    }
    const created = await this.customers.getOrCreateByContact(ctx, {
      email: c.email, phone: c.phone, name: c.name,
      source: entryMode === 'ONLINE' ? 'ONLINE' : 'MANUAL',
    });
    return { customerId: created.id, customerName: created.name };
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

  private isUniqueViolation(err: unknown): boolean {
    return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002';
  }

  // Kept for later derivation callers (payments update amountPaid → status).
  protected recomputePaymentStatus(amountPaid: number, total: number): OrderDto['paymentStatus'] {
    return derivePaymentStatus(amountPaid, total);
  }
}
