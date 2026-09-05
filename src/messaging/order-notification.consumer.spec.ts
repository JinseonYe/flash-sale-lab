import type { ChannelModel, ConfirmChannel, ConsumeMessage } from 'amqplib';

import { OrderNotificationConsumer } from './order-notification.consumer';
import { RedisService } from '../redis/redis.service';

type TestableOrderNotificationConsumer = {
  handleMessage(
    channel: ConfirmChannel,
    message: ConsumeMessage,
  ): Promise<void>;

  beforeApplicationShutdown(): Promise<void>;

  connection?: ChannelModel;
  channel?: ConfirmChannel;
  consumerTag?: string;
  inFlightHandlers: Set<Promise<void>>;
};

describe('OrderNotificationConsumer', () => {
  let consumer: TestableOrderNotificationConsumer;

  let redisService: {
    getStrict: jest.Mock;
    setIfAbsentStrict: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
  };

  let channel: {
    sendToQueue: jest.Mock;
    waitForConfirms: jest.Mock;
    ack: jest.Mock;
    nack: jest.Mock;
    cancel: jest.Mock;
    close: jest.Mock;
  };

  let connection: {
    close: jest.Mock;
  };

  let message: ConsumeMessage;

  beforeEach(() => {
    redisService = {
      getStrict: jest.fn(),
      setIfAbsentStrict: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    channel = {
      sendToQueue: jest.fn().mockReturnValue(true),
      waitForConfirms: jest.fn().mockResolvedValue(undefined),
      ack: jest.fn(),
      nack: jest.fn(),
      cancel: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    };

    connection = {
      close: jest.fn().mockResolvedValue(undefined),
    };

    message = {
      content: Buffer.from(
        JSON.stringify({
          orderId: 1,
          requestId: 'test-request-id',
        }),
      ),
      fields: {} as ConsumeMessage['fields'],
      properties: {
        headers: {
          'existing-header': 'existing-value',
        },
      } as unknown as ConsumeMessage['properties'],
    };

    const orderNotificationConsumer = new OrderNotificationConsumer(
      redisService as unknown as RedisService,
    );

    consumer =
      orderNotificationConsumer as unknown as TestableOrderNotificationConsumer;
  });

  it('processing lock 획득 실패 시 processing-retry publish confirm 후 원본 메시지를 ACK한다', async () => {
    redisService.getStrict.mockResolvedValue(null);
    redisService.setIfAbsentStrict.mockResolvedValue(false);

    await consumer.handleMessage(channel as unknown as ConfirmChannel, message);

    expect(redisService.getStrict).toHaveBeenCalledWith(
      'processed:order-notification:1',
    );

    expect(redisService.setIfAbsentStrict).toHaveBeenCalledWith(
      'processing:order-notification:1',
      'true',
      30,
    );

    expect(channel.sendToQueue).toHaveBeenCalledWith(
      'order.notification.processing-retry',
      message.content,
      {
        persistent: true,
        headers: {
          'existing-header': 'existing-value',
        },
      },
    );

    expect(channel.waitForConfirms).toHaveBeenCalledTimes(1);
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();

    expect(redisService.set).not.toHaveBeenCalled();
    expect(redisService.del).not.toHaveBeenCalled();

    const confirmCallOrder =
      channel.waitForConfirms.mock.invocationCallOrder[0];
    const ackCallOrder = channel.ack.mock.invocationCallOrder[0];

    expect(confirmCallOrder).toBeLessThan(ackCallOrder);
  });

  it('processing-retry publish confirm 실패 시 ACK하지 않고 원본 메시지를 requeue한다', async () => {
    redisService.getStrict.mockResolvedValue(null);
    redisService.setIfAbsentStrict.mockResolvedValue(false);

    channel.waitForConfirms.mockRejectedValue(
      new Error('RabbitMQ confirm failed'),
    );

    await consumer.handleMessage(channel as unknown as ConfirmChannel, message);

    expect(channel.sendToQueue).toHaveBeenCalledWith(
      'order.notification.processing-retry',
      message.content,
      {
        persistent: true,
        headers: {
          'existing-header': 'existing-value',
        },
      },
    );

    expect(channel.waitForConfirms).toHaveBeenCalledTimes(1);

    expect(channel.ack).not.toHaveBeenCalled();

    expect(channel.nack).toHaveBeenCalledWith(message, false, true);

    expect(redisService.set).not.toHaveBeenCalled();
    expect(redisService.del).not.toHaveBeenCalled();
  });

  it('shutdown 시 신규 메시지 소비를 중단하고 in-flight 작업 완료 후 RabbitMQ 연결을 닫는다', async () => {
    let resolveInFlight!: () => void;

    const inFlightTask = new Promise<void>((resolve) => {
      resolveInFlight = resolve;
    });

    consumer.channel = channel as unknown as ConfirmChannel;
    consumer.connection = connection as unknown as ChannelModel;
    consumer.consumerTag = 'test-consumer-tag';
    consumer.inFlightHandlers.add(inFlightTask);

    const shutdownPromise = consumer.beforeApplicationShutdown();

    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });

    expect(channel.cancel).toHaveBeenCalledWith('test-consumer-tag');

    expect(channel.close).not.toHaveBeenCalled();
    expect(connection.close).not.toHaveBeenCalled();

    resolveInFlight();

    await shutdownPromise;

    expect(channel.close).toHaveBeenCalledTimes(1);
    expect(connection.close).toHaveBeenCalledTimes(1);

    const cancelCallOrder = channel.cancel.mock.invocationCallOrder[0];
    const channelCloseCallOrder = channel.close.mock.invocationCallOrder[0];
    const connectionCloseCallOrder =
      connection.close.mock.invocationCallOrder[0];

    expect(cancelCallOrder).toBeLessThan(channelCloseCallOrder);
    expect(channelCloseCallOrder).toBeLessThan(connectionCloseCallOrder);
  });
});
