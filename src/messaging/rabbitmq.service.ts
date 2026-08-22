import { Injectable, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';
import type { Channel, ChannelModel } from 'amqplib';

@Injectable()
export class RabbitMqService implements OnModuleInit {
  private connection: ChannelModel;
  private channel: Channel;

  async onModuleInit() {
    this.connection = await amqp.connect('amqp://guest:guest@localhost:5672');
    this.channel = await this.connection.createChannel();

    await this.channel.assertQueue('order.notification', {
      durable: true,
    });

    await this.channel.assertQueue('order.notification.dlq', {
      durable: true,
    });
  }

  publishOrderNotification(orderId: number) {
    const message = JSON.stringify({
      orderId,
    });

    this.channel.sendToQueue('order.notification', Buffer.from(message));
  }
}
