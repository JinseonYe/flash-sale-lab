import { Injectable, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';
import type { Channel, ConsumeMessage } from 'amqplib';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class OrderNotificationConsumer implements OnModuleInit {
  constructor(private readonly redisService: RedisService) {}

  async onModuleInit() {
    const connection = await amqp.connect('amqp://guest:guest@localhost:5672');
    const channel = await connection.createChannel();

    await channel.assertQueue('order.notification.retry', {
      durable: true,
      arguments: {
        'x-message-ttl': 5000,
        'x-dead-letter-exchange': '',
        'x-dead-letter-routing-key': 'order.notification',
      },
    });

    await channel.prefetch(10);

    await channel.consume('order.notification', (message) => {
      if (!message) {
        return;
      }

      void this.handleMessage(channel, message);
    });
  }

  private async handleMessage(channel: Channel, message: ConsumeMessage) {
    const data = JSON.parse(message.content.toString()) as {
      orderId: number;
    };

    const processedKey = `processed:order-notification:${data.orderId}`;
    const processingKey = `processing:order-notification:${data.orderId}`;

    let acquired: boolean;

    try {
      const alreadyProcessed = await this.redisService.getStrict(processedKey);

      if (alreadyProcessed) {
        channel.ack(message);
        return;
      }

      acquired = await this.redisService.setIfAbsentStrict(
        processingKey,
        'true',
        30,
      );
    } catch (error) {
      console.error(`Redis 멱등성 확인 실패: orderId=${data.orderId}`, error);

      const retryCount = Number(
        message.properties.headers?.['retry-count'] ?? 0,
      );

      if (retryCount >= 3) {
        channel.sendToQueue('order.notification.dlq', message.content, {
          persistent: true,
          headers: {
            ...message.properties.headers,
            'retry-count': retryCount,
          },
        });

        console.log(
          `DLQ 이동: orderId=${data.orderId}, retryCount=${retryCount}`,
        );

        channel.ack(message);
        return;
      }

      channel.sendToQueue('order.notification.retry', message.content, {
        persistent: true,
        headers: {
          ...message.properties.headers,
          'retry-count': retryCount + 1,
        },
      });

      console.log(
        `Retry Queue 이동: orderId=${data.orderId}, retryCount=${retryCount + 1}`,
      );

      channel.ack(message);
      return;
    }

    if (!acquired) {
      channel.ack(message);
      return;
    }

    try {
      // 실제로는 외부 알림 API 호출
      await new Promise((resolve) => setTimeout(resolve, 500));

      await this.redisService.set(processedKey, 'true', 86400);
      await this.redisService.del(processingKey);

      channel.ack(message);
    } catch {
      await this.redisService.del(processingKey);

      const retryCount = Number(
        message.properties.headers?.['retry-count'] ?? 0,
      );

      if (retryCount >= 1) {
        channel.sendToQueue('order.notification.dlq', message.content, {
          headers: {
            'retry-count': retryCount,
          },
        });

        channel.ack(message);
        return;
      }

      channel.sendToQueue('order.notification', message.content, {
        headers: {
          'retry-count': retryCount + 1,
        },
      });

      channel.ack(message);
    }
  }
}
