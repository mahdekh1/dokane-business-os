import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { EntitlementService } from '../registry/entitlement.service';

describe('Project Management (Task 5.2, integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tag = `pmtest-${Date.now()}`;
  let token = '';
  let biz = '';
  let ownerMembershipId = '';
  let projectId = '';

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
    const entitlements = app.get(EntitlementService);
    const a = await signup(`${tag}-a@example.com`);
    token = a.token;
    const owner = await prisma.role.findFirstOrThrow({ where: { name: 'OWNER', businessId: null, isSystem: true } });
    biz = (await prisma.business.create({ data: { name: tag, slug: tag, status: 'APPROVED' } })).id;
    const membership = await prisma.businessMembership.create({ data: { businessId: biz, userId: a.userId, roleId: owner.id } });
    ownerMembershipId = membership.id;
    await entitlements.assignPlan(biz, 'BUSINESS'); // PM is a Business-tier entitlement
    const project = await as(request(server()).post('/api/v1/pm/projects')).send({ name: 'Website revamp' }).expect(201);
    projectId = project.body.id;
  });

  afterAll(async () => {
    const ids = [biz];
    await prisma.outboxEvent.deleteMany({ where: { OR: [{ topic: 'pm.task.assigned' }, { topic: 'pm.task.completed' }] } });
    await prisma.task.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.project.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.subscription.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.businessMembership.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.business.deleteMany({ where: { id: { in: ids } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: tag } } });
    await app.close();
  });

  it('creates a project in PLANNING', async () => {
    const p = await as(request(server()).get(`/api/v1/pm/projects/${projectId}`)).expect(200);
    expect(p.body.status).toBe('PLANNING');
  });

  it('rejects an illegal project transition (PLANNING → COMPLETED)', async () => {
    const res = await as(request(server()).patch(`/api/v1/pm/projects/${projectId}`)).send({ status: 'COMPLETED' }).expect(400);
    expect(res.body.code).toBe('ILLEGAL_TRANSITION');
    await as(request(server()).patch(`/api/v1/pm/projects/${projectId}`)).send({ status: 'ACTIVE' }).expect(200); // legal
  });

  it('creates a task assigned to a member and emits pm.task.assigned', async () => {
    const res = await as(request(server()).post('/api/v1/pm/tasks'))
      .send({ projectId, title: 'Design homepage', priority: 'HIGH', assigneeId: ownerMembershipId })
      .expect(201);
    expect(res.body.assigneeId).toBe(ownerMembershipId);
    expect(res.body.assigneeName).toBeTruthy();
    const ev = await prisma.outboxEvent.findFirst({ where: { topic: 'pm.task.assigned', payload: { path: ['taskId'], equals: res.body.id } } });
    expect(ev).toBeTruthy();
  });

  it('rejects an assignee who is not a member of the business', async () => {
    const res = await as(request(server()).post('/api/v1/pm/tasks'))
      .send({ projectId, title: 'Ghost task', assigneeId: '00000000-0000-0000-0000-000000000000' })
      .expect(400);
    expect(res.body.code).toBe('INVALID_ASSIGNEE');
  });

  it('rejects an illegal task transition and allows the flow to DONE (emits completed)', async () => {
    const t = (await as(request(server()).post('/api/v1/pm/tasks')).send({ projectId, title: 'Ship it' }).expect(201)).body;
    const bad = await as(request(server()).patch(`/api/v1/pm/tasks/${t.id}`)).send({ status: 'DONE' }).expect(400);
    expect(bad.body.code).toBe('ILLEGAL_TRANSITION'); // TODO → DONE skips the flow
    await as(request(server()).patch(`/api/v1/pm/tasks/${t.id}`)).send({ status: 'IN_PROGRESS' }).expect(200);
    await as(request(server()).patch(`/api/v1/pm/tasks/${t.id}`)).send({ status: 'IN_REVIEW' }).expect(200);
    const done = await as(request(server()).patch(`/api/v1/pm/tasks/${t.id}`)).send({ status: 'DONE' }).expect(200);
    expect(done.body.status).toBe('DONE');
    const ev = await prisma.outboxEvent.findFirst({ where: { topic: 'pm.task.completed', payload: { path: ['taskId'], equals: t.id } } });
    expect(ev).toBeTruthy();
  });

  it('counts open vs total tasks on the project', async () => {
    const p = await as(request(server()).get(`/api/v1/pm/projects/${projectId}`)).expect(200);
    expect(p.body.taskCount).toBeGreaterThanOrEqual(2);
    expect(p.body.openTaskCount).toBeLessThan(p.body.taskCount); // one task is DONE
  });
});
