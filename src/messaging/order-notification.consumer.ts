import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';
import type { ChannelModel, ConfirmChannel, ConsumeMessage } from 'amqplib';
import { RedisService } from '../redis/redis.service';
import { performance } from 'node:perf_hooks';
import { orderNotificationConsumerStepDurationSeconds } from '../observability/metrics';

@Injectable()
export class OrderNotificationConsumer implements OnModuleInit {
  private readonly logger = new Logger(OrderNotificationConsumer.name);

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
        process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672',
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

      await channel.prefetch(100);

      await channel.consume('order.notification', (message) => {
        if (!message) {
          return;
        }

        void this.handleMessage(channel, message);
      });

      channel.on('error', (error) => {
        this.logger.error({
          event: 'rabbitmq_consumer_channel_error',
          error: error.message,
        });
      });

      channel.on('close', () => {
        this.logger.warn({
          event: 'rabbitmq_consumer_channel_closed',
        });

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
        this.logger.error({
          event: 'rabbitmq_consumer_connection_error',
          error: error.message,
        });
      });

      connection.on('close', () => {
        this.logger.warn({
          event: 'rabbitmq_consumer_connection_closed',
        });

        if (this.connection === connection) {
          this.connection = undefined;
          this.channel = undefined;
          this.scheduleReconnect();
        }
      });

      this.connection = connection;
      this.channel = channel;

      this.logger.log({
        event: 'order_notification_consumer_connected',
      });
    } catch (error) {
      this.logger.error({
        event: 'rabbitmq_consumer_connection_failed',
        error: error instanceof Error ? error.message : String(error),
      });

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
    const handleStartedAt = performance.now();

    const data = JSON.parse(message.content.toString()) as {
      orderId: number;
      requestId: string;
    };

    const processedKey = `processed:order-notification:${data.orderId}`;
    const processingKey = `processing:order-notification:${data.orderId}`;

    let acquired: boolean;

    try {
      const processedCheckStartedAt = performance.now();

      const alreadyProcessed = await this.redisService.getStrict(processedKey);

      orderNotificationConsumerStepDurationSeconds.observe(
        { step: 'processed_check' },
        (performance.now() - processedCheckStartedAt) / 1000,
      );

      if (alreadyProcessed) {
        this.logger.log({
          event: 'order_notification_duplicate_skipped',
          requestId: data.requestId,
          orderId: data.orderId,
        });

        channel.ack(message);
        return;
      }

      const processingLockStartedAt = performance.now();

      acquired = await this.redisService.setIfAbsentStrict(
        processingKey,
        'true',
        30,
      );

      orderNotificationConsumerStepDurationSeconds.observe(
        { step: 'processing_lock' },
        (performance.now() - processingLockStartedAt) / 1000,
      );
    } catch (error) {
      this.logger.error({
        event: 'redis_idempotency_check_failed',
        requestId: data.requestId,
        orderId: data.orderId,
        ...this.getErrorDetails(error),
      });

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

          this.logger.warn({
            event: 'order_notification_moved_to_dlq',
            requestId: data.requestId,
            orderId: data.orderId,
            retryCount,
          });

          channel.ack(message);
        } catch (error) {
          this.logger.error({
            event: 'order_notification_dlq_publish_failed',
            requestId: data.requestId,
            orderId: data.orderId,
            error: error instanceof Error ? error.message : String(error),
          });

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

        this.logger.log({
          event: 'order_notification_retry_scheduled',
          requestId: data.requestId,
          orderId: data.orderId,
          retryCount: retryCount + 1,
        });

        channel.ack(message);
      } catch (error) {
        this.logger.error({
          event: 'order_notification_retry_publish_failed',
          requestId: data.requestId,
          orderId: data.orderId,
          error: error instanceof Error ? error.message : String(error),
        });

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
      this.logger.log({
        event: 'order_notification_processing_not_acquired',
        requestId: data.requestId,
        orderId: data.orderId,
      });

      channel.ack(message);
      return;
    }

    try {
      const notificationStartedAt = performance.now();

      // 실제로는 외부 알림 API 호출
      await new Promise((resolve) => setTimeout(resolve, 500));

      orderNotificationConsumerStepDurationSeconds.observe(
        { step: 'notification' },
        (performance.now() - notificationStartedAt) / 1000,
      );

      const markProcessedStartedAt = performance.now();

      await this.redisService.set(processedKey, 'true', 86400);

      orderNotificationConsumerStepDurationSeconds.observe(
        { step: 'mark_processed' },
        (performance.now() - markProcessedStartedAt) / 1000,
      );

      const releaseProcessingLockStartedAt = performance.now();

      await this.redisService.del(processingKey);

      orderNotificationConsumerStepDurationSeconds.observe(
        { step: 'release_processing_lock' },
        (performance.now() - releaseProcessingLockStartedAt) / 1000,
      );

      channel.ack(message);

      orderNotificationConsumerStepDurationSeconds.observe(
        { step: 'total' },
        (performance.now() - handleStartedAt) / 1000,
      );
    } catch (error) {
      this.logger.error({
        event: 'order_notification_processing_failed',
        requestId: data.requestId,
        orderId: data.orderId,
        error: error instanceof Error ? error.message : String(error),
      });

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

          this.logger.warn({
            event: 'order_notification_moved_to_dlq',
            requestId: data.requestId,
            orderId: data.orderId,
            retryCount,
          });

          channel.ack(message);
        } catch (publishError) {
          this.logger.error({
            event: 'order_notification_dlq_publish_failed',
            requestId: data.requestId,
            orderId: data.orderId,
            error:
              publishError instanceof Error
                ? publishError.message
                : String(publishError),
          });

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

        this.logger.log({
          event: 'order_notification_reprocess_scheduled',
          requestId: data.requestId,
          orderId: data.orderId,
          retryCount: retryCount + 1,
        });

        channel.ack(message);
      } catch (publishError) {
        this.logger.error({
          event: 'order_notification_reprocess_publish_failed',
          requestId: data.requestId,
          orderId: data.orderId,
          error:
            publishError instanceof Error
              ? publishError.message
              : String(publishError),
        });

        try {
          channel.nack(message, false, true);
        } catch {
          // channel이 이미 닫혔다면 RabbitMQ가 unacked 메시지를 복구
        }
      }
    }
  }

  private getErrorDetails(error: unknown) {
    if (error instanceof AggregateError) {
      return {
        errorName: error.name,
        errorMessage: error.message,
        causes: error.errors.map((cause) =>
          cause instanceof Error
            ? `${cause.name}: ${cause.message}`
            : String(cause),
        ),
      };
    }

    if (error instanceof Error) {
      return {
        errorName: error.name,
        errorMessage: error.message,
      };
    }

    return {
      errorName: 'UnknownError',
      errorMessage: String(error),
    };
  }
}
