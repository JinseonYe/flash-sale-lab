import { Module } from '@nestjs/common';
import { RabbitMqService } from './rabbitmq.service';
import { RedisModule } from '../redis/redis.module';
import { OrderNotificationConsumer } from './order-notification.consumer';

@Module({
  imports: [RedisModule],
  providers: [RabbitMqService, OrderNotificationConsumer],
  exports: [RabbitMqService],
})
export class MessagingModule {}
