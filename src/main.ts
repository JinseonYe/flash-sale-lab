import './tracing';

import { ConsoleLogger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { Server } from 'node:http';
import { AppModule } from './app.module';
import { HttpLatencyInterceptor } from './observability/http-latency.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({
      json: true,
    }),
  });

  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(new HttpLatencyInterceptor());

  await app.listen(process.env.PORT ?? 3000);

  const server = app.getHttpServer() as Server;

  server.keepAliveTimeout = 65_000;
}

void bootstrap();
