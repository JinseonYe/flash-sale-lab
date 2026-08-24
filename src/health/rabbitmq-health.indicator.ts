import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { RabbitMqService } from '../messaging/rabbitmq.service';
import { dependencyHealth } from '../observability/metrics';

@Injectable()
export class RabbitMqHealthIndicator {
  constructor(
    private readonly rabbitMqService: RabbitMqService,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  isHealthy() {
    const indicator = this.healthIndicatorService.check('rabbitmq');

    if (this.rabbitMqService.isAvailable()) {
      dependencyHealth.set({ dependency: 'rabbitmq' }, 1);
      return indicator.up();
    }

    dependencyHealth.set({ dependency: 'rabbitmq' }, 0);
    return indicator.down();
  }
}
