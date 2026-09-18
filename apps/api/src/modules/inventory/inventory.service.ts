import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AdjustStockInput,
  InventoryItemDto,
  InventoryListQuery,
  InventoryListResult,
  LocationDto,
  MovementDto,
  MovementListQuery,
  MovementListResult,
} from '@dokane/contracts';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { TenantContext } from '../../common/tenant-context';

interface Stockable {
  offeringId: string | null;
  variantId: string | null;
  stockableKey: string;
  label: string;
}

/** Low-level, transaction-scoped stock change. */
export interface StockDelta {
  businessId: string;
  locationId: string;
  offeringId: string | null;
  variantId: string | null;
  stockableKey: string;
  delta: number;
  movementType: string;
  reason?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  createdBy?: string | null;
  /** When true, (re)sets the low-stock threshold to `lowStockThreshold`. */
  setThreshold?: boolean;
  lowStockThreshold?: number | null;
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  /** The business's default location, created on first use. */
  async ensureDefaultLocation(businessId: string): Promise<string> {
    const existing = await this.prisma.location.findFirst({
      where: { businessId, isDefault: true },
      select: { id: true },
    });
    if (existing) return existing.id;
    const created = await this.prisma.location.create({
      data: { businessId, name: 'Main location', isDefault: true },
      select: { id: true },
    });
    return created.id;
  }

  async listLocations(ctx: TenantContext): Promise<LocationDto[]> {
    await this.ensureDefaultLocation(ctx.businessId);
    const rows = await this.prisma.location.findMany({
      where: { businessId: ctx.businessId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
    return rows.map((l) => ({ id: l.id, name: l.name, code: l.code, isDefault: l.isDefault }));
  }

  private async resolveLocation(ctx: TenantContext, locationId?: string): Promise<{ id: string; name: string }> {
    if (!locationId) {
      const id = await this.ensureDefaultLocation(ctx.businessId);
      const loc = await this.prisma.location.findUniqueOrThrow({ where: { id }, select: { id: true, name: true } });
      return loc;
    }
    const loc = await this.prisma.location.findFirst({
      where: { id: locationId, businessId: ctx.businessId },
      select: { id: true, name: true },
    });
    if (!loc) throw new BadRequestException({ code: 'INVALID_LOCATION' });
    return loc;
  }

  private async resolveStockable(ctx: TenantContext, input: { offeringId?: string; variantId?: string }): Promise<Stockable> {
    if (input.variantId) {
      const v = await this.prisma.offeringVariant.findFirst({
        where: { id: input.variantId, businessId: ctx.businessId },
        include: { offering: { select: { name: true } } },
      });
      if (!v) throw new BadRequestException({ code: 'INVALID_STOCKABLE' });
      const attrs = (v.attributes ?? {}) as Record<string, string>;
      const variantLabel = v.name ?? Object.values(attrs).join(' / ');
      return {
        offeringId: null,
        variantId: v.id,
        stockableKey: `variant:${v.id}`,
        label: `${v.offering.name} — ${variantLabel}`,
      };
    }
    if (input.offeringId) {
      const o = await this.prisma.offering.findFirst({
        where: { id: input.offeringId, businessId: ctx.businessId },
        select: { id: true, name: true },
      });
      if (!o) throw new BadRequestException({ code: 'INVALID_STOCKABLE' });
      return { offeringId: o.id, variantId: null, stockableKey: `offering:${o.id}`, label: o.name };
    }
    throw new BadRequestException({ code: 'INVALID_STOCKABLE', message: 'offeringId or variantId is required' });
  }

  /**
   * The single path that mutates stock. Every call writes a movement in the same
   * transaction. A negative delta is applied with a conditional update so it can
   * never oversell (and concurrent decrements can't lose updates).
   */
  async adjustStock(ctx: TenantContext, input: AdjustStockInput): Promise<InventoryItemDto> {
    const location = await this.resolveLocation(ctx, input.locationId);
    const stockable = await this.resolveStockable(ctx, input);
    const item = await this.prisma.$transaction((tx) =>
      this.applyDeltaTx(tx, {
        businessId: ctx.businessId,
        locationId: location.id,
        offeringId: stockable.offeringId,
        variantId: stockable.variantId,
        stockableKey: stockable.stockableKey,
        delta: input.delta,
        movementType: input.movementType,
        reason: input.reason ?? null,
        createdBy: ctx.userId,
        setThreshold: input.lowStockThreshold !== undefined,
        lowStockThreshold: input.lowStockThreshold ?? null,
      }),
    );
    return {
      id: item.id,
      locationId: location.id,
      locationName: location.name,
      offeringId: stockable.offeringId,
      variantId: stockable.variantId,
      label: stockable.label,
      quantity: item.quantity,
      lowStockThreshold: item.lowStockThreshold,
      lowStock: item.lowStockThreshold !== null && item.quantity <= item.lowStockThreshold,
    };
  }

  /**
   * The single stock-mutating primitive, scoped to a caller's transaction so
   * order fulfillment (SALE/RETURN) and manual adjustments share one oversell-
   * proof path and always write a movement. A negative delta uses a conditional
   * update so it can never drive quantity below zero, even under concurrency.
   */
  async applyDeltaTx(
    tx: Prisma.TransactionClient,
    p: StockDelta,
  ): Promise<{ id: string; quantity: number; lowStockThreshold: number | null }> {
    const row = await tx.inventoryItem.upsert({
      where: {
        businessId_locationId_stockableKey: {
          businessId: p.businessId,
          locationId: p.locationId,
          stockableKey: p.stockableKey,
        },
      },
      create: {
        businessId: p.businessId,
        locationId: p.locationId,
        offeringId: p.offeringId,
        variantId: p.variantId,
        stockableKey: p.stockableKey,
        quantity: 0,
        lowStockThreshold: p.lowStockThreshold ?? null,
      },
      update: p.setThreshold ? { lowStockThreshold: p.lowStockThreshold ?? null } : {},
    });

    if (p.delta < 0) {
      const res = await tx.inventoryItem.updateMany({
        where: { id: row.id, quantity: { gte: -p.delta } },
        data: { quantity: { increment: p.delta } },
      });
      if (res.count === 0) {
        throw new ConflictException({ code: 'INSUFFICIENT_STOCK', message: 'Not enough stock for this change' });
      }
    } else if (p.delta > 0) {
      await tx.inventoryItem.update({ where: { id: row.id }, data: { quantity: { increment: p.delta } } });
    }

    await tx.inventoryMovement.create({
      data: {
        businessId: p.businessId,
        locationId: p.locationId,
        offeringId: p.offeringId,
        variantId: p.variantId,
        movementType: p.movementType,
        quantityDelta: p.delta,
        reason: p.reason ?? null,
        referenceType: p.referenceType ?? null,
        referenceId: p.referenceId ?? null,
        createdBy: p.createdBy ?? null,
      },
    });

    const fresh = await tx.inventoryItem.findUniqueOrThrow({ where: { id: row.id } });
    return { id: fresh.id, quantity: fresh.quantity, lowStockThreshold: fresh.lowStockThreshold };
  }

  async list(ctx: TenantContext, query: InventoryListQuery): Promise<InventoryListResult> {
    const rows = await this.prisma.inventoryItem.findMany({
      where: {
        businessId: ctx.businessId,
        ...(query.locationId ? { locationId: query.locationId } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    });

    const locations = await this.prisma.location.findMany({ where: { businessId: ctx.businessId } });
    const locName = new Map(locations.map((l) => [l.id, l.name]));
    const labels = await this.labelsFor(ctx.businessId, rows);

    let items: InventoryItemDto[] = rows.map((r) => ({
      id: r.id,
      locationId: r.locationId,
      locationName: locName.get(r.locationId) ?? '',
      offeringId: r.offeringId,
      variantId: r.variantId,
      label: labels.get(r.id) ?? '',
      quantity: r.quantity,
      lowStockThreshold: r.lowStockThreshold,
      lowStock: r.lowStockThreshold !== null && r.quantity <= r.lowStockThreshold,
    }));

    if (query.lowStock === 'true') items = items.filter((i) => i.lowStock);
    const total = items.length;
    const start = (query.page - 1) * query.pageSize;
    return { items: items.slice(start, start + query.pageSize), total, page: query.page, pageSize: query.pageSize };
  }

  private async labelsFor(businessId: string, rows: { id: string; offeringId: string | null; variantId: string | null }[]): Promise<Map<string, string>> {
    const offeringIds = rows.map((r) => r.offeringId).filter((x): x is string => !!x);
    const variantIds = rows.map((r) => r.variantId).filter((x): x is string => !!x);
    const offerings = offeringIds.length
      ? await this.prisma.offering.findMany({ where: { businessId, id: { in: offeringIds } }, select: { id: true, name: true } })
      : [];
    const variants = variantIds.length
      ? await this.prisma.offeringVariant.findMany({ where: { businessId, id: { in: variantIds } }, include: { offering: { select: { name: true } } } })
      : [];
    const oName = new Map(offerings.map((o) => [o.id, o.name]));
    const vLabel = new Map(
      variants.map((v) => {
        const attrs = (v.attributes ?? {}) as Record<string, string>;
        return [v.id, `${v.offering.name} — ${v.name ?? Object.values(attrs).join(' / ')}`];
      }),
    );
    return new Map(rows.map((r) => [r.id, r.offeringId ? oName.get(r.offeringId) ?? '' : vLabel.get(r.variantId ?? '') ?? '']));
  }

  async listMovements(ctx: TenantContext, query: MovementListQuery): Promise<MovementListResult> {
    const where = {
      businessId: ctx.businessId,
      ...(query.offeringId ? { offeringId: query.offeringId } : {}),
      ...(query.variantId ? { variantId: query.variantId } : {}),
      ...(query.locationId ? { locationId: query.locationId } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.inventoryMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.inventoryMovement.count({ where }),
    ]);
    const locations = await this.prisma.location.findMany({ where: { businessId: ctx.businessId } });
    const locName = new Map(locations.map((l) => [l.id, l.name]));
    const labels = await this.labelsFor(ctx.businessId, rows);
    return {
      items: rows.map((m) => ({
        id: m.id,
        locationId: m.locationId,
        locationName: locName.get(m.locationId) ?? '',
        offeringId: m.offeringId,
        variantId: m.variantId,
        label: labels.get(m.id) ?? '',
        movementType: m.movementType as MovementDto['movementType'],
        quantityDelta: m.quantityDelta,
        reason: m.reason,
        createdAt: m.createdAt.toISOString(),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}
