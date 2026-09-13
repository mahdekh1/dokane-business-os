import { NestFactory } from '@nestjs/core';
import * as argon2 from 'argon2';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { EntitlementService } from './modules/registry/entitlement.service';
import { RegistryService } from './modules/registry/registry.service';
import type { TenantContext } from './common/tenant-context';

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

  const bizA = await prisma.business.upsert({
    where: { slug: 'abc-store' },
    create: { name: 'ABC Store', slug: 'abc-store', status: 'APPROVED' },
    update: { status: 'APPROVED' },
    select: { id: true },
  });
  const bizB = await prisma.business.upsert({
    where: { slug: 'fashion-store' },
    create: { name: 'Fashion Store', slug: 'fashion-store', status: 'APPROVED' },
    update: { status: 'APPROVED' },
    select: { id: true },
  });

  // A pending business for the platform admin to review.
  const bizC = await prisma.business.upsert({
    where: { slug: 'nour-pharmacy' },
    create: { name: 'Nour Pharmacy', slug: 'nour-pharmacy', businessType: 'Clinic', status: 'PENDING_APPROVAL' },
    update: {},
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
