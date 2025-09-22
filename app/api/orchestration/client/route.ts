import { NextRequest } from 'next/server';
import { clientOrchestrationService } from '@/lib/orchestration/client-orchestration';
import { createErrorResponse, createSuccessResponse, logError } from '@/lib/utils/error-handler';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'getGoals':
        const goals = await clientOrchestrationService.listGoals();
        return createSuccessResponse({ success: true, data: goals });

      case 'getGoal':
        const goalId = searchParams.get('goalId');
        if (!goalId) {
          return createErrorResponse(new Error('Goal ID is required'), 'GET /api/orchestration/client');
           
        }
        const goal = await clientOrchestrationService.getGoal(goalId);
        return createSuccessResponse({ success: true, data: goal });

      default:
        return createErrorResponse(new Error('Invalid action'), 'GET /api/orchestration/client');
         
    }

  } catch (error: any) {
    return createErrorResponse(error as Error, 'GET /api/orchestration/client');
    
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    switch (action) {
      case 'createGoal':
        const goal = await clientOrchestrationService.createGoal(params);
        return createSuccessResponse({ success: true, data: goal });

      case 'planSteps':
        const steps = await clientOrchestrationService.planSteps(params.goalId);
        return createSuccessResponse({ success: true, data: steps });

      case 'executeNextStep':
        const result = await clientOrchestrationService.executeNextStep(params.goalId);
        return createSuccessResponse({ success: true, data: result });

      case 'addSuggestion':
        const suggestion = await clientOrchestrationService.addSuggestion(params.goalId, params.suggestion);
        return createSuccessResponse({ success: true, data: suggestion });

      default:
        return createErrorResponse(new Error('Invalid action'), 'POST /api/orchestration/client');
        
    }

  } catch (error: any) {
    logError(error as Error, 'POST /api/orchestration/client');
    return createErrorResponse(error as Error, 'POST /api/orchestration/client');
    
  }
}
