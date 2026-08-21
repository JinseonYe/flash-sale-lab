import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { InventoryRepository } from './inventory.repository';

type InventoryClient = Pick<PrismaService, 'inventory'>;

@Injectable()
export class PrismaInventoryRepository implements InventoryRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: InventoryClient,
  ) {}

  findByProductId(productId: number) {
    return this.prisma.inventory.findUnique({
      where: {
        productId,
      },
    });
  }

  async decreaseIfAvailable(
    productId: number,
    quantity: number,
  ): Promise<boolean> {
    const result = await this.prisma.inventory.updateMany({
      where: {
        productId,
        stock: {
          gte: quantity,
        },
      },
      data: {
        stock: {
          decrement: quantity,
        },
      },
    });

    return result.count === 1;
  }
}
