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
      const claimed = await this.outboxRepository.claim(event.id);

      if (!claimed) {
        continue;
      }

      if (event.type !== 'ORDER_NOTIFICATION') {
        continue;
      }

      console.log(
        `[${process.env.PORT ?? 3000}] publish 시도: outbox=${event.id}, order=${event.payload.orderId}`,
      );

      await this.rabbitMqService.publishOrderNotification(
        event.payload.orderId,
      );

      console.log(
        `[${process.env.PORT ?? 3000}] publish 성공: outbox=${event.id}, order=${event.payload.orderId}`,
      );

      await this.outboxRepository.markAsSent(event.id);
    }
  }

  @Interval(30000)
  async recoverStuckProcessing() {
    const recovered = await this.outboxRepository.recoverStuckProcessing();

    if (recovered > 0) {
      console.log(`stuck outbox 복구: ${recovered}건`);
    }
  }
}
