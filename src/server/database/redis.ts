import { Redis } from 'ioredis';
import { logger } from '../logger.js';
import { config } from '../../config/environment.js';

class RedisManager {
  private static instance: RedisManager | null = null;
  private client: Redis | null = null;

  private constructor() {}

  public static getInstance(): RedisManager {
    if (!RedisManager.instance) {
      RedisManager.instance = new RedisManager();
    }
    return RedisManager.instance;
  }

  public getClient(): Redis {
    if (!this.client) {
      this.client = new Redis(config.redisUrl, {
        keyPrefix: 'mini:',
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
        reconnectOnError: (err: Error) => {
          logger.error('Redis reconnecting due to error:', err);
          return true;
        },
        retryStrategy: (times: number) => {
          if (times > 10) {
            logger.error(
              `[Redis] Maximum reconnection attempts (${times}) exceeded. Connection aborted.`
            );
            return null;
          }
          const baseDelay = 200;
          const maxDelay = 5000;
          const delay = Math.min(baseDelay * Math.pow(2, times - 1), maxDelay);
          const jitteredDelay = Math.random() * delay;
          return Math.max(50, jitteredDelay);
        },
      });

      this.client.on('connect', () => {
        logger.info('Redis client connected successfully.');
      });

      this.client.on('error', (err: Error) => {
        if (err.message?.includes('Connection is closed')) {
          logger.warn(`Redis connection status notice: ${err.message}`);
        } else {
          logger.error('Redis client error:', err);
        }
      });
    }

    return this.client;
  }

  public async disconnect(): Promise<void> {
    if (this.client) {
      try {
        if (this.client.status === 'ready' || this.client.status === 'connect') {
          await this.client.quit();
        } else {
          this.client.disconnect();
        }
        logger.info('Redis client disconnected cleanly.');
      } catch (err: any) {
        try {
          this.client?.disconnect();
        } catch {
          // ignore
        }
        if (!err?.message?.includes('Connection is closed')) {
          logger.error('Error disconnecting Redis client:', err);
        }
      } finally {
        this.client = null;
      }
    }
  }
}

export const redis = RedisManager.getInstance().getClient();
export const redisManager = RedisManager.getInstance();
