import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { OrderModule } from './order/order.module';
import { ProductModule } from './product/product.module';
import { MessagingModule } from './messaging/messaging.module';

@Module({
  imports: [PrismaModule, OrderModule, ProductModule, MessagingModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
