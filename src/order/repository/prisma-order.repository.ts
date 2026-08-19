import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateOrderInput, OrderRepository } from './order.repository';

@Injectable()
export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

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
      where: { id },
      select: {
        id: true,
        userId: true,
        productId: true,
        quantity: true,
      },
    });
  }
}
