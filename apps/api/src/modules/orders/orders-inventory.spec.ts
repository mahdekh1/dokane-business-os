import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { EntitlementService } from '../registry/entitlement.service';

describe('Order fulfillment ↔ inventory (Task 4.4, integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tag = `oitest-${Date.now()}`;
  let token = '';
  let biz = '';
  let physicalChannelId = '';

  async function signup(email: string): Promise<{ token: string; userId: string }> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({ email, password: 'password123', firstName: 'T', lastName: 'U' })
      .expect(201);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    return { token: res.body.accessToken as string, userId: user.id };
  }
  const as = (r: request.Test) => r.set('authorization', `Bearer ${token}`).set('x-business-id', biz);
  const server = () => app.getHttpServer();

  const makeOffering = async (over: Record<string, unknown> = {}) => {
    const res = await as(request(server()).post('/api/v1/catalog/offerings'))
      .send({ type: 'physical', name: `P-${Math.random().toString(36).slice(2, 8)}`, price: 100, ...over })
      .expect(201);
    return res.body.id as string;
  };
  const setStock = (offeringId: string, qty: number) =>
    as(request(server()).post('/api/v1/inventory/adjustments'))
      .send({ offeringId, delta: qty, movementType: 'INITIAL_STOCK' })
      .expect(201);
  const stockOf = async (offeringId: string): Promise<number> => {
    const list = await as(request(server()).get('/api/v1/inventory?pageSize=100')).expect(200);
    const row = list.body.items.find((i: { offeringId: string }) => i.offeringId === offeringId);
    return row ? (row.quantity as number) : -1;
  };
  const sell = (offeringId: string, quantity = 1, status = 'COMPLETED') =>
    as(request(server()).post('/api/v1/orders')).send({
      channelId: physicalChannelId,
      items: [{ offeringId, quantity }],
      fulfillmentStatus: status,
    });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });
    await app.init();
    prisma = app.get(PrismaService);
    const entitlements = app.get(EntitlementService);

    const a = await signup(`${tag}-a@example.com`);
    token = a.token;
    const owner = await prisma.role.findFirstOrThrow({ where: { name: 'OWNER', businessId: null, isSystem: true } });
    biz = (await prisma.business.create({ data: { name: tag, slug: tag, status: 'APPROVED' } })).id;
    await prisma.businessMembership.create({ data: { businessId: biz, userId: a.userId, roleId: owner.id } });
    await entitlements.assignPlan(biz, 'GROWTH');
    const channels = await as(request(server()).get('/api/v1/channels')).expect(200);
    physicalChannelId = channels.body.find((c: { type: string }) => c.type === 'PHYSICAL').id;
  });

  afterAll(async () => {
    const ids = [biz];
    await prisma.payment.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.orderItem.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.order.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.inventoryMovement.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.inventoryItem.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.salesChannel.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.location.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.offering.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.subscription.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.businessMembership.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.business.deleteMany({ where: { id: { in: ids } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: tag } } });
    await app.close();
  });

  it('decrements stock and writes a SALE movement on a completed sale', async () => {
    const o = await makeOffering();
    await setStock(o, 5);
    await sell(o, 2).expect(201);
    expect(await stockOf(o)).toBe(3);
    const moves = await as(request(server()).get(`/api/v1/inventory/movements?offeringId=${o}`)).expect(200);
    const sale = moves.body.items.find((m: { movementType: string }) => m.movementType === 'SALE');
    expect(sale.quantityDelta).toBe(-2);
  });

  it('prevents overselling the last unit under concurrency', async () => {
    const o = await makeOffering();
    await setStock(o, 1);
    const results = await Promise.all([sell(o, 1), sell(o, 1)]);
    const oks = results.filter((r) => r.status === 201).length;
    const conflicts = results.filter((r) => r.status === 409);
    expect(oks).toBe(1);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].body.code).toBe('INSUFFICIENT_STOCK');
    expect(await stockOf(o)).toBe(0);
  });

  it('restocks with a RETURN when a committed order is cancelled', async () => {
    const o = await makeOffering();
    await setStock(o, 5);
    const order = (await sell(o, 2, 'CONFIRMED').expect(201)).body; // CONFIRMED does not consume
    expect(await stockOf(o)).toBe(5);
    await as(request(server()).post(`/api/v1/orders/${order.id}/transitions`)).send({ fulfillmentStatus: 'PROCESSING' }).expect(201);
    expect(await stockOf(o)).toBe(3); // committed
    await as(request(server()).post(`/api/v1/orders/${order.id}/transitions`)).send({ fulfillmentStatus: 'CANCELLED' }).expect(201);
    expect(await stockOf(o)).toBe(5); // returned
  });

  it('does not touch stock for digital items', async () => {
    const d = await makeOffering({ type: 'digital' });
    await sell(d, 1).expect(201);
    expect(await stockOf(d)).toBe(-1); // no inventory row created
  });
});
