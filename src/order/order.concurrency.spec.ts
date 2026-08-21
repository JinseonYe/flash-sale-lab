import { OrderService } from './order.service';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaInventoryRepository } from './repository/prisma-inventory.repository';
import { PrismaOrderRepository } from './repository/prisma-order.repository';

describe('Order concurrency', () => {
  let prisma: PrismaService;
  let orderService: OrderService;

  const INITIAL_STOCK = 100;
  const CONCURRENT_ORDERS = 150;
  const QUANTITY = 1;

  beforeAll(() => {
    prisma = new PrismaService();

    const inventoryRepository = new PrismaInventoryRepository(prisma);
    const orderRepository = new PrismaOrderRepository(prisma);

    orderService = new OrderService(
      inventoryRepository,
      orderRepository,
      prisma,
    );
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('동시 주문 시 재고 정합성 상태를 확인한다', async () => {
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

    const orderPromises = Array.from({ length: CONCURRENT_ORDERS }, () =>
      orderService.create({
        userId: user.id,
        productId: product.id,
        quantity: QUANTITY,
      }),
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
  });
});
