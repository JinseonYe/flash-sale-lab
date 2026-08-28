import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { context, propagation } from '@opentelemetry/api';
import { performance } from 'node:perf_hooks';

import {
  INVENTORY_REPOSITORY,
  type InventoryRepository,
} from './repository/inventory.repository';

import { ORDER_REPOSITORY } from './repository/order.repository';
import type {
  CreateOrderInput,
  OrderRepository,
} from './repository/order.repository';

import { ORDER_UNIT_OF_WORK } from './transaction/order-unit-of-work';
import type { OrderUnitOfWork } from './transaction/order-unit-of-work';

import { orderStepDurationSeconds } from '../observability/metrics';

@Injectable()
export class OrderService {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepository,

    @Inject(INVENTORY_REPOSITORY)
    private readonly inventoryRepository: InventoryRepository,

    @Inject(ORDER_UNIT_OF_WORK)
    private readonly unitOfWork: OrderUnitOfWork,
  ) {}

  async create(input: CreateOrderInput, requestId: string) {
    const inventoryPrecheckStartedAt = performance.now();

    const inventory = await this.inventoryRepository.findByProductId(
      input.productId,
    );

    orderStepDurationSeconds.observe(
      { step: 'inventory_precheck' },
      (performance.now() - inventoryPrecheckStartedAt) / 1000,
    );

    if (!inventory || inventory.stock < input.quantity) {
      throw new ConflictException('재고가 부족합니다.');
    }

    const transactionStartedAt = performance.now();

    try {
      const order = await this.unitOfWork.execute(
        async ({ inventoryRepository, orderRepository, outboxRepository }) => {
          const orderInsertStartedAt = performance.now();

          const order = await orderRepository.create(input);

          orderStepDurationSeconds.observe(
            { step: 'order_insert' },
            (performance.now() - orderInsertStartedAt) / 1000,
          );

          const traceContext: Record<string, string> = {};

          propagation.inject(context.active(), traceContext);

          const outboxInsertStartedAt = performance.now();

          await outboxRepository.create({
            type: 'ORDER_NOTIFICATION',
            payload: {
              orderId: order.id,
              requestId,
              traceContext,
            },
          });

          orderStepDurationSeconds.observe(
            { step: 'outbox_insert' },
            (performance.now() - outboxInsertStartedAt) / 1000,
          );

          const inventoryStartedAt = performance.now();

          const decreased = await inventoryRepository.decreaseIfAvailable(
            input.productId,
            input.quantity,
          );

          orderStepDurationSeconds.observe(
            { step: 'inventory_decrease' },
            (performance.now() - inventoryStartedAt) / 1000,
          );

          if (!decreased) {
            throw new ConflictException('재고가 부족합니다.');
          }

          return order;
        },
      );

      return order;
    } finally {
      orderStepDurationSeconds.observe(
        { step: 'transaction' },
        (performance.now() - transactionStartedAt) / 1000,
      );
    }
  }

  async findById(id: number) {
    const order = await this.orderRepository.findById(id);

    if (!order) {
      throw new NotFoundException('주문을 찾을 수 없습니다.');
    }

    return order;
  }
}
