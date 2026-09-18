import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { EntitlementService } from '../registry/entitlement.service';

describe('Sales channels (Task 4.1, integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tag = `chtest-${Date.now()}`;
  let tokenA = '';
  let tokenB = '';
  let bizA = '';
  let bizB = '';

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
  const listChannels = (token: string, biz: string) =>
    asBiz(request(server()).get('/api/v1/channels'), token, biz);

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
  });

  afterAll(async () => {
    const ids = (await prisma.business.findMany({ where: { slug: { startsWith: tag } }, select: { id: true } })).map((x) => x.id);
    await prisma.salesChannel.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.location.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.subscription.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.businessMembership.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.business.deleteMany({ where: { id: { in: ids } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: tag } } });
    await app.close();
  });

  it('auto-provisions an online-store + physical channel, online has a fulfillment location', async () => {
    const res = await listChannels(tokenA, bizA).expect(200);
    const online = res.body.find((c: { type: string }) => c.type === 'ONLINE_STORE');
    const physical = res.body.find((c: { type: string }) => c.type === 'PHYSICAL');
    expect(online).toBeTruthy();
    expect(online.fulfillmentLocationId).toBeTruthy();
    expect(online.isDefault).toBe(true);
    expect(physical).toBeTruthy();
    expect(physical.locationId).toBeTruthy();
  });

  it('is idempotent — listing twice does not duplicate defaults', async () => {
    await listChannels(tokenA, bizA).expect(200);
    const res = await listChannels(tokenA, bizA).expect(200);
    expect(res.body.filter((c: { type: string }) => c.type === 'ONLINE_STORE')).toHaveLength(1);
  });

  it('rejects an ONLINE_STORE channel without a fulfillment location', async () => {
    const res = await asBiz(request(server()).post('/api/v1/channels'), tokenA, bizA)
      .send({ type: 'ONLINE_STORE', name: 'Second store' })
      .expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('creates a MARKETPLACE channel owned by the tenant', async () => {
    const res = await asBiz(request(server()).post('/api/v1/channels'), tokenA, bizA)
      .send({ type: 'MARKETPLACE', name: 'Dokane Market' })
      .expect(201);
    expect(res.body.type).toBe('MARKETPLACE');
    expect(res.body.isDefault).toBe(false);
  });

  it('refuses to clear the fulfillment location of an online store', async () => {
    const list = await listChannels(tokenA, bizA).expect(200);
    const online = list.body.find((c: { type: string }) => c.type === 'ONLINE_STORE');
    const res = await asBiz(request(server()).patch(`/api/v1/channels/${online.id}`), tokenA, bizA)
      .send({ fulfillmentLocationId: null })
      .expect(400);
    expect(res.body.code).toBe('FULFILLMENT_REQUIRED');
  });

  it('does not let another business update this tenant’s channel', async () => {
    const list = await listChannels(tokenA, bizA).expect(200);
    const chan = list.body[0];
    await asBiz(request(server()).patch(`/api/v1/channels/${chan.id}`), tokenB, bizB)
      .send({ name: 'Hijacked' })
      .expect(404);
  });
});
