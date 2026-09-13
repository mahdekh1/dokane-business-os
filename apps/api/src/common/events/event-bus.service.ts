import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

/**
 * Emits domain events via the transactional outbox. `emit` MUST be called with
 * the Prisma transaction client of the business write it accompanies, so the
 * event is persisted iff the write commits (see docs/ARCHITECTURE.md §3.3).
 */
@Injectable()
export class EventBus {
  async emit(
    tx: Prisma.TransactionClient,
    topic: string,
    payload: Prisma.InputJsonValue,
  ): Promise<void> {
    await tx.outboxEvent.create({ data: { topic, payload } });
  }
}
