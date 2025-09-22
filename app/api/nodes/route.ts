import { NextRequest } from 'next/server';
import { nodeRegistry } from '@/lib/nodes/registry';
import { nodeSelectionService } from '@/lib/nodes/selection-service';
import { createErrorResponse, createSuccessResponse, logError } from '@/lib/utils/error-handler';
import { validateApiRequest } from '@/lib/middleware/security-middleware';

export async function GET(request: NextRequest) {
  try {
    // Security validation
    const securityResult = await validateApiRequest(request);
    if (!securityResult.isValid) {
      return createErrorResponse(securityResult.error as Error, 'GET /api/nodes');
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const tags = searchParams.get('tags')?.split(',');
    const complexity = searchParams.get('complexity');
    const text = searchParams.get('text');

    const criteria = {
      category: category || undefined,
      tags: tags || undefined,
      complexity: complexity || undefined,
      text: text || undefined
    };

    const nodes = nodeRegistry.searchNodes(criteria);
    
    return createSuccessResponse({
      data: nodes,
      count: nodes.length
    });
  } catch (error) {
    logError(error as Error, 'Error fetching nodes');
    return createErrorResponse(error as Error, 'Error fetching nodes');
  }
}

export async function POST(request: NextRequest) {
  try {
    // Security validation
    const securityResult = await validateApiRequest(request);
    if (!securityResult.isValid) {
      return createErrorResponse(securityResult.error as Error, 'POST /api/nodes');
    }

    const body = await request.json();
    const { action, nodeId, params, goal, context } = body;

    switch (action) {
      case 'execute':
        if (!nodeId || !params) {
          return createErrorResponse(new Error('Missing nodeId or params'), 'POST /api/nodes');
        }
        
        const result = await nodeRegistry.executeNode(nodeId, params);
        return createSuccessResponse({
          data: result
        });

      case 'validate':
        if (!nodeId || !params) {
          return createErrorResponse(new Error('Missing nodeId or params'), 'POST /api/nodes');
        }
        
        const validation = await nodeRegistry.validateNode(nodeId, params);
        return createSuccessResponse({
          data: validation
        });

      case 'suggest-composition':
        if (!goal) {
            return createErrorResponse(new Error('Missing goal'), 'POST /api/nodes');
        }
        
        const suggestion = await nodeSelectionService.suggestNodeComposition(goal, context || {});
        return createSuccessResponse({
          data: suggestion
        });

      case 'select-for-goal':
        if (!goal) {
          return createErrorResponse(new Error('Missing goal'), 'POST /api/nodes');
        }
        
        
        const selectedNodes = await nodeSelectionService.selectNodesForGoal(goal, context || {});
        return createSuccessResponse({
          data: selectedNodes
        });

      default:
        return createErrorResponse(new Error('Invalid action'), 'POST /api/nodes');
    }
  } catch (error) {
    logError(error as Error, 'Error processing node request');
    return createErrorResponse(error as Error, 'Error processing node request');
  }
}
