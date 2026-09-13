import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  const prisma = new PrismaService();
  const audit = new AuditService(prisma);

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { action: 'TEST_ACTION' } });
    await prisma.$disconnect();
  });

  it('writes a record and redacts secret-like metadata keys', async () => {
    await audit.record({
      actorType: 'USER',
      action: 'TEST_ACTION',
      entityType: 'thing',
      entityId: 'x',
      metadata: { note: 'ok', password: 'sekret', token: 'abc' },
    });

    const row = await prisma.auditLog.findFirst({
      where: { action: 'TEST_ACTION' },
      orderBy: { createdAt: 'desc' },
    });
    expect(row).toBeTruthy();
    const meta = row?.metadata as Record<string, unknown>;
    expect(meta.note).toBe('ok');
    expect(meta.password).toBe('[REDACTED]');
    expect(meta.token).toBe('[REDACTED]');
  });

  it('is append-only (no update/delete on the service)', () => {
    const api = audit as unknown as Record<string, unknown>;
    expect(api.update).toBeUndefined();
    expect(api.delete).toBeUndefined();
  });
});
