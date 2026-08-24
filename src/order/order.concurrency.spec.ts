import { OrderService } from './order.service';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaOrderUnitOfWork } from './transaction/prisma-order-unit-of-work';
import { PrismaOrderRepository } from './repository/prisma-order.repository';

describe('Order concurrency', () => {
  let prisma: PrismaService;
  let orderService: OrderService;

  const INITIAL_STOCK = 100;
  const CONCURRENT_ORDERS = 150;
  const QUANTITY = 1;

  beforeAll(() => {
    prisma = new PrismaService();

    const orderRepository = new PrismaOrderRepository(prisma);
    const unitOfWork = new PrismaOrderUnitOfWork(prisma);

    orderService = new OrderService(orderRepository, unitOfWork);
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('동시 주문 시 재고 정합성을 보장한다', async () => {
    const user = await prisma.user.findUniqueOrThrow({
      where: {
        email: 'seed@example.com',
      },
    });

    const product = await prisma.product.findFirstOrThrow({
      where: {
        name: 'Flash Sale Seed Product',
      },
      include: {
        inventory: true,
      },
    });

    if (!product.inventory) {
      throw new Error('Seed product inventory not found');
    }

    const initialStock = product.inventory.stock;

    expect(initialStock).toBe(INITIAL_STOCK);

    const orderPromises = Array.from({ length: CONCURRENT_ORDERS }, () =>
      orderService.create(
        {
          userId: user.id,
          productId: product.id,
          quantity: QUANTITY,
        },
        'test-request-id',
      ),
    );

    const startedAt = performance.now();

    const results = await Promise.allSettled(orderPromises);

    const durationMs = performance.now() - startedAt;

    const successCount = results.filter(
      (result) => result.status === 'fulfilled',
    ).length;

    const failedCount = results.filter(
      (result) => result.status === 'rejected',
    ).length;

    const orderCount = await prisma.order.count({
      where: {
        productId: product.id,
      },
    });

    const finalInventory = await prisma.inventory.findUniqueOrThrow({
      where: {
        productId: product.id,
      },
    });

    const finalStock = finalInventory.stock;

    const expectedStock = initialStock - successCount * QUANTITY;

    console.log({
      initialStock,
      successCount,
      failedCount,
      orderCount,
      finalStock,
      expectedStock,
      durationMs,
    });

    expect(successCount).toBe(INITIAL_STOCK);
    expect(failedCount).toBe(CONCURRENT_ORDERS - INITIAL_STOCK);

    expect(orderCount).toBe(successCount);

    expect(finalStock).toBe(expectedStock);
    expect(finalStock).toBe(0);
  });
});
