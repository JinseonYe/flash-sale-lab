import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { InventoryRepository } from './inventory.repository';

@Injectable()
export class PrismaInventoryRepository implements InventoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByProductId(productId: number) {
    return this.prisma.inventory.findUnique({
      where: {
        productId,
      },
    });
  }

  async decrease(productId: number, quantity: number) {
    await this.prisma.inventory.update({
      where: {
        productId,
      },
      data: {
        stock: {
          decrement: quantity,
        },
      },
    });
  }
}
