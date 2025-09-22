import { NextRequest } from 'next/server';
import { withRedisStreams } from '@/lib/utils/redis-connection';
import { createErrorResponse, createSuccessResponse, ValidationError } from '@/lib/utils/error-handler';
import { StreamMessage } from '@/lib/redis/streams-service';
import { handleRequest } from '@/lib/middleware/stream-middleware';
import { z } from 'zod';

export async function POST(request: NextRequest) {
  return handleRequest(request, async (body) => {
    const { streamName, groupName, consumerName, count = 10, blockMs = 1000 } = body as { streamName: string, groupName: string, consumerName: string, count: number, blockMs: number };
    
    if (!streamName || !groupName || !consumerName) {
      throw new ValidationError('Missing required parameters: streamName, groupName, consumerName');
    }
    
    const result = await withRedisStreams(async (streamsService) => {
      const messages = await streamsService.readMessages(
        streamName,
        groupName,
        consumerName,
        count,
        blockMs
      );
      
      return {
        streamName,
        groupName,
        consumerName,
        messageCount: messages.length,
        messages: messages.map((msg: StreamMessage) => ({
          id: msg.id,
          fields: msg.fields,
          timestamp: msg.timestamp.toISOString()
        }))
      };
    });
    
    return createSuccessResponse(result);
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

export async function PUT(request: NextRequest) {
  return handleRequest(request, async (body) => {
    const { streamName, groupName, messageId } = body as { streamName: string, groupName: string, messageId: string };
    
    if (!streamName || !groupName || !messageId) {
      throw new ValidationError('Missing required parameters: streamName, groupName, messageId');
    }
    
    const result = await withRedisStreams(async (streamsService) => {
      await streamsService.acknowledgeMessage(streamName, groupName, messageId);
      
      return {
        streamName,
        groupName,
        messageId,
        acknowledged: true
      };
    });
    
    return createSuccessResponse(result);
  }, {
    validation: {
      bodySchema: z.object({
        streamName: z.string(),
        groupName: z.string(),
        messageId: z.string(),
      })
    }
  });
}
