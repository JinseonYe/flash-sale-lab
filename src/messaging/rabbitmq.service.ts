import { Injectable, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';
import type { ChannelModel, ConfirmChannel } from 'amqplib';

@Injectable()
export class RabbitMqService implements OnModuleInit {
  private connection?: ChannelModel;
  private channel?: ConfirmChannel;

  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private connecting = false;

  async onModuleInit() {
    await this.connect();
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

      connection.on('error', (error) => {
        console.error('RabbitMQ connection error:', error.message);
      });

      connection.on('close', () => {
        console.error('RabbitMQ connection closed');

        this.connection = undefined;
        this.channel = undefined;

        this.scheduleReconnect();
      });

      this.connection = connection;
      this.channel = channel;

      console.log('RabbitMQ connected');
    } catch (error) {
      console.error('RabbitMQ connection failed');

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

  async publishOrderNotification(orderId: number): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel is not available');
    }

    const message = JSON.stringify({
      orderId,
    });

    this.channel.sendToQueue('order.notification', Buffer.from(message), {
      persistent: true,
    });

    await this.channel.waitForConfirms();
  }
}
