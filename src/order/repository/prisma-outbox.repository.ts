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
        typeof payload.orderId !== 'number'
      ) {
        throw new Error(`Invalid outbox payload: ${event.id}`);
      }

      return {
        id: event.id,
        type: event.type,
        payload: {
          orderId: payload.orderId,
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
      },
    });
  }
}
