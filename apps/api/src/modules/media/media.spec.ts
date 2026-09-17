import { promises as fs } from 'fs';
import * as path from 'path';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { EntitlementService } from '../registry/entitlement.service';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

describe('Media (Task 3.4, integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tag = `medtest-${Date.now()}`;
  let tokenA = '';
  let tokenB = '';
  let bizA = '';
  let bizB = '';
  let offeringId = '';
  let storedKey = '';

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
  const uploadUrl = (id: string) => `/api/v1/catalog/offerings/${id}/media`;

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

    const off = await asBiz(request(server()).post('/api/v1/catalog/offerings'), tokenA, bizA)
      .send({ type: 'physical', name: 'Widget', price: 1000 })
      .expect(201);
    offeringId = off.body.id;
  });

  afterAll(async () => {
    const ids = (await prisma.business.findMany({ where: { slug: { startsWith: tag } }, select: { id: true } })).map((x) => x.id);
    await prisma.offering.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.subscription.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.businessMembership.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.business.deleteMany({ where: { id: { in: ids } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: tag } } });
    const root = process.env.STORAGE_LOCAL_DIR ?? path.join(process.cwd(), 'storage');
    for (const id of ids) await fs.rm(path.join(root, id), { recursive: true, force: true });
    await app.close();
  });

  it('uploads an image, server-keyed under the tenant path (filename ignored)', async () => {
    const res = await asBiz(request(server()).post(uploadUrl(offeringId)), tokenA, bizA)
      .attach('file', PNG, { filename: 'my-secret-name.png', contentType: 'image/png' })
      .expect(201);
    expect(res.body.media.length).toBe(1);
    const url = res.body.media[0].url as string;
    expect(url.startsWith('/api/v1/public/media/')).toBe(true);
    storedKey = url.replace('/api/v1/public/media/', '');
    expect(storedKey).not.toContain('my-secret-name');
    expect(storedKey.startsWith(`${bizA}/`)).toBe(true);
  });

  it('rejects a non-image upload', async () => {
    const res = await asBiz(request(server()).post(uploadUrl(offeringId)), tokenA, bizA)
      .attach('file', Buffer.from('not an image'), { filename: 'x.txt', contentType: 'text/plain' })
      .expect(400);
    expect(res.body.code).toBe('INVALID_FILE_TYPE');
  });

  it('serves the uploaded image publicly', async () => {
    const res = await request(server()).get(`/api/v1/public/media/${storedKey}`).expect(200);
    expect(res.headers['content-type']).toContain('image/png');
  });

  it('does not serve a traversal / unknown key', async () => {
    await request(server()).get('/api/v1/public/media/nope/missing.png').expect(404);
  });

  it('cannot upload to another business offering (tenant isolation)', async () => {
    await asBiz(request(server()).post(uploadUrl(offeringId)), tokenB, bizB)
      .attach('file', PNG, { filename: 'a.png', contentType: 'image/png' })
      .expect(404);
  });
});
