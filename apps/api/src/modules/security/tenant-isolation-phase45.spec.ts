import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { EntitlementService } from '../registry/entitlement.service';

/**
 * Cross-tenant isolation for the Phase 4-5 modules (SECURITY.md §1, §8;
 * ARCHITECTURE_REVIEW §2.4). Business B must never read or mutate Business A's
 * orders, payments, leads, projects/tasks or appointments.
 */
describe('Tenant isolation — Orders/CRM/PM/Calendar (Phase 4-5)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tag = `iso45-${Date.now()}`;
  let tokenA = '';
  let tokenB = '';
  let bizA = '';
  let bizB = '';
  let memberA = '';
  let memberB = '';
  const A = { orderId: '', leadId: '', projectId: '', taskId: '', apptId: '' };

  async function signup(email: string): Promise<{ token: string; userId: string }> {
    const res = await request(app.getHttpServer()).post('/api/v1/auth/signup')
      .send({ email, password: 'password123', firstName: 'T', lastName: 'U' }).expect(201);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    return { token: res.body.accessToken as string, userId: user.id };
  }
  const asB = (r: request.Test, token: string, biz: string) => r.set('authorization', `Bearer ${token}`).set('x-business-id', biz);
  const server = () => app.getHttpServer();
  const iso = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });
    await app.init();
    prisma = app.get(PrismaService);
    const entitlements = app.get(EntitlementService);
    const a = await signup(`${tag}-a@example.com`);
    const b = await signup(`${tag}-b@example.com`);
    tokenA = a.token; tokenB = b.token;
    const owner = await prisma.role.findFirstOrThrow({ where: { name: 'OWNER', businessId: null, isSystem: true } });
    const mk = async (slug: string) => (await prisma.business.create({ data: { name: slug, slug, status: 'APPROVED' } })).id;
    bizA = await mk(`${tag}-a`); bizB = await mk(`${tag}-b`);
    memberA = (await prisma.businessMembership.create({ data: { businessId: bizA, userId: a.userId, roleId: owner.id } })).id;
    memberB = (await prisma.businessMembership.create({ data: { businessId: bizB, userId: b.userId, roleId: owner.id } })).id;
    await entitlements.assignPlan(bizA, 'BUSINESS');
    await entitlements.assignPlan(bizB, 'BUSINESS');

    // Seed resources owned by A.
    const off = await asB(request(server()).post('/api/v1/catalog/offerings'), tokenA, bizA).send({ type: 'physical', name: 'A-widget', price: 1000 }).expect(201);
    const order = await asB(request(server()).post('/api/v1/orders'), tokenA, bizA)
      .send({ items: [{ offeringId: off.body.id, quantity: 1 }], fulfillmentStatus: 'CONFIRMED', customer: { name: 'A Customer' } }).expect(201);
    A.orderId = order.body.id;
    A.leadId = (await asB(request(server()).post('/api/v1/crm/leads'), tokenA, bizA).send({ name: 'A Lead', email: 'a-lead@x.test' }).expect(201)).body.id;
    A.projectId = (await asB(request(server()).post('/api/v1/pm/projects'), tokenA, bizA).send({ name: 'A Project' }).expect(201)).body.id;
    A.taskId = (await asB(request(server()).post('/api/v1/pm/tasks'), tokenA, bizA).send({ projectId: A.projectId, title: 'A Task' }).expect(201)).body.id;
    A.apptId = (await asB(request(server()).post('/api/v1/calendar/appointments'), tokenA, bizA).send({ title: 'A Appt', startsAt: iso(24), endsAt: iso(25) }).expect(201)).body.id;
  });

  afterAll(async () => {
    const ids = [bizA, bizB];
    await prisma.outboxEvent.deleteMany({ where: { OR: [{ topic: 'order.placed' }, { topic: 'pm.task.assigned' }, { topic: 'calendar.appointment.changed' }] } });
    await prisma.appointment.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.task.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.project.deleteMany({ where: { businessId: { in: ids } } });
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

  it('B cannot read or mutate A’s order', async () => {
    await asB(request(server()).get(`/api/v1/orders/${A.orderId}`), tokenB, bizB).expect(404);
    await asB(request(server()).post(`/api/v1/orders/${A.orderId}/transitions`), tokenB, bizB).send({ fulfillmentStatus: 'COMPLETED' }).expect(404);
    await asB(request(server()).post(`/api/v1/orders/${A.orderId}/payments`), tokenB, bizB).send({ amount: 100, method: 'CASH' }).expect(404);
  });

  it('B’s order list does not include A’s order', async () => {
    const list = await asB(request(server()).get('/api/v1/orders'), tokenB, bizB).expect(200);
    expect(list.body.items.some((o: { id: string }) => o.id === A.orderId)).toBe(false);
  });

  it('B cannot read or convert A’s lead', async () => {
    await asB(request(server()).get(`/api/v1/crm/leads/${A.leadId}`), tokenB, bizB).expect(404);
    await asB(request(server()).post(`/api/v1/crm/leads/${A.leadId}/convert`), tokenB, bizB).expect(404);
  });

  it('B cannot read A’s project or mutate A’s task', async () => {
    await asB(request(server()).get(`/api/v1/pm/projects/${A.projectId}`), tokenB, bizB).expect(404);
    await asB(request(server()).patch(`/api/v1/pm/tasks/${A.taskId}`), tokenB, bizB).send({ status: 'IN_PROGRESS' }).expect(404);
  });

  it('B cannot assign B’s task to A’s membership (cross-tenant assignee)', async () => {
    const bProject = (await asB(request(server()).post('/api/v1/pm/projects'), tokenB, bizB).send({ name: 'B Project' }).expect(201)).body;
    const res = await asB(request(server()).post('/api/v1/pm/tasks'), tokenB, bizB).send({ projectId: bProject.id, title: 'B Task', assigneeId: memberA }).expect(400);
    expect(res.body.code).toBe('INVALID_ASSIGNEE');
    expect(memberB).toBeTruthy();
  });

  it('B cannot read A’s appointment', async () => {
    await asB(request(server()).get(`/api/v1/calendar/appointments/${A.apptId}`), tokenB, bizB).expect(404);
  });
});
