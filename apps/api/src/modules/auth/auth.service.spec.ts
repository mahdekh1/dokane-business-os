import { PrismaService } from '../../prisma/prisma.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { AuthService } from './auth.service';

describe('AuthService (integration, real DB)', () => {
  const prisma = new PrismaService();
  const auth = new AuthService(prisma, new PasswordService(), new TokenService());
  const email = `authtest_${Date.now()}@example.com`;

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: 'authtest_' } } });
    await prisma.$disconnect();
  });

  it('signs up and returns access + refresh tokens', async () => {
    const tokens = await auth.signup({
      email,
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
    });
    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();
  });

  it('rejects a duplicate email', async () => {
    await expect(
      auth.signup({ email, password: 'password123', firstName: 'T', lastName: 'U' }),
    ).rejects.toThrow();
  });

  it('logs in with the correct password', async () => {
    const tokens = await auth.login({ email, password: 'password123' });
    expect(tokens.accessToken).toBeTruthy();
  });

  it('rejects a wrong password', async () => {
    await expect(auth.login({ email, password: 'wrong-password' })).rejects.toThrow();
  });

  it('rejects an unknown email', async () => {
    await expect(
      auth.login({ email: 'nobody_authtest_x@example.com', password: 'password123' }),
    ).rejects.toThrow();
  });

  it('issues fresh tokens from a valid refresh token', async () => {
    const { refreshToken } = await auth.login({ email, password: 'password123' });
    const next = auth.refresh(refreshToken);
    expect(next.accessToken).toBeTruthy();
  });

  it('rejects a bogus refresh token', () => {
    expect(() => auth.refresh('not-a-real-token')).toThrow();
  });
});
