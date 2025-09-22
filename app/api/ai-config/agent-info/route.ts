  import { NextRequest } from 'next/server';
import { aiConfigService } from '@/lib/ai-config-service';
import { createErrorResponse, createSuccessResponse, logError } from '@/lib/utils/error-handler';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentType = searchParams.get('agentType');

    if (!agentType) {
      return createErrorResponse(new Error('Agent type is required'), 'GET /api/ai-config/agent-info');
    }

    const agentInfo = await aiConfigService.getAgentAIInfo(agentType);

    return createSuccessResponse({
      success: true,
      data: agentInfo
    }, 'Agent info loaded successfully');

  } catch (error: any) {
    logError(error, 'GET /api/ai-config/agent-info');
    return createErrorResponse(error, 'GET /api/ai-config/agent-info');
  }
}
