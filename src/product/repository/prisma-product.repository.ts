import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { ProductRepository } from './product.repository';

@Injectable()
export class PrismaProductRepository implements ProductRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: number) {
    return this.prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        price: true,
      },
    });
  }

  findStockById(id: number) {
    return this.prisma.inventory.findUnique({
      where: {
        productId: id,
      },
      select: {
        productId: true,
        stock: true,
      },
    });
  }

  updatePrice(
    id: number,
    price: number,
  ): Promise<{ id: number; name: string; price: number }> {
    return this.prisma.product.update({
      where: {
        id: id,
      },
      data: { price },
      select: {
        id: true,
        name: true,
        price: true,
      },
    });
  }
}
