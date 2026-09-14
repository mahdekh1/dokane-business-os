import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';

describe('Account / profile (Task 2.5.5, integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tag = `metest-${Date.now()}`;
  const email = `${tag}-user@example.com`;
  let token = '';

  const auth = (r: request.Test) => r.set('authorization', `Bearer ${token}`);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });
    await app.init();
    prisma = app.get(PrismaService);

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({ email, password: 'password123', firstName: 'Sam', lastName: 'Test' })
      .expect(201);
    token = res.body.accessToken as string;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: tag } } });
    await app.close();
  });

  it('returns the profile with defaults (language=en)', async () => {
    const res = await auth(request(app.getHttpServer()).get('/api/v1/me')).expect(200);
    expect(res.body.user.email).toBe(email);
    expect(res.body.user.language).toBe('en');
  });

  it('updates name, phone and language', async () => {
    const res = await auth(request(app.getHttpServer()).patch('/api/v1/me'))
      .send({ firstName: 'Samir', lastName: 'Test', phone: '+972 50 111 2222', language: 'ar' })
      .expect(200);
    expect(res.body.user.firstName).toBe('Samir');
    expect(res.body.user.phone).toBe('+972 50 111 2222');
    expect(res.body.user.language).toBe('ar');
  });

  it('rejects an invalid language', async () => {
    await auth(request(app.getHttpServer()).patch('/api/v1/me'))
      .send({ firstName: 'Samir', lastName: 'Test', language: 'fr' })
      .expect(400);
  });

  it('refuses a password change with the wrong current password', async () => {
    await auth(request(app.getHttpServer()).post('/api/v1/me/password'))
      .send({ currentPassword: 'wrong-one', newPassword: 'newpassword123' })
      .expect(401);
  });

  it('changes the password and lets the user log in with it', async () => {
    await auth(request(app.getHttpServer()).post('/api/v1/me/password'))
      .send({ currentPassword: 'password123', newPassword: 'brandnew456' })
      .expect(204);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'brandnew456' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'password123' })
      .expect(401);
  });
});
