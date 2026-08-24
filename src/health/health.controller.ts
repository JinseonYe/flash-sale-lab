import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { RedisHealthIndicator } from './redis-health.indicator';
import { PostgreSqlHealthIndicator } from './postgresql-health.indicator';
import { RabbitMqHealthIndicator } from './rabbitmq-health.indicator';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly redisHealthIndicator: RedisHealthIndicator,
    private readonly postgresqlHealthIndicator: PostgreSqlHealthIndicator,
    private readonly rabbitMqHealthIndicator: RabbitMqHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.redisHealthIndicator.isHealthy(),
      () => this.postgresqlHealthIndicator.isHealthy(),
      () => this.rabbitMqHealthIndicator.isHealthy(),
    ]);
  }
}
