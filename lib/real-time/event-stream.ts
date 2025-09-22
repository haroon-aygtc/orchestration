// Production-grade real-time event streaming system
import { EventEmitter } from "node:events"
import { logger } from "../utils/structured-logger";

export interface RealTimeEvent {
  type: string
  agentId: string
  timestamp: string
  data?: any
  event?: string
  payload?: any
  sessionId: string
  source?: string
}

export interface EventStreamOptions {
  agentId: string
  sessionId: string
  eventTypes: string[]
  source: string
  heartbeatInterval?: number
  maxEvents?: number
}

export class RealTimeEventStream extends EventEmitter {
  private controller: ReadableStreamDefaultController<Uint8Array> | null = null
  private encoder = new TextEncoder()
  private isActive = true
  private heartbeatInterval: NodeJS.Timeout | null = null
  private eventBuffer: RealTimeEvent[] = []
  private readonly maxBufferSize: number

  constructor(
    private options: EventStreamOptions,
    private maxEvents: number = 1000
  ) {
    super()
    this.maxBufferSize = maxEvents
    this.setupHeartbeat()
  }

  private setupHeartbeat() {
    const interval = this.options.heartbeatInterval || 30000 // 30 seconds
    this.heartbeatInterval = setInterval(() => {
      if (this.isActive) {
        this.sendEvent({
          type: "heartbeat",
          agentId: this.options.agentId,
          timestamp: new Date().toISOString(),
          sessionId: this.options.sessionId,
          data: { status: "alive", uptime: process.uptime() }
        })
      }
    }, interval)
  }

  public sendEvent(event: RealTimeEvent): void {
    if (!this.isActive || !this.controller) return

    try {
      // Add to buffer
      this.eventBuffer.push(event)
      if (this.eventBuffer.length > this.maxBufferSize) {
        this.eventBuffer.shift() // Remove oldest event
      }

      // Send event
      const eventData = JSON.stringify(event)
      const sseData = `data: ${eventData}\n\n`
      this.controller.enqueue(this.encoder.encode(sseData))

      // Emit for internal listeners
      this.emit("event", event)
    } catch (error) {
      logger.error("❌ [EventStream] Failed to send event:", { error: error instanceof Error ? error.message : String(error) })
    }
  }

  public sendError(error: string): void {
    this.sendEvent({
      type: "error",
      agentId: this.options.agentId,
      timestamp: new Date().toISOString(),
      sessionId: this.options.sessionId,
      data: { error }
    })
  }

  public getResponse(): Response {
    const stream = new ReadableStream({
      start: (controller) => {
        this.controller = controller

        // Send initial connection event
        this.sendEvent({
          type: "connection",
          agentId: this.options.agentId,
          timestamp: new Date().toISOString(),
          sessionId: this.options.sessionId,
          data: {
            message: `Connected to ${this.options.agentId} monitoring`,
            eventTypes: this.options.eventTypes,
            source: this.options.source
          }
        })

        // Send buffered events if any
        this.eventBuffer.forEach(event => {
          const eventData = JSON.stringify(event)
          const sseData = `data: ${eventData}\n\n`
          controller.enqueue(this.encoder.encode(sseData))
        })
      },
      cancel: () => {
        this.close()
      }
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Cache-Control",
        "X-Accel-Buffering": "no" // Disable nginx buffering
      }
    })
  }

  public close(): void {
    this.isActive = false
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }

    if (this.controller) {
      try {
        this.controller.close()
      } catch (error) {
        // Controller might already be closed
      }
      this.controller = null
    }

    this.removeAllListeners()
    logger.info(`🔌 [EventStream] Closed stream for ${this.options.agentId}`)
  }

  public getStats() {
    return {
      agentId: this.options.agentId,
      sessionId: this.options.sessionId,
      isActive: this.isActive,
      eventTypes: this.options.eventTypes,
      bufferedEvents: this.eventBuffer.length,
      uptime: process.uptime()
    }
  }
}

// Factory function to create event streams
export async function createRealTimeEventStream(options: EventStreamOptions): Promise<RealTimeEventStream> {
  const stream = new RealTimeEventStream(options)
  
  // Log stream creation
  logger.info(`🔌 [EventStream] Created for agent: ${options.agentId}, session: ${options.sessionId}`)
  
  return stream
}

// Global event stream manager
class EventStreamManager {
  private streams = new Map<string, RealTimeEventStream>()

  public addStream(sessionId: string, stream: RealTimeEventStream): void {
    this.streams.set(sessionId, stream)
  }

  public removeStream(sessionId: string): void {
    const stream = this.streams.get(sessionId)
    if (stream) {
      stream.close()
      this.streams.delete(sessionId)
    }
  }

  public broadcastToAgent(agentId: string, event: RealTimeEvent): void {
    for (const [sessionId, stream] of this.streams) {
      if (stream.getStats().agentId === agentId) {
        stream.sendEvent(event)
      }
    }
  }

  public broadcastToAll(event: RealTimeEvent): void {
    for (const [sessionId, stream] of this.streams) {
      stream.sendEvent(event)
    }
  }

  public getActiveStreams(): Array<{ sessionId: string; stats: any }> {
    return Array.from(this.streams.entries()).map(([sessionId, stream]) => ({
      sessionId,
      stats: stream.getStats()
    }))
  }

  public cleanup(): void {
    for (const [sessionId, stream] of this.streams) {
      stream.close()
    }
    this.streams.clear()
  }
}

export const eventStreamManager = new EventStreamManager()

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('🔌 [EventStream] Shutting down event streams...')
  eventStreamManager.cleanup()
})

process.on('SIGINT', () => {
  logger.info('🔌 [EventStream] Shutting down event streams...')
  eventStreamManager.cleanup()
})
