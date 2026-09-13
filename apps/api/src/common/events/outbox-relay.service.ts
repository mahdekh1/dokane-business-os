import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainEvents } from './domain-events.service';

/**
 * Polls the outbox and dispatches committed events to in-process subscribers,
 * marking each processed (exactly-once for successful handlers; a failed handler
 * leaves the row for the next pass, so handlers must be idempotent).
 *
 * In production this runs on an interval (and later moves to apps/worker). It is
 * disabled under tests (NODE_ENV=test) so specs drive `processPending` directly.
 */
@Injectable()
export class OutboxRelay implements OnModuleInit {
  private readonly logger = new Logger(OutboxRelay.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEvents,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV !== 'test' && process.env.OUTBOX_POLLER !== 'off') {
      this.timer = setInterval(() => void this.processPending(), 1000);
      this.timer.unref();
    }
  }

  async processPending(limit = 100): Promise<number> {
    const rows = await this.prisma.outboxEvent.findMany({
      where: { processedAt: null },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    let processed = 0;
    for (const row of rows) {
      try {
        await this.events.dispatch(row.topic, row.payload);
        await this.prisma.outboxEvent.update({
          where: { id: row.id },
          data: { processedAt: new Date() },
        });
        processed += 1;
      } catch (err) {
        this.logger.error(
          `Failed to dispatch outbox ${row.topic} (${row.id}): ${(err as Error).message}`,
        );
      }
    }
    return processed;
  }
}
