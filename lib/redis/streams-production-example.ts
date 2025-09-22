// path: lib/redis/streams-production-example.ts
// Production-grade Redis Streams implementation example
// Complete integration with automatic cleanup, PEL management, and monitoring

import Redis from 'ioredis';
import { RedisStreamsService } from './streams-service';
import { logger } from '../utils/structured-logger';

/**
 * Production-grade Redis Streams setup with all features
 */
export class ProductionRedisStreamsManager {
  private redis: Redis;
  private streamsService: RedisStreamsService;
  private isInitialized = false;

  constructor(redisConfig: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  }) {
    // Create Redis connection with production settings
    this.redis = new Redis({
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
      db: redisConfig.db ?? 0,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      connectTimeout: 10000,
      commandTimeout: 5000,
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      maxLoadingTimeout: 5000,
    });

    // Create streams service with production retry config
    this.streamsService = new RedisStreamsService(this.redis, {
      maxRetries: 5,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
    });

    // Setup Redis error handling
    this.redis.on('error', (error) => {
      logger.error('Redis connection error:', { error: error.message });
    });

    this.redis.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    this.redis.on('ready', () => {
      logger.info('Redis ready for operations');
    });

    this.redis.on('close', () => {
      logger.warn('Redis connection closed');
    });

    this.redis.on('reconnecting', () => {
      logger.info('Redis reconnecting...');
    });
  }

  /**
   * Initialize the complete Redis Streams system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Production Redis Streams Manager is already initialized');
      return;
    }

    try {
      logger.info('🚀 Initializing Production Redis Streams Manager...');

      // Initialize Redis Streams service
      await this.streamsService.initialize();

      // Start all cleanup and monitoring services
      await this.streamsService.startCleanupServices({
        // PEL Janitor configuration
        pelJanitor: {
          minIdleMs: 30000,        // 30 seconds
          batchSize: 50,           // Process 50 messages at a time
          intervalMs: 2000,        // Check every 2 seconds
          processor: this.handleAbandonedMessage.bind(this),
          onMetrics: this.handlePelMetrics.bind(this),
        },

        // Stream Cleanup configuration
        cleanup: {
          intervalMs: 300000,      // 5 minutes
          minAgeMs: 60000,        // 1 minute minimum age
          aggressiveCleanup: true,
          memoryThresholdBytes: 100 * 1024 * 1024, // 100MB
          onMetrics: this.handleCleanupMetrics.bind(this),
        },

        // Monitoring configuration
        monitoring: {
          collectionIntervalMs: 30000,  // 30 seconds
          enableAnalytics: true,
          thresholds: {
            streamLengthWarning: 70,    // 70% of max length
            streamLengthCritical: 90,   // 90% of max length
            pelWarning: 100,            // 100 pending messages
            pelCritical: 500,           // 500 pending messages
            memoryWarning: 50 * 1024 * 1024,  // 50MB
            memoryCritical: 100 * 1024 * 1024, // 100MB
          },
          onAlert: this.handleAlert.bind(this),
          onMetrics: this.handleMonitoringMetrics.bind(this),
        },
      });

      this.isInitialized = true;
      logger.info('✅ Production Redis Streams Manager initialized successfully');

    } catch (error) {
      logger.error('❌ Failed to initialize Production Redis Streams Manager:', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get the streams service for application use
   */
  getStreamsService(): RedisStreamsService {
    if (!this.isInitialized) {
      throw new Error('Production Redis Streams Manager must be initialized first');
    }
    return this.streamsService;
  }

  /**
   * Get comprehensive system health
   */
  async getSystemHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    streams: any;
    pel: any;
    cleanup: any;
    monitoring: any;
    alerts: any[];
    timestamp: string;
  }> {
    if (!this.isInitialized) {
      throw new Error('Production Redis Streams Manager must be initialized first');
    }

    try {
      // Get all health statuses
      const streamsHealth = await this.streamsService.healthCheck();
      const pelHealth = this.streamsService.getPelJanitorHealth();
      const cleanupHealth = await this.streamsService.getCleanupHealth();
      const monitoringHealth = this.streamsService.getMonitoringHealth();
      const alerts = this.streamsService.getActiveAlerts();

      // Determine overall status
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      
      if (streamsHealth.status === 'unhealthy') {
        status = 'critical';
      } else if (alerts.some(alert => alert.type === 'critical')) {
        status = 'critical';
      } else if (alerts.some(alert => alert.type === 'warning')) {
        status = 'warning';
      }

      return {
        status,
        streams: streamsHealth,
        pel: pelHealth,
        cleanup: cleanupHealth,
        monitoring: monitoringHealth,
        alerts,
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      logger.error('Failed to get system health:', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get production metrics
   */
  async getProductionMetrics(): Promise<{
    streams: any;
    pel: any;
    cleanup: any;
    monitoring: any;
    timestamp: string;
  }> {
    if (!this.isInitialized) {
      throw new Error('Production Redis Streams Manager must be initialized first');
    }

    try {
      const pelMetrics = this.streamsService.getPelJanitorMetrics();
      const cleanupMetrics = this.streamsService.getCleanupMetrics();
      const monitoringHealth = this.streamsService.getMonitoringHealth();

      return {
        streams: await this.streamsService.getConnectionStatus(),
        pel: pelMetrics,
        cleanup: cleanupMetrics,
        monitoring: monitoringHealth,
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      logger.error('Failed to get production metrics:', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Force cleanup operations (for testing or manual triggers)
   */
  async forceCleanup(): Promise<{
    pel: any;
    streams: any;
    duration: number;
  }> {
    if (!this.isInitialized) {
      throw new Error('Production Redis Streams Manager must be initialized first');
    }

    const startTime = Date.now();

    try {
      const [pelResult, streamResult] = await Promise.all([
        this.streamsService.forcePelCleanup(),
        this.streamsService.forceStreamCleanup(),
      ]);

      return {
        pel: pelResult,
        streams: streamResult,
        duration: Date.now() - startTime,
      };

    } catch (error) {
      logger.error('Force cleanup failed:', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      logger.warn('Production Redis Streams Manager is not initialized');
      return;
    }

    try {
      logger.info('🛑 Shutting down Production Redis Streams Manager...');

      // Stop all services
      await this.streamsService.stopCleanupServices();

      // Close Redis connection
      await this.redis.quit();

      this.isInitialized = false;
      logger.info('✅ Production Redis Streams Manager shutdown complete');

    } catch (error) {
      logger.error('❌ Error during shutdown:', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Handle abandoned messages (PEL Janitor processor)
   */
  private async handleAbandonedMessage(msg: {
    stream: string;
    group: string;
    id: string;
    fields: Record<string, string>;
  }): Promise<void> {
    logger.info('Processing abandoned message', {
      stream: msg.stream,
      group: msg.group,
      messageId: msg.id,
      fields: Object.keys(msg.fields),
    });

    // Add your custom processing logic here
    // For example: retry the message, log it, send to DLQ, etc.
    
    // Example: Log the message for manual review
    logger.warn('Abandoned message recovered', {
      stream: msg.stream,
      group: msg.group,
      messageId: msg.id,
      timestamp: msg.fields.timestamp,
      eventType: msg.fields.eventType,
      goalId: msg.fields.goalId,
    });
  }

  /**
   * Handle PEL metrics
   */
  private handlePelMetrics(metrics: any): void {
    logger.debug('PEL Janitor metrics', {
      totalClaimed: metrics.totalClaimed,
      totalAcked: metrics.totalAcked,
      totalFailed: metrics.totalFailed,
      lastRun: metrics.lastRun,
    });
  }

  /**
   * Handle cleanup metrics
   */
  private handleCleanupMetrics(metrics: any): void {
    logger.debug('Stream cleanup metrics', {
      totalTrims: metrics.totalTrims,
      totalBytesFreed: metrics.totalBytesFreed,
      memoryUsage: metrics.memoryUsage,
      lastRun: metrics.lastRun,
    });
  }

  /**
   * Handle monitoring alerts
   */
  private handleAlert(alert: any): void {
    logger.warn('Stream alert triggered', {
      id: alert.id,
      type: alert.type,
      category: alert.category,
      message: alert.message,
      stream: alert.stream,
      value: alert.value,
      threshold: alert.threshold,
    });

    // Add your alert handling logic here
    // For example: send notifications, trigger actions, etc.
  }

  /**
   * Handle monitoring metrics
   */
  private handleMonitoringMetrics(metrics: any): void {
    logger.debug('Monitoring metrics collected', {
      streams: metrics.streams,
      pel: metrics.pel,
      cleanup: metrics.cleanup,
      performance: metrics.performance,
      alerts: metrics.alerts.length,
    });
  }
}

/**
 * Factory function to create a production Redis Streams manager
 */
export function createProductionRedisStreamsManager(redisConfig: {
  host: string;
  port: number;
  password?: string;
  db?: number;
}): ProductionRedisStreamsManager {
  return new ProductionRedisStreamsManager(redisConfig);
}

/**
 * Example usage in your application
 */
export async function setupProductionRedisStreams(): Promise<ProductionRedisStreamsManager> {
  // Create the manager
  const manager = createProductionRedisStreamsManager({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
  });

  // Initialize with all services
  await manager.initialize();

  // Get the streams service for your application
  const streamsService = manager.getStreamsService();

  // Use the streams service in your application
  // Example: Add orchestration events
  await streamsService.addOrchestrationEvent('goal_started', {
    goalId: 'example-goal-123',
    stepId: 'step-1',
    data: { message: 'Goal started' },
  });

  // Example: Add agent communication
  await streamsService.addAgentMessage(
    'agent-1',
    'agent-2',
    'task_assignment',
    { task: 'Process data' },
    'correlation-123'
  );

  // Example: Add collaboration reasoning
  await streamsService.addReasoningEvent(
    'goal-123',
    'I need to analyze the user input and determine the best approach',
    0.8,
    'step-1',
    { context: 'user-request' }
  );

  return manager;
}

/**
 * Graceful shutdown handler
 */
export function setupGracefulShutdown(manager: ProductionRedisStreamsManager): void {
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    try {
      await manager.shutdown();
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGUSR2', () => shutdown('SIGUSR2')); // For nodemon
}
