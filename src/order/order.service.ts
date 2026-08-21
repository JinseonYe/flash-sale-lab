import {
  Inject,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { INVENTORY_REPOSITORY } from './repository/inventory.repository';
import type { InventoryRepository } from './repository/inventory.repository';
import { ORDER_REPOSITORY } from './repository/order.repository';
import type {
  CreateOrderInput,
  OrderRepository,
} from './repository/order.repository';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrderService {
  constructor(
    @Inject(INVENTORY_REPOSITORY)
    private readonly inventoryRepository: InventoryRepository,

    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepository,

    private readonly prisma: PrismaService,
  ) {}

  create(input: CreateOrderInput) {
    return this.createInTransaction(input);
  }

  private createInTransaction(input: CreateOrderInput) {
    return this.prisma.$transaction(async (tx) => {
      const inventories = await tx.$queryRaw<
        Array<{
          product_id: number;
          stock: number;
        }>
      >`
      SELECT product_id, stock
      FROM inventories
      WHERE product_id = ${input.productId}
      FOR UPDATE
    `;

      const inventory = inventories[0];

      if (!inventory || inventory.stock < input.quantity) {
        throw new ConflictException('재고가 부족합니다.');
      }

      await tx.inventory.update({
        where: {
          productId: input.productId,
        },
        data: {
          stock: {
            decrement: input.quantity,
          },
        },
      });

      return tx.order.create({
        data: {
          userId: input.userId,
          productId: input.productId,
          quantity: input.quantity,
        },
      });
    });
  }

  async findById(id: number) {
    const order = await this.orderRepository.findById(id);

    if (!order) {
      throw new NotFoundException('주문을 찾을 수 없습니다.');
    }

    return order;
  }
}
