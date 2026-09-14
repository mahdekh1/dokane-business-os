import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { EntitlementService } from '../registry/entitlement.service';

/**
 * Security / tenant-isolation attacks against the Phase 1–2 surface, per
 * SECURITY.md §1–4, §8. Every attack must be REJECTED. Modules that don't exist
 * yet (offerings, inventory rows, orders) are covered by their own A/B tests when
 * built (Phase 3+); here we attack every tenant-scoped endpoint that exists now:
 * /business, /roles, /modules, /branding, /billing, plus lifecycle + mass
 * assignment + privilege escalation + platform IDOR.
 */
describe('Security / tenant isolation (SECURITY.md)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tag = `sectest-${Date.now()}`;

  let tokenA = '';
  let tokenB = '';
  let bizA = '';
  let bizB = '';
  let bizSusp = '';

  async function signup(email: string): Promise<{ token: string; userId: string }> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({ email, password: 'password123', firstName: 'T', lastName: 'U' })
      .expect(201);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    return { token: res.body.accessToken as string, userId: user.id };
  }
  const auth = (r: request.Test, t: string) => r.set('authorization', `Bearer ${t}`);
  const asBiz = (r: request.Test, t: string, biz: string) =>
    auth(r, t).set('x-business-id', biz);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });
    await app.init();
    prisma = app.get(PrismaService);
    const entitlements = app.get(EntitlementService);

    const a = await signup(`${tag}-a@example.com`);
    const b = await signup(`${tag}-b@example.com`);
    tokenA = a.token;
    tokenB = b.token;

    const owner = await prisma.role.findFirstOrThrow({
      where: { name: 'OWNER', businessId: null, isSystem: true },
    });
    const mk = async (slug: string, status: 'APPROVED' | 'SUSPENDED') =>
      (await prisma.business.create({ data: { name: slug, slug, status } })).id;

    bizA = await mk(`${tag}-a`, 'APPROVED');
    bizB = await mk(`${tag}-b`, 'APPROVED');
    bizSusp = await mk(`${tag}-susp`, 'SUSPENDED');

    await prisma.businessMembership.create({ data: { businessId: bizA, userId: a.userId, roleId: owner.id } });
    await prisma.businessMembership.create({ data: { businessId: bizB, userId: b.userId, roleId: owner.id } });
    await prisma.businessMembership.create({ data: { businessId: bizSusp, userId: a.userId, roleId: owner.id } });

    await entitlements.assignPlan(bizA, 'GROWTH');
    await entitlements.assignPlan(bizB, 'STARTER');
  });

  afterAll(async () => {
    const ids = (await prisma.business.findMany({ where: { slug: { startsWith: tag } }, select: { id: true } })).map((x) => x.id);
    await prisma.moduleState.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.businessMembership.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.subscription.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.auditLog.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.business.deleteMany({ where: { id: { in: ids } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: tag } } });
    await app.close();
  });

  const server = () => app.getHttpServer();

  // ── §1/§8: A cannot reach B by swapping X-Business-Id (IDOR via header) ──
  it('A → read B business is refused', async () => {
    await asBiz(request(server()).get('/api/v1/business'), tokenA, bizB).expect(403);
  });
  it('A → read B modules is refused', async () => {
    await asBiz(request(server()).get('/api/v1/modules'), tokenA, bizB).expect(403);
  });
  it('A → read B branding is refused', async () => {
    await asBiz(request(server()).get('/api/v1/branding'), tokenA, bizB).expect(403);
  });
  it('A → read B plan is refused', async () => {
    await asBiz(request(server()).get('/api/v1/billing/plan'), tokenA, bizB).expect(403);
  });
  it('A → enable a module for B is refused (SECURITY §8)', async () => {
    await asBiz(request(server()).post('/api/v1/modules/catalog/enable'), tokenA, bizB).expect(403);
  });
  it('A → change B branding is refused', async () => {
    await asBiz(request(server()).patch('/api/v1/branding'), tokenA, bizB)
      .send({ primaryColor: '#000000', secondaryColor: '#ffffff', fontHeading: 'Fraunces', fontBody: 'Hanken Grotesk' })
      .expect(403);
  });

  // ── §3: entitlement is enforced server-side ──
  it('a Starter tenant cannot enable a module its plan excludes (NOT_ENTITLED)', async () => {
    const res = await asBiz(request(server()).post('/api/v1/modules/inventory/enable'), tokenB, bizB).expect(403);
    expect(res.body.code).toBe('NOT_ENTITLED');
  });

  // ── §4: suspended (non-approved) businesses are blocked ──
  it('a member of a SUSPENDED business is blocked (BUSINESS_INACTIVE)', async () => {
    const res = await asBiz(request(server()).get('/api/v1/business'), tokenA, bizSusp).expect(403);
    expect(res.body.code).toBe('BUSINESS_INACTIVE');
  });

  // ── §3: mass assignment — declared fields only survive ──
  it('createBusiness ignores an injected status/id (stays PENDING_APPROVAL)', async () => {
    const res = await auth(request(server()).post('/api/v1/business'), tokenA)
      .send({
        name: 'Mass Assign', slug: `${tag}-mass`, email: 'x@test.dev', category: 'retail',
        offeringTypes: ['physical'], address: '1 St', phone: '+1 555 0000',
        status: 'APPROVED', id: '00000000-0000-0000-0000-000000000000', isPlatformAdmin: true,
      })
      .expect(201);
    expect(res.body.status).toBe('PENDING_APPROVAL');
  });

  // ── privilege escalation via signup body is ignored ──
  it('signup cannot self-grant platform admin', async () => {
    const email = `${tag}-esc@example.com`;
    const res = await request(server())
      .post('/api/v1/auth/signup')
      .send({ email, password: 'password123', firstName: 'E', lastName: 'S', isPlatformAdmin: true })
      .expect(201);
    const me = await auth(request(server()).get('/api/v1/me'), res.body.accessToken).expect(200);
    expect(me.body.user.isPlatformAdmin).toBe(false);
  });

  // ── platform endpoints reject a non-admin regardless of the id in the URL ──
  it('a non-admin cannot read a platform business detail (IDOR)', async () => {
    await auth(request(server()).get(`/api/v1/platform/businesses/${bizB}`), tokenA).expect(403);
  });
  it('a non-admin cannot approve a business', async () => {
    await auth(request(server()).post(`/api/v1/platform/businesses/${bizB}/approve`), tokenA).expect(403);
  });
});
