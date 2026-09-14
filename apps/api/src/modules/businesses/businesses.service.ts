import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Business, type BusinessStatus } from '@prisma/client';
import type {
  BusinessDto,
  CreateBusinessInput,
  PlatformBusinessDetail,
} from '@dokane/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EntitlementService } from '../registry/entitlement.service';

const DEFAULT_PLAN = 'STARTER';

@Injectable()
export class BusinessesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly entitlements: EntitlementService,
  ) {}

  private toDto(b: Business): BusinessDto {
    return {
      id: b.id,
      name: b.name,
      slug: b.slug,
      status: b.status,
      businessType: b.businessType,
      email: b.email,
      businessNumber: b.businessNumber,
      address: b.addressLine1,
      phone: b.phone,
      createdAt: b.createdAt.toISOString(),
    };
  }

  /** Register a new business owned by the caller; enters PENDING_APPROVAL. */
  async createBusiness(userId: string, input: CreateBusinessInput): Promise<BusinessDto> {
    const ownerRole = await this.prisma.role.findFirstOrThrow({
      where: { name: 'OWNER', businessId: null, isSystem: true },
    });
    try {
      const business = await this.prisma.$transaction(async (tx) => {
        const b = await tx.business.create({
          data: {
            name: input.name,
            slug: input.slug,
            // Category is stored in businessType: the taxonomy key, or the
            // free-text label when the owner picked "Other".
            businessType: input.category === 'other' ? input.categoryOther : input.category,
            email: input.email,
            businessNumber: input.businessNumber,
            addressLine1: input.address,
            phone: input.phone,
            status: 'PENDING_APPROVAL',
          },
        });
        await tx.businessMembership.create({
          data: { businessId: b.id, userId, roleId: ownerRole.id },
        });
        return b;
      });
      await this.audit.record({
        businessId: business.id,
        actorUserId: userId,
        actorType: 'USER',
        action: 'BUSINESS_CREATED',
        entityType: 'business',
        entityId: business.id,
      });
      return this.toDto(business);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({ code: 'SLUG_TAKEN', message: 'That URL is taken' });
      }
      throw err;
    }
  }

  async listBusinesses(status?: BusinessStatus): Promise<BusinessDto[]> {
    const rows = await this.prisma.business.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((b) => this.toDto(b));
  }

  async getBusiness(id: string): Promise<BusinessDto> {
    const b = await this.prisma.business.findUnique({ where: { id } });
    if (!b) throw new NotFoundException({ code: 'NOT_FOUND' });
    return this.toDto(b);
  }

  /** Platform review detail: business + its owner. */
  async getBusinessDetail(id: string): Promise<PlatformBusinessDetail> {
    const b = await this.prisma.business.findUnique({ where: { id } });
    if (!b) throw new NotFoundException({ code: 'NOT_FOUND' });
    const ownerMembership = await this.prisma.businessMembership.findFirst({
      where: { businessId: id, role: { name: 'OWNER' } },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return {
      ...this.toDto(b),
      owner: ownerMembership
        ? {
            name: `${ownerMembership.user.firstName} ${ownerMembership.user.lastName}`.trim(),
            email: ownerMembership.user.email,
          }
        : null,
    };
  }

  private async transition(
    adminUserId: string,
    id: string,
    from: BusinessStatus[],
    to: BusinessStatus,
    action: string,
    note?: string,
  ): Promise<BusinessDto> {
    const b = await this.prisma.business.findUnique({ where: { id } });
    if (!b) throw new NotFoundException({ code: 'NOT_FOUND' });
    if (!from.includes(b.status)) {
      throw new BadRequestException({
        code: 'INVALID_TRANSITION',
        message: `Cannot ${action} a business that is ${b.status}`,
      });
    }
    const updated = await this.prisma.business.update({ where: { id }, data: { status: to } });
    await this.audit.record({
      businessId: id,
      actorUserId: adminUserId,
      actorType: 'PLATFORM_ADMIN',
      action,
      entityType: 'business',
      entityId: id,
      metadata: note ? { note } : undefined,
    });
    return this.toDto(updated);
  }

  async approve(adminUserId: string, id: string): Promise<BusinessDto> {
    const dto = await this.transition(
      adminUserId,
      id,
      ['PENDING_APPROVAL', 'CHANGES_REQUESTED'],
      'APPROVED',
      'BUSINESS_APPROVED',
    );
    await this.entitlements.assignPlan(id, DEFAULT_PLAN);
    return dto;
  }

  reject(adminUserId: string, id: string, note?: string): Promise<BusinessDto> {
    return this.transition(adminUserId, id, ['PENDING_APPROVAL', 'CHANGES_REQUESTED'], 'REJECTED', 'BUSINESS_REJECTED', note);
  }

  requestChanges(adminUserId: string, id: string, note?: string): Promise<BusinessDto> {
    return this.transition(adminUserId, id, ['PENDING_APPROVAL'], 'CHANGES_REQUESTED', 'BUSINESS_CHANGES_REQUESTED', note);
  }

  suspend(adminUserId: string, id: string, note?: string): Promise<BusinessDto> {
    return this.transition(adminUserId, id, ['APPROVED'], 'SUSPENDED', 'BUSINESS_SUSPENDED', note);
  }

  reactivate(adminUserId: string, id: string): Promise<BusinessDto> {
    return this.transition(adminUserId, id, ['SUSPENDED'], 'APPROVED', 'BUSINESS_REACTIVATED');
  }
}
