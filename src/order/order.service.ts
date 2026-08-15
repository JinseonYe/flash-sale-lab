import { InventoryRepository } from './repository/inventory.repository';
import {
  CreateOrderInput,
  OrderRepository,
} from './repository/order.repository';

export class OrderService {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly orderRepository: OrderRepository,
  ) {}

  async create(input: CreateOrderInput) {
    const inventory = await this.inventoryRepository.findByProductId(
      input.productId,
    );

    if (inventory.stock < input.quantity) {
      throw new Error('재고가 부족합니다.');
    }

    await this.inventoryRepository.decrease(input.productId, input.quantity);

    return this.orderRepository.create(input);
  }
}
