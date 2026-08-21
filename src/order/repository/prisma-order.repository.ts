import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateOrderInput, OrderRepository } from './order.repository';

type OrderClient = Pick<PrismaService, 'order'>;

@Injectable()
export class PrismaOrderRepository implements OrderRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: OrderClient,
  ) {}

  create(input: CreateOrderInput) {
    return this.prisma.order.create({
      data: {
        userId: input.userId,
        productId: input.productId,
        quantity: input.quantity,
      },
    });
  }

  findById(id: number) {
    return this.prisma.order.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        userId: true,
        productId: true,
        quantity: true,
      },
    });
  }
}
