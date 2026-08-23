import { Inject, Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';

import { RabbitMqService } from './rabbitmq.service';
import {
  OUTBOX_REPOSITORY,
  type OutboxRepository,
} from '../order/repository/outbox.repository';

@Injectable()
export class OutboxPublisherService {
  constructor(
    @Inject(OUTBOX_REPOSITORY)
    private readonly outboxRepository: OutboxRepository,

    private readonly rabbitMqService: RabbitMqService,
  ) {}

  @Interval(1000)
  async publishPending() {
    const events = await this.outboxRepository.findPending();

    for (const event of events) {
      if (event.type !== 'ORDER_NOTIFICATION') {
        continue;
      }

      await this.rabbitMqService.publishOrderNotification(
        event.payload.orderId,
      );

      await this.outboxRepository.markAsSent(event.id);
    }
  }
}
