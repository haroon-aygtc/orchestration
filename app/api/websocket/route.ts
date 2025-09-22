import type { NextRequest } from "next/server"
import { createRealTimeEventStream } from "@/lib/real-time/event-stream"
import { orchestrationEventBus, onCollaborationEvent } from "@/lib/real-time/event-bus"
import { postgresPool as pool } from "@/lib/database/postgresql-client"
import { logger } from "@/lib/utils/structured-logger"
import { createErrorResponse } from "@/lib/utils/error-handler"
import { validateApiRequest } from "@/lib/middleware/security-middleware"
import type { CollaborationEvent } from "@/lib/types/collaboration"

// Production-grade real-time WebSocket handler for agent monitoring
export async function GET(request: NextRequest) {
  try {
    // Security validation
    const securityResult = await validateApiRequest(request);
    if (!securityResult.isValid) {
      return createErrorResponse(securityResult.error as Error, 'GET /api/websocket');
    }

    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get("agentId")
    const sessionId = searchParams.get("sessionId") || `session_${Date.now()}`
    const eventTypes = searchParams.get("events")?.split(",") || ["all"]

    if (!agentId) {
      return createErrorResponse(new Error("Missing agentId parameter"), 'GET /api/websocket');
    }

  logger.info(`🔌 [WebSocket] New connection: ${agentId} (session: ${sessionId})`)

    // Create production-grade event stream
    const eventStream = await createRealTimeEventStream({
      agentId,
      sessionId,
      eventTypes,
      source: "websocket_api"
    })

    // Set up orchestration event forwarding
    const unsubscribeOrchestration = orchestrationEventBus.onAnyEvent((event, payload) => {
      if (eventTypes.includes("all") || eventTypes.includes("orchestration")) {
        eventStream.sendEvent({
          type: "orchestration_event",
          agentId,
          timestamp: new Date().toISOString(),
          event: event,
          payload: payload,
          sessionId
        })
      }
    })

    // Set up collaboration event forwarding for real-time reasoning and suggestions
    const unsubscribeCollaboration = onCollaborationEvent((collabEvent: CollaborationEvent) => {
      if (eventTypes.includes("all") || eventTypes.includes("collaboration")) {
        eventStream.sendEvent({
          type: "collaboration_event",
          agentId,
          timestamp: new Date().toISOString(),
          event: collabEvent.kind,
          payload: collabEvent,
          sessionId
        })
      }
    })

    // Set up database event monitoring
    let dbMonitorInterval: NodeJS.Timeout | null = null
    if (eventTypes.includes("all") || eventTypes.includes("database")) {
      dbMonitorInterval = setInterval(async () => {
        try {
          if (!pool) {
            logger.warn("❌ [WebSocket] Database pool not available, skipping database monitoring")
            return
          }
          const client = await pool.connect()

          // Get real-time agent status
          const agentResult = await client.query(
            'SELECT * FROM agents WHERE type = $1 OR id = $1 ORDER BY "lastActive" DESC LIMIT 1',
            [agentId]
          )

          // Get recent tasks for this agent
          const tasksResult = await client.query(
            'SELECT * FROM tasks WHERE "agentId" = $1 ORDER BY "createdAt" DESC LIMIT 5',
            [agentId]
          )

          client.release()

          if (agentResult.rows.length > 0) {
            const agent = agentResult.rows[0]
            eventStream.sendEvent({
              type: "agent_status_update",
              agentId,
              timestamp: new Date().toISOString(),
              data: {
                agent: {
                  id: agent.id,
                  type: agent.type,
                  name: agent.name,
                  status: agent.status,
                  lastActive: agent.lastActive,
                  config: agent.config
                },
                recentTasks: tasksResult.rows.map(task => ({
                  id: task.id,
                  status: task.status,
                  createdAt: task.createdAt,
                  completedAt: task.completedAt,
                  result: task.result
                }))
              },
              sessionId
            })
          }
        } catch (error) {
          logger.error(`❌ [WebSocket] Database monitoring error for ${agentId}:`, error as Error)
        }
      }, 5000) // Every 5 seconds
    }

    // Set up performance monitoring
    let perfMonitorInterval: NodeJS.Timeout | null = null
    if (eventTypes.includes("all") || eventTypes.includes("performance")) {
      perfMonitorInterval = setInterval(async () => {
        try {
          if (!pool) {
            logger.warn("❌ [WebSocket] Database pool not available, skipping performance monitoring")
            return
          }
          const client = await pool.connect()

          // Calculate real performance metrics
          const perfResult = await client.query(`
            SELECT
              COUNT(*) as total_tasks,
              COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
              COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_tasks,
              AVG(EXTRACT(EPOCH FROM ("completedAt" - "createdAt"))) as avg_duration,
              MAX("createdAt") as last_task_time
            FROM tasks
            WHERE "agentId" = $1
            AND "createdAt" > NOW() - INTERVAL '1 hour'
          `, [agentId])

          client.release()

          const metrics = perfResult.rows[0]
          const successRate = metrics.total_tasks > 0
            ? (metrics.completed_tasks / metrics.total_tasks) * 100
            : 100

          eventStream.sendEvent({
            type: "performance_metrics",
            agentId,
            timestamp: new Date().toISOString(),
            data: {
              performance: {
                totalTasks: parseInt(metrics.total_tasks) || 0,
                completedTasks: parseInt(metrics.completed_tasks) || 0,
                failedTasks: parseInt(metrics.failed_tasks) || 0,
                successRate: Math.round(successRate * 100) / 100,
                averageDuration: metrics.avg_duration ? Math.round(metrics.avg_duration * 1000) : 0,
                lastTaskTime: metrics.last_task_time,
                responseTime: metrics.avg_duration ? Math.round(metrics.avg_duration * 1000) : 0,
                throughput: parseInt(metrics.total_tasks) || 0
              }
            },
            sessionId
          })
        } catch (error) {
          logger.error(`❌ [WebSocket] Performance monitoring error for ${agentId}:`, error as Error)
        }
      }, 3000) // Every 3 seconds
    }

    // Handle connection cleanup
    request.signal.addEventListener("abort", () => {
      logger.info(`🔌 [WebSocket] Connection closed: ${agentId} (session: ${sessionId})`)

      // Clean up subscriptions
      unsubscribeOrchestration()
      unsubscribeCollaboration()

      // Clear intervals
      if (dbMonitorInterval) clearInterval(dbMonitorInterval)
      if (perfMonitorInterval) clearInterval(perfMonitorInterval)

      // Close event stream
      eventStream.close()
    })

    return eventStream.getResponse()

  } catch (error) {
    logger.error(`❌ [WebSocket] Failed to create event stream:`, error as Error)
    return createErrorResponse(error as Error, "GET /api/websocket")
  }
}
