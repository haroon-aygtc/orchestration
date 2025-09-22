// path: lib/redis/streams-cleanup-service.ts
// Production-grade Automatic Stream Cleanup Service
// Prevents memory growth by automatically trimming streams

import { RedisStreamsService, STREAMS, type StreamName } from './streams-service';
import { logger } from '../utils/structured-logger';

export interface CleanupServiceOptions {
  /** How often to run cleanup (ms) */
  intervalMs?: number;
  /** Maximum length for each stream */
  maxLengths?: Record<StreamName, number>;
  /** Minimum age before trimming (ms) */
  minAgeMs?: number;
  /** Enable aggressive cleanup for high-memory usage */
  aggressiveCleanup?: boolean;
  /** Memory threshold for aggressive cleanup (bytes) */
  memoryThresholdBytes?: number;
  /** Metrics callback for monitoring */
  onMetrics?: (metrics: CleanupMetrics) => void;
}

export interface CleanupMetrics {
  totalTrims: number;
  totalBytesFreed: number;
  perStream: Record<string, {
    trims: number;
    bytesFreed: number;
    currentLength: number;
    lastTrim: Date | null;
  }>;
  lastRun: Date;
  isRunning: boolean;
  memoryUsage: {
    current: number;
    peak: number;
    threshold: number;
  };
}

export interface CleanupHealth {
  isRunning: boolean;
  lastRun: Date | null;
  totalTrims: number;
  errors: number;
  uptime: number;
  streams: Array<{
    name: string;
    length: number;
    maxLength: number;
    lastTrim: Date | null;
    status: 'healthy' | 'warning' | 'critical';
  }>;
}

export class StreamCleanupService {
  private streamsService: RedisStreamsService;
  private options: Required<Omit<CleanupServiceOptions, 'onMetrics'>> & {
    onMetrics?: CleanupServiceOptions['onMetrics'];
  };
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private startTime: number;
  private metrics: CleanupMetrics;
  private errorCount = 0;

  constructor(streamsService: RedisStreamsService, options: CleanupServiceOptions = {}) {
    this.streamsService = streamsService;
    this.startTime = Date.now();

    // Default max lengths for each stream
    const defaultMaxLengths: Record<StreamName, number> = {
      [STREAMS.ORCH_EVENTS]: 5_000,
      [STREAMS.AGENT_COMM]: 3_000,
      [STREAMS.WF_STEPS]: 2_000,
      [STREAMS.NODE_EXEC]: 2_000,
      [STREAMS.COORD_DECISIONS]: 1_000,
      [STREAMS.COLLAB_REASONING]: 1_000,
      [STREAMS.COLLAB_SUGGESTIONS]: 1_000,
      [STREAMS.COLLAB_STATUS]: 1_000,
    };

    this.options = {
      intervalMs: options.intervalMs ?? 300_000, // 5 minutes
      maxLengths: { ...defaultMaxLengths, ...options.maxLengths },
      minAgeMs: options.minAgeMs ?? 60_000, // 1 minute
      aggressiveCleanup: options.aggressiveCleanup ?? true,
      memoryThresholdBytes: options.memoryThresholdBytes ?? 100 * 1024 * 1024, // 100MB
      onMetrics: options.onMetrics,
    };

    this.metrics = {
      totalTrims: 0,
      totalBytesFreed: 0,
      perStream: {},
      lastRun: new Date(),
      isRunning: false,
      memoryUsage: {
        current: 0,
        peak: 0,
        threshold: this.options.memoryThresholdBytes,
      },
    };

    // Initialize per-stream metrics
    Object.keys(this.options.maxLengths).forEach((streamName) => {
      this.metrics.perStream[streamName] = {
        trims: 0,
        bytesFreed: 0,
        currentLength: 0,
        lastTrim: null,
      };
    });

    logger.info('🧹 Stream Cleanup Service initialized', {
      intervalMs: this.options.intervalMs,
      streams: Object.keys(this.options.maxLengths).length,
      aggressiveCleanup: this.options.aggressiveCleanup,
      memoryThreshold: this.options.memoryThresholdBytes,
    });
  }

  /**
   * Start the cleanup service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Stream Cleanup Service is already running');
      return;
    }

    this.isRunning = true;
    this.metrics.isRunning = true;
    this.startTime = Date.now();

    // Start the cleanup interval
    this.intervalId = setInterval(() => {
      this.performCleanup().catch((error) => {
        logger.error('Stream Cleanup Service failed:', {
          error: error instanceof Error ? error.message : String(error),
        });
        this.errorCount++;
      });
    }, this.options.intervalMs);

    logger.info('✅ Stream Cleanup Service started', {
      intervalMs: this.options.intervalMs,
    });
  }

  /**
   * Stop the cleanup service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Stream Cleanup Service is not running');
      return;
    }

    this.isRunning = false;
    this.metrics.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    logger.info('🛑 Stream Cleanup Service stopped', {
      uptime: Date.now() - this.startTime,
      totalTrims: this.metrics.totalTrims,
    });
  }

  /**
   * Get current health status
   */
  async getHealth(): Promise<CleanupHealth> {
    const streams = await Promise.all(
      Object.entries(this.options.maxLengths).map(async ([streamName, maxLength]) => {
        try {
          const info = await this.streamsService.getStreamInfo(streamName as StreamName);
          const currentLength = info?.length ?? 0;
          const usagePercent = (currentLength / maxLength) * 100;
          
          let status: 'healthy' | 'warning' | 'critical' = 'healthy';
          if (usagePercent > 90) status = 'critical';
          else if (usagePercent > 70) status = 'warning';

          return {
            name: streamName,
            length: currentLength,
            maxLength,
            lastTrim: this.metrics.perStream[streamName]?.lastTrim ?? null,
            status,
          };
        } catch (error) {
          return {
            name: streamName,
            length: 0,
            maxLength,
            lastTrim: null,
            status: 'critical' as const,
          };
        }
      })
    );

    return {
      isRunning: this.isRunning,
      lastRun: this.metrics.lastRun,
      totalTrims: this.metrics.totalTrims,
      errors: this.errorCount,
      uptime: Date.now() - this.startTime,
      streams,
    };
  }

  /**
   * Get current metrics
   */
  getMetrics(): CleanupMetrics {
    return { ...this.metrics };
  }

  /**
   * Perform a single cleanup cycle
   */
  private async performCleanup(): Promise<void> {
    const startTime = Date.now();
    let cycleTrims = 0;
    let cycleBytesFreed = 0;

    // Get current memory usage
    await this.updateMemoryUsage();

    // Determine if we need aggressive cleanup
    const needsAggressiveCleanup = this.options.aggressiveCleanup && 
      this.metrics.memoryUsage.current > this.options.memoryThresholdBytes;

    for (const [streamName, maxLength] of Object.entries(this.options.maxLengths)) {
      try {
        const streamInfo = await this.streamsService.getStreamInfo(streamName as StreamName);
        if (!streamInfo) continue;

        const currentLength = streamInfo.length;
        const shouldTrim = currentLength > maxLength || needsAggressiveCleanup;

        if (shouldTrim) {
          const beforeLength = currentLength;
          const targetLength = needsAggressiveCleanup ? Math.floor(maxLength * 0.5) : maxLength;

          // Perform the trim
          await this.streamsService.trimStream(streamName as StreamName, targetLength);

          // Get updated info to calculate bytes freed
          const afterInfo = await this.streamsService.getStreamInfo(streamName as StreamName);
          const afterLength = afterInfo?.length ?? 0;
          const trimmedCount = beforeLength - afterLength;

          if (trimmedCount > 0) {
            cycleTrims++;
            cycleBytesFreed += trimmedCount * 1024; // Rough estimate: 1KB per message

            // Update metrics
            this.metrics.totalTrims++;
            this.metrics.totalBytesFreed += trimmedCount * 1024;
            this.metrics.perStream[streamName].trims++;
            this.metrics.perStream[streamName].bytesFreed += trimmedCount * 1024;
            this.metrics.perStream[streamName].currentLength = afterLength;
            this.metrics.perStream[streamName].lastTrim = new Date();

            logger.info('Stream trimmed', {
              stream: streamName,
              beforeLength,
              afterLength,
              trimmedCount,
              targetLength,
              aggressive: needsAggressiveCleanup,
            });
          }
        } else {
          // Update current length in metrics
          this.metrics.perStream[streamName].currentLength = currentLength;
        }

      } catch (error) {
        logger.error('Failed to cleanup stream', {
          stream: streamName,
          error: error instanceof Error ? error.message : String(error),
        });
        this.errorCount++;
      }
    }

    // Update metrics
    this.metrics.lastRun = new Date();

    // Call metrics callback if provided
    if (this.options.onMetrics) {
      this.options.onMetrics({ ...this.metrics });
    }

    // Log cycle results if there was activity
    if (cycleTrims > 0) {
      logger.info('Stream cleanup cycle completed', {
        trims: cycleTrims,
        bytesFreed: cycleBytesFreed,
        duration: Date.now() - startTime,
        aggressive: needsAggressiveCleanup,
        memoryUsage: this.metrics.memoryUsage,
      });
    }
  }

  /**
   * Update memory usage metrics
   */
  private async updateMemoryUsage(): Promise<void> {
    try {
      const connectionStatus = await this.streamsService.getConnectionStatus();
      this.metrics.memoryUsage.current = connectionStatus.memory.used;
      this.metrics.memoryUsage.peak = connectionStatus.memory.peak;
    } catch (error) {
      logger.warn('Failed to get memory usage', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Force a cleanup cycle (for testing or manual triggers)
   */
  async forceCleanup(): Promise<{
    trims: number;
    bytesFreed: number;
    duration: number;
  }> {
    const startTime = Date.now();
    let trims = 0;
    let bytesFreed = 0;

    for (const [streamName, maxLength] of Object.entries(this.options.maxLengths)) {
      try {
        const streamInfo = await this.streamsService.getStreamInfo(streamName as StreamName);
        if (!streamInfo || streamInfo.length <= maxLength) continue;

        const beforeLength = streamInfo.length;
        await this.streamsService.trimStream(streamName as StreamName, maxLength);

        const afterInfo = await this.streamsService.getStreamInfo(streamName as StreamName);
        const afterLength = afterInfo?.length ?? 0;
        const trimmedCount = beforeLength - afterLength;

        if (trimmedCount > 0) {
          trims++;
          bytesFreed += trimmedCount * 1024; // Rough estimate
        }

      } catch (error) {
        logger.error('Force cleanup failed for stream', {
          stream: streamName,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      trims,
      bytesFreed,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Get detailed stream information
   */
  async getStreamDetails(): Promise<Array<{
    name: string;
    length: number;
    maxLength: number;
    usagePercent: number;
    lastTrim: Date | null;
    status: 'healthy' | 'warning' | 'critical';
  }>> {
    const details = await Promise.all(
      Object.entries(this.options.maxLengths).map(async ([streamName, maxLength]) => {
        try {
          const info = await this.streamsService.getStreamInfo(streamName as StreamName);
          const length = info?.length ?? 0;
          const usagePercent = (length / maxLength) * 100;
          
          let status: 'healthy' | 'warning' | 'critical' = 'healthy';
          if (usagePercent > 90) status = 'critical';
          else if (usagePercent > 70) status = 'warning';

          return {
            name: streamName,
            length,
            maxLength,
            usagePercent: Math.round(usagePercent * 100) / 100,
            lastTrim: this.metrics.perStream[streamName]?.lastTrim ?? null,
            status,
          };
        } catch (error) {
          return {
            name: streamName,
            length: 0,
            maxLength,
            usagePercent: 0,
            lastTrim: null,
            status: 'critical' as const,
          };
        }
      })
    );

    return details;
  }
}

/**
 * Factory function to create and start a cleanup service
 */
export function createStreamCleanupService(
  streamsService: RedisStreamsService,
  options: CleanupServiceOptions = {}
): StreamCleanupService {
  return new StreamCleanupService(streamsService, options);
}
