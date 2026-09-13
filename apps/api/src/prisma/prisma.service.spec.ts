import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  const prisma = new PrismaService();

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('connects to the test database and queries a core table', async () => {
    const count = await prisma.user.count();
    expect(typeof count).toBe('number');
  });
});
