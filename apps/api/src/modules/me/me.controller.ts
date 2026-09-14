import { Controller, Get } from '@nestjs/common';
import type { MeResponse } from '@dokane/contracts';
import { UserId } from '../../common/decorators';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * The signed-in user and the businesses they belong to. Authenticated but
 * tenant-agnostic (no X-Business-Id) — powers the business switcher in the shell.
 */
@Controller('me')
export class MeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async me(@UserId() userId: string): Promise<MeResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isPlatformAdmin: true,
      },
    });
    const memberships = await this.prisma.businessMembership.findMany({
      where: { userId, status: 'ACTIVE' },
      include: {
        business: { select: { id: true, name: true, slug: true, status: true } },
        role: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return {
      user,
      businesses: memberships.map((m) => ({
        id: m.business.id,
        name: m.business.name,
        slug: m.business.slug,
        status: m.business.status,
        role: m.role.name,
        membershipId: m.id,
      })),
    };
  }
}
