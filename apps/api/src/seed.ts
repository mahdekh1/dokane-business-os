import { NestFactory } from '@nestjs/core';
import * as argon2 from 'argon2';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { EntitlementService } from './modules/registry/entitlement.service';

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

  await upsertUser(prisma, 'admin@dokane.test', 'Platform', 'Admin');
  const ownerA = await upsertUser(prisma, 'owner.a@dokane.test', 'Owner', 'A');
  const staffA = await upsertUser(prisma, 'staff.a@dokane.test', 'Staff', 'A');
  const ownerB = await upsertUser(prisma, 'owner.b@dokane.test', 'Owner', 'B');

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

  await entitlements.assignPlan(bizA.id, 'GROWTH');
  await entitlements.assignPlan(bizB.id, 'STARTER');

  // eslint-disable-next-line no-console
  console.log(
    [
      'Seed complete (all passwords: password123):',
      '  Platform admin : admin@dokane.test  (platform authz wiring is Task 2.1)',
      `  Business A     : abc-store [GROWTH] ${bizA.id}`,
      '                   owner.a@dokane.test (OWNER), staff.a@dokane.test (STAFF)',
      `  Business B     : fashion-store [STARTER] ${bizB.id}`,
      '                   owner.b@dokane.test (OWNER)',
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
