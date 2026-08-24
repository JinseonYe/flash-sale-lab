import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { OrderModule } from './order/order.module';
import { ProductModule } from './product/product.module';
import { MessagingModule } from './messaging/messaging.module';
import { MetricsController } from './observability/metrics.controller';
import { HealthModule } from './health/health.module';
import { RequestIdMiddleware } from './observability/request-id.middleware';

@Module({
  imports: [
    PrismaModule,
    OrderModule,
    ProductModule,
    MessagingModule,
    HealthModule,
  ],
  controllers: [AppController, MetricsController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
