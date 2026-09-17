import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import type { TenantContext } from '../../common/tenant-context';
import { CustomersService } from './customers.service';

describe('Customers (Task 3.6, integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let service: CustomersService;
  const tag = `custtest-${Date.now()}`;
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
  const ctxFor = (biz: string): TenantContext => ({
    userId: '00000000-0000-0000-0000-000000000000',
    businessId: biz,
    membershipId: '',
    roleId: '',
    businessStatus: 'APPROVED',
    permissions: new Set<string>(),
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });
    await app.init();
    prisma = app.get(PrismaService);
    service = app.get(CustomersService);

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
  });

  afterAll(async () => {
    const ids = (await prisma.business.findMany({ where: { slug: { startsWith: tag } }, select: { id: true } })).map((x) => x.id);
    await prisma.customer.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.businessMembership.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.business.deleteMany({ where: { id: { in: ids } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: tag } } });
    await app.close();
  });

  let customerId = '';
  it('creates a customer (core — no plan/entitlement needed)', async () => {
    const res = await asBiz(request(server()).post('/api/v1/customers'), tokenA, bizA)
      .send({ name: 'Lina Khoury', email: 'lina@example.com', phone: '+972 50 111 2222' })
      .expect(201);
    expect(res.body.source).toBe('MANUAL');
    customerId = res.body.id;
  });

  it('lists and searches customers', async () => {
    const res = await asBiz(request(server()).get('/api/v1/customers?q=lina'), tokenA, bizA).expect(200);
    expect(res.body.items.some((c: { id: string }) => c.id === customerId)).toBe(true);
  });

  it('updates a customer', async () => {
    const res = await asBiz(request(server()).patch(`/api/v1/customers/${customerId}`), tokenA, bizA)
      .send({ address: '5 Paul VI St, Nazareth' })
      .expect(200);
    expect(res.body.address).toBe('5 Paul VI St, Nazareth');
  });

  it('does not leak another business customer (tenant isolation)', async () => {
    await asBiz(request(server()).get(`/api/v1/customers/${customerId}`), tokenB, bizB).expect(404);
  });

  it('getOrCreateByContact dedupes by email within the tenant', async () => {
    const first = await service.getOrCreateByContact(ctxFor(bizA), { email: 'lina@example.com', name: 'Lina K' });
    expect(first.id).toBe(customerId); // matched the existing customer
    const created = await service.getOrCreateByContact(ctxFor(bizA), { phone: '+972 50 999 0000', name: 'Walk-in', source: 'ONLINE' });
    expect(created.id).not.toBe(customerId);
    expect(created.source).toBe('ONLINE');
  });
});
