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

@Injectable()
export class OrderService {
  constructor(
    @Inject(INVENTORY_REPOSITORY)
    private readonly inventoryRepository: InventoryRepository,

    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepository,
  ) {}

  async create(input: CreateOrderInput) {
    const inventory = await this.inventoryRepository.findByProductId(
      input.productId,
    );

    if (!inventory || inventory.stock < input.quantity) {
      throw new ConflictException('재고가 부족합니다.');
    }

    await this.inventoryRepository.decrease(input.productId, input.quantity);

    return this.orderRepository.create(input);
  }

  async findById(id: number) {
    const order = await this.orderRepository.findById(id);

    if (!order) {
      throw new NotFoundException('주문을 찾을 수 없습니다.');
    }

    return order;
  }
}
