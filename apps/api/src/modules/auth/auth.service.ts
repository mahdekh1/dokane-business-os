import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthTokens, LoginInput, SignupInput } from '@dokane/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  async signup(input: SignupInput): Promise<AuthTokens> {
    const passwordHash = await this.passwords.hash(input.password);
    try {
      const user = await this.prisma.user.create({
        data: {
          email: input.email.toLowerCase(),
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
          passwordHash,
        },
      });
      return this.tokens.issueTokens(user.id);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'EMAIL_TAKEN',
          message: 'Email already registered',
        });
      }
      throw err;
    }
  }

  async login(input: LoginInput): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });
    const invalid = new UnauthorizedException({
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password',
    });

    if (!user || user.status !== 'ACTIVE') {
      // Spend comparable time to reduce user-enumeration timing signal.
      await this.passwords.hash(input.password).catch(() => undefined);
      throw invalid;
    }

    const ok = await this.passwords.verify(user.passwordHash, input.password);
    if (!ok) {
      throw invalid;
    }
    return this.tokens.issueTokens(user.id);
  }

  refresh(refreshToken: string): AuthTokens {
    try {
      const payload = this.tokens.verify(refreshToken);
      if (payload.type !== 'refresh') {
        throw new Error('wrong token type');
      }
      return this.tokens.issueTokens(payload.sub);
    } catch {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH',
        message: 'Invalid refresh token',
      });
    }
  }
}
