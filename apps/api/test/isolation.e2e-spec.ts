import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Phase-1 tenant-isolation gate (SECURITY.md §8) over the endpoints that exist
 * so far. Each module adds its own A→B isolation tests as it is built (Phase 3+).
 * Every cross-tenant attempt below must be rejected.
 */
describe('Tenant isolation gate', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tag = `isogate_${Date.now()}`;
  let tokenA = '';
  let bizA = '';
  let bizB = '';

  async function signup(email: string): Promise<{ token: string; id: string }> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({ email, password: 'password123', firstName: 'T', lastName: 'U' })
      .expect(201);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    return { token: res.body.accessToken as string, id: user.id };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });
    await app.init();
    prisma = app.get(PrismaService);

    const a = await signup(`${tag}_a@example.com`);
    const b = await signup(`${tag}_b@example.com`);
    tokenA = a.token;

    const ba = await prisma.business.create({
      data: { name: `${tag}-a`, slug: `${tag}-a`, status: 'APPROVED' },
    });
    const bb = await prisma.business.create({
      data: { name: `${tag}-b`, slug: `${tag}-b`, status: 'APPROVED' },
    });
    bizA = ba.id;
    bizB = bb.id;

    const owner = await prisma.role.findFirstOrThrow({
      where: { name: 'OWNER', businessId: null, isSystem: true },
    });
    await prisma.businessMembership.create({
      data: { businessId: bizA, userId: a.id, roleId: owner.id },
    });
    await prisma.businessMembership.create({
      data: { businessId: bizB, userId: b.id, roleId: owner.id },
    });
  });

  afterAll(async () => {
    await prisma.businessMembership.deleteMany({
      where: { business: { slug: { startsWith: tag } } },
    });
    await prisma.moduleState.deleteMany({ where: { businessId: { in: [bizA, bizB] } } });
    await prisma.subscription.deleteMany({ where: { businessId: { in: [bizA, bizB] } } });
    await prisma.auditLog.deleteMany({ where: { businessId: { in: [bizA, bizB] } } });
    await prisma.business.deleteMany({ where: { slug: { startsWith: tag } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: tag } } });
    await app.close();
  });

  const server = () => app.getHttpServer();
  const asA = (req: request.Test) => req.set('authorization', `Bearer ${tokenA}`);

  it('unauthenticated request is rejected (401)', async () => {
    await request(server()).get('/api/v1/business').set('x-business-id', bizA).expect(401);
  });

  it('A can read its own business (200)', async () => {
    await asA(request(server()).get('/api/v1/business')).set('x-business-id', bizA).expect(200);
  });

  it('A CANNOT read B business (403)', async () => {
    await asA(request(server()).get('/api/v1/business')).set('x-business-id', bizB).expect(403);
  });

  it('A CANNOT list B roles (403)', async () => {
    await asA(request(server()).get('/api/v1/roles')).set('x-business-id', bizB).expect(403);
  });

  it('A CANNOT list B modules (403)', async () => {
    await asA(request(server()).get('/api/v1/modules')).set('x-business-id', bizB).expect(403);
  });

  it('A CANNOT enable a module for B (403)', async () => {
    await asA(request(server()).post('/api/v1/modules/catalog/enable'))
      .set('x-business-id', bizB)
      .expect(403);
  });
});
