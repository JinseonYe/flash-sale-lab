import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { INVENTORY_REPOSITORY } from './repository/inventory.repository';
import { ORDER_REPOSITORY } from './repository/order.repository';
import { PrismaInventoryRepository } from './repository/prisma-inventory.repository';
import { PrismaOrderRepository } from './repository/prisma-order.repository';
import { ORDER_UNIT_OF_WORK } from './transaction/order-unit-of-work';
import { PrismaOrderUnitOfWork } from './transaction/prisma-order-unit-of-work';

@Module({
  controllers: [OrderController],

  providers: [
    OrderService,
    {
      provide: INVENTORY_REPOSITORY,
      useClass: PrismaInventoryRepository,
    },
    {
      provide: ORDER_REPOSITORY,
      useClass: PrismaOrderRepository,
    },
    {
      provide: ORDER_UNIT_OF_WORK,
      useClass: PrismaOrderUnitOfWork,
    },
  ],

  exports: [OrderService],
})
export class OrderModule {}
