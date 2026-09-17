import { NestFactory } from '@nestjs/core';
import * as argon2 from 'argon2';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { EntitlementService } from './modules/registry/entitlement.service';
import { RegistryService } from './modules/registry/registry.service';
import { CatalogService } from './modules/catalog/catalog.service';
import { InventoryService } from './modules/inventory/inventory.service';
import type { CreateOfferingInput } from '@dokane/contracts';
import type { TenantContext } from './common/tenant-context';

/**
 * Seed a small demo catalog for a business (idempotent). Physical simple goods
 * are keyed by SKU; variant products by name. Runs through CatalogService and
 * InventoryService so variant keys are canonical and every stock change writes
 * an INITIAL_STOCK movement. Safe to re-run — existing products are skipped.
 */
async function seedCatalog(
  app: Awaited<ReturnType<typeof NestFactory.createApplicationContext>>,
  prisma: PrismaService,
  businessId: string,
  userId: string,
): Promise<void> {
  const catalog = app.get(CatalogService);
  const inventory = app.get(InventoryService);
  const ctx: TenantContext = {
    userId,
    businessId,
    membershipId: '',
    roleId: '',
    businessStatus: 'APPROVED',
    permissions: new Set<string>(),
  };

  const slugify = (s: string): string =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const ensureCategory = async (name: string): Promise<string> => {
    const existing = await prisma.category.findFirst({ where: { businessId, slug: slugify(name) } });
    if (existing) return existing.id;
    return (await catalog.createCategory(ctx, { name, active: true })).id;
  };

  const apparel = await ensureCategory('Apparel');
  const accessories = await ensureCategory('Accessories');
  const digital = await ensureCategory('Digital');

  // qty (and optional low-stock threshold) per offering/variant SKU.
  type Stock = Record<string, { qty: number; threshold?: number }>;
  const ensureOffering = async (input: CreateOfferingInput, stock: Stock = {}): Promise<void> => {
    const existing = input.sku
      ? await prisma.offering.findFirst({ where: { businessId, sku: input.sku } })
      : await prisma.offering.findFirst({ where: { businessId, name: input.name } });
    if (existing) return;
    const created = await catalog.create(ctx, input);
    const stockOne = async (target: { offeringId?: string; variantId?: string }, s?: { qty: number; threshold?: number }) => {
      if (!s || s.qty <= 0) return;
      await inventory.adjustStock(ctx, {
        ...target,
        delta: s.qty,
        movementType: 'INITIAL_STOCK',
        reason: 'Demo seed',
        lowStockThreshold: s.threshold,
      });
    };
    if (created.variants.length > 0) {
      for (const v of created.variants) await stockOne({ variantId: v.id }, v.sku ? stock[v.sku] : undefined);
    } else if (created.type === 'physical') {
      await stockOne({ offeringId: created.id }, input.sku ? stock[input.sku] : undefined);
    }
  };

  const teeVariants = (['S', 'M', 'L'] as const).flatMap((size) =>
    ([['Black', 'BK'], ['White', 'WT']] as const).map(([color, code]) => ({
      attributes: { Size: size, Color: color },
      price: 7900,
      sku: `TEE-${size}-${code}`,
      active: true,
    })),
  );
  await ensureOffering(
    {
      type: 'physical', name: 'Classic Cotton Tee', categoryId: apparel,
      description: 'Soft mid-weight cotton tee. Unisex fit.',
      price: 7900, active: true, variants: teeVariants,
    },
    {
      'TEE-S-BK': { qty: 12 }, 'TEE-M-BK': { qty: 20 }, 'TEE-L-BK': { qty: 10 },
      'TEE-S-WT': { qty: 8 }, 'TEE-M-WT': { qty: 15 }, 'TEE-L-WT': { qty: 6, threshold: 10 },
    },
  );

  const mugVariants = ([['Cream', 'CREAM'], ['Charcoal', 'CHAR']] as const).map(([color, code]) => ({
    attributes: { Color: color }, price: 3800, sku: `MUG-${code}`, active: true,
  }));
  await ensureOffering(
    {
      type: 'physical', name: 'Ceramic Mug', categoryId: accessories,
      description: '330ml stoneware mug, dishwasher safe.',
      price: 3800, active: true, variants: mugVariants,
    },
    { 'MUG-CREAM': { qty: 25 }, 'MUG-CHAR': { qty: 18 } },
  );

  await ensureOffering(
    {
      type: 'physical', name: 'Canvas Tote Bag', categoryId: accessories, sku: 'TOTE-01',
      description: 'Heavy 12oz cotton canvas, reinforced handles.',
      price: 4500, active: true, variants: [],
    },
    { 'TOTE-01': { qty: 40, threshold: 8 } },
  );

  await ensureOffering(
    {
      type: 'physical', name: 'Enamel Pin — Logo', categoryId: accessories, sku: 'PIN-01',
      description: 'Hard enamel lapel pin, 25mm, rubber clutch.',
      price: 1800, active: true, variants: [],
    },
    { 'PIN-01': { qty: 120 } },
  );

  await ensureOffering({
    type: 'digital', name: 'Gift Card (₪100)', categoryId: digital, sku: 'GC-100',
    description: 'Digital gift card, delivered by email. Never expires.',
    price: 10000, active: true, variants: [],
  });

  await ensureOffering({
    type: 'digital', name: 'Style Guide eBook', categoryId: digital, sku: 'EBOOK-01',
    description: 'PDF style guide, instant download.',
    price: 2900, active: true, variants: [],
  });
}

/**
 * Idempotent dev seed. Boots the app context so system roles/permissions and
 * plans/entitlements are seeded by their onModuleInit hooks, then creates a
 * platform admin and two demo businesses (A/B) with members and subscriptions.
 * Run with: `pnpm --filter @dokane/api seed` (compiles first).
 */
async function upsertUser(
  prisma: PrismaService,
  email: string,
  firstName: string,
  lastName: string,
): Promise<{ id: string }> {
  const passwordHash = await argon2.hash('password123');
  return prisma.user.upsert({
    where: { email },
    create: { email, firstName, lastName, passwordHash },
    update: {},
    select: { id: true },
  });
}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const prisma = app.get(PrismaService);
  const entitlements = app.get(EntitlementService);

  const admin = await upsertUser(prisma, 'admin@dokane.test', 'Platform', 'Admin');
  await prisma.user.update({ where: { id: admin.id }, data: { isPlatformAdmin: true } });
  const ownerA = await upsertUser(prisma, 'owner.a@dokane.test', 'Owner', 'A');
  const staffA = await upsertUser(prisma, 'staff.a@dokane.test', 'Staff', 'A');
  const ownerB = await upsertUser(prisma, 'owner.b@dokane.test', 'Owner', 'B');
  const ownerC = await upsertUser(prisma, 'owner.c@dokane.test', 'Owner', 'C');

  // `businessType` holds the category key (see @dokane/contracts BUSINESS_CATEGORIES).
  const abcData = { businessType: 'retail', offeringTypes: ['physical'], email: 'hello@abc-store.test' };
  const bizA = await prisma.business.upsert({
    where: { slug: 'abc-store' },
    create: { name: 'ABC Store', slug: 'abc-store', status: 'APPROVED', ...abcData },
    update: { status: 'APPROVED', ...abcData },
    select: { id: true },
  });
  const fashionData = { businessType: 'fashion', offeringTypes: ['physical', 'digital'], email: 'hello@fashion-store.test' };
  const bizB = await prisma.business.upsert({
    where: { slug: 'fashion-store' },
    create: { name: 'Fashion Store', slug: 'fashion-store', status: 'APPROVED', ...fashionData },
    update: { status: 'APPROVED', ...fashionData },
    select: { id: true },
  });

  // A pending business for the platform admin to review (reset each seed).
  const nourDetails = {
    businessType: 'pharmacy',
    offeringTypes: ['physical', 'services'],
    email: 'contact@nour-pharmacy.test',
    businessNumber: '514782390',
    addressLine1: '18 Al-Bishara St, Nazareth',
    city: 'Nazareth',
    phone: '+972 4 601 2233',
  };
  const bizC = await prisma.business.upsert({
    where: { slug: 'nour-pharmacy' },
    create: { name: 'Nour Pharmacy', slug: 'nour-pharmacy', status: 'PENDING_APPROVAL', ...nourDetails },
    update: { status: 'PENDING_APPROVAL', ...nourDetails },
    select: { id: true },
  });
  await prisma.subscription.deleteMany({ where: { businessId: bizC.id } });
  await prisma.moduleState.deleteMany({ where: { businessId: bizC.id } });

  const owner = await prisma.role.findFirstOrThrow({
    where: { name: 'OWNER', businessId: null, isSystem: true },
  });
  const staff = await prisma.role.findFirstOrThrow({
    where: { name: 'STAFF', businessId: null, isSystem: true },
  });

  const link = (businessId: string, userId: string, roleId: string) =>
    prisma.businessMembership.upsert({
      where: { businessId_userId: { businessId, userId } },
      create: { businessId, userId, roleId },
      update: {},
    });

  await link(bizA.id, ownerA.id, owner.id);
  await link(bizA.id, staffA.id, staff.id);
  await link(bizB.id, ownerB.id, owner.id);
  await link(bizC.id, ownerC.id, owner.id);

  await entitlements.assignPlan(bizA.id, 'GROWTH');
  await entitlements.assignPlan(bizB.id, 'STARTER');

  // Enable a realistic set of modules for Business A (dependency-ordered) so the
  // console nav is populated. Business B stays on Starter with nothing enabled.
  const registry = app.get(RegistryService);
  const ctxA: TenantContext = {
    userId: ownerA.id,
    businessId: bizA.id,
    membershipId: '',
    roleId: '',
    businessStatus: 'APPROVED',
    permissions: new Set(['modules.enable']),
  };
  for (const id of ['catalog', 'channels', 'inventory', 'online_store', 'crm', 'accounting']) {
    await registry.enable(ctxA, id).catch(() => undefined);
  }

  // Demo catalog for Business A (idempotent) so Catalog/Inventory have content.
  await seedCatalog(app, prisma, bizA.id, ownerA.id);

  // eslint-disable-next-line no-console
  console.log(
    [
      'Seed complete (all passwords: password123):',
      '  Platform admin : admin@dokane.test  (isPlatformAdmin)',
      `  Business A     : abc-store [GROWTH, approved] ${bizA.id}`,
      '                   owner.a@dokane.test (OWNER), staff.a@dokane.test (STAFF)',
      `  Business B     : fashion-store [STARTER, approved] ${bizB.id}`,
      '                   owner.b@dokane.test (OWNER)',
      `  Business C     : nour-pharmacy [PENDING_APPROVAL] ${bizC.id}`,
      '                   owner.c@dokane.test (OWNER)',
    ].join('\n'),
  );

  await app.close();
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
