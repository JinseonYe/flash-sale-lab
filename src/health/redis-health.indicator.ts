import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly redisService: RedisService,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy() {
    const indicator = this.healthIndicatorService.check('redis');

    try {
      await this.redisService.pingStrict();

      return indicator.up();
    } catch {
      return indicator.down();
    }
  }
}
