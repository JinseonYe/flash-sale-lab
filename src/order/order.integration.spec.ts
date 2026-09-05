import { OrderService } from './order.service';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaOrderRepository } from './repository/prisma-order.repository';
import { PrismaInventoryRepository } from './repository/prisma-inventory.repository';
import { PrismaOrderUnitOfWork } from './transaction/prisma-order-unit-of-work';

describe('OrderService Integration', () => {
  let prisma: PrismaService;
  let orderService: OrderService;

  beforeAll(() => {
    prisma = new PrismaService();

    const orderRepository = new PrismaOrderRepository(prisma);
    const inventoryRepository = new PrismaInventoryRepository(prisma);
    const unitOfWork = new PrismaOrderUnitOfWork(prisma);

    orderService = new OrderService(
      orderRepository,
      inventoryRepository,
      unitOfWork,
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('실제 DB에서 주문 생성 시 재고가 감소하고 주문이 저장되어야 한다', async () => {
    // Arrange
    const user = await prisma.user.findUniqueOrThrow({
      where: {
        email: 'test@example.com',
      },
    });

    const product = await prisma.product.findFirstOrThrow({
      where: {
        name: 'Flash Sale Product',
      },
    });

    // Act
    const order = await orderService.create(
      {
        userId: user.id,
        productId: product.id,
        quantity: 2,
      },
      'test-request-id',
    );

    // Assert
    const inventory = await prisma.inventory.findUniqueOrThrow({
      where: {
        productId: product.id,
      },
    });

    const savedOrder = await prisma.order.findUniqueOrThrow({
      where: {
        id: order.id,
      },
    });

    expect(inventory.stock).toBe(8);

    expect(savedOrder).toEqual(
      expect.objectContaining({
        userId: user.id,
        productId: product.id,
        quantity: 2,
      }),
    );
  });
});
