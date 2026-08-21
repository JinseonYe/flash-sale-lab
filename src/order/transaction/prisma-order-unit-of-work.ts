import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { PrismaInventoryRepository } from '../repository/prisma-inventory.repository';
import { PrismaOrderRepository } from '../repository/prisma-order.repository';

import type {
  OrderTransactionRepositories,
  OrderUnitOfWork,
} from './order-unit-of-work';

@Injectable()
export class PrismaOrderUnitOfWork implements OrderUnitOfWork {
  constructor(private readonly prisma: PrismaService) {}

  execute<T>(
    work: (repositories: OrderTransactionRepositories) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const inventoryRepository = new PrismaInventoryRepository(tx);

      const orderRepository = new PrismaOrderRepository(tx);

      return work({
        inventoryRepository,
        orderRepository,
      });
    });
  }
}
