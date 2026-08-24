import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { MessagingModule } from '../messaging/messaging.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { HealthController } from './health.controller';
import { PostgreSqlHealthIndicator } from './postgresql-health.indicator';
import { RabbitMqHealthIndicator } from './rabbitmq-health.indicator';
import { RedisHealthIndicator } from './redis-health.indicator';

@Module({
  imports: [TerminusModule, RedisModule, PrismaModule, MessagingModule],
  controllers: [HealthController],
  providers: [
    RedisHealthIndicator,
    PostgreSqlHealthIndicator,
    RabbitMqHealthIndicator,
  ],
})
export class HealthModule {}
