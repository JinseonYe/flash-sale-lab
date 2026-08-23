import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { RabbitMqService } from './rabbitmq.service';
import { RedisModule } from '../redis/redis.module';
import { OrderNotificationConsumer } from './order-notification.consumer';
import { OutboxPublisherService } from './outbox-publisher.service';
import { OUTBOX_REPOSITORY } from '../order/repository/outbox.repository';
import { PrismaOutboxRepository } from '../order/repository/prisma-outbox.repository';

@Module({
  imports: [RedisModule, ScheduleModule.forRoot()],
  providers: [
    RabbitMqService,
    OrderNotificationConsumer,
    OutboxPublisherService,
    {
      provide: OUTBOX_REPOSITORY,
      useClass: PrismaOutboxRepository,
    },
  ],
  exports: [RabbitMqService],
})
export class MessagingModule {}
