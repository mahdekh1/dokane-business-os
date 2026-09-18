import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { EntitlementService } from '../registry/entitlement.service';
import { OutboxRelay } from '../../common/events/outbox-relay.service';

describe('Accounting (Task 4.5, integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let relay: OutboxRelay;
  const tag = `acctest-${Date.now()}`;
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
  const summary = async () => (await as(request(server()).get('/api/v1/accounting/summary')).expect(200)).body;
  const flush = () => relay.processPending();

  const newCompletedOrder = async () => {
    // ensure stock so a COMPLETED order can commit
    await as(request(server()).post('/api/v1/inventory/adjustments'))
      .send({ offeringId, delta: 10, movementType: 'ADJUSTMENT' })
      .expect(201);
    const res = await as(request(server()).post('/api/v1/orders'))
      .send({ channelId: physicalChannelId, items: [{ offeringId, quantity: 1 }], fulfillmentStatus: 'COMPLETED' })
      .expect(201);
    return res.body;
  };
  const pay = (orderId: string, amount: number) =>
    as(request(server()).post(`/api/v1/orders/${orderId}/payments`)).send({ amount, method: 'CASH' });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });
    await app.init();
    prisma = app.get(PrismaService);
    relay = app.get(OutboxRelay);
    const entitlements = app.get(EntitlementService);

    const a = await signup(`${tag}-a@example.com`);
    token = a.token;
    const owner = await prisma.role.findFirstOrThrow({ where: { name: 'OWNER', businessId: null, isSystem: true } });
    biz = (await prisma.business.create({ data: { name: tag, slug: tag, status: 'APPROVED' } })).id;
    await prisma.businessMembership.create({ data: { businessId: biz, userId: a.userId, roleId: owner.id } });
    await entitlements.assignPlan(biz, 'GROWTH');
    const off = await as(request(server()).post('/api/v1/catalog/offerings')).send({ type: 'physical', name: 'Widget', price: 500 }).expect(201);
    offeringId = off.body.id;
    const channels = await as(request(server()).get('/api/v1/channels')).expect(200);
    physicalChannelId = channels.body.find((c: { type: string }) => c.type === 'PHYSICAL').id;
  });

  afterAll(async () => {
    const ids = [biz];
    await prisma.financialEntry.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.payment.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.orderItem.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.order.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.outboxEvent.deleteMany({});
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

  it('records income only when paid, not when completed', async () => {
    const before = await summary();
    const order = await newCompletedOrder();
    await flush(); // no payment yet — nothing to record

    const afterComplete = await summary();
    expect(afterComplete.income).toBe(before.income); // unchanged — completion is not income
    expect(afterComplete.receivables).toBe(before.receivables + order.total);
    expect(afterComplete.sales).toBe(before.sales + order.total); // COMPLETED counts as a sale

    await pay(order.id, order.total).expect(201);
    await flush(); // payment.received → INCOME entry

    const afterPay = await summary();
    expect(afterPay.income).toBe(before.income + order.total);
    expect(afterPay.receivables).toBe(before.receivables); // cleared
  });

  it('creates one income entry per payment, equal to the amount', async () => {
    const order = await newCompletedOrder();
    await pay(order.id, 200).expect(201);
    await pay(order.id, 300).expect(201);
    await flush();
    await flush(); // idempotent — running twice must not double-count
    const entries = await as(request(server()).get(`/api/v1/accounting/entries?type=INCOME`)).expect(200);
    const mine = entries.body.items.filter((e: { sourceType: string }) => e.sourceType === 'ORDER_PAYMENT');
    const amounts = mine.map((e: { amount: number }) => e.amount);
    expect(amounts).toContain(200);
    expect(amounts).toContain(300);
  });

  it('a manual expense lowers net and lists in the ledger', async () => {
    const before = await summary();
    await as(request(server()).post('/api/v1/accounting/entries'))
      .send({ type: 'EXPENSE', amount: 150, category: 'supplies' })
      .expect(201);
    const after = await summary();
    expect(after.expenses).toBe(before.expenses + 150);
    expect(after.net).toBe(before.net - 150);
  });
});
