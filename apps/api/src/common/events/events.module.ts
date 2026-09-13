import { Global, Module } from '@nestjs/common';
import { EventBus } from './event-bus.service';
import { DomainEvents } from './domain-events.service';
import { OutboxRelay } from './outbox-relay.service';

@Global()
@Module({
  providers: [EventBus, DomainEvents, OutboxRelay],
  exports: [EventBus, DomainEvents, OutboxRelay],
})
export class EventsModule {}
