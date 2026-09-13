import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthTokens } from '@dokane/contracts';

export interface TokenPayload {
  sub: string;
  type: 'access' | 'refresh';
}

/**
 * Issues and verifies JWTs. Tokens encode only the userId (`sub`) — NO tenant.
 * Tenant context is resolved per request from the caller's memberships
 * (see tenancy guards, Task 1.3).
 */
@Injectable()
export class TokenService {
  private readonly jwt = new JwtService({
    secret: process.env.AUTH_SECRET ?? 'dev-secret',
  });

  issueTokens(userId: string): AuthTokens {
    return {
      accessToken: this.jwt.sign({ sub: userId, type: 'access' }, { expiresIn: '15m' }),
      refreshToken: this.jwt.sign({ sub: userId, type: 'refresh' }, { expiresIn: '7d' }),
    };
  }

  verify(token: string): TokenPayload {
    return this.jwt.verify<TokenPayload>(token);
  }
}
