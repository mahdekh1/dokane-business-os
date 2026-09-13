import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { RbacService } from './rbac.service';

/**
 * Integration test for Task 1.3 (tenancy guards) + Task 1.4 (RBAC).
 * Boots the full app and drives it over HTTP with real tokens and memberships.
 */
describe('Tenancy + RBAC (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tag = `rbactest_${Date.now()}`;

  let tokenA = '';
  let tokenB = '';
  let userAId = '';
  let bizA = '';
  let bizB = '';
  let bizC = '';

  async function signup(email: string): Promise<{ token: string; userId: string }> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({ email, password: 'password123', firstName: 'T', lastName: 'U' })
      .expect(201);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    return { token: res.body.accessToken as string, userId: user.id };
  }

  async function roleId(name: string): Promise<string> {
    const role = await prisma.role.findFirstOrThrow({
      where: { name, businessId: null, isSystem: true },
    });
    return role.id;
  }

  async function makeBusiness(slug: string): Promise<string> {
    const b = await prisma.business.create({
      data: { name: slug, slug, status: 'APPROVED' },
    });
    return b.id;
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
    userAId = a.userId;
    tokenB = b.token;

    bizA = await makeBusiness(`${tag}-a`);
    bizB = await makeBusiness(`${tag}-b`);
    bizC = await makeBusiness(`${tag}-c`);

    const owner = await roleId('OWNER');
    const staff = await roleId('STAFF');
    // A owns business A; B owns business B; A is STAFF in business C.
    await prisma.businessMembership.create({
      data: { businessId: bizA, userId: a.userId, roleId: owner },
    });
    await prisma.businessMembership.create({
      data: { businessId: bizB, userId: b.userId, roleId: owner },
    });
    await prisma.businessMembership.create({
      data: { businessId: bizC, userId: a.userId, roleId: staff },
    });
  });

  afterAll(async () => {
    await prisma.businessMembership.deleteMany({
      where: { business: { slug: { startsWith: tag } } },
    });
    await prisma.business.deleteMany({ where: { slug: { startsWith: tag } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: tag } } });
    await app.close();
  });

  const server = () => app.getHttpServer();

  it('401 without authentication', async () => {
    await request(server()).get('/api/v1/business').set('x-business-id', bizA).expect(401);
  });

  it('403 when no business context is supplied', async () => {
    await request(server())
      .get('/api/v1/business')
      .set('authorization', `Bearer ${tokenA}`)
      .expect(403);
  });

  it('owner reads their own business', async () => {
    const res = await request(server())
      .get('/api/v1/business')
      .set('authorization', `Bearer ${tokenA}`)
      .set('x-business-id', bizA)
      .expect(200);
    expect(res.body.id).toBe(bizA);
  });

  it('CANNOT access a business the user is not a member of (tenant isolation)', async () => {
    await request(server())
      .get('/api/v1/business')
      .set('authorization', `Bearer ${tokenA}`)
      .set('x-business-id', bizB)
      .expect(403);
  });

  it('owner (has roles.view) can list roles', async () => {
    const res = await request(server())
      .get('/api/v1/roles')
      .set('authorization', `Bearer ${tokenA}`)
      .set('x-business-id', bizA)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((r: { name: string }) => r.name === 'OWNER')).toBe(true);
  });

  it('STAFF (lacks roles.view) is forbidden from listing roles', async () => {
    await request(server())
      .get('/api/v1/roles')
      .set('authorization', `Bearer ${tokenA}`)
      .set('x-business-id', bizC)
      .expect(403);
  });

  it('STAFF can still read the business (has business.view)', async () => {
    await request(server())
      .get('/api/v1/business')
      .set('authorization', `Bearer ${tokenA}`)
      .set('x-business-id', bizC)
      .expect(200);
  });

  it('rejects assigning another business’s custom role', async () => {
    const rbac = app.get(RbacService);
    const custom = await prisma.role.create({
      data: { name: 'CustomB', scope: 'BUSINESS', isSystem: false, businessId: bizB },
    });
    await expect(rbac.assertRoleAssignable(custom.id, bizA)).rejects.toThrow();
    await expect(rbac.assertRoleAssignable(custom.id, bizB)).resolves.toBeUndefined();
    await prisma.role.delete({ where: { id: custom.id } });
  });

  it('userAId is set (sanity)', () => {
    expect(userAId).toBeTruthy();
  });
});
