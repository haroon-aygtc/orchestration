// path: lib/redis/streams-pel-janitor.ts
// Production-grade PEL (Pending Entries List) Janitor Service
// Automatically recovers abandoned messages from crashed workers

import { RedisStreamsService, STREAMS, GROUPS, type StreamMessage } from './streams-service';
import { logger } from '../utils/structured-logger';

export interface PelJanitorOptions {
  /** How long a message must be idle to be considered abandoned (ms) */
  minIdleMs?: number;
  /** How many messages to claim per tick per target */
  batchSize?: number;
  /** How often to run the sweep (ms) */
  intervalMs?: number;
  /** Which stream/group pairs to watch */
  targets?: Array<{ stream: string; group: string }>;
  /** Optional processor for claimed messages */
  processor?: (msg: {
    stream: string;
    group: string;
    id: string;
    fields: Record<string, string>;
  }) => Promise<void>;
  /** Metrics callback for monitoring */
  onMetrics?: (metrics: PelJanitorMetrics) => void;
}

export interface PelJanitorMetrics {
  totalClaimed: number;
  totalAcked: number;
  totalFailed: number;
  perStream: Record<string, {
    claimed: number;
    acked: number;
    failed: number;
  }>;
  lastRun: Date;
  isRunning: boolean;
}

export interface PelJanitorHealth {
  isRunning: boolean;
  lastRun: Date | null;
  totalProcessed: number;
  errors: number;
  uptime: number;
  targets: Array<{ stream: string; group: string; status: 'healthy' | 'unhealthy' }>;
}

export class PelJanitorService {
  private streamsService: RedisStreamsService;
  private options: Required<Omit<PelJanitorOptions, 'processor' | 'onMetrics'>> & {
    processor?: PelJanitorOptions['processor'];
    onMetrics?: PelJanitorOptions['onMetrics'];
  };
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private consumerName: string;
  private startTime: number;
  private metrics: PelJanitorMetrics;
  private errorCount = 0;

  constructor(streamsService: RedisStreamsService, options: PelJanitorOptions = {}) {
    this.streamsService = streamsService;
    this.consumerName = `pel-janitor-${process.pid}-${Math.random().toString(36).slice(2, 7)}`;
    this.startTime = Date.now();
    
    this.options = {
      minIdleMs: options.minIdleMs ?? 30_000,
      batchSize: options.batchSize ?? 50,
      intervalMs: options.intervalMs ?? 2_000,
      targets: options.targets ?? [
        { stream: STREAMS.ORCH_EVENTS, group: GROUPS.ORCH },
        { stream: STREAMS.AGENT_COMM, group: GROUPS.AGENT },
        { stream: STREAMS.WF_STEPS, group: GROUPS.WF },
        { stream: STREAMS.NODE_EXEC, group: GROUPS.NODE },
        { stream: STREAMS.COORD_DECISIONS, group: GROUPS.COORD },
        { stream: STREAMS.COLLAB_REASONING, group: GROUPS.COLLAB },
        { stream: STREAMS.COLLAB_SUGGESTIONS, group: GROUPS.COLLAB },
        { stream: STREAMS.COLLAB_STATUS, group: GROUPS.COLLAB },
      ],
      processor: options.processor,
      onMetrics: options.onMetrics,
    };

    this.metrics = {
      totalClaimed: 0,
      totalAcked: 0,
      totalFailed: 0,
      perStream: {},
      lastRun: new Date(),
      isRunning: false,
    };

    // Initialize per-stream metrics
    this.options.targets.forEach(({ stream }) => {
      this.metrics.perStream[stream] = {
        claimed: 0,
        acked: 0,
        failed: 0,
      };
    });

    logger.info('🔧 PEL Janitor Service initialized', {
      consumerName: this.consumerName,
      targets: this.options.targets.length,
      intervalMs: this.options.intervalMs,
      minIdleMs: this.options.minIdleMs,
    });
  }

  /**
   * Start the PEL janitor service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('PEL Janitor is already running');
      return;
    }

    this.isRunning = true;
    this.metrics.isRunning = true;
    this.startTime = Date.now();

    // Start the cleanup interval
    this.intervalId = setInterval(() => {
      this.performCleanup().catch((error) => {
        logger.error('PEL Janitor cleanup failed:', {
          error: error instanceof Error ? error.message : String(error),
          consumerName: this.consumerName,
        });
        this.errorCount++;
      });
    }, this.options.intervalMs);

    logger.info('✅ PEL Janitor Service started', {
      consumerName: this.consumerName,
      intervalMs: this.options.intervalMs,
    });
  }

  /**
   * Stop the PEL janitor service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('PEL Janitor is not running');
      return;
    }

    this.isRunning = false;
    this.metrics.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    logger.info('🛑 PEL Janitor Service stopped', {
      consumerName: this.consumerName,
      uptime: Date.now() - this.startTime,
      totalProcessed: this.metrics.totalClaimed,
    });
  }

  /**
   * Get current health status
   */
  getHealth(): PelJanitorHealth {
    const targets = this.options.targets.map(({ stream, group }) => ({
      stream,
      group,
      status: 'healthy' as const, // Could be enhanced with actual health checks
    }));

    return {
      isRunning: this.isRunning,
      lastRun: this.metrics.lastRun,
      totalProcessed: this.metrics.totalClaimed,
      errors: this.errorCount,
      uptime: Date.now() - this.startTime,
      targets,
    };
  }

  /**
   * Get current metrics
   */
  getMetrics(): PelJanitorMetrics {
    return { ...this.metrics };
  }

  /**
   * Perform a single cleanup cycle
   */
  private async performCleanup(): Promise<void> {
    const startTime = Date.now();
    let cycleClaimed = 0;
    let cycleAcked = 0;
    let cycleFailed = 0;

    for (const { stream, group } of this.options.targets) {
      try {
        const claimed = await this.streamsService.claimPendingMessages(
          stream as any,
          group,
          this.consumerName,
          this.options.minIdleMs,
          this.options.batchSize
        );

        if (claimed.length === 0) continue;

        cycleClaimed += claimed.length;
        this.metrics.totalClaimed += claimed.length;
        this.metrics.perStream[stream].claimed += claimed.length;

        // Process each claimed message
        for (const message of claimed) {
          try {
            // Call processor if provided
            if (this.options.processor) {
              await this.options.processor({
                stream,
                group,
                id: message.id,
                fields: message.fields,
              });
            }

            // Acknowledge the message
            await this.streamsService.acknowledgeMessage(stream as any, group, message.id);
            
            cycleAcked++;
            this.metrics.totalAcked++;
            this.metrics.perStream[stream].acked++;

          } catch (error) {
            // Don't ACK on processor error - message stays pending for retry
            cycleFailed++;
            this.metrics.totalFailed++;
            this.metrics.perStream[stream].failed++;

            logger.warn('PEL Janitor: processor failed, leaving message pending', {
              stream,
              group,
              messageId: message.id,
              error: error instanceof Error ? error.message : String(error),
              consumerName: this.consumerName,
            });
          }
        }

      } catch (error) {
        logger.error('PEL Janitor: claim cycle failed', {
          stream,
          group,
          error: error instanceof Error ? error.message : String(error),
          consumerName: this.consumerName,
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
    if (cycleClaimed > 0) {
      logger.info('PEL Janitor cleanup cycle completed', {
        consumerName: this.consumerName,
        claimed: cycleClaimed,
        acked: cycleAcked,
        failed: cycleFailed,
        duration: Date.now() - startTime,
      });
    }
  }

  /**
   * Force a cleanup cycle (for testing or manual triggers)
   */
  async forceCleanup(): Promise<{
    claimed: number;
    acked: number;
    failed: number;
    duration: number;
  }> {
    const startTime = Date.now();
    let claimed = 0;
    let acked = 0;
    let failed = 0;

    for (const { stream, group } of this.options.targets) {
      try {
        const messages = await this.streamsService.claimPendingMessages(
          stream as any,
          group,
          this.consumerName,
          this.options.minIdleMs,
          this.options.batchSize
        );

        claimed += messages.length;

        for (const message of messages) {
          try {
            if (this.options.processor) {
              await this.options.processor({
                stream,
                group,
                id: message.id,
                fields: message.fields,
              });
            }

            await this.streamsService.acknowledgeMessage(stream as any, group, message.id);
            acked++;

          } catch (error) {
            failed++;
            logger.warn('Force cleanup: processor failed', {
              stream,
              group,
              messageId: message.id,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

      } catch (error) {
        logger.error('Force cleanup failed', {
          stream,
          group,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      claimed,
      acked,
      failed,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Factory function to create and start a PEL janitor
 */
export function createPelJanitor(
  streamsService: RedisStreamsService,
  options: PelJanitorOptions = {}
): PelJanitorService {
  return new PelJanitorService(streamsService, options);
}

/**
 * Legacy function for backward compatibility
 */
export function startPelJanitor(
  streamsService: RedisStreamsService,
  options: PelJanitorOptions = {}
): () => void {
  const janitor = new PelJanitorService(streamsService, options);
  
  // Start immediately
  janitor.start().catch((error) => {
    logger.error('Failed to start PEL Janitor:', error);
  });

  // Return stop function
  return () => {
    janitor.stop().catch((error) => {
      logger.error('Failed to stop PEL Janitor:', error);
    });
  };
}
