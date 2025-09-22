import { NextRequest } from 'next/server';
import { bootstrapAgents } from '@/lib/agents/bootstrap';
import { createErrorResponse, createSuccessResponse, logError } from '@/lib/utils/error-handler';

export async function POST(request: NextRequest) {
  try {
    const agents = await bootstrapAgents();

    return createSuccessResponse({
      data: {
        agents: Object.keys(agents),
        count: Object.keys(agents).length
      }
    }, 'Specialized agents created successfully');

  } catch (error: any) {
    logError(error, 'Failed to create specialized agents');
    return createErrorResponse(error, 'Failed to create specialized agents');
  }
}
