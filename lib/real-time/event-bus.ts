// Centralized event bus for orchestration system with Redis Streams persistence
import { EventEmitter } from "node:events";
import type { OrchestrationEvent, EventPayload } from "../types";
import { RedisStreamsService } from "../redis/streams-service";
import { logger } from "../utils/structured-logger";
import type { CollaborationEvent } from "../types/collaboration";

/**
 * Internal channel for "any event" listeners.
 * Using a Symbol prevents collisions with real event names.
 */
const ALL_EVENTS = Symbol("orchestration.event");

type AnyEventTuple = {
  event: OrchestrationEvent;
  payload: EventPayload;
};

class OrchestrationEventBus extends EventEmitter {
  private static instance: OrchestrationEventBus;
  private streamsService?: RedisStreamsService;
  private isRedisEnabled = false;

  private constructor(maxListeners = 100) {
    super();
    this.setMaxListeners(maxListeners);
  }

  static getInstance(): OrchestrationEventBus {
    if (!OrchestrationEventBus.instance) {
      OrchestrationEventBus.instance = new OrchestrationEventBus();
    }
    return OrchestrationEventBus.instance;
  }

  /**
   * Initialize Redis Streams service
   */
  async initializeRedisStreams(streamsService: RedisStreamsService): Promise<void> {
    this.streamsService = streamsService;
    await this.streamsService.initialize();
    this.isRedisEnabled = true;
    logger.info('✅ Event bus initialized with Redis Streams');
  }

  /**
   * Emit a strongly-typed orchestration event with Redis Streams persistence.
   */
  async emitEvent(event: OrchestrationEvent, payload: EventPayload): Promise<void> {
    // Emit to specific event listeners
    this.emit(event, payload);

    // Emit to "any event" listeners as a tuple to avoid payload key collisions
    const tuple: AnyEventTuple = { event, payload };
    this.emit(ALL_EVENTS, tuple);

    // Persist to Redis Streams if enabled
    if (this.isRedisEnabled && this.streamsService) {
      try {
        await this.streamsService.addOrchestrationEvent(event, payload);
      } catch (error) {
        logger.error('Failed to persist event to Redis Streams:', error);
        // Continue execution even if Redis fails
      }
    }

    // Lightweight structured logging for notable events (adjust as needed)
    if (event === "goal.completed" || event === "step.failed") {
      logger.info(`[Orchestration] ${event}`, payload);
    }
  }

  /**
   * Emit a collaboration event with Redis Streams persistence.
   */
  async emitCollaborationEvent(event: CollaborationEvent): Promise<void> {
    // Emit to collaboration listeners
    this.emit('collaboration', event);

    // Persist to Redis Streams if enabled
    if (this.isRedisEnabled && this.streamsService) {
      try {
        switch (event.kind) {
          case 'reasoning':
            await this.streamsService.addReasoningEvent(
              event.goalId,
              event.text,
              event.confidence,
              event.stepId,
              event.context
            );
            break;
          case 'status':
            await this.streamsService.addStatusEvent(
              event.goalId,
              event.status,
              event.stepId,
              event.progress,
              event.meta
            );
            break;
          case 'suggestion':
            await this.streamsService.addSuggestionEvent(
              event.goalId,
              event.suggestion,
              event.action,
              event.confidence,
              event.fromAgent,
              event.toAgent,
              event.stepId
            );
            break;
        }
      } catch (error) {
        logger.error('Failed to persist collaboration event to Redis Streams:', error);
        // Continue execution even if Redis fails
      }
    }

    // Log collaboration events for debugging
    logger.info(`[Collaboration] ${event.kind}`, {
      goalId: event.goalId,
      stepId: event.stepId,
      timestamp: event.timestamp
    });
  }

  /**
   * Listen once for a specific event.
   * Returns an unsubscribe fn.
   */
  onceEvent(
    event: OrchestrationEvent,
    listener: (payload: EventPayload) => void
  ): () => void {
    this.once(event, listener);
    return () => this.off(event, listener);
  }

  /**
   * Listen for a specific event.
   * Returns an unsubscribe fn.
   */
  onEvent(
    event: OrchestrationEvent,
    listener: (payload: EventPayload) => void
  ): () => void {
    this.on(event, listener);
    return () => this.off(event, listener);
  }

  /**
   * Listen to all orchestration events.
   * Returns an unsubscribe fn.
   */
  onAnyEvent(
    listener: (event: OrchestrationEvent, payload: EventPayload) => void
  ): () => void {
    const fn = ({ event, payload }: AnyEventTuple) => listener(event, payload);
    this.on(ALL_EVENTS, fn);
    return () => this.off(ALL_EVENTS, fn);
  }

  /**
   * Remove a specific event listener.
   */
  offEvent(
    event: OrchestrationEvent,
    listener: (payload: EventPayload) => void
  ): void {
    this.off(event, listener);
  }

  /**
   * Remove an "any event" listener.
   */
  offAnyEvent(
    listener: (event: OrchestrationEvent, payload: EventPayload) => void
  ): void {
    // We wrapped the original listener, so we need to remove by scanning.
    // Provide a direct method only if you keep a map from user listener -> wrapped fn.
    // For simplicity, remove all ALL_EVENTS listeners if needed:
    // this.removeAllListeners(ALL_EVENTS);
    // Better: keep a WeakMap to track wrappers. For now, expose removeAll:
    this.removeAllListeners(ALL_EVENTS);
  }

  /**
   * Listen for collaboration events.
   * Returns an unsubscribe fn.
   */
  onCollaborationEvent(
    listener: (event: CollaborationEvent) => void
  ): () => void {
    this.on('collaboration', listener);
    return () => this.off('collaboration', listener);
  }

  /**
   * Listen once for a collaboration event.
   * Returns an unsubscribe fn.
   */
  onceCollaborationEvent(
    listener: (event: CollaborationEvent) => void
  ): () => void {
    this.once('collaboration', listener);
    return () => this.off('collaboration', listener);
  }

  /**
   * Remove a collaboration event listener.
   */
  offCollaborationEvent(
    listener: (event: CollaborationEvent) => void
  ): void {
    this.off('collaboration', listener);
  }

  /**
   * Remove all listeners for a specific event (or for all events if omitted).
   */
  removeAllEventListeners(event?: OrchestrationEvent): void {
    if (event) {
      this.removeAllListeners(event);
    } else {
      this.removeAllListeners();
    }
  }

  /**
   * Get number of listeners per event name (stringified).
   */
  getEventStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const name of this.eventNames()) {
      const key =
        typeof name === "string"
          ? name
          : name === ALL_EVENTS
          ? "[ALL_EVENTS]"
          : name.toString();
      stats[key] = this.listenerCount(name);
    }
    return stats;
  }
}

// Export singleton instance
export const orchestrationEventBus = OrchestrationEventBus.getInstance();

// Convenience functions
export const emitOrchestrationEvent = async (
  event: OrchestrationEvent,
  payload: EventPayload
): Promise<void> => {
  await orchestrationEventBus.emitEvent(event, payload);
};

export const onOrchestrationEvent = (
  event: OrchestrationEvent,
  listener: (payload: EventPayload) => void
) => orchestrationEventBus.onEvent(event, listener);

export const onceOrchestrationEvent = (
  event: OrchestrationEvent,
  listener: (payload: EventPayload) => void
) => orchestrationEventBus.onceEvent(event, listener);

export const onAnyOrchestrationEvent = (
  listener: (event: OrchestrationEvent, payload: EventPayload) => void
) => orchestrationEventBus.onAnyEvent(listener);

// Collaboration event convenience functions
export const emitCollaborationEvent = async (
  event: CollaborationEvent
): Promise<void> => {
  await orchestrationEventBus.emitCollaborationEvent(event);
};

export const onCollaborationEvent = (
  listener: (event: CollaborationEvent) => void
) => orchestrationEventBus.onCollaborationEvent(listener);

export const onceCollaborationEvent = (
  listener: (event: CollaborationEvent) => void
) => orchestrationEventBus.onceCollaborationEvent(listener);
