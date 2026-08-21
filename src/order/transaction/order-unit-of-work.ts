import type { InventoryRepository } from '../repository/inventory.repository';
import type { OrderRepository } from '../repository/order.repository';

export const ORDER_UNIT_OF_WORK = Symbol('ORDER_UNIT_OF_WORK');

export interface OrderTransactionRepositories {
  inventoryRepository: InventoryRepository;
  orderRepository: OrderRepository;
}

export interface OrderUnitOfWork {
  execute<T>(
    work: (repositories: OrderTransactionRepositories) => Promise<T>,
  ): Promise<T>;
}
