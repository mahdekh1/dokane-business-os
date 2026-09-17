import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CreateCustomerInput,
  CustomerDto,
  CustomerListQuery,
  CustomerListResult,
  CustomerSource,
  UpdateCustomerInput,
} from '@dokane/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import type { TenantContext } from '../../common/tenant-context';

type Row = { id: string; name: string; email: string | null; phone: string | null; address: string | null; source: string; createdAt: Date };

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  private toDto(c: Row): CustomerDto {
    return {
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      address: c.address,
      source: c.source as CustomerSource,
      createdAt: c.createdAt.toISOString(),
    };
  }

  async list(ctx: TenantContext, query: CustomerListQuery): Promise<CustomerListResult> {
    const where: Prisma.CustomerWhereInput = { businessId: ctx.businessId };
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { email: { contains: query.q, mode: 'insensitive' } },
        { phone: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.customer.count({ where }),
    ]);
    return { items: items.map((c) => this.toDto(c)), total, page: query.page, pageSize: query.pageSize };
  }

  async get(ctx: TenantContext, id: string): Promise<CustomerDto> {
    const c = await this.prisma.customer.findFirst({ where: { id, businessId: ctx.businessId } });
    if (!c) throw new NotFoundException({ code: 'NOT_FOUND' });
    return this.toDto(c);
  }

  async create(ctx: TenantContext, input: CreateCustomerInput): Promise<CustomerDto> {
    const c = await this.prisma.customer.create({
      data: {
        businessId: ctx.businessId,
        name: input.name,
        email: input.email || null,
        phone: input.phone || null,
        address: input.address || null,
        source: input.source ?? 'MANUAL',
      },
    });
    return this.toDto(c);
  }

  async update(ctx: TenantContext, id: string, input: UpdateCustomerInput): Promise<CustomerDto> {
    await this.get(ctx, id);
    const data: Prisma.CustomerUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.email !== undefined) data.email = input.email || null;
    if (input.phone !== undefined) data.phone = input.phone || null;
    if (input.address !== undefined) data.address = input.address || null;
    if (input.source !== undefined) data.source = input.source;
    const c = await this.prisma.customer.update({ where: { id }, data });
    return this.toDto(c);
  }

  /**
   * Find an existing customer by email or phone within the tenant, else create one.
   * Used by Orders (Phase 4) and CRM so they never duplicate the base record.
   */
  async getOrCreateByContact(
    ctx: TenantContext,
    contact: { email?: string; phone?: string; name?: string; source?: CustomerSource },
  ): Promise<CustomerDto> {
    const or: Prisma.CustomerWhereInput[] = [];
    if (contact.email) or.push({ email: contact.email });
    if (contact.phone) or.push({ phone: contact.phone });
    if (or.length > 0) {
      const found = await this.prisma.customer.findFirst({ where: { businessId: ctx.businessId, OR: or } });
      if (found) return this.toDto(found);
    }
    return this.create(ctx, {
      name: contact.name || contact.email || contact.phone || 'Customer',
      email: contact.email ?? '',
      phone: contact.phone,
      source: contact.source ?? 'MANUAL',
    });
  }
}
