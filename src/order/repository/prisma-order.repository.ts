import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrderInput, OrderRepository } from './order.repository';

@Injectable()
export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateOrderInput) {
    return this.prisma.order.create({
      data: {
        userId: input.userId,
        productId: input.productId,
        quantity: input.quantity,
      },
    });
  }
}
