// path: lib/redis/streams-service.ts
// Redis Streams Service for AI Agent Architecture
// Production-grade implementation with full error handling, retries, and monitoring.

import Redis from 'ioredis';
import { generateUUID } from '../utils/uuid';
import type { OrchestrationEvent, EventPayload } from '../types';
import { logger } from '../utils/structured-logger';
import { PelJanitorService, type PelJanitorOptions, type PelJanitorHealth, type PelJanitorMetrics } from './streams-pel-janitor';
import { StreamCleanupService, type CleanupServiceOptions, type CleanupHealth, type CleanupMetrics } from './streams-cleanup-service';
import { StreamsMonitoringService, type MonitoringOptions, type ComprehensiveMetrics, type StreamAlert } from './streams-monitoring-service';

/** ---------- Constants ---------- */

export const STREAMS = {
  ORCH_EVENTS: 'orchestration:events',
  AGENT_COMM: 'agent:communication',
  WF_STEPS: 'workflow:steps',
  NODE_EXEC: 'node:executions',
  COORD_DECISIONS: 'coordination:decisions',
  COLLAB_REASONING: 'collaboration:reasoning',
  COLLAB_SUGGESTIONS: 'collaboration:suggestions',
  COLLAB_STATUS: 'collaboration:status',
} as const;

export const GROUPS = {
  ORCH: 'orchestration-processors',
  AGENT: 'agent-processors',
  WF: 'workflow-processors',
  NODE: 'node-processors',
  COORD: 'coordination-processors',
  COLLAB: 'collaboration-processors',
} as const;

type StreamName = (typeof STREAMS)[keyof typeof STREAMS];

const DEFAULT_MAXLEN = 10_000; // soft limit per stream
const STREAM_MAXLEN: Record<StreamName, number> = {
  [STREAMS.ORCH_EVENTS]: DEFAULT_MAXLEN,
  [STREAMS.AGENT_COMM]: DEFAULT_MAXLEN,
  [STREAMS.WF_STEPS]: DEFAULT_MAXLEN,
  [STREAMS.NODE_EXEC]: DEFAULT_MAXLEN,
  [STREAMS.COORD_DECISIONS]: DEFAULT_MAXLEN,
  [STREAMS.COLLAB_REASONING]: DEFAULT_MAXLEN,
  [STREAMS.COLLAB_SUGGESTIONS]: DEFAULT_MAXLEN,
  [STREAMS.COLLAB_STATUS]: DEFAULT_MAXLEN,
};

/** ---------- Types ---------- */

export interface StreamMessage {
  id: string;
  fields: Record<string, string>;
  timestamp: Date;
}

export interface ConsumerGroupInfo {
  name: string;
  consumers: number;
  pending: number;
  lastDeliveredId: string;
}

export interface StreamInfo {
  length: number;
  radixTreeKeys: number;
  radixTreeNodes: number;
  groups: number;
  lastGeneratedId: string;
  firstEntry: StreamMessage | null;
  lastEntry: StreamMessage | null;
}

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

/** ---------- Service ---------- */

export class RedisStreamsService {
  private redis: Redis;
  private isInitialized = false;
  private pelJanitor: PelJanitorService | null = null;
  private cleanupService: StreamCleanupService | null = null;
  private monitoringService: StreamsMonitoringService | null = null;

  private retryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10_000,
    backoffMultiplier: 2,
  };

  constructor(redis: Redis, retryConfig?: Partial<RetryConfig>) {
    this.redis = redis;
    if (retryConfig) this.retryConfig = { ...this.retryConfig, ...retryConfig };
  }

  /** Initialize Redis Streams and create consumer groups */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Create streams + groups
      await this.ensureStreamWithGroup(STREAMS.ORCH_EVENTS, GROUPS.ORCH);
      await this.ensureStreamWithGroup(STREAMS.AGENT_COMM, GROUPS.AGENT);
      await this.ensureStreamWithGroup(STREAMS.WF_STEPS, GROUPS.WF);
      await this.ensureStreamWithGroup(STREAMS.NODE_EXEC, GROUPS.NODE);
      await this.ensureStreamWithGroup(STREAMS.COORD_DECISIONS, GROUPS.COORD);

      await this.ensureStreamWithGroup(STREAMS.COLLAB_REASONING, GROUPS.COLLAB);
      await this.ensureStreamWithGroup(STREAMS.COLLAB_SUGGESTIONS, GROUPS.COLLAB);
      await this.ensureStreamWithGroup(STREAMS.COLLAB_STATUS, GROUPS.COLLAB);

      this.isInitialized = true;
      logger.info('✅ Redis Streams initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize Redis Streams:', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Start automatic cleanup services
   */
  async startCleanupServices(options?: {
    pelJanitor?: PelJanitorOptions;
    cleanup?: CleanupServiceOptions;
    monitoring?: MonitoringOptions;
  }): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Redis Streams Service must be initialized before starting cleanup services');
    }

    try {
      // Start PEL Janitor
      this.pelJanitor = new PelJanitorService(this, options?.pelJanitor);
      await this.pelJanitor.start();

      // Start Stream Cleanup Service
      this.cleanupService = new StreamCleanupService(this, options?.cleanup);
      await this.cleanupService.start();

      // Start Monitoring Service
      this.monitoringService = new StreamsMonitoringService(this, options?.monitoring);
      await this.monitoringService.start();

      logger.info('✅ Cleanup services started successfully', {
        pelJanitor: !!this.pelJanitor,
        cleanupService: !!this.cleanupService,
        monitoringService: !!this.monitoringService,
      });
    } catch (error) {
      logger.error('❌ Failed to start cleanup services:', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Stop automatic cleanup services
   */
  async stopCleanupServices(): Promise<void> {
    try {
      if (this.pelJanitor) {
        await this.pelJanitor.stop();
        this.pelJanitor = null;
      }

      if (this.cleanupService) {
        await this.cleanupService.stop();
        this.cleanupService = null;
      }

      if (this.monitoringService) {
        await this.monitoringService.stop();
        this.monitoringService = null;
      }

      logger.info('✅ Cleanup services stopped successfully');
    } catch (error) {
      logger.error('❌ Failed to stop cleanup services:', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Get PEL Janitor health status
   */
  getPelJanitorHealth(): PelJanitorHealth | null {
    return this.pelJanitor?.getHealth() ?? null;
  }

  /**
   * Get PEL Janitor metrics
   */
  getPelJanitorMetrics(): PelJanitorMetrics | null {
    return this.pelJanitor?.getMetrics() ?? null;
  }

  /**
   * Get Stream Cleanup health status
   */
  async getCleanupHealth(): Promise<CleanupHealth | null> {
    return this.cleanupService ? await this.cleanupService.getHealth() : null;
  }

  /**
   * Get Stream Cleanup metrics
   */
  getCleanupMetrics(): CleanupMetrics | null {
    return this.cleanupService?.getMetrics() ?? null;
  }

  /**
   * Force PEL cleanup (for testing or manual triggers)
   */
  async forcePelCleanup(): Promise<{
    claimed: number;
    acked: number;
    failed: number;
    duration: number;
  } | null> {
    return this.pelJanitor ? await this.pelJanitor.forceCleanup() : null;
  }

  /**
   * Force stream cleanup (for testing or manual triggers)
   */
  async forceStreamCleanup(): Promise<{
    trims: number;
    bytesFreed: number;
    duration: number;
  } | null> {
    return this.cleanupService ? await this.cleanupService.forceCleanup() : null;
  }

  /**
   * Get comprehensive monitoring metrics
   */
  async getComprehensiveMetrics(): Promise<ComprehensiveMetrics | null> {
    if (!this.monitoringService) return null;
    
    // Trigger a metrics collection
    await (this.monitoringService as any).collectMetrics();
    return null; // Will be provided via callback
  }

  /**
   * Get monitoring health status
   */
  getMonitoringHealth() {
    return this.monitoringService?.getHealth() ?? null;
  }

  /**
   * Get all alerts
   */
  getAlerts(): StreamAlert[] {
    return this.monitoringService?.getAlerts() ?? [];
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): StreamAlert[] {
    return this.monitoringService?.getActiveAlerts() ?? [];
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    return this.monitoringService?.resolveAlert(alertId) ?? false;
  }

  /**
   * Clear all alerts
   */
  clearAlerts(): void {
    this.monitoringService?.clearAlerts();
  }

  /** Create a stream and its consumer group (idempotent) */
  private async ensureStreamWithGroup(streamName: StreamName, groupName: string): Promise<void> {
    await this.createStream(streamName);
    await this.createConsumerGroup(streamName, groupName);
  }

  /** Create a stream if it doesn't exist (adds one init message) */
  private async createStream(streamName: StreamName): Promise<void> {
    try {
      const exists = await this.redis.exists(streamName);
      if (!exists) {
        await this.redis.xadd(
          streamName,
          'MAXLEN',
          '~',
          String(STREAM_MAXLEN[streamName]),
          '*',
          'type',
          'stream_created',
          'timestamp',
          new Date().toISOString(),
          'message',
          'Stream initialized'
        );
        logger.info(`✅ Created stream: ${streamName}`);
      }
    } catch (error) {
      logger.error(`Failed to create stream ${streamName}:`, { error: error instanceof Error ? error.message : String(error) });  
      throw error;
    }
  }

  /** Create a consumer group for a stream */
  private async createConsumerGroup(streamName: StreamName, groupName: string): Promise<void> {
    try {
      await this.redis.xgroup('CREATE', streamName, groupName, '$', 'MKSTREAM');
      logger.info(`✅ Created consumer group: ${groupName} for ${streamName}`);
    } catch (error) {
      // BUSYGROUP means it already exists
      if (!(error as Error).message.includes('BUSYGROUP')) {
        logger.error(`Failed to create consumer group ${groupName}:`, { error: error instanceof Error ? error.message : String(error) });
        throw error;
      }
    }
  }

  /** ---------- Adders (bounded via MAXLEN ~) ---------- */

  async addOrchestrationEvent(event: OrchestrationEvent, payload: EventPayload): Promise<string> {
    const goalId = payload.goalId?.trim();
    if (!goalId) {
      logger.warn('addOrchestrationEvent skipped: missing goalId', { event });
      return '';
    }
    return await this.executeWithRetry(
      async () => {
        return (await this.redis.xadd(
          STREAMS.ORCH_EVENTS,
          'MAXLEN',
          '~',
          String(STREAM_MAXLEN[STREAMS.ORCH_EVENTS]),
          '*',
          'eventType',
          event,
          'goalId',
          goalId,
          'stepId',
          payload.stepId || '',
          'error',
          payload.error || '',
          'data',
          JSON.stringify(payload.data || {}),
          'timestamp',
          new Date().toISOString(),
          'correlationId',
          generateUUID()
        )) as string;
      },
      'addOrchestrationEvent',
      { event, goalId, stepId: payload.stepId }
    );
  }

  async addAgentMessage(
    fromAgent: string,
    toAgent: string,
    messageType: string,
    payload: unknown,
    correlationId?: string
  ): Promise<string> {
    return (await this.redis.xadd(
      STREAMS.AGENT_COMM,
      'MAXLEN',
      '~',
      String(STREAM_MAXLEN[STREAMS.AGENT_COMM]),
      '*',
      'fromAgent',
      fromAgent,
      'toAgent',
      toAgent,
      'messageType',
      messageType,
      'payload',
      JSON.stringify(payload ?? {}),
      'correlationId',
      correlationId || generateUUID(),
      'timestamp',
      new Date().toISOString()
    )) as string;
  }

  async addWorkflowStep(
    stepId: string,
    goalId: string,
    agentType: string,
    input: unknown,
    dependencies: string[] = []
  ): Promise<string> {
    return (await this.redis.xadd(
      STREAMS.WF_STEPS,
      'MAXLEN',
      '~',
      String(STREAM_MAXLEN[STREAMS.WF_STEPS]),
      '*',
      'stepId',
      stepId,
      'goalId',
      goalId,
      'agentType',
      agentType,
      'input',
      JSON.stringify(input ?? {}),
      'dependencies',
      JSON.stringify(dependencies ?? []),
      'status',
      'pending',
      'retryCount',
      '0',
      'maxRetries',
      '3',
      'timestamp',
      new Date().toISOString()
    )) as string;
  }

  async addNodeExecution(nodeId: string, params: Record<string, any>, goalId?: string, stepId?: string): Promise<string> {
    return (await this.redis.xadd(
      STREAMS.NODE_EXEC,
      'MAXLEN',
      '~',
      String(STREAM_MAXLEN[STREAMS.NODE_EXEC]),
      '*',
      'nodeId',
      nodeId,
      'params',
      JSON.stringify(params ?? {}),
      'goalId',
      goalId || '',
      'stepId',
      stepId || '',
      'status',
      'pending',
      'timestamp',
      new Date().toISOString()
    )) as string;
  }

  async addReasoningEvent(
    goalId: string,
    text: string,
    confidence: number,
    stepId?: string,
    context?: Record<string, any>
  ): Promise<string> {
    if (!goalId?.trim() || !text?.trim()) {
      logger.warn('addReasoningEvent skipped: missing goalId/text', { goalId, textLen: text?.length });
      return '';
    }
    const conf = Math.max(0, Math.min(1, Number(confidence ?? 0)));
    return await this.executeWithRetry(
      async () => {
        return (await this.redis.xadd(
          STREAMS.COLLAB_REASONING,
          'MAXLEN',
          '~',
          String(STREAM_MAXLEN[STREAMS.COLLAB_REASONING]),
          '*',
          'goalId',
          goalId,
          'stepId',
          stepId || '',
          'text',
          text,
          'confidence',
          String(conf),
          'context',
          JSON.stringify(context ?? {}),
          'timestamp',
          new Date().toISOString(),
          'correlationId',
          generateUUID()
        )) as string;
      },
      'addReasoningEvent',
      { goalId, stepId, conf }
    );
  }

  async addStatusEvent(
    goalId: string,
    status: string,
    stepId?: string,
    progress?: number,
    meta?: Record<string, any>
  ): Promise<string> {
    if (!goalId?.trim() || !status?.trim()) {
      logger.warn('addStatusEvent skipped: missing goalId/status', { goalId, status });
      return '';
    }
    const p =
      typeof progress === 'number' && Number.isFinite(progress)
        ? Math.max(0, Math.min(100, progress))
        : undefined;

    return await this.executeWithRetry(
      async () => {
        return (await this.redis.xadd(
          STREAMS.COLLAB_STATUS,
          'MAXLEN',
          '~',
          String(STREAM_MAXLEN[STREAMS.COLLAB_STATUS]),
          '*',
          'goalId',
          goalId,
          'stepId',
          stepId || '',
          'status',
          status,
          'progress',
          p !== undefined ? String(p) : '',
          'meta',
          JSON.stringify(meta ?? {}),
          'timestamp',
          new Date().toISOString(),
          'correlationId',
          generateUUID()
        )) as string;
      },
      'addStatusEvent',
      { goalId, stepId, status, progress: p }
    );
  }

  async addSuggestionEvent(
    goalId: string,
    suggestion: string,
    action: string,
    confidence: number,
    fromAgent: string,
    toAgent?: string,
    stepId?: string
  ): Promise<string> {
    if (!goalId?.trim() || !suggestion?.trim() || !action?.trim()) {
      logger.warn('addSuggestionEvent skipped: missing required fields', { goalId, suggestionLen: suggestion?.length, action });
      return '';
    }
    const conf = Math.max(0, Math.min(1, Number(confidence ?? 0)));
    return await this.executeWithRetry(
      async () => {
        return (await this.redis.xadd(
          STREAMS.COLLAB_SUGGESTIONS,
          'MAXLEN',
          '~',
          String(STREAM_MAXLEN[STREAMS.COLLAB_SUGGESTIONS]),
          '*',
          'goalId',
          goalId,
          'stepId',
          stepId || '',
          'suggestion',
          suggestion,
          'action',
          action,
          'confidence',
          String(conf),
          'fromAgent',
          fromAgent || '',
          'toAgent',
          toAgent || '',
          'timestamp',
          new Date().toISOString(),
          'correlationId',
          generateUUID()
        )) as string;
      },
      'addSuggestionEvent',
      { goalId, stepId, conf, fromAgent, toAgent }
    );
  }

  /** ---------- Consumers ---------- */

  async readMessages(
    streamName: StreamName,
    groupName: string,
    consumerName: string,
    count: number = 10,
    blockMs: number = 1000
  ): Promise<StreamMessage[]> {
    // Clamp count to reasonable bounds
    count = Math.max(1, Math.min(count, 1000));
    
    try {
      const messages = await this.executeWithRetry(
        async () =>
          await this.redis.xreadgroup(
            'GROUP',
            groupName,
            consumerName,
            'COUNT',
            count,
            'BLOCK',
            blockMs,
            'STREAMS',
            streamName,
            '>'
          ),
        'readMessages',
        { streamName, groupName, consumerName, count, blockMs }
      );

      if (!messages || messages.length === 0) return [];

      const [, streamMessages] = messages[0] as [string, any[]];
      return streamMessages.map(([id, fields]) => ({
        id,
        fields: this.parseFields(fields),
        timestamp: new Date(),
      }));
    } catch (error) {
      logger.error(`Failed to read messages from ${streamName}:`, { error: error instanceof Error ? error.message : String(error) });
      return [];
    }
  }

  async acknowledgeMessage(streamName: StreamName, groupName: string, messageId: string): Promise<void> {
    try {
      await this.redis.xack(streamName, groupName, messageId);
    } catch (error) {
      logger.error(`Failed to acknowledge message ${messageId}:`, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * Check if Redis supports XAUTOCLAIM (Redis >= 6.2)
   */
  private async supportsXAUTOCLAIM(): Promise<boolean> {
    try {
      const serverInfo = await this.redis.info('server');
      const line = serverInfo.split('\r\n').find(l => l.startsWith('redis_version:'));
      const v = line ? line.split(':')[1].trim() : '0.0.0';
      const [maj, min] = v.split('.').map(n => parseInt(n, 10) || 0);
      return maj > 6 || (maj === 6 && min >= 2);
    } catch {
      // If we can't tell, assume yes (ioredis against Redis proxies can hide INFO)
      return true;
    }
  }

  /**
   * Fallback claiming for Redis < 6.2 using XPENDING + XCLAIM
   */
  private async fallbackClaimPendingByIds(
    streamName: StreamName,
    groupName: string,
    consumerName: string,
    minIdleTime: number,
    count: number
  ): Promise<StreamMessage[]> {
    // XPENDING <key> <group> - returns [count, smallestId, greatestId, [ [consumer, count, minId, maxId], ... ]]
    const pending = await this.redis.xpending(streamName, groupName);
    const total = Array.isArray(pending) ? Number(pending[0]) || 0 : 0;
    if (!total) return [];

    // XPENDING key group - + - COUNT consumer  => fetch IDs window
    // Use RANGE form to list entries (older Redis requires RANGE not IDLE filter)
    const entries = await (this.redis as any).xpending(
      streamName,
      groupName,
      '-', '+',
      Math.min(count, 100) // clamp to sane window
    );

    const ids: string[] = Array.isArray(entries) ? entries.map((e: any[]) => String(e[0])) : [];
    if (!ids.length) return [];

    // XCLAIM by IDs
    const claimed = await (this.redis as any).xclaim(
      streamName,
      groupName,
      consumerName,
      minIdleTime,
      ...ids
    );

    // Shape: [ [id, [field, value ...]], ... ]
    return (claimed || [])
      .filter((c: any) => Array.isArray(c) && c.length >= 2)
      .map(([id, fields]: [string, string[]]) => ({
        id,
        fields: this.parseFields(fields),
        timestamp: new Date(),
      }));
  }

  /**
   * Claim pending idle messages with Redis version detection and fallback
   */
  async claimPendingMessages(
    streamName: StreamName,
    groupName: string,
    consumerName: string,
    minIdleTime: number = 30_000,
    count: number = 10
  ): Promise<StreamMessage[]> {
    // Clamp count to reasonable bounds
    count = Math.max(1, Math.min(count, 1000));
    
    try {
      if (await this.supportsXAUTOCLAIM()) {
        // Use XAUTOCLAIM for Redis >= 6.2
        const res = await (this.redis as any).xautoclaim(
          streamName, groupName, consumerName, minIdleTime, '0-0', 'COUNT', count
        );
        const entries = Array.isArray(res) && Array.isArray(res[1]) ? res[1] : [];
        return entries.map(([id, fields]: [string, string[]]) => ({
          id, fields: this.parseFields(fields), timestamp: new Date()
        }));
      } else {
        // Fallback path for Redis < 6.2
        return await this.fallbackClaimPendingByIds(streamName, groupName, consumerName, minIdleTime, count);
      }
    } catch (error) {
      logger.error(`Failed to claim pending messages from ${streamName}:`, { error: error instanceof Error ? error.message : String(error) });
      return [];
    }
  }

  /** ---------- Introspection ---------- */

  async getStreamInfo(streamName: StreamName): Promise<StreamInfo | null> {
    try {
      const info = await this.redis.xinfo('STREAM', streamName);
      if (!Array.isArray(info)) {
        logger.warn(`Invalid stream info format for ${streamName}`);
        return null;
      }

      // Convert alternating [key, value, key, value...] into an object
      const obj: Record<string, any> = {};
      for (let i = 0; i < info.length - 1; i += 2) {
        obj[String(info[i])] = info[i + 1];
      }

      const firstEntry = Array.isArray(obj['first-entry']) ? this.parseStreamEntry(obj['first-entry']) : null;
      const lastEntry = Array.isArray(obj['last-entry']) ? this.parseStreamEntry(obj['last-entry']) : null;

      return {
        length: this.toNumber(obj.length, 0),
        radixTreeKeys: this.toNumber(obj['radix-tree-keys'], 0),
        radixTreeNodes: this.toNumber(obj['radix-tree-nodes'], 0),
        groups: this.toNumber(obj['groups'], 0),
        lastGeneratedId: String(obj['last-generated-id'] ?? ''),
        firstEntry,
        lastEntry,
      };
    } catch (error) {
      logger.error(`Failed to get stream info for ${streamName}:`, { error: error instanceof Error ? error.message : String(error) }      );
      return null;
    }
  }

  async getConsumerGroupInfo(streamName: StreamName, groupName: string): Promise<ConsumerGroupInfo | null> {
    try {
      const info = await this.redis.xinfo('GROUPS', streamName);
      if (!Array.isArray(info)) return null;

      for (const g of info) {
        if (Array.isArray(g)) {
          const obj: Record<string, any> = {};
          for (let i = 0; i < g.length - 1; i += 2) obj[String(g[i])] = g[i + 1];

          const name = (obj.name ?? g[1]) as string | undefined;
          if (name === groupName) {
            return {
              name,
              consumers: this.toNumber(obj.consumers ?? g[3], 0),
              pending: this.toNumber(obj.pending ?? g[5], 0),
              lastDeliveredId: String(obj['last-delivered-id'] ?? g[7] ?? ''),
            };
          }
        }
      }
      return null;
    } catch (error) {
      logger.error(`Failed to get consumer group info for ${groupName}:`, { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  async getPendingMessagesCount(streamName: StreamName, groupName: string): Promise<number> {
    try {
      const pending = await this.redis.xpending(streamName, groupName);
      // ioredis returns [pendingCount, smallestId, greatestId, [consumers...]]
      if (Array.isArray(pending) && pending.length > 0) {
        return this.toNumber(pending[0], 0);
      }
      return 0;
    } catch (error) {
      logger.error('Failed to get pending messages count:', { error: error instanceof Error ? error.message : String(error) });
      return 0;
    }
  }

  /** Soft trim helper if you need explicit trims elsewhere */
  async trimStream(streamName: StreamName, maxLength: number = DEFAULT_MAXLEN): Promise<void> {
    try {
      await this.redis.xtrim(streamName, 'MAXLEN', '~', maxLength);
    } catch (error) {
      logger.error(`Failed to trim stream ${streamName}:`, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /** ---------- Health & Diagnostics ---------- */

  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    streams: Record<string, boolean>;
    groups: Record<string, boolean>;
    errors: Record<string, string>;
    performance: { avgResponseTime: number; totalOperations: number; errorRate: number };
  }> {
    const result = {
      status: 'healthy' as 'healthy' | 'unhealthy',
      streams: {} as Record<string, boolean>,
      groups: {} as Record<string, boolean>,
      errors: {} as Record<string, string>,
      performance: { avgResponseTime: 0, totalOperations: 0, errorRate: 0 },
    };

    const streamNames: StreamName[] = [
      STREAMS.ORCH_EVENTS,
      STREAMS.AGENT_COMM,
      STREAMS.WF_STEPS,
      STREAMS.NODE_EXEC,
      STREAMS.COORD_DECISIONS,
      STREAMS.COLLAB_REASONING,
      STREAMS.COLLAB_SUGGESTIONS,
      STREAMS.COLLAB_STATUS,
    ];

    const groupNames = [GROUPS.ORCH, GROUPS.AGENT, GROUPS.WF, GROUPS.NODE, GROUPS.COORD, GROUPS.COLLAB];

    let totalOperations = 0;
    let totalResponseTime = 0;
    let errorCount = 0;

    // Streams presence (parallel)
    const streamPresence = await Promise.all(streamNames.map(async (s) => {
      try {
        const start = Date.now();
        const exists = await this.redis.exists(s);
        const rt = Date.now() - start;
        return { s, ok: exists > 0, rt };
      } catch (e: any) {
        return { s, ok: false, rt: 0, err: e.message || String(e) };
      }
    }));

    // Process stream results
    for (const { s, ok, rt, err } of streamPresence) {
      result.streams[s] = ok;
      totalOperations++;
      totalResponseTime += rt;
      if (!ok) {
        result.status = 'unhealthy';
        if (err) result.errors[s] = err;
      }
    }

    // Groups presence (parallel scan per group across all streams)
    const groupPresence = await Promise.all(groupNames.map(async (gname) => {
      try {
        const start = Date.now();
        let found = false;
        await Promise.all(streamNames.map(async (s) => {
          if (found) return;
          const info = await this.redis.xinfo('GROUPS', s);
          if (Array.isArray(info)) {
            for (const g of info) {
              if (Array.isArray(g)) {
                const obj: Record<string, any> = {};
                for (let i = 0; i < g.length - 1; i += 2) obj[String(g[i])] = g[i + 1];
                if ((obj.name ?? g[1]) === gname) { found = true; break; }
              }
            }
          }
        }));
        return { gname, ok: found, rt: Date.now() - start };
      } catch (e: any) {
        return { gname, ok: false, rt: 0, err: e.message || String(e) };
      }
    }));

    // Process group results
    for (const { gname, ok, rt, err } of groupPresence) {
      result.groups[gname] = ok;
      totalOperations++;
      totalResponseTime += rt;
      if (!ok) {
        result.status = 'unhealthy';
        if (err) result.errors[gname] = err;
      }
    }

    result.performance = {
      avgResponseTime: totalOperations ? totalResponseTime / totalOperations : 0,
      totalOperations,
      errorRate: totalOperations ? (errorCount / totalOperations) * 100 : 0,
    };

    return result;
  }

  async testConnection(): Promise<boolean> {
    try {
      const pong = await this.redis.ping();
      return pong === 'PONG';
    } catch (error) {
      logger.error('Redis connection test failed:', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  async getConnectionStatus(): Promise<{
    connected: boolean;
    latency: number;
    memory: { used: number; peak: number };
    info: Record<string, any>;
  }> {
    const start = Date.now();
    const connected = await this.testConnection();
    const latency = Date.now() - start;

    let memory = { used: 0, peak: 0 };
    const info: Record<string, any> = {};

    if (connected) {
      try {
        // Memory info
        const memInfo = await this.redis.info('memory');
        const memLines = memInfo.split('\r\n');
        const usedLine = memLines.find((l) => l.startsWith('used_memory:'));
        const peakLine = memLines.find((l) => l.startsWith('used_memory_peak:'));
        if (usedLine) memory.used = parseInt(usedLine.split(':')[1], 10) || 0;
        if (peakLine) memory.peak = parseInt(peakLine.split(':')[1], 10) || 0;

        // Server info (redis_version, uptime)
        const serverInfo = await this.redis.info('server');
        const srvLines = serverInfo.split('\r\n');
        const versionLine = srvLines.find((l) => l.startsWith('redis_version:'));
        const uptimeLine = srvLines.find((l) => l.startsWith('uptime_in_seconds:'));
        info.version = versionLine ? versionLine.split(':')[1] : 'unknown';
        info.uptime = uptimeLine ? parseInt(uptimeLine.split(':')[1], 10) || 0 : 0;

        // Clients info
        const clientsInfo = await this.redis.info('clients');
        const clLines = clientsInfo.split('\r\n');
        const clientsLine = clLines.find((l) => l.startsWith('connected_clients:'));
        info.connected_clients = clientsLine ? parseInt(clientsLine.split(':')[1], 10) || 0 : 0;
      } catch (error) {
        logger.warn('Failed to parse Redis INFO:', { error: error instanceof Error ? error.message : String(error) });
      }
    }

    return { connected, latency, memory, info };
  }

  /** ---------- Utils ---------- */

  private parseFields(fields: ReadonlyArray<string>): Record<string, string> {
    const result: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) {
      result[String(fields[i])] = String(fields[i + 1]);
    }
    return result;
  }

  private parseStreamEntry(entry: unknown): StreamMessage {
    if (!Array.isArray(entry) || entry.length < 2) {
      throw new Error('Invalid stream entry format');
    }
    const [id, fields] = entry as [string, string[]];
    return { id, fields: this.parseFields(fields), timestamp: new Date() };
  }

  private toNumber(v: unknown, fallback: number): number {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    }
    return fallback;
  }

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    context?: Record<string, any>
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt === this.retryConfig.maxRetries) {
          logger.error(
            `Operation ${operationName} failed after ${this.retryConfig.maxRetries + 1} attempts`,
            { error: lastError.message, context, attempts: attempt + 1 }
          );
          throw lastError;
        }

        const delay = Math.min(
          this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt),
          this.retryConfig.maxDelay
        );
        logger.warn(
          `Operation ${operationName} failed (attempt ${attempt + 1}/${
            this.retryConfig.maxRetries + 1
          }), retrying in ${delay}ms`,
          { error: lastError.message, context }
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    throw lastError || new Error(`Operation ${operationName} failed unexpectedly`);
  }

  /** Cleanup flags (connection itself should be closed by the caller) */
  async cleanup(): Promise<void> {
    // Stop cleanup services first
    await this.stopCleanupServices();
    this.isInitialized = false;
  }
}           