import { Inject, Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';

import { RabbitMqService } from './rabbitmq.service';
import {
  OUTBOX_REPOSITORY,
  type OutboxRepository,
} from '../order/repository/outbox.repository';

@Injectable()
export class OutboxPublisherService {
  private readonly logger = new Logger(OutboxPublisherService.name);

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

      this.logger.log({
        event: 'outbox_publish_started',
        requestId: event.payload.requestId,
        serverPort: process.env.PORT ?? 3000,
        outboxId: event.id,
        orderId: event.payload.orderId,
      });

      await this.rabbitMqService.publishOrderNotification(
        event.payload.orderId,
        event.payload.requestId,
      );

      this.logger.log({
        event: 'outbox_publish_succeeded',
        requestId: event.payload.requestId,
        serverPort: process.env.PORT ?? 3000,
        outboxId: event.id,
        orderId: event.payload.orderId,
      });

      await this.outboxRepository.markAsSent(event.id);
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
