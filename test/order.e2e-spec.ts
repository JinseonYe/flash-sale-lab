import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Order E2E', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.order.deleteMany();
    await prisma.inventory.deleteMany();
    await prisma.product.deleteMany();
    await prisma.user.deleteMany();

    await prisma.user.create({
      data: {
        email: 'e2e@example.com',
      },
    });

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
    await app.close();
  });

  it('POST /orders - 주문이 생성되고 재고가 감소해야 한다', async () => {
    // Arrange
    const user = await prisma.user.findUniqueOrThrow({
      where: {
        email: 'e2e@example.com',
      },
    });

    const product = await prisma.product.findFirstOrThrow({
      where: {
        name: 'Flash Sale Product',
      },
    });

    // Act
    const response = await request(app.getHttpServer())
      .post('/orders')
      .send({
        userId: user.id,
        productId: product.id,
        quantity: 2,
      })
      .expect(201);

    // Assert - HTTP 응답
    expect(response.body).toEqual(
      expect.objectContaining({
        userId: user.id,
        productId: product.id,
        quantity: 2,
      }),
    );

    // Assert - 실제 DB
    const inventory = await prisma.inventory.findUniqueOrThrow({
      where: {
        productId: product.id,
      },
    });

    expect(inventory.stock).toBe(8);

    const orders = await prisma.order.findMany();

    expect(orders).toHaveLength(1);
    expect(orders[0]).toEqual(
      expect.objectContaining({
        userId: user.id,
        productId: product.id,
        quantity: 2,
      }),
    );
  });

  it('POST /orders - 주문 수량이 0 이하면 400을 반환해야 한다', async () => {
    await request(app.getHttpServer())
      .post('/orders')
      .send({
        userId: 1,
        productId: 1,
        quantity: 0,
      })
      .expect(400);
  });

  it('POST /orders - 재고보다 많은 수량을 주문하면 409를 반환해야 한다', async () => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: 'e2e@example.com' },
    });

    const product = await prisma.product.findFirstOrThrow({
      where: { name: 'Flash Sale Product' },
    });

    await request(app.getHttpServer())
      .post('/orders')
      .send({
        userId: user.id,
        productId: product.id,
        quantity: 11,
      })
      .expect(409);
  });
});
