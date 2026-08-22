import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createClient } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly client = createClient({
    url: 'redis://localhost:6379',
  });

  async onModuleInit() {
    try {
      await this.client.connect();
    } catch (error) {
      console.error('Redis 연결 실패. 캐시 없이 실행합니다.', error);
    }
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
}
