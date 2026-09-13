import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { LoginInput, RefreshInput, SignupInput } from '@dokane/contracts';
import type {
  AuthTokens,
  LoginInput as LoginInputType,
  RefreshInput as RefreshInputType,
  SignupInput as SignupInputType,
} from '@dokane/contracts';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { Public } from '../../common/decorators';
import { AuthService } from './auth.service';

@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('signup')
  signup(
    @Body(new ZodValidationPipe(SignupInput)) body: SignupInputType,
  ): Promise<AuthTokens> {
    return this.auth.signup(body);
  }

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('login')
  login(
    @Body(new ZodValidationPipe(LoginInput)) body: LoginInputType,
  ): Promise<AuthTokens> {
    return this.auth.login(body);
  }

  @Post('refresh')
  refresh(
    @Body(new ZodValidationPipe(RefreshInput)) body: RefreshInputType,
  ): AuthTokens {
    return this.auth.refresh(body.refreshToken);
  }

  @HttpCode(204)
  @Post('logout')
  logout(): void {
    // Stateless tokens: the client discards them. Refresh-token revocation is
    // a post-MVP hardening step.
  }
}
