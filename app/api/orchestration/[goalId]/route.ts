// API Routes for Individual Orchestration Goals
import { NextRequest } from "next/server";
import { RealManagerAgent } from "@/lib/real-manager-agent";
import { createErrorResponse, createSuccessResponse } from "@/lib/utils/error-handler";
import { logError } from "@/lib/utils/error-handler";

// Singleton manager agent instance
let managerAgent: RealManagerAgent | null = null;

function getManagerAgent(): RealManagerAgent {
  if (!managerAgent) {
    managerAgent = new RealManagerAgent();
  }
  return managerAgent;
}

// GET /api/orchestration/[goalId] - Get specific goal
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ goalId: string }> }
) {
  try {
    const { goalId } = await params;
    const manager = getManagerAgent();
    const goal = manager.getOrchestrationGoal(goalId);

    if (!goal) {
      return createErrorResponse(new Error('Goal not found'), 'GET /api/orchestration/[goalId]');
    }

    return createSuccessResponse({
      goal,
    });
  } catch (error: any) {
    logError(error as Error, 'Failed to get orchestration goal');
    return createErrorResponse(error as Error, 'Failed to get orchestration goal');
  }
}

// POST /api/orchestration/[goalId]/execute - Execute next step
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ goalId: string }> }
) {
  try {
    const { goalId } = await params;
    const manager = getManagerAgent();
    
    const result = await manager.executeOrchestrationStep(goalId);

    return createSuccessResponse({
      result,
      goalId,
    });
  } catch (error: any) {
    logError(error as Error, 'Failed to execute orchestration step');
    return createErrorResponse(error as Error, 'Failed to execute orchestration step');
  }
}

// PUT /api/orchestration/[goalId]/plan - Generate execution plan
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ goalId: string }> }
) {
  try {
    const { goalId } = await params;
    const manager = getManagerAgent();
    
    const steps = await manager.generateExecutionPlan(goalId);

    return createSuccessResponse({
      success: true,
      steps,
      goalId,
    });
  } catch (error: any) {
    logError(error as Error, 'Failed to generate execution plan');
    return createErrorResponse(error as Error, 'Failed to generate execution plan');
  }
}
