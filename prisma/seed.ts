import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  const prisma = new PrismaService();

  try {
    const user = await prisma.user.upsert({
      where: {
        email: 'seed@example.com',
      },
      update: {},
      create: {
        email: 'seed@example.com',
      },
    });

    const product = await prisma.product.create({
      data: {
        name: 'Flash Sale Seed Product',
        price: 10000,
        inventory: {
          create: {
            stock: 100,
          },
        },
      },
      include: {
        inventory: true,
      },
    });

    console.log({
      user,
      product,
    });
  } finally {
    await prisma.onModuleDestroy();
  }
}

void main();
