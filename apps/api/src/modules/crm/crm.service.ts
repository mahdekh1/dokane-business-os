import { Injectable, NotFoundException, type OnModuleInit } from '@nestjs/common';
import type {
  CreateLeadInput,
  LeadDto,
  LeadListQuery,
  LeadListResult,
  UpdateLeadInput,
} from '@dokane/contracts';
import type { Lead, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainEvents } from '../../common/events/domain-events.service';
import type { TenantContext } from '../../common/tenant-context';
import { CustomersService } from '../customers/customers.service';

interface OrderPlaced {
  orderId: string;
  businessId: string;
  entryMode: string;
  customerId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
}

@Injectable()
export class CrmService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customers: CustomersService,
    private readonly events: DomainEvents,
  ) {}

  /**
   * CRM registers customers off orders WITHOUT owning the customers table — it
   * calls the core CustomersService (module-boundary rule). On an online order,
   * ensure a customer exists (source ONLINE); dedupe is delegated to the core
   * getOrCreateByContact, so this is idempotent with the order's own inline link.
   */
  onModuleInit(): void {
    this.events.on('order.placed', (payload) => this.onOrderPlaced(payload as OrderPlaced));
  }

  private async onOrderPlaced(p: OrderPlaced): Promise<void> {
    if (p.entryMode !== 'ONLINE') return;
    if (p.customerId) return; // order already linked a customer
    if (!p.email && !p.phone && !p.name) return;
    const ctx = { businessId: p.businessId } as TenantContext;
    await this.customers.getOrCreateByContact(ctx, {
      email: p.email ?? undefined,
      phone: p.phone ?? undefined,
      name: p.name ?? undefined,
      source: 'ONLINE',
    });
  }

  private toDto(l: Lead): LeadDto {
    return {
      id: l.id,
      customerId: l.customerId,
      name: l.name,
      email: l.email,
      phone: l.phone,
      source: l.source,
      value: l.value,
      note: l.note,
      stage: l.stage as LeadDto['stage'],
      createdAt: l.createdAt.toISOString(),
      updatedAt: l.updatedAt.toISOString(),
    };
  }

  async list(ctx: TenantContext, query: LeadListQuery): Promise<LeadListResult> {
    const where: Prisma.LeadWhereInput = {
      businessId: ctx.businessId,
      ...(query.stage ? { stage: query.stage } : {}),
      ...(query.q
        ? { OR: [
            { name: { contains: query.q, mode: 'insensitive' } },
            { email: { contains: query.q, mode: 'insensitive' } },
            { phone: { contains: query.q } },
          ] }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.lead.count({ where }),
    ]);
    return { items: rows.map((l) => this.toDto(l)), total, page: query.page, pageSize: query.pageSize };
  }

  async get(ctx: TenantContext, id: string): Promise<LeadDto> {
    const lead = await this.prisma.lead.findFirst({ where: { id, businessId: ctx.businessId } });
    if (!lead) throw new NotFoundException({ code: 'LEAD_NOT_FOUND' });
    return this.toDto(lead);
  }

  async create(ctx: TenantContext, input: CreateLeadInput): Promise<LeadDto> {
    const lead = await this.prisma.lead.create({
      data: {
        businessId: ctx.businessId,
        name: input.name,
        email: input.email || null,
        phone: input.phone ?? null,
        source: input.source ?? null,
        value: input.value ?? null,
        note: input.note ?? null,
        stage: input.stage ?? 'NEW',
      },
    });
    return this.toDto(lead);
  }

  async update(ctx: TenantContext, id: string, input: UpdateLeadInput): Promise<LeadDto> {
    await this.get(ctx, id); // tenant check
    const data: Prisma.LeadUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.email !== undefined) data.email = input.email || null;
    if (input.phone !== undefined) data.phone = input.phone ?? null;
    if (input.source !== undefined) data.source = input.source ?? null;
    if (input.value !== undefined) data.value = input.value ?? null;
    if (input.note !== undefined) data.note = input.note ?? null;
    if (input.stage !== undefined) data.stage = input.stage;
    const lead = await this.prisma.lead.update({ where: { id }, data });
    return this.toDto(lead);
  }

  /** Convert a lead into a core customer (create/link, deduped) and mark it
   *  CONVERTED. Delegates customer creation to the core module. */
  async convert(ctx: TenantContext, id: string): Promise<LeadDto> {
    const lead = await this.prisma.lead.findFirst({ where: { id, businessId: ctx.businessId } });
    if (!lead) throw new NotFoundException({ code: 'LEAD_NOT_FOUND' });
    const customer = await this.customers.getOrCreateByContact(ctx, {
      email: lead.email ?? undefined,
      phone: lead.phone ?? undefined,
      name: lead.name,
      source: 'MANUAL',
    });
    const updated = await this.prisma.lead.update({
      where: { id },
      data: { customerId: customer.id, stage: 'CONVERTED' },
    });
    return this.toDto(updated);
  }
}
