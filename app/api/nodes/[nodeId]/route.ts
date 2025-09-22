import { NextRequest, NextResponse } from 'next/server';
import { nodeRegistry } from '@/lib/nodes/registry';
import { createErrorResponse, createSuccessResponse, logError } from '@/lib/utils/error-handler';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  try {
    const { nodeId } = await params;
    const node = nodeRegistry.getNode(nodeId);
    
    if (!node) {
      return createErrorResponse(new Error('Node not found'), 'GET /api/nodes/[nodeId]');
     
    }
    
    return createSuccessResponse({
      data: node
    });
  } catch (error) {
    logError(error as Error, 'Error fetching node');
    return createErrorResponse(error as Error, 'Error fetching node');
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  try {
    const { nodeId } = await params;
    const body = await request.json();
    const { action, params: inputParams } = body;

    switch (action) {
      case 'execute':
        if (!inputParams) {
          return createErrorResponse(new Error('Missing params'), 'POST /api/nodes/[nodeId]');
          
        }
        
        const result = await nodeRegistry.executeNode(nodeId, inputParams);
        return createSuccessResponse({
          data: result
        });

      case 'validate':
        if (!inputParams) {
          return createErrorResponse(new Error('Missing params'), 'POST /api/nodes/[nodeId]');
        }
        
        const validation = await nodeRegistry.validateNode(nodeId, inputParams);
        return createSuccessResponse({
          success: true,
          data: validation
        });

      default:
        return createErrorResponse(new Error('Invalid action'), 'POST /api/nodes/[nodeId]');
    }
  } catch (error) {
    logError(error as Error, 'Error processing node action');
    return createErrorResponse(error as Error, 'Error processing node action');
      
  }
}
