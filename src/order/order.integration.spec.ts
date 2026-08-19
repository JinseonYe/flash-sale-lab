import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import { OrderService } from './order.service';
import { PrismaInventoryRepository } from './repository/prisma-inventory.repository';
import { PrismaOrderRepository } from './repository/prisma-order.repository';

describe('OrderService Integration', () => {
  let prisma: PrismaClient;
  let orderService: OrderService;

  beforeAll(() => {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });

    prisma = new PrismaClient({ adapter });

    const inventoryRepository = new PrismaInventoryRepository(prisma);
    const orderRepository = new PrismaOrderRepository(prisma);

    orderService = new OrderService(inventoryRepository, orderRepository);
  });

  beforeEach(async () => {
    // 이전 테스트 데이터 제거
    await prisma.order.deleteMany();
    await prisma.inventory.deleteMany();
    await prisma.product.deleteMany();
    await prisma.user.deleteMany();

    // 테스트 User 생성
    await prisma.user.create({
      data: {
        email: 'test@example.com',
      },
    });

    // 테스트 Product + Inventory 생성
    await prisma.product.create({
      data: {
        name: 'Flash Sale Product',
        price: 10000,
        inventory: {
          create: {
            stock: 10,
          },
        },
      },
    });
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
    const order = await orderService.create({
      userId: user.id,
      productId: product.id,
      quantity: 2,
    });

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
