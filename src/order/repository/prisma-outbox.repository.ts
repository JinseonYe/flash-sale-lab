import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateOutboxEventInput,
  OutboxRepository,
  PendingOutboxEvent,
} from './outbox.repository';

type OutboxClient = Pick<PrismaService, 'outboxEvent'>;

@Injectable()
export class PrismaOutboxRepository implements OutboxRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: OutboxClient,
  ) {}

  async create(input: CreateOutboxEventInput): Promise<void> {
    await this.prisma.outboxEvent.create({
      data: {
        type: input.type,
        payload: input.payload,
      },
    });
  }

  async findPending(): Promise<PendingOutboxEvent[]> {
    const events = await this.prisma.outboxEvent.findMany({
      where: {
        status: 'PENDING',
      },
      orderBy: {
        id: 'asc',
      },
    });

    return events.map((event) => {
      const payload = event.payload;

      if (
        typeof payload !== 'object' ||
        payload === null ||
        Array.isArray(payload) ||
        typeof payload.orderId !== 'number' ||
        typeof payload.requestId !== 'string'
      ) {
        throw new Error(`Invalid outbox payload: ${event.id}`);
      }

      const traceContext = payload.traceContext;

      if (
        typeof traceContext !== 'object' ||
        traceContext === null ||
        Array.isArray(traceContext)
      ) {
        throw new Error('Invalid traceContext');
      }

      return {
        id: event.id,
        type: event.type,
        payload: {
          orderId: payload.orderId,
          requestId: payload.requestId,
          traceContext: traceContext as Record<string, string>,
        },
      };
    });
  }

  async markAsSent(id: number): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: {
        id,
      },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        processingStartedAt: null,
      },
    });
  }

  async claim(id: number): Promise<boolean> {
    const result = await this.prisma.outboxEvent.updateMany({
      where: {
        id,
        status: 'PENDING',
      },
      data: {
        status: 'PROCESSING',
        processingStartedAt: new Date(),
      },
    });

    return result.count === 1;
  }

  async recoverStuckProcessing(): Promise<number> {
    const timeout = new Date(Date.now() - 30_000);

    const result = await this.prisma.outboxEvent.updateMany({
      where: {
        status: 'PROCESSING',
        processingStartedAt: {
          lt: timeout,
        },
      },
      data: {
        status: 'PENDING',
        processingStartedAt: null,
      },
    });

    return result.count;
  }
}
