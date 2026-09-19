import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { EntitlementService } from '../registry/entitlement.service';

describe('Order ↔ customer link (step 1, integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tag = `ordcust-${Date.now()}`;
  let token = '';
  let biz = '';
  let offeringId = '';
  let channelId = '';

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
  const createOrder = (customer: unknown) =>
    as(request(server()).post('/api/v1/orders')).send({ channelId, items: [{ offeringId, quantity: 1 }], fulfillmentStatus: 'CONFIRMED', customer });

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
    const off = await as(request(server()).post('/api/v1/catalog/offerings')).send({ type: 'physical', name: 'Widget', price: 1000 }).expect(201);
    offeringId = off.body.id;
    const channels = await as(request(server()).get('/api/v1/channels')).expect(200);
    channelId = channels.body.find((c: { type: string }) => c.type === 'PHYSICAL').id;
  });

  afterAll(async () => {
    const ids = [biz];
    await prisma.outboxEvent.deleteMany({ where: { topic: 'order.placed' } });
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

  it('links an existing customer and snapshots its name', async () => {
    const cust = await as(request(server()).post('/api/v1/customers')).send({ name: 'Acme Ltd', email: 'buy@acme.test' }).expect(201);
    const res = await createOrder({ customerId: cust.body.id }).expect(201);
    expect(res.body.customerId).toBe(cust.body.id);
    expect(res.body.customerName).toBe('Acme Ltd');
  });

  it('creates and links a customer from contact when save is not false', async () => {
    const res = await createOrder({ name: 'Dina', phone: '+972500000001' }).expect(201);
    expect(res.body.customerId).toBeTruthy();
    expect(res.body.customerName).toBe('Dina');
    const found = await prisma.customer.findFirst({ where: { businessId: biz, phone: '+972500000001' } });
    expect(found).toBeTruthy();
  });

  it('keeps an ephemeral name without creating a customer (save:false)', async () => {
    const res = await createOrder({ name: 'Passer-by', save: false }).expect(201);
    expect(res.body.customerId).toBeNull();
    expect(res.body.customerName).toBe('Passer-by');
    const found = await prisma.customer.findFirst({ where: { businessId: biz, name: 'Passer-by' } });
    expect(found).toBeNull();
  });

  it('filters orders by customerId', async () => {
    const cust = await as(request(server()).post('/api/v1/customers')).send({ name: 'Repeat Buyer', email: 'repeat@acme.test' }).expect(201);
    await createOrder({ customerId: cust.body.id }).expect(201);
    await createOrder({ customerId: cust.body.id }).expect(201);
    const list = await as(request(server()).get(`/api/v1/orders?customerId=${cust.body.id}`)).expect(200);
    expect(list.body.total).toBe(2);
    expect(list.body.items.every((o: { customerName: string }) => o.customerName === 'Repeat Buyer')).toBe(true);
  });

  it('emits order.placed with the order + contact', async () => {
    const res = await createOrder({ name: 'Eventful', save: false }).expect(201);
    const ev = await prisma.outboxEvent.findFirst({ where: { topic: 'order.placed', payload: { path: ['orderId'], equals: res.body.id } } });
    expect(ev).toBeTruthy();
    expect((ev!.payload as { name: string }).name).toBe('Eventful');
  });
});
