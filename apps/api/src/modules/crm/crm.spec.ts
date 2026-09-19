import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { EntitlementService } from '../registry/entitlement.service';
import { OutboxRelay } from '../../common/events/outbox-relay.service';

describe('CRM (Task 5.1, integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let relay: OutboxRelay;
  const tag = `crmtest-${Date.now()}`;
  let token = '';
  let biz = '';
  let offeringId = '';
  let onlineChannelId = '';

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
    const off = await as(request(server()).post('/api/v1/catalog/offerings')).send({ type: 'physical', name: 'Widget', price: 1000 }).expect(201);
    offeringId = off.body.id;
    const channels = await as(request(server()).get('/api/v1/channels')).expect(200);
    onlineChannelId = channels.body.find((c: { type: string }) => c.type === 'ONLINE_STORE').id;
  });

  afterAll(async () => {
    const ids = [biz];
    await prisma.outboxEvent.deleteMany({ where: { topic: 'order.placed' } });
    await prisma.lead.deleteMany({ where: { businessId: { in: ids } } });
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

  it('an online order registers exactly one linked customer (source ONLINE)', async () => {
    const email = `shopper-${Date.now()}@buyer.test`;
    await as(request(server()).post('/api/v1/orders'))
      .send({ channelId: onlineChannelId, items: [{ offeringId, quantity: 1 }], customer: { name: 'Web Shopper', email } })
      .expect(201);
    await relay.processPending();
    await relay.processPending(); // idempotent — must not create a second customer
    const customers = await prisma.customer.findMany({ where: { businessId: biz, email } });
    expect(customers).toHaveLength(1);
    expect(customers[0].source).toBe('ONLINE');
  });

  it('converts a lead into a linked customer', async () => {
    const lead = (await as(request(server()).post('/api/v1/crm/leads'))
      .send({ name: 'Prospect Co', email: 'prospect@corp.test', source: 'referral', value: 250000 })
      .expect(201)).body;
    expect(lead.stage).toBe('NEW');
    const converted = (await as(request(server()).post(`/api/v1/crm/leads/${lead.id}/convert`)).expect(201)).body;
    expect(converted.stage).toBe('CONVERTED');
    expect(converted.customerId).toBeTruthy();
    const customer = await prisma.customer.findFirst({ where: { businessId: biz, email: 'prospect@corp.test' } });
    expect(customer?.id).toBe(converted.customerId);
  });

  it('lists and filters leads by stage', async () => {
    await as(request(server()).post('/api/v1/crm/leads')).send({ name: 'Cold One', stage: 'NEW' }).expect(201);
    const list = await as(request(server()).get('/api/v1/crm/leads?stage=NEW')).expect(200);
    expect(list.body.items.every((l: { stage: string }) => l.stage === 'NEW')).toBe(true);
    expect(list.body.total).toBeGreaterThanOrEqual(1);
  });
});
