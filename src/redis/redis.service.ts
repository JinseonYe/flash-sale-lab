import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createClient } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly client = createClient({
    url: 'redis://localhost:6379',
  });

  constructor() {
    this.client.on('error', (error) => {
      console.error('Redis client error:', error);
    });

    this.client.on('reconnecting', () => {
      console.warn('Redis reconnecting...');
    });

    this.client.on('ready', () => {
      console.log('Redis connected');
    });
  }

  onModuleInit() {
    void this.client.connect().catch((error) => {
      console.error('Redis 초기 연결 실패:', error);
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      console.error(`Redis GET 실패: ${key}`, error);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    try {
      await this.client.set(key, value, {
        EX: ttlSeconds,
      });
    } catch (error) {
      console.error(`Redis SET 실패: ${key}`, error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      console.error(`Redis DEL 실패: ${key}`, error);
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
      console.error(`Redis SET NX 실패: ${key}`, error);
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
}
