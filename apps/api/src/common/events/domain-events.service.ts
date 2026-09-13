import { Injectable } from '@nestjs/common';

export type EventHandler = (payload: unknown) => Promise<void> | void;

/**
 * In-process subscriber registry. Modules register handlers for the topics they
 * consume; the outbox relay dispatches committed events to them. Handlers must
 * be idempotent (a failed handler is retried on the next relay pass).
 */
@Injectable()
export class DomainEvents {
  private readonly handlers = new Map<string, EventHandler[]>();

  on(topic: string, handler: EventHandler): void {
    const list = this.handlers.get(topic) ?? [];
    list.push(handler);
    this.handlers.set(topic, list);
  }

  async dispatch(topic: string, payload: unknown): Promise<void> {
    for (const handler of this.handlers.get(topic) ?? []) {
      await handler(payload);
    }
  }
}
