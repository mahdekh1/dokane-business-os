import { Controller, Get } from '@nestjs/common';
import type { TeamMemberDto } from '@dokane/contracts';
import { Ctx, RequirePermission } from '../../common/decorators';
import type { TenantContext } from '../../common/tenant-context';
import { PrismaService } from '../../prisma/prisma.service';

/** Read-only team roster for assignment pickers. Core (permission-gated). */
@Controller('team')
export class TeamController {
  constructor(private readonly prisma: PrismaService) {}

  @RequirePermission('users.view')
  @Get('members')
  async members(@Ctx() ctx: TenantContext): Promise<TeamMemberDto[]> {
    const rows = await this.prisma.businessMembership.findMany({
      where: { businessId: ctx.businessId, status: 'ACTIVE' },
      select: { id: true, user: { select: { id: true, firstName: true, lastName: true, email: true } }, role: { select: { name: true } } },
    });
    return rows.map((m) => ({
      membershipId: m.id,
      userId: m.user.id,
      name: `${m.user.firstName} ${m.user.lastName}`.trim(),
      email: m.user.email,
      role: m.role.name,
    }));
  }
}
