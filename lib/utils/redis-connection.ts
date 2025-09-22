import Redis from 'ioredis';
import { logger } from './structured-logger';
import { AppError, DatabaseError, NetworkError, handleServiceError } from './error-handler';

export interface RedisConnectionConfig {
  maxRetriesPerRequest?: number;
  lazyConnect?: boolean;
  connectTimeout?: number;
  commandTimeout?: number;
  retryStrategy?: (times: number) => number | null | void;
}

export class RedisConnectionManager {
  private static instance: RedisConnectionManager;
  private redisUrl: string;
  private defaultConfig: RedisConnectionConfig;

  private constructor() {
    this.redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.defaultConfig = {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      connectTimeout: 5000,
      commandTimeout: 3000,
      retryStrategy: (times) => {
        if (times > 3) {
          return null; // Stop retrying after 3 attempts
        }
        return Math.min(times * 1000, 3000); // Exponential backoff
      }
    };
  }

  static getInstance(): RedisConnectionManager {
    if (!RedisConnectionManager.instance) {
      RedisConnectionManager.instance = new RedisConnectionManager();
    }
    return RedisConnectionManager.instance;
  }

  createConnection(config?: RedisConnectionConfig): Redis {
    const finalConfig = { ...this.defaultConfig, ...config };
    
    return new Redis(this.redisUrl, finalConfig);
  }

  async connect(redis: Redis): Promise<void> {
    try {
      if (redis.status !== 'ready') {
        await redis.connect();
        logger.info('✅ Redis connection established');
      }
    } catch (error) {
      handleServiceError(error, 'RedisConnectionManager.connect');
    }
  }

  async disconnect(redis: Redis): Promise<void> {
    try {
      if (redis && redis.status !== 'end') {
        await redis.quit();
        logger.info('✅ Redis connection closed');
      }
    } catch (error) {
      logger.warn('Failed to close Redis connection gracefully', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async testConnection(): Promise<boolean> {
    const redis = this.createConnection();
    
    try {
      await this.connect(redis);
      const pong = await redis.ping();
      await this.disconnect(redis);
      
      return pong === 'PONG';
    } catch (error) {
      await this.disconnect(redis);
      return false;
    }
  }

  async withConnection<T>(
    operation: (redis: Redis) => Promise<T>,
    config?: RedisConnectionConfig
  ): Promise<T> {
    const redis = this.createConnection(config);
    
    try {
      await this.connect(redis);
      const result = await operation(redis);
      await this.disconnect(redis);
      
      return result;
    } catch (error) {
      await this.disconnect(redis);
      throw error;
    }
  }

  async withStreamsService<T>(
    operation: (streamsService: any) => Promise<T>,
    config?: RedisConnectionConfig
  ): Promise<T> {
    return this.withConnection(async (redis) => {
      const { RedisStreamsService } = await import('@/lib/redis/streams-service');
      const streamsService = new RedisStreamsService(redis);
      await streamsService.initialize();
      
      return operation(streamsService);
    }, config);
  }

  getConnectionStatus(): {
    url: string;
    status: string;
    config: RedisConnectionConfig;
  } {
    return {
      url: this.redisUrl,
      status: 'configured',
      config: this.defaultConfig
    };
  }
}

// Export singleton instance
export const redisConnectionManager = RedisConnectionManager.getInstance();

// Helper function for API routes
export async function withRedisStreams<T>(
  operation: (streamsService: any) => Promise<T>
): Promise<T> {
  return redisConnectionManager.withStreamsService(operation);
}
