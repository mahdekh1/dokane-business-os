import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { EntitlementService } from '../registry/entitlement.service';

describe('Payments (Task 4.3, integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tag = `paytest-${Date.now()}`;
  let token = '';
  let biz = '';
  let offeringId = '';
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
  const createOrder = (body: unknown) => as(request(server()).post('/api/v1/orders')).send(body as object);
  const pay = (orderId: string, amount: number, method = 'CASH') =>
    as(request(server()).post(`/api/v1/orders/${orderId}/payments`)).send({ amount, method });

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
      .send({ type: 'physical', name: 'Widget', price: 500 })
      .expect(201);
    offeringId = off.body.id;
    await as(request(server()).post('/api/v1/inventory/adjustments'))
      .send({ offeringId, delta: 1000, movementType: 'INITIAL_STOCK' })
      .expect(201);
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

  const newOrder = async () => {
    const res = await createOrder({
      channelId: physicalChannelId,
      items: [{ offeringId, quantity: 1 }],
      fulfillmentStatus: 'COMPLETED',
    }).expect(201);
    return res.body;
  };

  it('a delivered order is UNPAID with the full amount due', async () => {
    const order = await newOrder();
    expect(order.fulfillmentStatus).toBe('COMPLETED');
    expect(order.paymentStatus).toBe('UNPAID');
    expect(order.amountDue).toBe(500);
  });

  it('derives PARTIALLY_PAID then PAID across two payments', async () => {
    const order = await newOrder();
    const first = await pay(order.id, 200).expect(201);
    expect(first.body.paymentStatus).toBe('PARTIALLY_PAID');
    expect(first.body.amountPaid).toBe(200);
    expect(first.body.amountDue).toBe(300);
    const second = await pay(order.id, 300).expect(201);
    expect(second.body.paymentStatus).toBe('PAID');
    expect(second.body.amountDue).toBe(0);
    expect(second.body.payments).toHaveLength(2);
  });

  it('rejects overpayment beyond the amount due', async () => {
    const order = await newOrder();
    const res = await pay(order.id, 600).expect(400);
    expect(res.body.code).toBe('OVERPAYMENT');
  });

  it('refuses payment on a cancelled order', async () => {
    const res = await createOrder({ channelId: physicalChannelId, items: [{ offeringId, quantity: 1 }], fulfillmentStatus: 'CONFIRMED' }).expect(201);
    await as(request(server()).post(`/api/v1/orders/${res.body.id}/transitions`)).send({ fulfillmentStatus: 'CANCELLED' }).expect(201);
    const bad = await pay(res.body.id, 100).expect(400);
    expect(bad.body.code).toBe('PAYMENT_ON_CANCELLED');
  });
});
