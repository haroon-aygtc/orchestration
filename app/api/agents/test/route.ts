import { NextRequest, NextResponse } from "next/server";
import { bootstrapAgents } from "@/lib/agents/bootstrap";
import { createErrorResponse, createSuccessResponse, logError } from "@/lib/utils/error-handler";

export async function POST(request: NextRequest) {
  try {
    const { agentType, input } = await request.json();

    // Bootstrap agents on server side
    const agents = await bootstrapAgents();

    let result;
    const startTime = Date.now();

    switch (agentType) {
      case "intent":
        result = await agents.intent.processIntent(input);
        break;
      case "retriever":
        result = await agents.retriever.retrieveInformation(input);
        break;
      case "tool":
        result = await agents.tool.executeTool(input);
        break;
      case "workflow":
        result = await agents.workflow.createWorkflow(input);
        break;
      case "memory":
        result = await agents.memory.storeMemory(input);
        break;
      case "follow":
        result = await agents.follow.trackProgress(input);
        break;
      case "formatter":
        result = await agents.formatter.formatOutput(input);
        break;
      case "guardrail":
        result = await agents.guardrail.validateContent(input);
        break;
      case "llm":
        result = await agents.llm.generateResponse(input);
        break;
      default:
        throw new Error(`Unknown agent type: ${agentType}`);
    }

    const responseTime = Date.now() - startTime;

    return createSuccessResponse({
      result,
      responseTime,
      agentType,
    }, "Agent test completed successfully");
  } catch (error) {
    logError(error as Error, 'POST /api/agents/test');
    return createErrorResponse(error as Error, 'POST /api/agents/test');
  }
}
