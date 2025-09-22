import { NextRequest } from 'next/server';
import { aiConfigService } from '@/lib/ai-config-service';
import { createErrorResponse, createSuccessResponse, logError } from '@/lib/utils/error-handler';
import { validateApiRequest } from '@/lib/middleware/security-middleware';



export async function GET(request: NextRequest) {
  try {
    // Security validation
    const securityResult = await validateApiRequest(request);
    if (!securityResult.isValid) {
      return createErrorResponse(securityResult.error as Error, 'GET /api/ai-config');
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const agentType = searchParams.get('agentType');

    switch (action) {
      case 'getAgentInfo':
        if (!agentType) {
          return createErrorResponse(new Error('Agent type is required'), 'GET /api/ai-config');
        }
        
        const agentInfo = await aiConfigService.getAgentAIInfo(agentType);
        return createSuccessResponse(agentInfo, 'Agent info loaded successfully');

      case 'getAllAgents':
        const allAgents = aiConfigService.getAgentMappings();
        return createSuccessResponse(allAgents, 'All agents loaded successfully');

      case 'getProviders':
        const providers = await aiConfigService.getProviderConfigs();
        return createSuccessResponse(providers, 'Providers loaded successfully');

      default:
        return createErrorResponse(new Error('Invalid action'), 'GET /api/ai-config');
    }

  } catch (error: any) {
    logError(error, 'GET /api/ai-config');
    return createErrorResponse(error, 'GET /api/ai-config');
  }
}

export async function POST(request: NextRequest) {
  try {
    // Security validation
    const securityResult = await validateApiRequest(request);
    if (!securityResult.isValid) {
      return createErrorResponse(securityResult.error as Error, 'POST /api/ai-config');
    }

    const body = await request.json();
    const { action, agentType, provider, config } = body;

    switch (action) {
      case 'updateAgentConfig':
        if (!agentType || !provider || !config) {
          return createErrorResponse(new Error('Agent type, provider, and config are required'), 'POST /api/ai-config');
        }
        await aiConfigService.setAgentMapping(agentType, { provider, model: config.model, description: config.description });
        return createSuccessResponse(null, 'Agent config updated successfully');

      case 'testConnection':
        if (!provider || !config) {
          return createErrorResponse(new Error('Provider and config are required'), 'POST /api/ai-config');
        }
        const testResult = await aiConfigService.testProvider({ provider: { provider } }, config.model);
        return createSuccessResponse(testResult, 'Provider connection tested successfully');

      default:
        return createErrorResponse(new Error('Invalid action'), 'POST /api/ai-config');
    }

  } catch (error: any) {
    logError(error, 'POST /api/ai-config');
    return createErrorResponse(error, 'POST /api/ai-config');
  }
}
