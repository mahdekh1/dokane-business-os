import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  variantKey,
  type CategoryDto,
  type CreateCategoryInput,
  type CreateOfferingInput,
  type OfferingDto,
  type OfferingListQuery,
  type OfferingListResult,
  type UpdateOfferingInput,
} from '@dokane/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import type { TenantContext } from '../../common/tenant-context';

/** Public route the media driver serves from (Task 3.4). */
const MEDIA_PUBLIC_PREFIX = '/api/v1/public/media/';

type OfferingRow = Prisma.OfferingGetPayload<{ include: { variants: true; media: true } }>;

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  private toDto(o: OfferingRow): OfferingDto {
    return {
      id: o.id,
      type: o.type as OfferingDto['type'],
      name: o.name,
      description: o.description,
      categoryId: o.categoryId,
      sku: o.sku,
      barcode: o.barcode,
      price: o.price,
      cost: o.cost,
      trackInventory: o.trackInventory,
      active: o.active,
      variants: o.variants
        .slice()
        .sort((a, b) => a.key.localeCompare(b.key))
        .map((v) => ({
          id: v.id,
          name: v.name,
          sku: v.sku,
          barcode: v.barcode,
          price: v.price,
          attributes: (v.attributes ?? {}) as Record<string, string>,
          key: v.key,
          active: v.active,
        })),
      media: o.media
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((m) => ({
          id: m.id,
          url: `${MEDIA_PUBLIC_PREFIX}${m.storageKey}`,
          sortOrder: m.sortOrder,
          altText: m.altText,
        })),
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
    };
  }

  // ---- Offerings ----

  async list(ctx: TenantContext, query: OfferingListQuery): Promise<OfferingListResult> {
    const where: Prisma.OfferingWhereInput = { businessId: ctx.businessId };
    if (query.q) where.name = { contains: query.q, mode: 'insensitive' };
    if (query.type) where.type = query.type;
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.active) where.active = query.active === 'true';

    const [items, total] = await this.prisma.$transaction([
      this.prisma.offering.findMany({
        where,
        include: { variants: true, media: true },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.offering.count({ where }),
    ]);
    return { items: items.map((o) => this.toDto(o)), total, page: query.page, pageSize: query.pageSize };
  }

  async get(ctx: TenantContext, id: string): Promise<OfferingDto> {
    const o = await this.prisma.offering.findFirst({
      where: { id, businessId: ctx.businessId },
      include: { variants: true, media: true },
    });
    if (!o) throw new NotFoundException({ code: 'NOT_FOUND' });
    return this.toDto(o);
  }

  async create(ctx: TenantContext, input: CreateOfferingInput): Promise<OfferingDto> {
    await this.assertCategory(ctx, input.categoryId ?? null);
    const trackInventory = input.trackInventory ?? input.type === 'physical';
    try {
      const created = await this.prisma.offering.create({
        data: {
          businessId: ctx.businessId,
          categoryId: input.categoryId ?? null,
          type: input.type,
          name: input.name,
          description: input.description ?? null,
          sku: input.sku || null,
          barcode: input.barcode || null,
          price: input.price,
          cost: input.cost ?? null,
          trackInventory,
          active: input.active ?? true,
          variants: {
            create: (input.variants ?? []).map((v) => ({
              businessId: ctx.businessId,
              name: v.name ?? null,
              sku: v.sku || null,
              barcode: v.barcode || null,
              price: v.price,
              attributes: v.attributes,
              key: variantKey(v.attributes),
              active: v.active ?? true,
            })),
          },
        },
        include: { variants: true, media: true },
      });
      return this.toDto(created);
    } catch (err) {
      throw this.mapUniqueError(err);
    }
  }

  async update(ctx: TenantContext, id: string, input: UpdateOfferingInput): Promise<OfferingDto> {
    const existing = await this.prisma.offering.findFirst({ where: { id, businessId: ctx.businessId } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND' });
    if (input.categoryId !== undefined) await this.assertCategory(ctx, input.categoryId ?? null);

    const data: Prisma.OfferingUpdateInput = {};
    if (input.type !== undefined) data.type = input.type;
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description ?? null;
    if (input.categoryId !== undefined) data.category = input.categoryId ? { connect: { id: input.categoryId } } : { disconnect: true };
    if (input.sku !== undefined) data.sku = input.sku || null;
    if (input.barcode !== undefined) data.barcode = input.barcode || null;
    if (input.price !== undefined) data.price = input.price;
    if (input.cost !== undefined) data.cost = input.cost ?? null;
    if (input.trackInventory !== undefined) data.trackInventory = input.trackInventory;
    if (input.active !== undefined) data.active = input.active;

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.offering.update({ where: { id }, data });

        // Variants (when provided): upsert by canonical key so unchanged combos
        // keep their row/id (inventory references it); drop combos no longer present.
        if (input.variants !== undefined) {
          const incoming = input.variants.map((v) => ({ v, key: variantKey(v.attributes) }));
          const keys = incoming.map((i) => i.key);
          await tx.offeringVariant.deleteMany({ where: { offeringId: id, key: { notIn: keys } } });
          for (const { v, key } of incoming) {
            await tx.offeringVariant.upsert({
              where: { offeringId_key: { offeringId: id, key } },
              create: {
                businessId: ctx.businessId,
                offeringId: id,
                name: v.name ?? null,
                sku: v.sku || null,
                barcode: v.barcode || null,
                price: v.price,
                attributes: v.attributes,
                key,
                active: v.active ?? true,
              },
              update: {
                name: v.name ?? null,
                sku: v.sku || null,
                barcode: v.barcode || null,
                price: v.price,
                attributes: v.attributes,
                active: v.active ?? true,
              },
            });
          }
        }
      });
    } catch (err) {
      throw this.mapUniqueError(err);
    }
    return this.get(ctx, id);
  }

  /** Soft delete: archive (never hard-delete — orders may reference it). */
  async archive(ctx: TenantContext, id: string): Promise<OfferingDto> {
    await this.get(ctx, id); // ownership check
    await this.prisma.offering.update({ where: { id }, data: { active: false } });
    return this.get(ctx, id);
  }

  // ---- Categories ----

  async listCategories(ctx: TenantContext): Promise<CategoryDto[]> {
    const rows = await this.prisma.category.findMany({
      where: { businessId: ctx.businessId },
      orderBy: { name: 'asc' },
    });
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      parentId: c.parentId,
      active: c.active,
    }));
  }

  async createCategory(ctx: TenantContext, input: CreateCategoryInput): Promise<CategoryDto> {
    const slug = (input.slug ?? this.slugify(input.name)).slice(0, 80);
    if (input.parentId) await this.assertCategory(ctx, input.parentId);
    try {
      const c = await this.prisma.category.create({
        data: {
          businessId: ctx.businessId,
          name: input.name,
          slug,
          description: input.description ?? null,
          parentId: input.parentId ?? null,
          active: input.active ?? true,
        },
      });
      return { id: c.id, name: c.name, slug: c.slug, description: c.description, parentId: c.parentId, active: c.active };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({ code: 'SLUG_TAKEN', message: 'That category URL is taken' });
      }
      throw err;
    }
  }

  // ---- helpers ----

  private async assertCategory(ctx: TenantContext, categoryId: string | null): Promise<void> {
    if (!categoryId) return;
    const found = await this.prisma.category.findFirst({
      where: { id: categoryId, businessId: ctx.businessId },
      select: { id: true },
    });
    if (!found) throw new BadRequestException({ code: 'INVALID_CATEGORY', message: 'Unknown category' });
  }

  private slugify(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'category';
  }

  private mapUniqueError(err: unknown): Error {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const target = String((err.meta as { target?: string[] })?.target ?? '');
      if (target.includes('barcode')) return new ConflictException({ code: 'BARCODE_TAKEN', message: 'That barcode is already used' });
      return new ConflictException({ code: 'SKU_TAKEN', message: 'That SKU is already used' });
    }
    return err instanceof Error ? err : new Error('Unknown error');
  }
}
