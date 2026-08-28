import { Inject, Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { context, propagation, trace } from '@opentelemetry/api';

import { RabbitMqService } from './rabbitmq.service';
import {
  OUTBOX_REPOSITORY,
  type OutboxRepository,
} from '../order/repository/outbox.repository';

@Injectable()
export class OutboxPublisherService {
  private readonly logger = new Logger(OutboxPublisherService.name);
  private readonly tracer = trace.getTracer('outbox-publisher');

  constructor(
    @Inject(OUTBOX_REPOSITORY)
    private readonly outboxRepository: OutboxRepository,

    private readonly rabbitMqService: RabbitMqService,
  ) {}

  @Interval(1000)
  async publishPending() {
    const events = await this.outboxRepository.findPending();

    for (const event of events) {
      const claimed = await this.outboxRepository.claim(event.id);

      if (!claimed) {
        continue;
      }

      if (event.type !== 'ORDER_NOTIFICATION') {
        continue;
      }

      const parentContext = propagation.extract(
        context.active(),
        event.payload.traceContext,
      );

      await this.tracer.startActiveSpan(
        'outbox.publish',
        {},
        parentContext,
        async (span) => {
          try {
            await this.rabbitMqService.publishOrderNotification(
              event.payload.orderId,
              event.payload.requestId,
            );

            await this.outboxRepository.markAsSent(event.id);
          } finally {
            span.end();
          }
        },
      );
    }
  }

  @Interval(30000)
  async recoverStuckProcessing() {
    const recovered = await this.outboxRepository.recoverStuckProcessing();

    if (recovered > 0) {
      this.logger.log({
        event: 'outbox_stuck_recovered',
        recoveredCount: recovered,
      });
    }
  }
}
