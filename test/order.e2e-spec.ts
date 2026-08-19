import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaPg } from '@prisma/adapter-pg';

import { AppModule } from '../src/app.module';
import { PrismaClient } from '../generated/prisma/client';

describe('Order E2E', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });

    prisma = new PrismaClient({ adapter });
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
    await prisma.$disconnect();
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
});
