import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { EntitlementService } from '../registry/entitlement.service';

describe('Inventory (Task 3.3, integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tag = `invtest-${Date.now()}`;
  let tokenA = '';
  let tokenB = '';
  let bizA = '';
  let bizB = '';
  let offeringId = '';

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
  const adjust = (token: string, biz: string, body: unknown) =>
    asBiz(request(server()).post('/api/v1/inventory/adjustments'), token, biz).send(body as object);

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

    const off = await asBiz(request(server()).post('/api/v1/catalog/offerings'), tokenA, bizA)
      .send({ type: 'physical', name: 'Widget', price: 1000 })
      .expect(201);
    offeringId = off.body.id;
  });

  afterAll(async () => {
    const ids = (await prisma.business.findMany({ where: { slug: { startsWith: tag } }, select: { id: true } })).map((x) => x.id);
    await prisma.inventoryMovement.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.inventoryItem.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.location.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.offering.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.subscription.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.businessMembership.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.business.deleteMany({ where: { id: { in: ids } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: tag } } });
    await app.close();
  });

  it('initial stock sets quantity and writes exactly one movement', async () => {
    const res = await adjust(tokenA, bizA, { offeringId, delta: 10, movementType: 'INITIAL_STOCK' }).expect(201);
    expect(res.body.quantity).toBe(10);
    const movements = await asBiz(request(server()).get(`/api/v1/inventory/movements?offeringId=${offeringId}`), tokenA, bizA).expect(200);
    expect(movements.body.total).toBe(1);
    expect(movements.body.items[0].movementType).toBe('INITIAL_STOCK');
    expect(movements.body.items[0].quantityDelta).toBe(10);
  });

  it('an adjustment changes quantity and adds a movement', async () => {
    const res = await adjust(tokenA, bizA, { offeringId, delta: -3, movementType: 'ADJUSTMENT', reason: 'damaged' }).expect(201);
    expect(res.body.quantity).toBe(7);
    const movements = await asBiz(request(server()).get(`/api/v1/inventory/movements?offeringId=${offeringId}`), tokenA, bizA).expect(200);
    expect(movements.body.total).toBe(2);
  });

  it('refuses to oversell (delta would go below zero)', async () => {
    const res = await adjust(tokenA, bizA, { offeringId, delta: -100 }).expect(409);
    expect(res.body.code).toBe('INSUFFICIENT_STOCK');
  });

  it('sets a low-stock threshold and flags it in the list', async () => {
    await adjust(tokenA, bizA, { offeringId, delta: 0, lowStockThreshold: 8 }).expect(201);
    const list = await asBiz(request(server()).get('/api/v1/inventory?lowStock=true'), tokenA, bizA).expect(200);
    const row = list.body.items.find((i: { offeringId: string }) => i.offeringId === offeringId);
    expect(row).toBeTruthy();
    expect(row.lowStock).toBe(true); // quantity 7 <= threshold 8
  });

  it('concurrent increments do not lose updates', async () => {
    const before = await asBiz(request(server()).get('/api/v1/inventory'), tokenA, bizA).expect(200);
    const start = before.body.items.find((i: { offeringId: string }) => i.offeringId === offeringId).quantity as number;
    await Promise.all(Array.from({ length: 6 }, () => adjust(tokenA, bizA, { offeringId, delta: 2 }).expect(201)));
    const after = await asBiz(request(server()).get('/api/v1/inventory'), tokenA, bizA).expect(200);
    const end = after.body.items.find((i: { offeringId: string }) => i.offeringId === offeringId).quantity as number;
    expect(end).toBe(start + 12);
  });

  it('rejects providing neither / both stockables', async () => {
    await adjust(tokenA, bizA, { delta: 1 }).expect(400);
    await adjust(tokenA, bizA, { offeringId, variantId: offeringId, delta: 1 }).expect(400);
  });

  it('cannot adjust another business offering (tenant isolation)', async () => {
    const res = await adjust(tokenB, bizB, { offeringId, delta: 5 }).expect(400);
    expect(res.body.code).toBe('INVALID_STOCKABLE');
  });
});
