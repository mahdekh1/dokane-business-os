import { Body, Controller, Get, HttpCode, Patch, Post, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import {
  ChangePasswordInput,
  UpdateProfileInput,
  type ChangePasswordInput as ChangePasswordInputType,
  type MeResponse,
  type UpdateProfileInput as UpdateProfileInputType,
} from '@dokane/contracts';
import { UserId } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * The signed-in user: profile + the businesses they belong to. Authenticated but
 * tenant-agnostic (no X-Business-Id) — powers the business switcher and the
 * account/profile surface in the shell.
 */
@Controller('me')
export class MeController {
  constructor(private readonly prisma: PrismaService) {}

  private async buildMe(userId: string): Promise<MeResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        language: true,
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

  @Get()
  me(@UserId() userId: string): Promise<MeResponse> {
    return this.buildMe(userId);
  }

  /** Update the caller's own profile (name, phone, language). Email is read-only. */
  @Patch()
  async updateProfile(
    @UserId() userId: string,
    @Body(new ZodValidationPipe(UpdateProfileInput)) body: UpdateProfileInputType,
  ): Promise<MeResponse> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        phone: body.phone ? body.phone : null,
        language: body.language,
      },
    });
    return this.buildMe(userId);
  }

  /** Change the caller's password; requires the current password. */
  @Post('password')
  @HttpCode(204)
  async changePassword(
    @UserId() userId: string,
    @Body(new ZodValidationPipe(ChangePasswordInput)) body: ChangePasswordInputType,
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true },
    });
    const ok = await argon2.verify(user.passwordHash, body.currentPassword);
    if (!ok) {
      throw new UnauthorizedException({
        code: 'INVALID_PASSWORD',
        message: 'Current password is incorrect',
      });
    }
    const passwordHash = await argon2.hash(body.newPassword);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }
}
