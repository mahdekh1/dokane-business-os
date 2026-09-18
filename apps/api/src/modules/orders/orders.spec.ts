import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { EntitlementService } from '../registry/entitlement.service';

describe('Orders (Task 4.2, integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tag = `ordtest-${Date.now()}`;
  let token = '';
  let biz = '';
  let offeringId = '';
  let onlineChannelId = '';
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
  const createOrder = (body: unknown, key?: string) => {
    let r = as(request(server()).post('/api/v1/orders'));
    if (key) r = r.set('idempotency-key', key);
    return r.send(body as object);
  };

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

    const off = await as(request(server()).post('/api/v1/catalog/offerings'))
      .send({ type: 'physical', name: 'Widget', price: 1000, sku: 'W-1' })
      .expect(201);
    offeringId = off.body.id;

    const channels = await as(request(server()).get('/api/v1/channels')).expect(200);
    onlineChannelId = channels.body.find((c: { type: string }) => c.type === 'ONLINE_STORE').id;
    physicalChannelId = channels.body.find((c: { type: string }) => c.type === 'PHYSICAL').id;
  });

  afterAll(async () => {
    const ids = [biz];
    await prisma.payment.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.orderItem.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.order.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.salesChannel.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.location.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.offering.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.customer.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.subscription.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.businessMembership.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.business.deleteMany({ where: { id: { in: ids } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: tag } } });
    await app.close();
  });

  it('ignores client-supplied totals and computes server-side', async () => {
    const res = await createOrder({ items: [{ offeringId, quantity: 2 }], total: 1 }).expect(201);
    expect(res.body.total).toBe(2 * 1000);
    expect(res.body.subtotal).toBe(2000);
    expect(res.body.items[0].nameSnapshot).toBe('Widget');
    expect(res.body.items[0].skuSnapshot).toBe('W-1');
    expect(res.body.items[0].unitPrice).toBe(1000);
  });

  it('online orders start PENDING and cannot jump straight to COMPLETED', async () => {
    const res = await createOrder({ channelId: onlineChannelId, items: [{ offeringId, quantity: 1 }] }).expect(201);
    expect(res.body.entryMode).toBe('ONLINE');
    expect(res.body.fulfillmentStatus).toBe('PENDING');
    const bad = await as(request(server()).post(`/api/v1/orders/${res.body.id}/transitions`))
      .send({ fulfillmentStatus: 'COMPLETED' })
      .expect(400);
    expect(bad.body.code).toBe('ILLEGAL_TRANSITION');
    // legal next step works
    await as(request(server()).post(`/api/v1/orders/${res.body.id}/transitions`))
      .send({ fulfillmentStatus: 'CONFIRMED' })
      .expect(201);
  });

  it('a manual counter order can be created straight at COMPLETED', async () => {
    const res = await createOrder({
      channelId: physicalChannelId,
      items: [{ offeringId, quantity: 3 }],
      fulfillmentStatus: 'COMPLETED',
    }).expect(201);
    expect(res.body.entryMode).toBe('MANUAL');
    expect(res.body.fulfillmentStatus).toBe('COMPLETED');
    expect(res.body.total).toBe(3000);
    expect(res.body.paymentStatus).toBe('UNPAID');
    expect(res.body.amountDue).toBe(3000);
  });

  it('freezes item snapshots against later offering edits', async () => {
    const res = await createOrder({ channelId: physicalChannelId, items: [{ offeringId, quantity: 1 }] }).expect(201);
    await as(request(server()).patch(`/api/v1/catalog/offerings/${offeringId}`)).send({ price: 5000 }).expect(200);
    const fetched = await as(request(server()).get(`/api/v1/orders/${res.body.id}`)).expect(200);
    expect(fetched.body.items[0].unitPrice).toBe(1000); // snapshot, not the new 5000
  });

  it('returns the first order for a duplicate idempotency key', async () => {
    const key = `idem-${Date.now()}`;
    const first = await createOrder({ channelId: physicalChannelId, items: [{ offeringId, quantity: 1 }] }, key).expect(201);
    const second = await createOrder({ channelId: physicalChannelId, items: [{ offeringId, quantity: 9 }] }, key).expect(201);
    expect(second.body.id).toBe(first.body.id);
    expect(second.body.items).toHaveLength(1); // the second (qty 9) payload was ignored
  });
});
