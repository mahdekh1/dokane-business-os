import {
  BadRequestException,
  Injectable,
  type OnModuleInit,
} from '@nestjs/common';
import type { CreateRoleInput, RoleDto } from '@dokane/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import type { TenantContext } from '../../common/tenant-context';
import { AuditService } from '../audit/audit.service';
import {
  ALL_PERMISSIONS,
  CORE_PERMISSIONS,
  PLATFORM_PERMISSIONS,
  SYSTEM_ROLE_PERMISSIONS,
} from './permission-catalog';

@Injectable()
export class RbacService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureSystem();
  }

  /** Idempotently seed the permission catalog and system roles. */
  async ensureSystem(): Promise<void> {
    for (const def of ALL_PERMISSIONS) {
      await this.prisma.permission.upsert({
        where: { code: def.code },
        create: { code: def.code, moduleId: def.moduleId, description: def.description },
        update: { moduleId: def.moduleId, description: def.description },
      });
    }

    // OWNER = every business (core) permission; other roles = explicit subsets.
    const ownerCodes = CORE_PERMISSIONS.map((p) => p.code);
    await this.upsertSystemRole('OWNER', 'BUSINESS', ownerCodes);
    for (const [name, codes] of Object.entries(SYSTEM_ROLE_PERMISSIONS)) {
      await this.upsertSystemRole(name, 'BUSINESS', codes);
    }
    await this.upsertSystemRole(
      'PLATFORM_ADMIN',
      'PLATFORM',
      PLATFORM_PERMISSIONS.map((p) => p.code),
    );
  }

  private async upsertSystemRole(
    name: string,
    scope: 'BUSINESS' | 'PLATFORM',
    codes: string[],
  ): Promise<void> {
    let role = await this.prisma.role.findFirst({
      where: { name, businessId: null, isSystem: true },
    });
    if (!role) {
      role = await this.prisma.role.create({
        data: { name, scope, isSystem: true, businessId: null },
      });
    }
    const perms = await this.prisma.permission.findMany({
      where: { code: { in: codes } },
      select: { id: true },
    });
    await this.prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    if (perms.length > 0) {
      await this.prisma.rolePermission.createMany({
        data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
        skipDuplicates: true,
      });
    }
  }

  async listRoles(ctx: TenantContext): Promise<RoleDto[]> {
    const roles = await this.prisma.role.findMany({
      where: {
        OR: [
          { businessId: null, scope: 'BUSINESS' },
          { businessId: ctx.businessId },
        ],
      },
      include: { permissions: { include: { permission: true } } },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      scope: r.scope,
      isSystem: r.isSystem,
      businessId: r.businessId,
      permissions: r.permissions.map((rp) => rp.permission.code),
    }));
  }

  async createCustomRole(
    ctx: TenantContext,
    input: CreateRoleInput,
  ): Promise<RoleDto> {
    const perms = await this.prisma.permission.findMany({
      where: { code: { in: input.permissions } },
    });
    if (perms.length !== new Set(input.permissions).size) {
      throw new BadRequestException({
        code: 'UNKNOWN_PERMISSION',
        message: 'One or more permissions are not in the assignable catalog',
      });
    }
    const role = await this.prisma.role.create({
      data: {
        name: input.name,
        scope: 'BUSINESS',
        isSystem: false,
        businessId: ctx.businessId,
        permissions: {
          create: perms.map((p) => ({ permissionId: p.id })),
        },
      },
      include: { permissions: { include: { permission: true } } },
    });
    await this.audit.record({
      businessId: ctx.businessId,
      actorUserId: ctx.userId,
      actorType: 'USER',
      action: 'ROLE_CREATED',
      entityType: 'role',
      entityId: role.id,
      metadata: { name: role.name, permissions: input.permissions },
    });
    return {
      id: role.id,
      name: role.name,
      scope: role.scope,
      isSystem: role.isSystem,
      businessId: role.businessId,
      permissions: role.permissions.map((rp) => rp.permission.code),
    };
  }

  /**
   * A membership may only reference a system BUSINESS-scope role or a custom
   * role of the SAME business — never another tenant's custom role.
   */
  async assertRoleAssignable(roleId: string, businessId: string): Promise<void> {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    const ok =
      role !== null &&
      role.scope === 'BUSINESS' &&
      (role.businessId === null || role.businessId === businessId);
    if (!ok) {
      throw new BadRequestException({
        code: 'INVALID_ROLE',
        message: 'Role is not assignable in this business',
      });
    }
  }
}
