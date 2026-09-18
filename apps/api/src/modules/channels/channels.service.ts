import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  ChannelDto,
  CreateChannelInput,
  UpdateChannelInput,
} from '@dokane/contracts';
import type { Prisma, SalesChannel } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { TenantContext } from '../../common/tenant-context';
import { InventoryService } from '../inventory/inventory.service';

@Injectable()
export class ChannelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  private toDto(c: SalesChannel): ChannelDto {
    return {
      id: c.id,
      type: c.type as ChannelDto['type'],
      name: c.name,
      locationId: c.locationId,
      fulfillmentLocationId: c.fulfillmentLocationId,
      isDefault: c.isDefault,
      active: c.active,
    };
  }

  /**
   * Ensure every approved business has its baseline channels: one ONLINE_STORE
   * (fulfilled from the default location) and one PHYSICAL per location. Called
   * lazily on first read and by order creation, mirroring ensureDefaultLocation.
   * Idempotent — only creates channels that are missing.
   */
  async ensureDefaults(businessId: string): Promise<void> {
    const defaultLocationId = await this.inventory.ensureDefaultLocation(businessId);
    const existing = await this.prisma.salesChannel.findMany({ where: { businessId } });

    if (!existing.some((c) => c.type === 'ONLINE_STORE')) {
      await this.prisma.salesChannel.create({
        data: {
          businessId,
          type: 'ONLINE_STORE',
          name: 'Online store',
          fulfillmentLocationId: defaultLocationId,
          isDefault: true,
        },
      });
    }

    const locations = await this.prisma.location.findMany({ where: { businessId } });
    const physicalLocationIds = new Set(
      existing.filter((c) => c.type === 'PHYSICAL').map((c) => c.locationId),
    );
    for (const loc of locations) {
      if (!physicalLocationIds.has(loc.id)) {
        await this.prisma.salesChannel.create({
          data: {
            businessId,
            type: 'PHYSICAL',
            name: loc.isDefault ? 'In-store' : `In-store — ${loc.name}`,
            locationId: loc.id,
            isDefault: loc.isDefault,
          },
        });
      }
    }
  }

  async list(ctx: TenantContext): Promise<ChannelDto[]> {
    await this.ensureDefaults(ctx.businessId);
    const rows = await this.prisma.salesChannel.findMany({
      where: { businessId: ctx.businessId },
      orderBy: [{ isDefault: 'desc' }, { type: 'asc' }, { name: 'asc' }],
    });
    return rows.map((c) => this.toDto(c));
  }

  /** Resolve a channel for order creation: a given id (validated) or the
   *  business default. Throws if the id is not this tenant's channel. */
  async resolveForOrder(businessId: string, channelId?: string): Promise<SalesChannel> {
    await this.ensureDefaults(businessId);
    if (channelId) {
      const c = await this.prisma.salesChannel.findFirst({ where: { id: channelId, businessId } });
      if (!c) throw new NotFoundException({ code: 'CHANNEL_NOT_FOUND' });
      if (!c.active) throw new BadRequestException({ code: 'CHANNEL_INACTIVE' });
      return c;
    }
    const def =
      (await this.prisma.salesChannel.findFirst({ where: { businessId, isDefault: true, active: true } })) ??
      (await this.prisma.salesChannel.findFirst({ where: { businessId, active: true } }));
    if (!def) throw new NotFoundException({ code: 'CHANNEL_NOT_FOUND' });
    return def;
  }

  async create(ctx: TenantContext, input: CreateChannelInput): Promise<ChannelDto> {
    await this.assertLocation(ctx.businessId, input.locationId ?? null);
    await this.assertLocation(ctx.businessId, input.fulfillmentLocationId ?? null);
    const created = await this.prisma.salesChannel.create({
      data: {
        businessId: ctx.businessId,
        type: input.type,
        name: input.name,
        locationId: input.locationId ?? null,
        fulfillmentLocationId: input.fulfillmentLocationId ?? null,
        settings: (input.settings ?? {}) as Prisma.InputJsonValue,
        active: input.active ?? true,
      },
    });
    return this.toDto(created);
  }

  async update(ctx: TenantContext, id: string, input: UpdateChannelInput): Promise<ChannelDto> {
    const existing = await this.prisma.salesChannel.findFirst({ where: { id, businessId: ctx.businessId } });
    if (!existing) throw new NotFoundException({ code: 'CHANNEL_NOT_FOUND' });
    if (input.locationId !== undefined) await this.assertLocation(ctx.businessId, input.locationId);
    if (input.fulfillmentLocationId !== undefined) await this.assertLocation(ctx.businessId, input.fulfillmentLocationId);

    const nextFulfillment =
      input.fulfillmentLocationId !== undefined ? input.fulfillmentLocationId : existing.fulfillmentLocationId;
    if (existing.type === 'ONLINE_STORE' && !nextFulfillment) {
      throw new BadRequestException({ code: 'FULFILLMENT_REQUIRED', message: 'An online store needs a fulfillment location.' });
    }

    const data: Prisma.SalesChannelUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.locationId !== undefined) data.locationId = input.locationId;
    if (input.fulfillmentLocationId !== undefined) data.fulfillmentLocationId = input.fulfillmentLocationId;
    if (input.settings !== undefined) data.settings = input.settings as Prisma.InputJsonValue;
    if (input.active !== undefined) data.active = input.active;
    const updated = await this.prisma.salesChannel.update({ where: { id }, data });
    return this.toDto(updated);
  }

  private async assertLocation(businessId: string, locationId: string | null): Promise<void> {
    if (!locationId) return;
    const loc = await this.prisma.location.findFirst({ where: { id: locationId, businessId } });
    if (!loc) throw new BadRequestException({ code: 'LOCATION_NOT_FOUND', message: 'Unknown location.' });
  }
}
