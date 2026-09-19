import { Injectable, type OnModuleInit } from '@nestjs/common';
import type {
  AccountingSummaryDto,
  AccountingSummaryQuery,
  CreateFinancialEntryInput,
  FinancialEntryDto,
  FinancialEntryListQuery,
  FinancialEntryListResult,
  ReceivableDto,
  ReceivablesResult,
} from '@dokane/contracts';
import type { FinancialEntry, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainEvents } from '../../common/events/domain-events.service';
import type { TenantContext } from '../../common/tenant-context';

interface PaymentReceived {
  paymentId: string;
  orderId: string;
  businessId: string;
  channelId: string;
  customerId: string | null;
  amount: number;
  currency: string;
  method: string;
  receivedAt: string;
}

const OPEN_PAYMENT_STATUSES = ['UNPAID', 'PARTIALLY_PAID'];

@Injectable()
export class AccountingService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEvents,
  ) {}

  /**
   * Income follows payment. Subscribing here (not to order completion) makes the
   * ledger cash-basis and is CORE — it runs for every business so money stays
   * truthful regardless of the Accounting module entitlement. Idempotent: the
   * (businessId, sourceId) unique index dedupes outbox retries.
   */
  onModuleInit(): void {
    this.events.on('payment.received', (payload) => this.recordIncomeFromPayment(payload as PaymentReceived));
  }

  private async recordIncomeFromPayment(p: PaymentReceived): Promise<void> {
    try {
      await this.prisma.financialEntry.create({
        data: {
          businessId: p.businessId,
          type: 'INCOME',
          amount: p.amount,
          currency: p.currency,
          category: 'sales',
          channelId: p.channelId,
          orderId: p.orderId,
          customerId: p.customerId ?? null,
          method: p.method,
          sourceType: 'ORDER_PAYMENT',
          sourceId: p.paymentId,
          entryDate: new Date(p.receivedAt),
        },
      });
    } catch (err) {
      if (!this.isUniqueViolation(err)) throw err; // already recorded — idempotent
    }
  }

  async createEntry(ctx: TenantContext, input: CreateFinancialEntryInput): Promise<FinancialEntryDto> {
    const business = await this.prisma.business.findUniqueOrThrow({ where: { id: ctx.businessId }, select: { currency: true } });
    const entry = await this.prisma.financialEntry.create({
      data: {
        businessId: ctx.businessId,
        type: input.type,
        amount: input.amount,
        currency: business.currency,
        category: input.category ?? null,
        channelId: input.channelId ?? null,
        method: input.type === 'INCOME' ? input.method ?? null : null,
        sourceType: 'MANUAL',
        note: input.note ?? null,
        entryDate: input.entryDate ? new Date(input.entryDate) : new Date(),
        createdBy: ctx.userId,
      },
    });
    return this.toDto(entry, await this.channelNames(ctx.businessId));
  }

  async listEntries(ctx: TenantContext, query: FinancialEntryListQuery): Promise<FinancialEntryListResult> {
    const where: Prisma.FinancialEntryWhereInput = {
      businessId: ctx.businessId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.channelId ? { channelId: query.channelId } : {}),
      ...this.dateRange('entryDate', query.from, query.to),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.financialEntry.findMany({
        where,
        orderBy: { entryDate: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.financialEntry.count({ where }),
    ]);
    const names = await this.channelNames(ctx.businessId);
    return { items: rows.map((r) => this.toDto(r, names)), total, page: query.page, pageSize: query.pageSize };
  }

  async summary(ctx: TenantContext, query: AccountingSummaryQuery): Promise<AccountingSummaryDto> {
    const business = await this.prisma.business.findUniqueOrThrow({ where: { id: ctx.businessId }, select: { currency: true } });
    const entryWhere: Prisma.FinancialEntryWhereInput = {
      businessId: ctx.businessId,
      ...(query.channelId ? { channelId: query.channelId } : {}),
      ...this.dateRange('entryDate', query.from, query.to),
    };
    const [income, expenses] = await Promise.all([
      this.prisma.financialEntry.aggregate({ where: { ...entryWhere, type: 'INCOME' }, _sum: { amount: true } }),
      this.prisma.financialEntry.aggregate({ where: { ...entryWhere, type: 'EXPENSE' }, _sum: { amount: true } }),
    ]);
    const sales = await this.prisma.order.aggregate({
      where: {
        businessId: ctx.businessId,
        fulfillmentStatus: 'COMPLETED',
        ...(query.channelId ? { channelId: query.channelId } : {}),
        ...this.dateRange('createdAt', query.from, query.to),
      },
      _sum: { total: true },
    });
    const openOrders = await this.prisma.order.findMany({
      where: {
        businessId: ctx.businessId,
        fulfillmentStatus: { not: 'CANCELLED' },
        paymentStatus: { in: OPEN_PAYMENT_STATUSES },
        ...(query.channelId ? { channelId: query.channelId } : {}),
      },
      select: { total: true, amountPaid: true },
    });
    const receivables = openOrders.reduce((s, o) => s + Math.max(0, o.total - o.amountPaid), 0);
    const inc = income._sum.amount ?? 0;
    const exp = expenses._sum.amount ?? 0;
    return {
      sales: sales._sum.total ?? 0,
      income: inc,
      expenses: exp,
      receivables,
      net: inc - exp,
      currency: business.currency,
    };
  }

  async receivables(ctx: TenantContext, channelId?: string): Promise<ReceivablesResult> {
    const orders = await this.prisma.order.findMany({
      where: {
        businessId: ctx.businessId,
        fulfillmentStatus: { not: 'CANCELLED' },
        paymentStatus: { in: OPEN_PAYMENT_STATUSES },
        ...(channelId ? { channelId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    const names = await this.channelNames(ctx.businessId);
    const customerName = await this.customerNames(ctx.businessId, orders.map((o) => o.customerId));
    const items: ReceivableDto[] = orders.map((o) => ({
      orderId: o.id,
      customerName: o.customerId ? customerName.get(o.customerId) ?? null : null,
      channelName: names.get(o.channelId) ?? '',
      fulfillmentStatus: o.fulfillmentStatus,
      total: o.total,
      amountPaid: o.amountPaid,
      amountDue: Math.max(0, o.total - o.amountPaid),
      currency: o.currency,
      createdAt: o.createdAt.toISOString(),
    }));
    return { items, totalDue: items.reduce((s, i) => s + i.amountDue, 0) };
  }

  // ---- helpers ----

  private toDto(e: FinancialEntry, channelNames: Map<string, string>): FinancialEntryDto {
    return {
      id: e.id,
      type: e.type as FinancialEntryDto['type'],
      amount: e.amount,
      currency: e.currency,
      category: e.category,
      channelId: e.channelId,
      channelName: e.channelId ? channelNames.get(e.channelId) ?? null : null,
      orderId: e.orderId,
      customerId: e.customerId,
      method: e.method,
      sourceType: e.sourceType,
      note: e.note,
      entryDate: e.entryDate.toISOString(),
      createdAt: e.createdAt.toISOString(),
    };
  }

  private dateRange(field: 'entryDate' | 'createdAt', from?: string, to?: string): Record<string, unknown> {
    if (!from && !to) return {};
    const range: Prisma.DateTimeFilter = {};
    if (from) range.gte = new Date(from);
    if (to) range.lte = new Date(to);
    return { [field]: range };
  }

  private async channelNames(businessId: string): Promise<Map<string, string>> {
    const rows = await this.prisma.salesChannel.findMany({ where: { businessId }, select: { id: true, name: true } });
    return new Map(rows.map((c) => [c.id, c.name]));
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
}
