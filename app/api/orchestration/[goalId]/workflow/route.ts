// API Route for Complete Workflow Execution
import { NextRequest } from "next/server";
import { RealManagerAgent } from "@/lib/real-manager-agent";
import { createErrorResponse, createSuccessResponse, logError } from "@/lib/utils/error-handler";

// Singleton manager agent instance
let managerAgent: RealManagerAgent | null = null;

function getManagerAgent(): RealManagerAgent {
  if (!managerAgent) {
    managerAgent = new RealManagerAgent();
  }
  return managerAgent;
}

// POST /api/orchestration/[goalId]/workflow - Run complete workflow
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ goalId: string }> }
) {
  try {
    const { goalId } = await params;
    const body = await request.json();
    const { maxSteps = 10 } = body;

    const manager = getManagerAgent();
    
    const workflowResult = await manager.runOrchestrationWorkflow(goalId, maxSteps);

    return createSuccessResponse({
      workflow: workflowResult,
    });
  } catch (error: any) {
    logError(error as Error, 'Failed to run o rchestration workflow');
    return createErrorResponse(error as Error, 'Failed to run orchestration workflow');
  }
}

// POST /api/orchestration/[goalId]/suggestions - Add suggestion
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ goalId: string }> }
) {
  try {
    const { goalId } = await params;
    const body = await request.json();
    const { fromAgent, toAgent, text, action, confidence = 0.7 } = body;

    if (!fromAgent || !text) {
        return createErrorResponse(new Error('fromAgent and text are required'), 'PUT /api/orchestration/[goalId]/suggestions');
    }

    const manager = getManagerAgent();
    
    manager.addOrchestrationSuggestion(goalId, {
      fromAgent,
      toAgent,
      text,
      action,
      confidence: Number(confidence),
    });

    return createSuccessResponse({
      message: "Suggestion added successfully"
    });
  } catch (error: any) {
    logError(error as Error, 'Failed to add orchestration suggestion');
    return createErrorResponse(error as Error, 'Failed to add orchestration suggestion');
  }
}
