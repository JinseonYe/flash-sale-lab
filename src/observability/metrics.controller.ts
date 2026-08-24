import { Controller, Get, Header } from '@nestjs/common';
import { register } from 'prom-client';

import { PrismaService } from '../prisma/prisma.service';
import { outboxEvents } from './metrics';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Header('Content-Type', register.contentType)
  async getMetrics(): Promise<string> {
    const [pendingCount, processingCount] = await Promise.all([
      this.prisma.outboxEvent.count({
        where: { status: 'PENDING' },
      }),
      this.prisma.outboxEvent.count({
        where: { status: 'PROCESSING' },
      }),
    ]);

    outboxEvents.set({ status: 'PENDING' }, pendingCount);
    outboxEvents.set({ status: 'PROCESSING' }, processingCount);

    return register.metrics();
  }
}
