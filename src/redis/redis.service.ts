import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { createClient } from 'redis';
import { redisOperationFailuresTotal } from '../observability/metrics';

@Injectable()
export class RedisService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(RedisService.name);

  private readonly client = createClient({
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  });

  constructor() {
    this.client.on('error', (error: unknown) => {
      if (error instanceof AggregateError) {
        this.logger.error({
          event: 'redis_client_error',
          errorName: error.name,
          errorMessage: error.message,
          causes: (error.errors as unknown[]).map((cause) =>
            cause instanceof Error
              ? `${cause.name}: ${cause.message}`
              : String(cause),
          ),
        });

        return;
      }

      if (error instanceof Error) {
        this.logger.error({
          event: 'redis_client_error',
          errorName: error.name,
          errorMessage: error.message,
        });

        return;
      }

      this.logger.error({
        event: 'redis_client_error',
        errorName: 'UnknownError',
        errorMessage: String(error),
      });
    });

    this.client.on('reconnecting', () => {
      // 장애 테스트 중 로그 폭주 방지를 위해 생략
    });

    this.client.on('ready', () => {
      this.logger.log({
        event: 'redis_connected',
      });
    });
  }

  onModuleInit() {
    void this.client.connect().catch((error) => {
      this.logger.error({
        event: 'redis_initial_connection_failed',
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    });
  }

  async onApplicationShutdown() {
    if (!this.client.isOpen) {
      return;
    }

    await this.client.quit();
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      redisOperationFailuresTotal.inc({ operation: 'get' });

      this.logger.error({
        event: 'redis_operation_failed',
        operation: 'get',
        key,
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    try {
      await this.client.set(key, value, {
        EX: ttlSeconds,
      });
    } catch (error) {
      redisOperationFailuresTotal.inc({ operation: 'set' });

      this.logger.error({
        event: 'redis_operation_failed',
        operation: 'set',
        key,
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.error({
        event: 'redis_operation_failed',
        operation: 'del',
        key,
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async setIfAbsent(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    try {
      const result = await this.client.set(key, value, {
        EX: ttlSeconds,
        NX: true,
      });

      return result === 'OK';
    } catch (error) {
      this.logger.error({
        event: 'redis_operation_failed',
        operation: 'set_nx',
        key,
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      return false;
    }
  }

  async getStrict(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async setIfAbsentStrict(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    const result = await this.client.set(key, value, {
      EX: ttlSeconds,
      NX: true,
    });

    return result === 'OK';
  }

  async pingStrict(): Promise<string> {
    return this.client.ping();
  }
}
