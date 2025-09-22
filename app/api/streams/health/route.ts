import { NextRequest } from 'next/server';
import { withRedisStreams } from '@/lib/utils/redis-connection';
import { 
  validateApiRequest, 
  createSecureApiErrorResponse, 
  createSecureApiSuccessResponse,
  SecurityContext 
} from '@/lib/middleware/security-middleware';
import { createErrorResponse, mapErrorToAppError } from '@/lib/utils/error-handler';
import { handleRequest } from '@/lib/middleware/stream-middleware';
import { z } from 'zod';

export async function GET(request: NextRequest) {
  return handleRequest(request, async () => {
    // Validate request security
    const validation = await validateApiRequest(request);
    if (!validation.isValid) {
      return createSecureApiErrorResponse(validation.error!, validation.context);
    }

    try {
      const result = await withRedisStreams(async (streamsService) => {
        // Get comprehensive health check
        const healthCheck = await streamsService.healthCheck();
        
        // Get detailed connection status
        const connectionStatus = await streamsService.getConnectionStatus();
        
        // Get detailed stream information
        const streamDetails = await Promise.all([
          streamsService.getStreamInfo('orchestration:events'),
          streamsService.getStreamInfo('agent:communication'),
          streamsService.getStreamInfo('workflow:steps'),
          streamsService.getStreamInfo('node:executions'),
          streamsService.getStreamInfo('coordination:decisions'),
        ]);
        
        // Get consumer group information
        const groupDetails = await Promise.all([
          streamsService.getConsumerGroupInfo('orchestration:events', 'orchestration-processors'),
          streamsService.getConsumerGroupInfo('agent:communication', 'agent-processors'),
          streamsService.getConsumerGroupInfo('workflow:steps', 'workflow-processors'),
          streamsService.getConsumerGroupInfo('node:executions', 'node-processors'),
          streamsService.getConsumerGroupInfo('coordination:decisions', 'coordination-processors'),
        ]);
        
        // Get pending messages counts
        const pendingCounts = await Promise.all([
          streamsService.getPendingMessagesCount('orchestration:events', 'orchestration-processors'),
          streamsService.getPendingMessagesCount('agent:communication', 'agent-processors'),
          streamsService.getPendingMessagesCount('workflow:steps', 'workflow-processors'),
          streamsService.getPendingMessagesCount('node:executions', 'node-processors'),
          streamsService.getPendingMessagesCount('coordination:decisions', 'coordination-processors'),
        ]);
        
        // Calculate overall health status
        const isHealthy = healthCheck.status === 'healthy' && 
                         healthCheck.streams['orchestration:events'] &&
                         healthCheck.streams['agent:communication'] &&
                         healthCheck.streams['workflow:steps'] &&
                         healthCheck.streams['node:executions'] &&
                         healthCheck.streams['coordination:decisions'];
        
        return {
          status: isHealthy ? 'healthy' : 'unhealthy',
          timestamp: new Date().toISOString(),
          redis: {
            connected: connectionStatus.connected,
            url: process.env.REDIS_URL?.replace(/\/\/.*@/, '//***:***@') || 'redis://localhost:6379',
            latency: connectionStatus.latency,
            memory: connectionStatus.memory,
            info: connectionStatus.info
          },
          streams: {
            orchestration: {
              exists: healthCheck.streams['orchestration:events'],
              info: streamDetails[0],
              group: groupDetails[0],
              pending: pendingCounts[0],
            },
            agentCommunication: {
              exists: healthCheck.streams['agent:communication'],
              info: streamDetails[1],
              group: groupDetails[1],
              pending: pendingCounts[1],
            },
            workflowSteps: {
              exists: healthCheck.streams['workflow:steps'],
              info: streamDetails[2],
              group: groupDetails[2],
              pending: pendingCounts[2],
            },
            nodeExecutions: {
              exists: healthCheck.streams['node:executions'],
              info: streamDetails[3],
              group: groupDetails[3],
              pending: pendingCounts[3],
            },
            coordination: {
              exists: healthCheck.streams['coordination:decisions'],
              info: streamDetails[4],
              group: groupDetails[4],
              pending: pendingCounts[4],
            },
          },
          summary: {
            totalStreams: Object.keys(healthCheck.streams).length,
            healthyStreams: Object.values(healthCheck.streams).filter(Boolean).length,
            totalGroups: Object.keys(healthCheck.groups).length,
            healthyGroups: Object.values(healthCheck.groups).filter(Boolean).length,
            totalPendingMessages: pendingCounts.reduce((sum: number, count: number) => sum + count, 0),
          },
          uptime: process.uptime(),
          memory: process.memoryUsage(),
        };
      });
      
      return createSecureApiSuccessResponse(result, validation.context);
      
    } catch (error) {
      // Map unknown error to AppError before passing to createErrorResponse
      const appError = mapErrorToAppError(error, 'health/GET');
      return createErrorResponse(appError as Error, 'health/GET');
    }
  }, {
    validation: {
      bodySchema: z.object({
        streamName: z.string(),
        groupName: z.string(),
        consumerName: z.string(),
      })
    }
  });
}
