// path: lib/redis/streams-monitoring-service.ts
// Production-grade Redis Streams Monitoring Service
// Comprehensive monitoring, metrics, and alerting for Redis Streams

import { RedisStreamsService, STREAMS, GROUPS, type StreamName } from './streams-service';
import { logger } from '../utils/structured-logger';
import type { PelJanitorHealth, PelJanitorMetrics } from './streams-pel-janitor';
import type { CleanupHealth, CleanupMetrics } from './streams-cleanup-service';

export interface MonitoringOptions {
  /** How often to collect metrics (ms) */
  collectionIntervalMs?: number;
  /** Enable detailed stream analytics */
  enableAnalytics?: boolean;
  /** Alert thresholds */
  thresholds?: {
    /** Stream length warning threshold (percentage) */
    streamLengthWarning?: number;
    /** Stream length critical threshold (percentage) */
    streamLengthCritical?: number;
    /** PEL count warning threshold */
    pelWarning?: number;
    /** PEL count critical threshold */
    pelCritical?: number;
    /** Memory usage warning threshold (bytes) */
    memoryWarning?: number;
    /** Memory usage critical threshold (bytes) */
    memoryCritical?: number;
  };
  /** Alert callbacks */
  onAlert?: (alert: StreamAlert) => void;
  /** Metrics callback */
  onMetrics?: (metrics: ComprehensiveMetrics) => void;
}

export interface StreamAlert {
  id: string;
  type: 'warning' | 'critical' | 'info';
  category: 'stream' | 'pel' | 'memory' | 'performance' | 'health';
  message: string;
  stream?: string;
  value?: number;
  threshold?: number;
  timestamp: Date;
  resolved?: boolean;
}

export interface StreamAnalytics {
  stream: string;
  totalMessages: number;
  messagesPerHour: number;
  averageMessageSize: number;
  peakLength: number;
  currentLength: number;
  growthRate: number;
  lastActivity: Date;
  healthScore: number;
}

export interface ComprehensiveMetrics {
  timestamp: Date;
  streams: {
    total: number;
    healthy: number;
    warning: number;
    critical: number;
    analytics: StreamAnalytics[];
  };
  pel: {
    totalPending: number;
    oldestPending: number;
    janitorHealth: PelJanitorHealth | null;
    janitorMetrics: PelJanitorMetrics | null;
  };
  cleanup: {
    totalTrims: number;
    bytesFreed: number;
    cleanupHealth: CleanupHealth | null;
    cleanupMetrics: CleanupMetrics | null;
  };
  performance: {
    avgResponseTime: number;
    errorRate: number;
    throughput: number;
    memoryUsage: {
      current: number;
      peak: number;
      threshold: number;
    };
  };
  alerts: StreamAlert[];
}

export interface MonitoringHealth {
  isRunning: boolean;
  lastCollection: Date | null;
  totalCollections: number;
  errors: number;
  uptime: number;
  alerts: {
    active: number;
    resolved: number;
    total: number;
  };
}

export class StreamsMonitoringService {
  private streamsService: RedisStreamsService;
  private options: Required<Omit<MonitoringOptions, 'onAlert' | 'onMetrics'>> & {
    onAlert?: MonitoringOptions['onAlert'];
    onMetrics?: MonitoringOptions['onMetrics'];
  };
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private startTime: number;
  private collectionCount = 0;
  private errorCount = 0;
  private alerts: Map<string, StreamAlert> = new Map();
  private streamHistory: Map<string, Array<{ timestamp: Date; length: number }>> = new Map();

  constructor(streamsService: RedisStreamsService, options: MonitoringOptions = {}) {
    this.streamsService = streamsService;
    this.startTime = Date.now();

    this.options = {
      collectionIntervalMs: options.collectionIntervalMs ?? 30_000, // 30 seconds
      enableAnalytics: options.enableAnalytics ?? true,
      thresholds: {
        streamLengthWarning: options.thresholds?.streamLengthWarning ?? 70,
        streamLengthCritical: options.thresholds?.streamLengthCritical ?? 90,
        pelWarning: options.thresholds?.pelWarning ?? 100,
        pelCritical: options.thresholds?.pelCritical ?? 500,
        memoryWarning: options.thresholds?.memoryWarning ?? 50 * 1024 * 1024, // 50MB
        memoryCritical: options.thresholds?.memoryCritical ?? 100 * 1024 * 1024, // 100MB
      },
      onAlert: options.onAlert,
      onMetrics: options.onMetrics,
    };

    // Initialize stream history
    Object.values(STREAMS).forEach(stream => {
      this.streamHistory.set(stream, []);
    });

    logger.info('📊 Streams Monitoring Service initialized', {
      collectionInterval: this.options.collectionIntervalMs,
      analytics: this.options.enableAnalytics,
      thresholds: this.options.thresholds,
    });
  }

  /**
   * Start the monitoring service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Streams Monitoring Service is already running');
      return;
    }

    this.isRunning = true;
    this.startTime = Date.now();

    // Start the monitoring interval
    this.intervalId = setInterval(() => {
      this.collectMetrics().catch((error) => {
        logger.error('Streams monitoring collection failed:', {
          error: error instanceof Error ? error.message : String(error),
        });
        this.errorCount++;
      });
    }, this.options.collectionIntervalMs);

    // Perform initial collection
    await this.collectMetrics();

    logger.info('✅ Streams Monitoring Service started', {
      collectionInterval: this.options.collectionIntervalMs,
    });
  }

  /**
   * Stop the monitoring service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Streams Monitoring Service is not running');
      return;
    }

    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    logger.info('🛑 Streams Monitoring Service stopped', {
      uptime: Date.now() - this.startTime,
      collections: this.collectionCount,
    });
  }

  /**
   * Get current health status
   */
  getHealth(): MonitoringHealth {
    const activeAlerts = Array.from(this.alerts.values()).filter(alert => !alert.resolved);
    const resolvedAlerts = Array.from(this.alerts.values()).filter(alert => alert.resolved);

    return {
      isRunning: this.isRunning,
      lastCollection: this.collectionCount > 0 ? new Date() : null,
      totalCollections: this.collectionCount,
      errors: this.errorCount,
      uptime: Date.now() - this.startTime,
      alerts: {
        active: activeAlerts.length,
        resolved: resolvedAlerts.length,
        total: this.alerts.size,
      },
    };
  }

  /**
   * Get all alerts
   */
  getAlerts(): StreamAlert[] {
    return Array.from(this.alerts.values()).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): StreamAlert[] {
    return Array.from(this.alerts.values())
      .filter(alert => !alert.resolved)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      this.alerts.set(alertId, alert);
      return true;
    }
    return false;
  }

  /**
   * Clear all alerts
   */
  clearAlerts(): void {
    this.alerts.clear();
  }

  /**
   * Perform a single metrics collection
   */
  private async collectMetrics(): Promise<void> {
    const startTime = Date.now();
    const timestamp = new Date();

    try {
      // Collect basic stream information
      const streamInfos = await Promise.all(
        Object.values(STREAMS).map(async (streamName) => {
          try {
            const info = await this.streamsService.getStreamInfo(streamName);
            return { stream: streamName, info };
          } catch (error) {
            logger.warn('Failed to get stream info', { stream: streamName, error });
            return { stream: streamName, info: null };
          }
        })
      );

      // Collect PEL information
      const pelCounts = await Promise.all(
        Object.values(GROUPS).map(async (groupName) => {
          try {
            const count = await this.streamsService.getPendingMessagesCount(
              Object.values(STREAMS)[0] as StreamName, // Use first stream as representative
              groupName
            );
            return { group: groupName, count };
          } catch (error) {
            logger.warn('Failed to get PEL count', { group: groupName, error });
            return { group: groupName, count: 0 };
          }
        })
      );

      // Get cleanup service metrics
      const pelJanitorHealth = this.streamsService.getPelJanitorHealth();
      const pelJanitorMetrics = this.streamsService.getPelJanitorMetrics();
      const cleanupHealth = await this.streamsService.getCleanupHealth();
      const cleanupMetrics = this.streamsService.getCleanupMetrics();

      // Get connection status
      const connectionStatus = await this.streamsService.getConnectionStatus();

      // Calculate analytics
      const analytics = this.options.enableAnalytics 
        ? await this.calculateStreamAnalytics(streamInfos)
        : [];

      // Check for alerts
      await this.checkAlerts(streamInfos, pelCounts, connectionStatus);

      // Build comprehensive metrics
      const metrics: ComprehensiveMetrics = {
        timestamp,
        streams: {
          total: streamInfos.length,
          healthy: streamInfos.filter(({ info }) => info && info.length < this.options.thresholds.streamLengthWarning).length,
          warning: streamInfos.filter(({ info }) => info && info.length >= this.options.thresholds.streamLengthWarning && info.length < this.options.thresholds.streamLengthCritical).length,
          critical: streamInfos.filter(({ info }) => info && info.length >= this.options.thresholds.streamLengthCritical).length,
          analytics,
        },
        pel: {
          totalPending: pelCounts.reduce((sum, { count }) => sum + count, 0),
          oldestPending: Math.max(...pelCounts.map(({ count }) => count)),
          janitorHealth: pelJanitorHealth,
          janitorMetrics: pelJanitorMetrics,
        },
        cleanup: {
          totalTrims: cleanupMetrics?.totalTrims ?? 0,
          bytesFreed: cleanupMetrics?.totalBytesFreed ?? 0,
          cleanupHealth: cleanupHealth,
          cleanupMetrics: cleanupMetrics,
        },
        performance: {
          avgResponseTime: connectionStatus.latency,
          errorRate: this.errorCount / Math.max(this.collectionCount, 1) * 100,
          throughput: this.calculateThroughput(),
          memoryUsage: {
            current: connectionStatus.memory.used,
            peak: connectionStatus.memory.peak,
            threshold: this.options.thresholds.memoryCritical,
          },
        },
        alerts: this.getActiveAlerts(),
      };

      // Call metrics callback
      if (this.options.onMetrics) {
        this.options.onMetrics(metrics);
      }

      this.collectionCount++;

      logger.debug('Metrics collection completed', {
        duration: Date.now() - startTime,
        streams: metrics.streams.total,
        alerts: metrics.alerts.length,
      });

    } catch (error) {
      logger.error('Metrics collection failed:', {
        error: error instanceof Error ? error.message : String(error),
      });
      this.errorCount++;
    }
  }

  /**
   * Calculate stream analytics
   */
  private async calculateStreamAnalytics(streamInfos: Array<{ stream: string; info: any }>): Promise<StreamAnalytics[]> {
    const analytics: StreamAnalytics[] = [];

    for (const { stream, info } of streamInfos) {
      if (!info) continue;

      const history = this.streamHistory.get(stream) || [];
      const currentLength = info.length;
      const now = new Date();

      // Add current data point
      history.push({ timestamp: now, length: currentLength });

      // Keep only last 24 hours of data
      const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const recentHistory = history.filter(h => h.timestamp > cutoff);
      this.streamHistory.set(stream, recentHistory);

      // Calculate analytics
      const totalMessages = recentHistory.reduce((sum, h) => sum + h.length, 0);
      const messagesPerHour = recentHistory.length > 0 ? totalMessages / (recentHistory.length / 60) : 0;
      const peakLength = Math.max(...recentHistory.map(h => h.length), currentLength);
      const growthRate = recentHistory.length > 1 
        ? (currentLength - recentHistory[0].length) / recentHistory.length 
        : 0;

      // Calculate health score (0-100)
      const usagePercent = (currentLength / 10000) * 100; // Assuming 10k max length
      const healthScore = Math.max(0, 100 - usagePercent);

      analytics.push({
        stream,
        totalMessages,
        messagesPerHour,
        averageMessageSize: 1024, // Rough estimate
        peakLength,
        currentLength,
        growthRate,
        lastActivity: recentHistory[recentHistory.length - 1]?.timestamp || now,
        healthScore,
      });
    }

    return analytics;
  }

  /**
   * Check for alerts and create them if needed
   */
  private async checkAlerts(
    streamInfos: Array<{ stream: string; info: any }>,
    pelCounts: Array<{ group: string; count: number }>,
    connectionStatus: any
  ): Promise<void> {
    const now = new Date();

    // Check stream length alerts
    for (const { stream, info } of streamInfos) {
      if (!info) continue;

      const usagePercent = (info.length / 10000) * 100; // Assuming 10k max length
      const alertId = `stream-length-${stream}`;

      if (usagePercent >= this.options.thresholds.streamLengthCritical) {
        this.createAlert({
          id: alertId,
          type: 'critical',
          category: 'stream',
          message: `Stream ${stream} is at critical length: ${info.length} messages`,
          stream,
          value: info.length,
          threshold: this.options.thresholds.streamLengthCritical,
          timestamp: now,
        });
      } else if (usagePercent >= this.options.thresholds.streamLengthWarning) {
        this.createAlert({
          id: alertId,
          type: 'warning',
          category: 'stream',
          message: `Stream ${stream} is approaching limit: ${info.length} messages`,
          stream,
          value: info.length,
          threshold: this.options.thresholds.streamLengthWarning,
          timestamp: now,
        });
      } else {
        // Resolve existing alert if stream is healthy
        this.resolveAlert(alertId);
      }
    }

    // Check PEL alerts
    const totalPending = pelCounts.reduce((sum, { count }) => sum + count, 0);
    const pelAlertId = 'pel-count';

    if (totalPending >= this.options.thresholds.pelCritical) {
      this.createAlert({
        id: pelAlertId,
        type: 'critical',
        category: 'pel',
        message: `Critical PEL count: ${totalPending} pending messages`,
        value: totalPending,
        threshold: this.options.thresholds.pelCritical,
        timestamp: now,
      });
    } else if (totalPending >= this.options.thresholds.pelWarning) {
      this.createAlert({
        id: pelAlertId,
        type: 'warning',
        category: 'pel',
        message: `High PEL count: ${totalPending} pending messages`,
        value: totalPending,
        threshold: this.options.thresholds.pelWarning,
        timestamp: now,
      });
    } else {
      this.resolveAlert(pelAlertId);
    }

    // Check memory alerts
    const memoryAlertId = 'memory-usage';
    const memoryUsage = connectionStatus.memory.used;

    if (memoryUsage >= this.options.thresholds.memoryCritical) {
      this.createAlert({
        id: memoryAlertId,
        type: 'critical',
        category: 'memory',
        message: `Critical memory usage: ${Math.round(memoryUsage / 1024 / 1024)}MB`,
        value: memoryUsage,
        threshold: this.options.thresholds.memoryCritical,
        timestamp: now,
      });
    } else if (memoryUsage >= this.options.thresholds.memoryWarning) {
      this.createAlert({
        id: memoryAlertId,
        type: 'warning',
        category: 'memory',
        message: `High memory usage: ${Math.round(memoryUsage / 1024 / 1024)}MB`,
        value: memoryUsage,
        threshold: this.options.thresholds.memoryWarning,
        timestamp: now,
      });
    } else {
      this.resolveAlert(memoryAlertId);
    }
  }

  /**
   * Create or update an alert
   */
  private createAlert(alert: StreamAlert): void {
    const existing = this.alerts.get(alert.id);
    if (existing && existing.type === alert.type) {
      // Update existing alert timestamp
      existing.timestamp = alert.timestamp;
      this.alerts.set(alert.id, existing);
    } else {
      // Create new alert
      this.alerts.set(alert.id, alert);
      
      // Call alert callback
      if (this.options.onAlert) {
        this.options.onAlert(alert);
      }

      logger.warn('Stream alert created', {
        id: alert.id,
        type: alert.type,
        category: alert.category,
        message: alert.message,
        value: alert.value,
        threshold: alert.threshold,
      });
    }
  }

  /**
   * Calculate throughput
   */
  private calculateThroughput(): number {
    // Simple throughput calculation based on collection frequency
    return this.collectionCount / ((Date.now() - this.startTime) / 1000 / 60); // Collections per minute
  }
}

/**
 * Factory function to create and start a monitoring service
 */
export function createStreamsMonitoringService(
  streamsService: RedisStreamsService,
  options: MonitoringOptions = {}
): StreamsMonitoringService {
  return new StreamsMonitoringService(streamsService, options);
}
