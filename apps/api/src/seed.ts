import { NestFactory } from '@nestjs/core';
import * as argon2 from 'argon2';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { EntitlementService } from './modules/registry/entitlement.service';
import { RegistryService } from './modules/registry/registry.service';
import { CatalogService } from './modules/catalog/catalog.service';
import { InventoryService } from './modules/inventory/inventory.service';
import { ChannelsService } from './modules/channels/channels.service';
import { OrdersService } from './modules/orders/orders.service';
import { PaymentsService } from './modules/orders/payments.service';
import { OutboxRelay } from './common/events/outbox-relay.service';
import type { CreateOfferingInput, CreateOrderInput } from '@dokane/contracts';
import type { TenantContext } from './common/tenant-context';

// qty (and optional low-stock threshold) per offering/variant SKU.
type Stock = Record<string, { qty: number; threshold?: number }>;
interface ProductSpec {
  /** Category name (must be listed in the spec's `categories`). */
  category?: string;
  /** Initial stock by SKU. Omit for stores without the Inventory module. */
  stock?: Stock;
  input: Omit<CreateOfferingInput, 'categoryId'>;
}
interface CatalogSpec {
  categories: string[];
  products: ProductSpec[];
}

const sizeColorVariants = (
  sizes: readonly string[],
  colors: readonly (readonly [string, string])[],
  price: number,
  skuPrefix: string,
) =>
  sizes.flatMap((size) =>
    colors.map(([color, code]) => ({
      attributes: { Size: size, Color: color },
      price,
      sku: `${skuPrefix}-${size}-${code}`,
      active: true,
    })),
  );

/** ABC Store (retail, Growth) — physical + digital goods, with stock. */
const ABC_CATALOG: CatalogSpec = {
  categories: ['Apparel', 'Accessories', 'Digital'],
  products: [
    {
      category: 'Apparel',
      input: {
        type: 'physical', name: 'Classic Cotton Tee', price: 7900, active: true,
        description: 'Soft mid-weight cotton tee. Unisex fit.',
        variants: sizeColorVariants(['S', 'M', 'L'], [['Black', 'BK'], ['White', 'WT']], 7900, 'TEE'),
      },
      stock: {
        'TEE-S-BK': { qty: 12 }, 'TEE-M-BK': { qty: 20 }, 'TEE-L-BK': { qty: 10 },
        'TEE-S-WT': { qty: 8 }, 'TEE-M-WT': { qty: 15 }, 'TEE-L-WT': { qty: 6, threshold: 10 },
      },
    },
    {
      category: 'Accessories',
      input: {
        type: 'physical', name: 'Ceramic Mug', price: 3800, active: true,
        description: '330ml stoneware mug, dishwasher safe.',
        variants: ([['Cream', 'CREAM'], ['Charcoal', 'CHAR']] as const).map(([color, code]) => ({
          attributes: { Color: color }, price: 3800, sku: `MUG-${code}`, active: true,
        })),
      },
      stock: { 'MUG-CREAM': { qty: 25 }, 'MUG-CHAR': { qty: 18 } },
    },
    {
      category: 'Accessories',
      input: {
        type: 'physical', name: 'Canvas Tote Bag', sku: 'TOTE-01', price: 4500, active: true,
        description: 'Heavy 12oz cotton canvas, reinforced handles.', variants: [],
      },
      stock: { 'TOTE-01': { qty: 40, threshold: 8 } },
    },
    {
      category: 'Accessories',
      input: {
        type: 'physical', name: 'Enamel Pin — Logo', sku: 'PIN-01', price: 1800, active: true,
        description: 'Hard enamel lapel pin, 25mm, rubber clutch.', variants: [],
      },
      stock: { 'PIN-01': { qty: 120 } },
    },
    {
      category: 'Digital',
      input: {
        type: 'digital', name: 'Gift Card (₪100)', sku: 'GC-100', price: 10000, active: true,
        description: 'Digital gift card, delivered by email. Never expires.', variants: [],
      },
    },
    {
      category: 'Digital',
      input: {
        type: 'digital', name: 'Style Guide eBook', sku: 'EBOOK-01', price: 2900, active: true,
        description: 'PDF style guide, instant download.', variants: [],
      },
    },
  ],
};

/** Fashion Store (fashion, Starter) — catalog only (no Inventory entitlement,
 * so no stock is seeded). Physical apparel + digital goods. */
const FASHION_CATALOG: CatalogSpec = {
  categories: ['Dresses', 'Tops', 'Footwear', 'Digital'],
  products: [
    {
      category: 'Dresses',
      input: {
        type: 'physical', name: 'Linen Wrap Dress', price: 18900, active: true,
        description: 'Breathable European linen, adjustable wrap tie.',
        variants: sizeColorVariants(['S', 'M', 'L'], [['Sand', 'SND'], ['Olive', 'OLV']], 18900, 'DRESS'),
      },
    },
    {
      category: 'Tops',
      input: {
        type: 'physical', name: 'Silk Camisole', price: 12900, active: true,
        description: 'Bias-cut mulberry silk, adjustable straps.',
        variants: (['S', 'M', 'L'] as const).map((size) => ({
          attributes: { Size: size }, price: 12900, sku: `CAMI-${size}`, active: true,
        })),
      },
    },
    {
      category: 'Footwear',
      input: {
        type: 'physical', name: 'Leather Ankle Boots', price: 34900, active: true,
        description: 'Full-grain leather, stacked heel, EU sizing.',
        variants: (['37', '38', '39', '40', '41'] as const).map((size) => ({
          attributes: { Size: size }, price: 34900, sku: `BOOT-${size}`, active: true,
        })),
      },
    },
    {
      category: 'Tops',
      input: {
        type: 'physical', name: 'Cashmere Scarf', sku: 'FS-SCARF-01', price: 15900, active: true,
        description: 'Pure Mongolian cashmere, 180×30cm.', variants: [],
      },
    },
    {
      category: 'Digital',
      input: {
        type: 'digital', name: 'Lookbook SS26 (PDF)', sku: 'FS-LOOKBOOK-26', price: 1900, active: true,
        description: 'Spring/Summer 2026 lookbook, instant download.', variants: [],
      },
    },
    {
      category: 'Digital',
      input: {
        type: 'digital', name: 'E-Gift Card (₪250)', sku: 'FS-GC-250', price: 25000, active: true,
        description: 'Digital gift card, delivered by email.', variants: [],
      },
    },
  ],
};

/**
 * Seed a demo catalog for a business from a spec (idempotent). Runs through
 * CatalogService/InventoryService so variant keys are canonical and every stock
 * change writes an INITIAL_STOCK movement. Simple goods are keyed by SKU,
 * variant products by name, categories by slug — re-running skips existing rows.
 */
async function seedCatalog(
  app: Awaited<ReturnType<typeof NestFactory.createApplicationContext>>,
  prisma: PrismaService,
  businessId: string,
  userId: string,
  spec: CatalogSpec,
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
  const catId = new Map<string, string>();
  for (const name of spec.categories) {
    const existing = await prisma.category.findFirst({ where: { businessId, slug: slugify(name) } });
    catId.set(name, existing ? existing.id : (await catalog.createCategory(ctx, { name, active: true })).id);
  }

  const stockOne = async (
    target: { offeringId?: string; variantId?: string },
    s?: { qty: number; threshold?: number },
  ): Promise<void> => {
    if (!s || s.qty <= 0) return;
    await inventory.adjustStock(ctx, {
      ...target, delta: s.qty, movementType: 'INITIAL_STOCK', reason: 'Demo seed', lowStockThreshold: s.threshold,
    });
  };

  for (const p of spec.products) {
    const { input } = p;
    const existing = input.sku
      ? await prisma.offering.findFirst({ where: { businessId, sku: input.sku } })
      : await prisma.offering.findFirst({ where: { businessId, name: input.name } });
    if (existing) continue;
    const created = await catalog.create(ctx, {
      ...input,
      categoryId: p.category ? (catId.get(p.category) ?? null) : null,
    });
    const stock = p.stock ?? {};
    if (created.variants.length > 0) {
      for (const v of created.variants) await stockOne({ variantId: v.id }, v.sku ? stock[v.sku] : undefined);
    } else if (created.type === 'physical') {
      await stockOne({ offeringId: created.id }, input.sku ? stock[input.sku] : undefined);
    }
  }
}

interface DemoOrder {
  key: string;
  channel: 'PHYSICAL' | 'ONLINE';
  status?: 'DRAFT' | 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'COMPLETED';
  customer?: { name?: string; email?: string; save?: boolean };
  items: { sku: string; qty: number }[];
  /** A payment to record after creation (minor units). */
  pay?: { amount: number; method: 'CASH' | 'BIT' };
}

/** Demo orders for ABC Store: a paid counter sale, a partly-paid one, an open
 *  online order, a digital sale, and a deposit on a confirmed order. Spread
 *  across fulfillment + payment states so Orders/Accounting/dashboard show
 *  realistic numbers (income posts via the outbox). */
const ABC_ORDERS: DemoOrder[] = [
  { key: 'abc-1', channel: 'PHYSICAL', status: 'COMPLETED', customer: { name: 'Café Luna' },
    items: [{ sku: 'TEE-M-BK', qty: 1 }, { sku: 'MUG-CREAM', qty: 1 }], pay: { amount: 11700, method: 'CASH' } },
  { key: 'abc-2', channel: 'PHYSICAL', status: 'COMPLETED', customer: { name: 'Rana Haddad' },
    items: [{ sku: 'TOTE-01', qty: 1 }, { sku: 'PIN-01', qty: 2 }], pay: { amount: 5000, method: 'CASH' } },
  { key: 'abc-3', channel: 'ONLINE', customer: { name: 'Omar Khoury', email: 'omar@example.com' },
    items: [{ sku: 'MUG-CHAR', qty: 1 }] },
  { key: 'abc-4', channel: 'PHYSICAL', status: 'COMPLETED', customer: { name: 'Walk-in', save: false },
    items: [{ sku: 'GC-100', qty: 1 }], pay: { amount: 10000, method: 'BIT' } },
  { key: 'abc-5', channel: 'PHYSICAL', status: 'CONFIRMED', customer: { name: 'Studio Nazareth' },
    items: [{ sku: 'TEE-L-BK', qty: 2 }], pay: { amount: 5000, method: 'CASH' } },
];

/** Seed demo orders (idempotent by an Idempotency-Key per order). Goes through
 *  OrdersService/PaymentsService so stock, movements and income are all real. */
async function seedOrders(
  app: Awaited<ReturnType<typeof NestFactory.createApplicationContext>>,
  prisma: PrismaService,
  businessId: string,
  userId: string,
): Promise<void> {
  const channels = app.get(ChannelsService);
  const orders = app.get(OrdersService);
  const payments = app.get(PaymentsService);
  const relay = app.get(OutboxRelay);
  const ctx: TenantContext = {
    userId, businessId, membershipId: '', roleId: '',
    businessStatus: 'APPROVED', permissions: new Set<string>(),
  };

  await channels.ensureDefaults(businessId);
  const chans = await prisma.salesChannel.findMany({ where: { businessId } });
  const physical = chans.find((c) => c.type === 'PHYSICAL');
  const online = chans.find((c) => c.type === 'ONLINE_STORE');

  const resolveItem = async (sku: string): Promise<{ offeringId?: string; variantId?: string } | null> => {
    const v = await prisma.offeringVariant.findFirst({ where: { businessId, sku }, select: { id: true } });
    if (v) return { variantId: v.id };
    const o = await prisma.offering.findFirst({ where: { businessId, sku }, select: { id: true } });
    return o ? { offeringId: o.id } : null;
  };

  for (const spec of ABC_ORDERS) {
    const idem = `seed:${spec.key}`;
    if (await prisma.order.findFirst({ where: { businessId, idempotencyKey: idem }, select: { id: true } })) continue;
    const channel = spec.channel === 'ONLINE' ? online : physical;
    if (!channel) continue;
    const items: CreateOrderInput['items'] = [];
    for (const it of spec.items) {
      const ref = await resolveItem(it.sku);
      if (ref) items.push({ ...ref, quantity: it.qty, discount: 0 });
    }
    if (items.length === 0) continue;
    const order = await orders.create(ctx, {
      channelId: channel.id,
      items,
      discount: 0,
      customer: spec.customer,
      fulfillmentStatus: spec.channel === 'ONLINE' ? undefined : spec.status,
    }, idem);
    if (spec.pay) await payments.record(ctx, order.id, { amount: spec.pay.amount, method: spec.pay.method });
  }

  // A few demo leads so the CRM pipeline isn't empty (idempotent: only if none).
  if ((await prisma.lead.count({ where: { businessId } })) === 0) {
    await prisma.lead.createMany({
      data: [
        { businessId, name: 'Galleria Boutique', email: 'hi@galleria.test', source: 'referral', value: 150000, stage: 'QUALIFIED' },
        { businessId, name: 'Marom Events', phone: '+972 50 123 4567', source: 'instagram', value: 80000, stage: 'CONTACTED' },
        { businessId, name: 'Tech Meetup Nazareth', email: 'organizer@meetup.test', source: 'ad', value: 40000, stage: 'NEW' },
      ],
    });
  }

  // Flush the outbox so payment.received → INCOME entries exist right after seeding.
  await relay.processPending();
}

interface DemoTask {
  title: string;
  status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'BLOCKED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  assignee?: string; // membership id
  dueInDays?: number;
}

/** Demo projects + tasks (prisma-direct so we can seed final statuses; idempotent
 *  by project name). Tasks are assigned to real memberships. */
async function seedProjects(
  prisma: PrismaService,
  businessId: string,
  ownerMembershipId: string,
  staffMembershipId: string,
): Promise<void> {
  const projects: { name: string; description: string; status: string; tasks: DemoTask[] }[] = [
    {
      name: 'Website Revamp', description: 'New marketing site + CMS migration.', status: 'ACTIVE',
      tasks: [
        { title: 'Wireframes & sitemap', status: 'DONE', priority: 'MEDIUM', assignee: ownerMembershipId },
        { title: 'Homepage visual design', status: 'IN_PROGRESS', priority: 'HIGH', assignee: staffMembershipId, dueInDays: 3 },
        { title: 'CMS integration', status: 'TODO', priority: 'MEDIUM', assignee: staffMembershipId },
        { title: 'Content migration', status: 'BLOCKED', priority: 'LOW' },
        { title: 'SEO & analytics audit', status: 'IN_REVIEW', priority: 'HIGH', assignee: ownerMembershipId },
      ],
    },
    {
      name: 'Q3 Brand Campaign', description: 'Summer launch across social + email.', status: 'PLANNING',
      tasks: [
        { title: 'Campaign brief', status: 'TODO', priority: 'URGENT', assignee: ownerMembershipId, dueInDays: 5 },
        { title: 'Budget approval', status: 'TODO', priority: 'HIGH' },
      ],
    },
  ];
  for (const p of projects) {
    if (await prisma.project.findFirst({ where: { businessId, name: p.name }, select: { id: true } })) continue;
    const proj = await prisma.project.create({ data: { businessId, name: p.name, description: p.description, status: p.status, ownerId: ownerMembershipId } });
    await prisma.task.createMany({
      data: p.tasks.map((t) => ({
        businessId, projectId: proj.id, title: t.title, status: t.status, priority: t.priority,
        assigneeId: t.assignee ?? null,
        dueDate: t.dueInDays ? new Date(Date.now() + t.dueInDays * 86_400_000) : null,
      })),
    });
  }

  // Demo appointments (idempotent) so the Calendar schedule isn't empty.
  if ((await prisma.appointment.count({ where: { businessId } })) === 0) {
    const at = (days: number, hour: number): Date => {
      const d = new Date(); d.setHours(0, 0, 0, 0);
      return new Date(d.getTime() + days * 86_400_000 + hour * 3_600_000);
    };
    await prisma.appointment.createMany({
      data: [
        { businessId, title: 'Kickoff call — Website Revamp', startsAt: at(0, 10), endsAt: at(0, 11), status: 'CONFIRMED', assigneeId: ownerMembershipId, location: 'Video call' },
        { businessId, title: 'Design review', startsAt: at(1, 14), endsAt: at(1, 15), status: 'SCHEDULED', assigneeId: staffMembershipId, location: 'Studio' },
        { businessId, title: 'Client onboarding', startsAt: at(2, 9), endsAt: at(2, 10), status: 'SCHEDULED', assigneeId: ownerMembershipId },
      ],
    });
  }
}

/**
 * Idempotent dev seed. Boots the app context so system roles/permissions and
 * plans/entitlements are seeded by their onModuleInit hooks, then creates a
 * platform admin and demo businesses with members and subscriptions.
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
  const ownerD = await upsertUser(prisma, 'owner.d@dokane.test', 'Lena', 'Rizk');
  const staffD = await upsertUser(prisma, 'staff.d@dokane.test', 'Sami', 'Odeh');

  // `businessType` holds the category key (see @dokane/contracts BUSINESS_CATEGORIES).
  const abcData = { businessType: 'retail', offeringTypes: ['physical'], email: 'hello@abc-store.test', currency: 'ILS' };
  const bizA = await prisma.business.upsert({
    where: { slug: 'abc-store' },
    create: { name: 'ABC Store', slug: 'abc-store', status: 'APPROVED', ...abcData },
    update: { status: 'APPROVED', ...abcData },
    select: { id: true },
  });
  const fashionData = { businessType: 'fashion', offeringTypes: ['physical', 'digital'], email: 'hello@fashion-store.test', currency: 'ILS' };
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
    currency: 'ILS',
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

  // A Business-tier agency (has Project Management + a team) to showcase PM.
  const studioData = { businessType: 'services', offeringTypes: ['services'], email: 'hello@meridian-studio.test', currency: 'ILS' };
  const bizD = await prisma.business.upsert({
    where: { slug: 'meridian-studio' },
    create: { name: 'Meridian Studio', slug: 'meridian-studio', status: 'APPROVED', ...studioData },
    update: { status: 'APPROVED', ...studioData },
    select: { id: true },
  });

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
  const mOwnerD = await link(bizD.id, ownerD.id, owner.id);
  const mStaffD = await link(bizD.id, staffD.id, staff.id);

  await entitlements.assignPlan(bizA.id, 'GROWTH');
  await entitlements.assignPlan(bizB.id, 'STARTER');
  await entitlements.assignPlan(bizD.id, 'BUSINESS');

  // Enable a realistic set of modules for Business A (dependency-ordered) so the
  // console nav is populated. Business B (Starter) gets just Catalog — Inventory
  // is a Growth entitlement, so its Fashion catalog is seeded without stock.
  const registry = app.get(RegistryService);
  const enableCtx = (userId: string, businessId: string): TenantContext => ({
    userId, businessId, membershipId: '', roleId: '',
    businessStatus: 'APPROVED', permissions: new Set(['modules.enable']),
  });
  const ctxA = enableCtx(ownerA.id, bizA.id);
  for (const id of ['catalog', 'channels', 'inventory', 'online_store', 'crm', 'accounting']) {
    await registry.enable(ctxA, id).catch(() => undefined);
  }
  await registry.enable(enableCtx(ownerB.id, bizB.id), 'catalog').catch(() => undefined);
  const ctxD = enableCtx(ownerD.id, bizD.id);
  for (const id of ['project_management', 'calendar', 'crm', 'accounting', 'notifications']) {
    await registry.enable(ctxD, id).catch(() => undefined);
  }

  // Demo catalogs (idempotent) so Catalog/Inventory have content.
  await seedCatalog(app, prisma, bizA.id, ownerA.id, ABC_CATALOG);
  await seedCatalog(app, prisma, bizB.id, ownerB.id, FASHION_CATALOG);

  // Demo orders for ABC Store (idempotent) so Orders/Accounting/dashboard populate.
  await seedOrders(app, prisma, bizA.id, ownerA.id);

  // Demo projects + tasks for Meridian Studio (idempotent) so PM populates.
  await seedProjects(prisma, bizD.id, mOwnerD.id, mStaffD.id);

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
      `  Business D     : meridian-studio [BUSINESS, approved] ${bizD.id}`,
      '                   owner.d@dokane.test (OWNER), staff.d@dokane.test (STAFF) — has Projects',
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
