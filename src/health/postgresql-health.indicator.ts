import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';
import { dependencyHealth } from '../observability/metrics';

@Injectable()
export class PostgreSqlHealthIndicator {
  constructor(
    private readonly prisma: PrismaService,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy() {
    const indicator = this.healthIndicatorService.check('postgresql');

    try {
      await this.prisma.$queryRaw`SELECT 1`;

      dependencyHealth.set({ dependency: 'postgresql' }, 1);

      return indicator.up();
    } catch {
      dependencyHealth.set({ dependency: 'postgresql' }, 0);

      return indicator.down();
    }
  }
}
