import { PrismaService } from '../../prisma/prisma.service';
import type { TenantContext } from '../../common/tenant-context';
import { AuditService } from '../audit/audit.service';
import { EntitlementService } from './entitlement.service';
import { RegistryService } from './registry.service';

describe('Registry + entitlements (Task 1.5)', () => {
  const prisma = new PrismaService();
  const entitlements = new EntitlementService(prisma);
  const registry = new RegistryService(prisma, entitlements, new AuditService(prisma));
  const tag = `regtest_${Date.now()}`;
  let businessId = '';

  const ctx = (): TenantContext => ({
    userId: '00000000-0000-0000-0000-000000000000',
    businessId,
    membershipId: '',
    roleId: '',
    businessStatus: 'APPROVED',
    permissions: new Set<string>(),
  });

  beforeAll(async () => {
    await prisma.$connect();
    await entitlements.ensureSystem();
    const b = await prisma.business.create({
      data: { name: tag, slug: tag, status: 'APPROVED' },
    });
    businessId = b.id;
  });

  afterAll(async () => {
    await prisma.moduleState.deleteMany({ where: { businessId } });
    await prisma.subscription.deleteMany({ where: { businessId } });
    await prisma.auditLog.deleteMany({ where: { businessId } });
    await prisma.business.deleteMany({ where: { slug: { startsWith: tag } } });
    await prisma.$disconnect();
  });

  it('locks every module when the business has no subscription', async () => {
    const list = await registry.listForTenant(ctx());
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((m) => m.state === 'locked')).toBe(true);
  });

  it('STARTER unlocks catalog (available) but not inventory (locked)', async () => {
    await entitlements.assignPlan(businessId, 'STARTER');
    const list = await registry.listForTenant(ctx());
    expect(list.find((m) => m.id === 'catalog')?.state).toBe('available');
    expect(list.find((m) => m.id === 'inventory')?.state).toBe('locked');
  });

  it('refuses to enable a module the plan does not include', async () => {
    await expect(registry.enable(ctx(), 'inventory')).rejects.toThrow();
  });

  it('enables an entitled module and marks it active', async () => {
    const view = await registry.enable(ctx(), 'catalog');
    expect(view.state).toBe('active');
    const list = await registry.listForTenant(ctx());
    expect(list.find((m) => m.id === 'catalog')?.state).toBe('active');
  });

  it('enforces dependencies: online_store needs channels enabled first', async () => {
    await entitlements.assignPlan(businessId, 'GROWTH'); // includes online_store + deps
    // catalog is enabled; channels is not → dependency error
    await expect(registry.enable(ctx(), 'online_store')).rejects.toThrow();
    await registry.enable(ctx(), 'channels');
    const view = await registry.enable(ctx(), 'online_store');
    expect(view.state).toBe('active');
  });

  it('writes a MODULE_ENABLED audit record', async () => {
    const row = await prisma.auditLog.findFirst({
      where: { businessId, action: 'MODULE_ENABLED' },
    });
    expect(row).toBeTruthy();
  });

  it('marks modules suggested for the business category (Task 2.5.3)', async () => {
    // Pharmacy suggests notifications, not crm (both available on GROWTH).
    await prisma.business.update({ where: { id: businessId }, data: { businessType: 'pharmacy' } });
    const list = await registry.listForTenant(ctx());
    expect(list.find((m) => m.id === 'notifications')?.suggested).toBe(true);
    expect(list.find((m) => m.id === 'crm')?.suggested).toBe(false);
  });
});
