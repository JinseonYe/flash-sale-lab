import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import * as amqp from 'amqplib';
import type { ChannelModel, ConfirmChannel } from 'amqplib';

@Injectable()
export class RabbitMqService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(RabbitMqService.name);

  private connection?: ChannelModel;
  private channel?: ConfirmChannel;

  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private connecting = false;
  private shuttingDown = false;

  async onModuleInit() {
    await this.connect();
  }

  private async connect() {
    if (this.shuttingDown || this.connecting || this.channel) {
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

      connection.on('error', (error) => {
        this.logger.error({
          event: 'rabbitmq_connection_error',
          errorName: error.name,
          errorMessage: error.message,
        });
      });

      connection.on('close', () => {
        this.logger.warn({
          event: 'rabbitmq_connection_closed',
        });

        this.connection = undefined;
        this.channel = undefined;

        if (!this.shuttingDown) {
          this.scheduleReconnect();
        }
      });

      this.connection = connection;
      this.channel = channel;

      this.logger.log({
        event: 'rabbitmq_connected',
      });
    } catch (error) {
      this.logger.error({
        event: 'rabbitmq_connection_failed',
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      this.scheduleReconnect();
    } finally {
      this.connecting = false;
    }
  }

  private scheduleReconnect() {
    if (this.shuttingDown || this.reconnectTimer) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;

      void this.connect();
    }, 3000);
  }

  async publishOrderNotification(
    orderId: number,
    requestId: string,
  ): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel is not available');
    }

    const message = JSON.stringify({
      orderId,
      requestId,
    });

    this.channel.sendToQueue('order.notification', Buffer.from(message), {
      persistent: true,
    });

    await this.channel.waitForConfirms();
  }

  isAvailable(): boolean {
    return this.connection !== undefined && this.channel !== undefined;
  }

  async onApplicationShutdown() {
    this.shuttingDown = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    const channel = this.channel;
    const connection = this.connection;

    this.channel = undefined;
    this.connection = undefined;

    if (channel) {
      try {
        await channel.close();
      } catch {
        // 이미 닫혀 있다면 무시
      }
    }

    if (connection) {
      try {
        await connection.close();
      } catch {
        // 이미 닫혀 있다면 무시
      }
    }
  }
}
