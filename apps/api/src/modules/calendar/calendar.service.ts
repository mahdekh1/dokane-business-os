import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AppointmentDto,
  AppointmentListQuery,
  AppointmentListResult,
  CalendarConnectionDto,
  CalendarProvider,
  CreateAppointmentInput,
  UpdateAppointmentInput,
} from '@dokane/contracts';
import { CALENDAR_PROVIDERS } from '@dokane/contracts';
import type { Appointment, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBus } from '../../common/events/event-bus.service';
import type { TenantContext } from '../../common/tenant-context';

/** Which external providers are configured server-side (creds present). Until
 *  set, connecting returns NOT_CONFIGURED and sync stays dormant. */
function providerConfigured(provider: CalendarProvider): boolean {
  if (provider === 'GOOGLE') return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  if (provider === 'APPLE_CALDAV') return process.env.CALDAV_ENABLED === 'true';
  return false;
}

@Injectable()
export class CalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBus,
  ) {}

  // ---- appointments ----

  async list(ctx: TenantContext, query: AppointmentListQuery): Promise<AppointmentListResult> {
    const where: Prisma.AppointmentWhereInput = {
      businessId: ctx.businessId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.from || query.to
        ? { startsAt: { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}) } }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.appointment.findMany({ where, orderBy: { startsAt: 'asc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.appointment.count({ where }),
    ]);
    const names = await this.names(ctx.businessId, rows);
    return { items: rows.map((a) => this.toDto(a, names)), total, page: query.page, pageSize: query.pageSize };
  }

  async get(ctx: TenantContext, id: string): Promise<AppointmentDto> {
    const a = await this.prisma.appointment.findFirst({ where: { id, businessId: ctx.businessId } });
    if (!a) throw new NotFoundException({ code: 'APPOINTMENT_NOT_FOUND' });
    return this.toDto(a, await this.names(ctx.businessId, [a]));
  }

  async create(ctx: TenantContext, input: CreateAppointmentInput): Promise<AppointmentDto> {
    if (input.customerId) await this.assertCustomer(ctx.businessId, input.customerId);
    if (input.assigneeId) await this.assertMembership(ctx.businessId, input.assigneeId);
    const created = await this.prisma.$transaction(async (tx) => {
      const a = await tx.appointment.create({
        data: {
          businessId: ctx.businessId,
          title: input.title,
          description: input.description ?? null,
          startsAt: new Date(input.startsAt),
          endsAt: new Date(input.endsAt),
          status: input.status ?? 'SCHEDULED',
          customerId: input.customerId ?? null,
          assigneeId: input.assigneeId ?? null,
          location: input.location ?? null,
          note: input.note ?? null,
          createdBy: ctx.userId,
        },
      });
      await this.emitChanged(tx, a, 'created');
      return a;
    });
    return this.get(ctx, created.id);
  }

  async update(ctx: TenantContext, id: string, input: UpdateAppointmentInput): Promise<AppointmentDto> {
    const existing = await this.prisma.appointment.findFirst({ where: { id, businessId: ctx.businessId } });
    if (!existing) throw new NotFoundException({ code: 'APPOINTMENT_NOT_FOUND' });
    if (input.customerId) await this.assertCustomer(ctx.businessId, input.customerId);
    if (input.assigneeId) await this.assertMembership(ctx.businessId, input.assigneeId);
    const startsAt = input.startsAt ? new Date(input.startsAt) : existing.startsAt;
    const endsAt = input.endsAt ? new Date(input.endsAt) : existing.endsAt;
    if (endsAt <= startsAt) throw new BadRequestException({ code: 'INVALID_RANGE', message: 'End must be after start.' });

    const data: Prisma.AppointmentUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description;
    if (input.startsAt !== undefined) data.startsAt = startsAt;
    if (input.endsAt !== undefined) data.endsAt = endsAt;
    if (input.customerId !== undefined) data.customerId = input.customerId;
    if (input.assigneeId !== undefined) data.assigneeId = input.assigneeId;
    if (input.location !== undefined) data.location = input.location;
    if (input.status !== undefined) data.status = input.status;
    if (input.note !== undefined) data.note = input.note;

    const updated = await this.prisma.$transaction(async (tx) => {
      const a = await tx.appointment.update({ where: { id }, data });
      await this.emitChanged(tx, a, 'updated');
      return a;
    });
    return this.get(ctx, updated.id);
  }

  // ---- external connections (scaffold, dormant) ----

  async connections(ctx: TenantContext): Promise<CalendarConnectionDto[]> {
    const rows = await this.prisma.calendarConnection.findMany({ where: { businessId: ctx.businessId } });
    const byProvider = new Map(rows.map((r) => [r.provider, r]));
    return CALENDAR_PROVIDERS.map((provider) => {
      const row = byProvider.get(provider);
      return {
        provider,
        status: (row?.status as CalendarConnectionDto['status']) ?? 'DISCONNECTED',
        accountEmail: row?.accountEmail ?? null,
        lastSyncAt: row?.lastSyncAt ? row.lastSyncAt.toISOString() : null,
        configured: providerConfigured(provider),
      };
    });
  }

  /** Begin connecting a provider. Dormant until server-side OAuth/CalDAV creds
   *  are configured — returns NOT_CONFIGURED so the UI can explain what's needed. */
  async connect(_ctx: TenantContext, provider: CalendarProvider): Promise<never> {
    if (!providerConfigured(provider)) {
      throw new BadRequestException({
        code: 'NOT_CONFIGURED',
        message: `${provider === 'GOOGLE' ? 'Google Calendar' : 'Apple Calendar'} sync isn't configured on this server yet.`,
      });
    }
    // Real OAuth/CalDAV handshake goes here once creds exist.
    throw new BadRequestException({ code: 'NOT_CONFIGURED', message: 'Sync is not enabled yet.' });
  }

  async disconnect(ctx: TenantContext, provider: CalendarProvider): Promise<CalendarConnectionDto[]> {
    await this.prisma.calendarConnection.updateMany({
      where: { businessId: ctx.businessId, provider },
      data: { status: 'DISCONNECTED', accessTokenEnc: null, refreshTokenEnc: null },
    });
    return this.connections(ctx);
  }

  // ---- helpers ----

  private async emitChanged(tx: Prisma.TransactionClient, a: Appointment, action: 'created' | 'updated'): Promise<void> {
    // Consumed by the (future) calendar-sync worker to push to Google/Apple.
    await this.events.emit(tx, 'calendar.appointment.changed', {
      appointmentId: a.id, businessId: a.businessId, action,
      startsAt: a.startsAt.toISOString(), endsAt: a.endsAt.toISOString(), status: a.status,
    });
  }

  private toDto(a: Appointment, names: { customers: Map<string, string>; members: Map<string, string> }): AppointmentDto {
    return {
      id: a.id,
      title: a.title,
      description: a.description,
      startsAt: a.startsAt.toISOString(),
      endsAt: a.endsAt.toISOString(),
      status: a.status as AppointmentDto['status'],
      customerId: a.customerId,
      customerName: a.customerId ? names.customers.get(a.customerId) ?? null : null,
      assigneeId: a.assigneeId,
      assigneeName: a.assigneeId ? names.members.get(a.assigneeId) ?? null : null,
      location: a.location,
      note: a.note,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    };
  }

  private async names(businessId: string, rows: Appointment[]): Promise<{ customers: Map<string, string>; members: Map<string, string> }> {
    const customerIds = [...new Set(rows.map((r) => r.customerId).filter((x): x is string => !!x))];
    const memberIds = [...new Set(rows.map((r) => r.assigneeId).filter((x): x is string => !!x))];
    const [customers, members] = await Promise.all([
      customerIds.length ? this.prisma.customer.findMany({ where: { businessId, id: { in: customerIds } }, select: { id: true, name: true } }) : [],
      memberIds.length ? this.prisma.businessMembership.findMany({ where: { businessId, id: { in: memberIds } }, select: { id: true, user: { select: { firstName: true, lastName: true } } } }) : [],
    ]);
    return {
      customers: new Map(customers.map((c) => [c.id, c.name])),
      members: new Map(members.map((m) => [m.id, `${m.user.firstName} ${m.user.lastName}`.trim()])),
    };
  }

  private async assertCustomer(businessId: string, customerId: string): Promise<void> {
    const c = await this.prisma.customer.findFirst({ where: { id: customerId, businessId }, select: { id: true } });
    if (!c) throw new BadRequestException({ code: 'CUSTOMER_NOT_FOUND' });
  }

  private async assertMembership(businessId: string, membershipId: string): Promise<void> {
    const m = await this.prisma.businessMembership.findFirst({ where: { id: membershipId, businessId }, select: { id: true } });
    if (!m) throw new BadRequestException({ code: 'INVALID_ASSIGNEE', message: 'Assignee is not a member of this business.' });
  }
}
