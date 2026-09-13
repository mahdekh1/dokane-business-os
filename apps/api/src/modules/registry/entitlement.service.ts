import { Injectable, type OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  MODULE_MANIFESTS,
  PLAN_ENTITLEMENTS,
  PLAN_NAMES,
} from './module-manifests';

@Injectable()
export class EntitlementService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.ensureSystem();
  }

  /** Idempotently seed entitlements, plans, and plan→entitlement mappings. */
  async ensureSystem(): Promise<void> {
    const keys = new Set(MODULE_MANIFESTS.map((m) => m.requiredEntitlement));
    for (const key of keys) {
      await this.prisma.entitlement.upsert({
        where: { key },
        create: { key, name: key },
        update: {},
      });
    }

    for (const [tier, entKeys] of Object.entries(PLAN_ENTITLEMENTS)) {
      const plan = await this.prisma.plan.upsert({
        where: { tier },
        create: { tier, name: PLAN_NAMES[tier] ?? tier },
        update: { name: PLAN_NAMES[tier] ?? tier },
      });
      const ents = await this.prisma.entitlement.findMany({
        where: { key: { in: entKeys } },
        select: { id: true },
      });
      await this.prisma.planEntitlement.deleteMany({ where: { planId: plan.id } });
      if (ents.length > 0) {
        await this.prisma.planEntitlement.createMany({
          data: ents.map((e) => ({ planId: plan.id, entitlementId: e.id })),
          skipDuplicates: true,
        });
      }
    }
  }

  /** The entitlement keys a business currently holds (plan + add-ons). */
  async resolveEntitlements(businessId: string): Promise<Set<string>> {
    const keys = new Set<string>();

    const subscription = await this.prisma.subscription.findUnique({
      where: { businessId },
      include: {
        plan: { include: { entitlements: { include: { entitlement: true } } } },
      },
    });
    if (subscription && subscription.status === 'ACTIVE') {
      for (const pe of subscription.plan.entitlements) {
        keys.add(pe.entitlement.key);
      }
    }

    const addons = await this.prisma.addonEntitlement.findMany({
      where: { businessId },
      include: { entitlement: true },
    });
    for (const a of addons) {
      keys.add(a.entitlement.key);
    }

    return keys;
  }

  /** Assign a default plan to a business (used at approval time, Task 2.1). */
  async assignPlan(businessId: string, tier: string): Promise<void> {
    const plan = await this.prisma.plan.findUniqueOrThrow({ where: { tier } });
    await this.prisma.subscription.upsert({
      where: { businessId },
      create: { businessId, planId: plan.id, status: 'ACTIVE' },
      update: { planId: plan.id, status: 'ACTIVE' },
    });
  }
}
