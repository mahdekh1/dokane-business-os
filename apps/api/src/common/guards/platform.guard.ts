import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { PLATFORM_PERMISSION_KEY } from '../decorators';

interface Req {
  userId?: string;
  platformAdmin?: boolean;
}

/**
 * Global guard. For routes marked @RequirePlatformPermission, requires the
 * authenticated user to be a platform admin (User.isPlatformAdmin). Platform
 * admin is global — it is NOT a business membership, so these routes never
 * resolve a tenant. (Scoped/audited support access is a post-MVP hardening.)
 */
@Injectable()
export class PlatformGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const code = this.reflector.getAllAndOverride<string | undefined>(
      PLATFORM_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!code) return true;

    const req = context.switchToHttp().getRequest<Req>();
    if (!req.userId) throw new UnauthorizedException({ code: 'UNAUTHENTICATED' });

    const user = await this.prisma.user.findUnique({
      where: { id: req.userId },
      select: { isPlatformAdmin: true },
    });
    if (!user?.isPlatformAdmin) {
      throw new ForbiddenException({ code: 'NOT_PLATFORM_ADMIN' });
    }
    req.platformAdmin = true;
    return true;
  }
}
