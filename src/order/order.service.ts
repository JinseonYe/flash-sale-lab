import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { ORDER_REPOSITORY } from './repository/order.repository';
import type {
  CreateOrderInput,
  OrderRepository,
} from './repository/order.repository';

import { ORDER_UNIT_OF_WORK } from './transaction/order-unit-of-work';
import type { OrderUnitOfWork } from './transaction/order-unit-of-work';

@Injectable()
export class OrderService {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepository,

    @Inject(ORDER_UNIT_OF_WORK)
    private readonly unitOfWork: OrderUnitOfWork,
  ) {}

  async create(input: CreateOrderInput) {
    const order = await this.unitOfWork.execute(
      async ({ inventoryRepository, orderRepository, outboxRepository }) => {
        const decreased = await inventoryRepository.decreaseIfAvailable(
          input.productId,
          input.quantity,
        );

        if (!decreased) {
          throw new ConflictException('재고가 부족합니다.');
        }

        const order = await orderRepository.create(input);

        await outboxRepository.create({
          type: 'ORDER_NOTIFICATION',
          payload: {
            orderId: order.id,
          },
        });

        return order;
      },
    );

    return order;
  }

  async findById(id: number) {
    const order = await this.orderRepository.findById(id);

    if (!order) {
      throw new NotFoundException('주문을 찾을 수 없습니다.');
    }

    return order;
  }
}
