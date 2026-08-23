import type { InventoryRepository } from '../repository/inventory.repository';
import type { OrderRepository } from '../repository/order.repository';
import type { OutboxRepository } from '../repository/outbox.repository';

export const ORDER_UNIT_OF_WORK = Symbol('ORDER_UNIT_OF_WORK');

export interface OrderTransactionRepositories {
  inventoryRepository: InventoryRepository;
  orderRepository: OrderRepository;
  outboxRepository: OutboxRepository;
}

export interface OrderUnitOfWork {
  execute<T>(
    work: (repositories: OrderTransactionRepositories) => Promise<T>,
  ): Promise<T>;
}
