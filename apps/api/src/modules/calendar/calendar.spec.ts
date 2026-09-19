import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { EntitlementService } from '../registry/entitlement.service';

describe('Calendar (Task 5.4, integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tag = `caltest-${Date.now()}`;
  let tokenA = '';
  let tokenB = '';
  let bizA = '';
  let bizB = '';
  let apptId = '';

  async function signup(email: string): Promise<{ token: string; userId: string }> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({ email, password: 'password123', firstName: 'T', lastName: 'U' })
      .expect(201);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    return { token: res.body.accessToken as string, userId: user.id };
  }
  const asBiz = (r: request.Test, token: string, biz: string) => r.set('authorization', `Bearer ${token}`).set('x-business-id', biz);
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
    await prisma.businessMembership.create({ data: { businessId: bizA, userId: a.userId, roleId: owner.id } });
    await prisma.businessMembership.create({ data: { businessId: bizB, userId: b.userId, roleId: owner.id } });
    await entitlements.assignPlan(bizA, 'GROWTH');
    await entitlements.assignPlan(bizB, 'GROWTH');
  });

  afterAll(async () => {
    const ids = [bizA, bizB];
    await prisma.outboxEvent.deleteMany({ where: { topic: 'calendar.appointment.changed' } });
    await prisma.appointment.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.calendarConnection.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.subscription.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.businessMembership.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.business.deleteMany({ where: { id: { in: ids } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: tag } } });
    await app.close();
  });

  it('creates an appointment and emits calendar.appointment.changed', async () => {
    const res = await asBiz(request(server()).post('/api/v1/calendar/appointments'), tokenA, bizA)
      .send({ title: 'Consultation', startsAt: iso(24), endsAt: iso(25) })
      .expect(201);
    expect(res.body.status).toBe('SCHEDULED');
    apptId = res.body.id;
    const ev = await prisma.outboxEvent.findFirst({ where: { topic: 'calendar.appointment.changed', payload: { path: ['appointmentId'], equals: apptId } } });
    expect(ev).toBeTruthy();
  });

  it('rejects an end that is not after the start', async () => {
    const res = await asBiz(request(server()).post('/api/v1/calendar/appointments'), tokenA, bizA)
      .send({ title: 'Bad', startsAt: iso(10), endsAt: iso(9) })
      .expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('filters appointments by date range', async () => {
    const list = await asBiz(request(server()).get(`/api/v1/calendar/appointments?from=${iso(0)}&to=${iso(48)}`), tokenA, bizA).expect(200);
    expect(list.body.items.some((x: { id: string }) => x.id === apptId)).toBe(true);
  });

  it('does not leak another business appointment (tenant isolation)', async () => {
    await asBiz(request(server()).get(`/api/v1/calendar/appointments/${apptId}`), tokenB, bizB).expect(404);
  });

  it('reports both providers as not configured and refuses to connect', async () => {
    const conns = await asBiz(request(server()).get('/api/v1/calendar/connections'), tokenA, bizA).expect(200);
    expect(conns.body).toHaveLength(2);
    expect(conns.body.every((c: { configured: boolean; status: string }) => c.configured === false && c.status === 'DISCONNECTED')).toBe(true);
    const res = await asBiz(request(server()).post('/api/v1/calendar/connections/GOOGLE/connect'), tokenA, bizA).expect(400);
    expect(res.body.code).toBe('NOT_CONFIGURED');
  });
});
