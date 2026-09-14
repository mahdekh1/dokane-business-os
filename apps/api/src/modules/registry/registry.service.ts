import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ModuleState } from '@dokane/module-sdk';
import { suggestedModulesForCategory } from '@dokane/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import type { TenantContext } from '../../common/tenant-context';
import { AuditService } from '../audit/audit.service';
import { EntitlementService } from './entitlement.service';
import { MODULE_MANIFESTS } from './module-manifests';

export interface ModuleView {
  id: string;
  name: string;
  requiredEntitlement: string;
  dependsOn: string[];
  state: ModuleState;
  suggested: boolean;
}

@Injectable()
export class RegistryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementService,
    private readonly audit: AuditService,
  ) {}

  async listForTenant(ctx: TenantContext): Promise<ModuleView[]> {
    const entitled = await this.entitlements.resolveEntitlements(ctx.businessId);
    const states = await this.prisma.moduleState.findMany({
      where: { businessId: ctx.businessId },
    });
    const enabled = new Set(states.filter((s) => s.enabled).map((s) => s.moduleId));

    // Suggestions come from the business category (stored in `businessType`).
    const business = await this.prisma.business.findUnique({
      where: { id: ctx.businessId },
      select: { businessType: true },
    });
    const suggestedSet = new Set(suggestedModulesForCategory(business?.businessType));

    return MODULE_MANIFESTS.map((m) => {
      let state: ModuleState;
      if (!entitled.has(m.requiredEntitlement)) {
        state = 'locked';
      } else if (enabled.has(m.id)) {
        state = 'active';
      } else {
        state = 'available';
      }
      return {
        id: m.id,
        name: m.name,
        requiredEntitlement: m.requiredEntitlement,
        dependsOn: m.dependsOn,
        state,
        suggested: suggestedSet.has(m.id),
      };
    });
  }

  async enable(ctx: TenantContext, moduleId: string): Promise<ModuleView> {
    const manifest = MODULE_MANIFESTS.find((m) => m.id === moduleId);
    if (!manifest) {
      throw new NotFoundException({ code: 'UNKNOWN_MODULE' });
    }

    const entitled = await this.entitlements.resolveEntitlements(ctx.businessId);
    if (!entitled.has(manifest.requiredEntitlement)) {
      throw new ForbiddenException({
        code: 'NOT_ENTITLED',
        message: `Plan does not include ${manifest.name}`,
      });
    }

    if (manifest.dependsOn.length > 0) {
      const states = await this.prisma.moduleState.findMany({
        where: { businessId: ctx.businessId, moduleId: { in: manifest.dependsOn } },
      });
      const enabledDeps = new Set(
        states.filter((s) => s.enabled).map((s) => s.moduleId),
      );
      const missing = manifest.dependsOn.filter((d: string) => !enabledDeps.has(d));
      if (missing.length > 0) {
        throw new BadRequestException({
          code: 'DEPENDENCY_NOT_ENABLED',
          message: `Enable first: ${missing.join(', ')}`,
        });
      }
    }

    await this.prisma.moduleState.upsert({
      where: { businessId_moduleId: { businessId: ctx.businessId, moduleId } },
      create: {
        businessId: ctx.businessId,
        moduleId,
        enabled: true,
        enabledAt: new Date(),
      },
      update: { enabled: true, enabledAt: new Date() },
    });

    await this.audit.record({
      businessId: ctx.businessId,
      actorUserId: ctx.userId,
      actorType: 'USER',
      action: 'MODULE_ENABLED',
      entityType: 'module',
      entityId: moduleId,
    });

    return {
      id: manifest.id,
      name: manifest.name,
      requiredEntitlement: manifest.requiredEntitlement,
      dependsOn: manifest.dependsOn,
      state: 'active',
      // Now active — the suggested hint only matters for available modules.
      suggested: false,
    };
  }
}
