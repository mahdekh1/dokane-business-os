import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TokenService } from '../../modules/auth/token.service';
import { IS_PUBLIC_KEY } from '../decorators';

interface AuthedRequest {
  headers: Record<string, string | string[] | undefined>;
  userId?: string;
}

/**
 * Global guard. Authenticates every non-@Public route from a Bearer access
 * token and attaches `userId` to the request. Tenant is NOT resolved here.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers['authorization'];
    const value = Array.isArray(header) ? header[0] : header;
    if (!value || !value.startsWith('Bearer ')) {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED' });
    }

    try {
      const payload = this.tokens.verify(value.slice('Bearer '.length));
      if (payload.type !== 'access') {
        throw new Error('not an access token');
      }
      req.userId = payload.sub;
      return true;
    } catch {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED' });
    }
  }
}
