import { NextRequest, NextResponse } from 'next/server';
import { withRedisStreams } from '@/lib/utils/redis-connection';
import { createErrorResponse, createSuccessResponse, ValidationError } from '@/lib/utils/error-handler';
import { handleRequest } from '@/lib/middleware/stream-middleware';
import { z } from 'zod';
import { StreamMessage } from '@/lib/redis/streams-service';

export async function POST(request: NextRequest) {
  return handleRequest(request, async (body) => {
    const { fromAgent, toAgent, messageType, payload, correlationId } = body as { fromAgent: string, toAgent: string, messageType: string, payload: string, correlationId: string };
    
    if (!fromAgent || !toAgent || !messageType || !payload) {
      throw new ValidationError('Missing required parameters: fromAgent, toAgent, messageType, payload');
    }
    
    const result = await withRedisStreams(async (streamsService) => {
      const messageId = await streamsService.addAgentMessage(
        fromAgent,
        toAgent,
        messageType,
        payload,
        correlationId
      );
      
      return {
        messageId,
        fromAgent,
        toAgent,
        messageType,
        correlationId: correlationId || null,
        timestamp: new Date().toISOString()
      };
    });
    
    return createSuccessResponse(result);
  }, {
    validation: {
      bodySchema: z.object({
        fromAgent: z.string(),
        toAgent: z.string(),
        messageType: z.string(),
        payload: z.string(),
        correlationId: z.string()
      })
    }
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const consumerName = searchParams.get('consumerName') || 'api-consumer';
    const count = parseInt(searchParams.get('count') || '10');
    const blockMs = parseInt(searchParams.get('blockMs') || '1000');
    
    const result = await withRedisStreams(async (streamsService) => {
      const messages = await streamsService.readMessages(
        'agent:communication',
        'agent-processors',
        consumerName,
        count,
        blockMs
      );
      
      return {
        streamName: 'agent:communication',
        groupName: 'agent-processors',
        consumerName,
        messageCount: messages.length,
        messages: messages.map((msg: StreamMessage) => ({
          id: msg.id,
          fromAgent: msg.fields.fromAgent,
          toAgent: msg.fields.toAgent,
          messageType: msg.fields.messageType,
          payload: JSON.parse(msg.fields.payload),
          correlationId: msg.fields.correlationId,
          timestamp: msg.timestamp.toISOString()
        }))
      };
    });
    
    return createSuccessResponse(result);
    
  } catch (error) {
    return createErrorResponse(error as Error, 'agent-communication/GET');
  }
}
