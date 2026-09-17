import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { variantKey } from '@dokane/contracts';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { EntitlementService } from '../registry/entitlement.service';

describe('Catalog (Task 3.1, integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tag = `cattest-${Date.now()}`;
  let tokenA = '';
  let tokenB = '';
  let bizA = '';
  let bizB = '';

  async function signup(email: string): Promise<{ token: string; userId: string }> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({ email, password: 'password123', firstName: 'T', lastName: 'U' })
      .expect(201);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    return { token: res.body.accessToken as string, userId: user.id };
  }
  const asBiz = (r: request.Test, token: string, biz: string) =>
    r.set('authorization', `Bearer ${token}`).set('x-business-id', biz);
  const server = () => app.getHttpServer();
  const post = (token: string, biz: string, body: unknown) =>
    asBiz(request(server()).post('/api/v1/catalog/offerings'), token, biz).send(body as object);

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
    const owner = await prisma.role.findFirstOrThrow({ where: { name: 'OWNER', businessId: null, isSystem: true } });
    const mk = async (slug: string) => (await prisma.business.create({ data: { name: slug, slug, status: 'APPROVED' } })).id;
    bizA = await mk(`${tag}-a`);
    bizB = await mk(`${tag}-b`);
    await prisma.businessMembership.create({ data: { businessId: bizA, userId: a.userId, roleId: owner.id } });
    await prisma.businessMembership.create({ data: { businessId: bizB, userId: b.userId, roleId: owner.id } });
    await entitlements.assignPlan(bizA, 'GROWTH');
    await entitlements.assignPlan(bizB, 'GROWTH');
  });

  afterAll(async () => {
    const ids = (await prisma.business.findMany({ where: { slug: { startsWith: tag } }, select: { id: true } })).map((x) => x.id);
    await prisma.offering.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.category.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.subscription.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.businessMembership.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.business.deleteMany({ where: { id: { in: ids } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: tag } } });
    await app.close();
  });

  it('variantKey is stable regardless of attribute key order', () => {
    expect(variantKey({ color: 'Red', size: 'M' })).toBe(variantKey({ size: 'M', color: 'Red' }));
  });

  let offeringId = '';
  it('creates a simple physical offering (trackInventory defaults true)', async () => {
    const res = await post(tokenA, bizA, { type: 'physical', name: 'T-Shirt', price: 4990, sku: `${tag}-TSHIRT` }).expect(201);
    expect(res.body.trackInventory).toBe(true);
    expect(res.body.variants).toEqual([]);
    expect(res.body.price).toBe(4990);
    offeringId = res.body.id;
  });

  it('creates a digital offering (trackInventory defaults false)', async () => {
    const res = await post(tokenA, bizA, { type: 'digital', name: 'E-book', price: 1500 }).expect(201);
    expect(res.body.trackInventory).toBe(false);
  });

  it('creates a variant offering with canonical keys', async () => {
    const res = await post(tokenA, bizA, {
      type: 'physical', name: 'Hoodie', price: 12000,
      variants: [
        { price: 12000, attributes: { size: 'M', color: 'Red' } },
        { price: 12500, attributes: { color: 'Blue', size: 'L' } },
      ],
    }).expect(201);
    expect(res.body.variants.map((v: { key: string }) => v.key).sort()).toEqual(
      ['color:Blue|size:L', 'color:Red|size:M'],
    );
  });

  it('rejects a duplicate SKU within the same business', async () => {
    const res = await post(tokenA, bizA, { type: 'physical', name: 'Dup', price: 1000, sku: `${tag}-TSHIRT` }).expect(409);
    expect(res.body.code).toBe('SKU_TAKEN');
  });

  it('allows the same SKU in a different business (cross-tenant)', async () => {
    await post(tokenB, bizB, { type: 'physical', name: 'B shirt', price: 1000, sku: `${tag}-TSHIRT` }).expect(201);
  });

  it('does not leak another business offering (tenant isolation)', async () => {
    await asBiz(request(server()).get(`/api/v1/catalog/offerings/${offeringId}`), tokenB, bizB).expect(404);
  });

  it('preserves a variant row (same id) when its attributes are unchanged on update', async () => {
    const created = await post(tokenA, bizA, {
      type: 'physical', name: 'Cap', price: 2000, variants: [{ price: 2000, attributes: { size: 'One' } }],
    }).expect(201);
    const vid = created.body.variants[0].id as string;

    const updated = await asBiz(request(server()).patch(`/api/v1/catalog/offerings/${created.body.id}`), tokenA, bizA)
      .send({ name: 'Cap v2', variants: [{ price: 2500, attributes: { size: 'One' } }] })
      .expect(200);
    expect(updated.body.name).toBe('Cap v2');
    expect(updated.body.variants[0].id).toBe(vid);
    expect(updated.body.variants[0].price).toBe(2500);
  });

  it('archives an offering (soft delete → inactive)', async () => {
    const res = await asBiz(request(server()).delete(`/api/v1/catalog/offerings/${offeringId}`), tokenA, bizA).expect(200);
    expect(res.body.active).toBe(false);
  });
});
