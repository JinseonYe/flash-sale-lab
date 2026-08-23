import { Injectable, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';
import type { ChannelModel, ConfirmChannel, ConsumeMessage } from 'amqplib';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class OrderNotificationConsumer implements OnModuleInit {
  constructor(private readonly redisService: RedisService) {}

  private connection?: ChannelModel;
  private channel?: ConfirmChannel;

  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private connecting = false;

  onModuleInit() {
    void this.connect();
  }

  private async connect() {
    if (this.connecting || this.channel) {
      return;
    }

    this.connecting = true;

    try {
      const connection = await amqp.connect(
        'amqp://guest:guest@localhost:5672',
      );

      const channel = await connection.createConfirmChannel();

      await channel.assertQueue('order.notification', {
        durable: true,
      });

      await channel.assertQueue('order.notification.dlq', {
        durable: true,
      });

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

      channel.on('error', (error) => {
        console.error('Consumer RabbitMQ channel error:', error.message);
      });

      channel.on('close', () => {
        console.error('Consumer RabbitMQ channel closed');

        if (this.channel === channel) {
          this.channel = undefined;
        }

        // channel만 죽고 connection은 살아 있는 경우,
        // 기존 connection도 정리해서 전체 연결을 새로 만들도록 한다.
        if (this.connection === connection) {
          void connection.close().catch(() => {
            // 이미 connection이 닫힌 상태라면 무시
          });
        }
      });

      connection.on('error', (error) => {
        console.error('Consumer RabbitMQ connection error:', error.message);
      });

      connection.on('close', () => {
        console.error('Consumer RabbitMQ connection closed');

        if (this.connection === connection) {
          this.connection = undefined;
          this.channel = undefined;
          this.scheduleReconnect();
        }
      });

      this.connection = connection;
      this.channel = channel;

      console.log('Order notification consumer connected');
    } catch (error) {
      console.error('Consumer RabbitMQ connection failed:', error);
      this.scheduleReconnect();
    } finally {
      this.connecting = false;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      void this.connect();
    }, 3000);
  }

  private async handleMessage(
    channel: ConfirmChannel,
    message: ConsumeMessage,
  ) {
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
        try {
          channel.sendToQueue('order.notification.dlq', message.content, {
            persistent: true,
            headers: {
              ...message.properties.headers,
              'retry-count': retryCount,
            },
          });

          await channel.waitForConfirms();

          console.log(
            `DLQ 이동 확인: orderId=${data.orderId}, retryCount=${retryCount}`,
          );

          channel.ack(message);
        } catch (error) {
          console.error(`DLQ 발행 확인 실패: orderId=${data.orderId}`, error);

          try {
            channel.nack(message, false, true);
          } catch {
            // 이미 연결이 끊겼다면 RabbitMQ가 unacked 메시지를 복구
          }
        }

        return;
      }

      try {
        channel.sendToQueue('order.notification.retry', message.content, {
          persistent: true,
          headers: {
            ...message.properties.headers,
            'retry-count': retryCount + 1,
          },
        });

        await channel.waitForConfirms();

        console.log(
          `Retry Queue 이동 확인: orderId=${data.orderId}, retryCount=${retryCount + 1}`,
        );

        channel.ack(message);
      } catch (error) {
        console.error(
          `Retry Queue 발행 확인 실패: orderId=${data.orderId}`,
          error,
        );

        try {
          channel.nack(message, false, true);
        } catch {
          // channel 자체가 이미 닫혔다면
          // RabbitMQ가 해당 unacked 메시지를 다시 Queue로 돌려놓음
        }
      }

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
        try {
          channel.sendToQueue('order.notification.dlq', message.content, {
            persistent: true,
            headers: {
              ...message.properties.headers,
              'retry-count': retryCount,
            },
          });

          await channel.waitForConfirms();

          channel.ack(message);
        } catch (error) {
          console.error(`DLQ 발행 확인 실패: orderId=${data.orderId}`, error);

          try {
            channel.nack(message, false, true);
          } catch {
            // channel이 이미 닫혔다면 RabbitMQ가 unacked 메시지를 복구
          }
        }

        return;
      }

      try {
        channel.sendToQueue('order.notification', message.content, {
          persistent: true,
          headers: {
            ...message.properties.headers,
            'retry-count': retryCount + 1,
          },
        });

        await channel.waitForConfirms();

        channel.ack(message);
      } catch (error) {
        console.error(
          `재처리 메시지 발행 확인 실패: orderId=${data.orderId}`,
          error,
        );

        try {
          channel.nack(message, false, true);
        } catch {
          // channel이 이미 닫혔다면 RabbitMQ가 unacked 메시지를 복구
        }
      }
    }
  }
}
