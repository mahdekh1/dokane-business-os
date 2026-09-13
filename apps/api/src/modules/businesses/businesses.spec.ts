import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';

describe('Business workflow (Task 2.1, integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tag = `biztest-${Date.now()}`;
  let userToken = '';
  let userId = '';
  let adminToken = '';
  let businessId = '';

  async function signup(email: string): Promise<{ token: string; id: string }> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({ email, password: 'password123', firstName: 'T', lastName: 'U' })
      .expect(201);
    const u = await prisma.user.findUniqueOrThrow({ where: { email } });
    return { token: res.body.accessToken as string, id: u.id };
  }
  const auth = (r: request.Test, t: string) => r.set('authorization', `Bearer ${t}`);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });
    await app.init();
    prisma = app.get(PrismaService);

    const user = await signup(`${tag}-owner@example.com`);
    userToken = user.token;
    userId = user.id;
    const admin = await signup(`${tag}-admin@example.com`);
    adminToken = admin.token;
    await prisma.user.update({ where: { id: admin.id }, data: { isPlatformAdmin: true } });
  });

  afterAll(async () => {
    const ids = (
      await prisma.business.findMany({ where: { slug: { startsWith: tag } }, select: { id: true } })
    ).map((b) => b.id);
    await prisma.businessMembership.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.subscription.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.auditLog.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.business.deleteMany({ where: { id: { in: ids } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: tag } } });
    await app.close();
  });

  it('registers a business as PENDING_APPROVAL with an owner membership', async () => {
    const res = await auth(request(app.getHttpServer()).post('/api/v1/business'), userToken)
      .send({ name: 'Test Shop', slug: `${tag}-shop` })
      .expect(201);
    businessId = res.body.id;
    expect(res.body.status).toBe('PENDING_APPROVAL');
    const membership = await prisma.businessMembership.findFirst({
      where: { businessId, userId },
      include: { role: true },
    });
    expect(membership?.role.name).toBe('OWNER');
  });

  it('rejects a duplicate slug', async () => {
    await auth(request(app.getHttpServer()).post('/api/v1/business'), userToken)
      .send({ name: 'Dup', slug: `${tag}-shop` })
      .expect(409);
  });

  it('forbids a non-admin from the platform businesses endpoint', async () => {
    await auth(request(app.getHttpServer()).get('/api/v1/platform/businesses'), userToken).expect(403);
  });

  it('lets a platform admin list businesses', async () => {
    const res = await auth(request(app.getHttpServer()).get('/api/v1/platform/businesses'), adminToken).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('approves the business and provisions a default subscription', async () => {
    const res = await auth(
      request(app.getHttpServer()).post(`/api/v1/platform/businesses/${businessId}/approve`),
      adminToken,
    ).expect(201);
    expect(res.body.status).toBe('APPROVED');
    const sub = await prisma.subscription.findUnique({ where: { businessId } });
    expect(sub).toBeTruthy();
  });

  it('rejects an invalid transition (approve when already approved)', async () => {
    await auth(
      request(app.getHttpServer()).post(`/api/v1/platform/businesses/${businessId}/approve`),
      adminToken,
    ).expect(400);
  });

  it('suspends and reactivates', async () => {
    const s = await auth(
      request(app.getHttpServer()).post(`/api/v1/platform/businesses/${businessId}/suspend`),
      adminToken,
    ).send({}).expect(201);
    expect(s.body.status).toBe('SUSPENDED');
    const r = await auth(
      request(app.getHttpServer()).post(`/api/v1/platform/businesses/${businessId}/reactivate`),
      adminToken,
    ).expect(201);
    expect(r.body.status).toBe('APPROVED');
  });
});
