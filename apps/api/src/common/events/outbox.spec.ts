import { PrismaService } from '../../prisma/prisma.service';
import { EventBus } from './event-bus.service';
import { DomainEvents } from './domain-events.service';
import { OutboxRelay } from './outbox-relay.service';

describe('Transactional outbox (Task 1.6)', () => {
  const prisma = new PrismaService();
  const events = new DomainEvents();
  const relay = new OutboxRelay(prisma, events);
  const bus = new EventBus();
  const received: unknown[] = [];
  const topic = `test.evt.${Date.now()}`;

  beforeAll(async () => {
    await prisma.$connect();
    events.on(topic, (payload) => {
      received.push(payload);
    });
  });

  afterAll(async () => {
    await prisma.outboxEvent.deleteMany({ where: { topic } });
    await prisma.$disconnect();
  });

  it('delivers nothing from a rolled-back transaction', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await bus.emit(tx, topic, { x: 1 });
        throw new Error('rollback');
      }),
    ).rejects.toThrow();

    await relay.processPending();
    expect(received.filter((p) => (p as { x: number }).x === 1)).toHaveLength(0);
  });

  it('delivers exactly once from a committed transaction', async () => {
    await prisma.$transaction(async (tx) => {
      await bus.emit(tx, topic, { x: 2 });
    });

    const first = await relay.processPending();
    const second = await relay.processPending();

    expect(received).toContainEqual({ x: 2 });
    expect(received.filter((p) => (p as { x: number }).x === 2)).toHaveLength(1);
    expect(first).toBeGreaterThanOrEqual(1);
    expect(second).toBe(0);
  });
});
