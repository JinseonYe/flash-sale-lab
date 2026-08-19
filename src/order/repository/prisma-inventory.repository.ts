import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { InventoryRepository } from './inventory.repository';

@Injectable()
export class PrismaInventoryRepository implements InventoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByProductId(productId: number) {
    return this.prisma.inventory.findUnique({
      where: {
        productId,
      },
    });
  }

  async decrease(productId: number, quantity: number) {
    const inventory = await this.prisma.inventory.findUnique({
      where: {
        productId,
      },
    });

    if (!inventory) {
      throw new Error('재고 정보를 찾을 수 없습니다.');
    }

    await this.prisma.inventory.update({
      where: {
        productId,
      },
      data: {
        stock: inventory.stock - quantity,
      },
    });
  }
}
