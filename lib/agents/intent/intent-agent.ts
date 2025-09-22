import { z } from "zod";
import { llmService } from "../../llm/api/llm-service";
import { parseWithSchema } from "../../llm/strict-json";
import { generatePrefixedUUID } from "../../utils/uuid";
import type { AgentTask, AgentTaskStore, IntentInput, IntentOutput } from "../shared/types";
import { handleError } from "../../utils/error-handler";
import { aiConfig } from "../../env";
import { logger } from "../../utils/structured-logger";
import { withTimeout } from "../../utils/with-timeout";
import { TaskStatus } from "../shared/types";
import { requireAgentConfigured } from "../shared/constants";
import { NextActionsSchema, IntentInputSchema, IntentOutputSchema } from "../shared/schemas";

// Use generatePrefixedUUID directly instead of wrapper

type NextAction = z.infer<typeof NextActionsSchema>[number];
const AllowedAgents = NextActionsSchema.element.shape.agent;

export class IntentAgent {
  private tasksCompleted = 0;
  private status: "idle" | "busy" | "error" = "idle";
  private llm = llmService;

  constructor(
    private taskStore?: AgentTaskStore,
    private agentInvoker?: {
      retriever?: (params: Record<string, any>, traceId: string) => Promise<any>;
      tool?: (params: Record<string, any>, traceId: string) => Promise<any>;
      workflow?: (params: Record<string, any>, traceId: string) => Promise<any>;
      memory?: (params: Record<string, any>, traceId: string) => Promise<any>;
      formatter?: (params: Record<string, any>, traceId: string) => Promise<any>;
      guardrail?: (params: Record<string, any>, traceId: string) => Promise<any>;
    }
  ) {}

  async processIntent(raw: IntentInput): Promise<AgentTask<IntentInput, IntentOutput>> {
    const traceId = generatePrefixedUUID("trace");
    const task: AgentTask<IntentInput, IntentOutput> = {
      id: generatePrefixedUUID("intent"),
      type: "intent_analysis",
      input: raw,
      status: "running" as TaskStatus,
      startedAt: new Date(),
      metadata: { traceId },
    };

    this.status = "busy";
    await this.safeStore("create", task, traceId);

    try {
      await requireAgentConfigured("intent");
      const input = IntentInputSchema.parse(raw);

      const request = {
        messages: [
          {
            role: "system" as const,
            content: "You are an intent analysis AI. Return ONLY valid JSON that matches the provided schema. Do not include explanations outside JSON.",
          },
          {
            role: "user" as const,
            content:
`Analyze the user's intent from this text:

TEXT:
${input.text}

CONTEXT:
${JSON.stringify(input.context ?? {}, null, 2)}

Return JSON with keys: intent (string), confidence (0-1), entities (array of {type,value,confidence}), actionRequired (boolean), suggestedResponse (string).`,
          },
        ],
        responseFormat: "json" as const,
        temperature: aiConfig.temperatures.intentAnalysis,
        maxTokens: aiConfig.limits?.intentMaxTokens ?? 1200,
      };

      const timeoutMs = aiConfig.timeouts?.intentAnalysisMs ?? 15000;
      const callOnce = async (req: typeof request) =>
        withTimeout(() => this.llm.chat(req), timeoutMs, "intent llm timeout");

      let response = await callOnce(request);

      let analysis: IntentOutput;
      try {
        analysis = parseWithSchema(response.content, IntentOutputSchema);
      } catch (e1: any) {
        logger.warn("intent.parse.fail_first", { traceId, err: e1?.message });
        const retryReq = { ...request, temperature: Math.max(0, (request.temperature ?? 0.2) - 0.2) };
        response = await callOnce(retryReq);
        try {
          analysis = parseWithSchema(response.content, IntentOutputSchema);
        } catch (e2: any) {
          const err = new Error("LLM returned invalid JSON for intent twice");
          (err as any).status = 422;
          (err as any).details = { first: e1?.message, second: e2?.message, content: (response as any)?.content?.slice?.(0, 500) };
          throw err;
        }
      }

      task.output = analysis;
      task.status = "completed" as TaskStatus;
      task.completedAt = new Date();
      this.tasksCompleted++;
      this.status = "idle";
      await this.safeStore("update", task, traceId);
      return task;
    } catch (error: any) {
      handleError(error, "intent-agent");
      task.error = error?.message || "Unknown error";
      (task as any).errorStatus = error?.status ?? 500;
      task.status = "failed" as TaskStatus;
      task.completedAt = new Date();
      this.status = "error";
      await this.safeStore("update", task, traceId);
      return task;
    }
  }

  async processIntentWithCollaboration(
    input: IntentInput
  ): Promise<AgentTask<IntentInput, IntentOutput & { nextActions: NextAction[]; results?: Record<string, any> }>> {
    const traceId = generatePrefixedUUID("trace");
    const task: AgentTask<IntentInput, IntentOutput & { nextActions: NextAction[]; results?: Record<string, any> }> = {
      id: generatePrefixedUUID("intent"),
      type: "intent_analysis_with_collaboration",
      input,
      status: "running" as TaskStatus,
      startedAt: new Date(),
      metadata: { traceId },
    };
    this.status = "busy";
    await this.safeStore("create", task, traceId);

    try {
      const intentResult = await this.processIntent(input);
      if (!intentResult.output) throw new Error("Intent analysis failed");

      const nextActions = await this.decideNextActions(intentResult.output, traceId);

      const results: Record<string, any> = {};
      for (const action of nextActions) {
        try {
          AllowedAgents.parse(action.agent);
          const invoke = this.agentInvoker?.[action.agent as keyof typeof this.agentInvoker];
          if (!invoke) {
            logger.warn("intent.collab.no_handler", { traceId, agent: action.agent });
            continue;
          }
          results[action.agent] = await invoke(action.parameters, traceId);
        } catch (err: any) {
          logger.error("intent.collab.action_fail", { traceId, agent: action.agent, err: err?.message });
        }
      }

      task.output = { ...(intentResult.output as any), nextActions, results };
      task.status = "completed" as TaskStatus;
      task.completedAt = new Date();
      this.tasksCompleted++;
      this.status = "idle";
      await this.safeStore("update", task, traceId);
      return task;
    } catch (error: any) {
      handleError(error, "intent-agent");
      task.error = error?.message || "Unknown error";
      (task as any).errorStatus = error?.status ?? 500;
      task.status = "failed" as TaskStatus;
      task.completedAt = new Date();
      this.status = "error";
      await this.safeStore("update", task, traceId);
      return task;
    }
  }

  private async decideNextActions(intentOutput: IntentOutput, traceId: string) {
    await requireAgentConfigured("orchestrator-agent");
    const request = {
      messages: [
        {
          role: "system" as const,
          content:
`You are an orchestration AI. Return ONLY valid JSON (array) matching the schema:
[{ "agent": "retriever|tool|workflow|memory|formatter|guardrail", "parameters": object, "reasoning": string }]
Do not include explanations outside JSON.`,
        },
        {
          role: "user" as const,
          content:
`Intent Analysis:
${JSON.stringify(intentOutput, null, 2)}`,
        },
      ],
      responseFormat: "json" as const,
      temperature: aiConfig.temperatures.collaboration,
      maxTokens: aiConfig.limits?.collabMaxTokens ?? 800,
    };

    const timeoutMs = aiConfig.timeouts?.collaborationMs ?? 12000;
    const resp = await withTimeout(() => this.llm.chat(request), timeoutMs, "collaboration llm timeout");
    return parseWithSchema(resp.content, NextActionsSchema) as NextAction[];
  }

  private async safeStore(op: "create" | "update", task: any, traceId: string) {
    if (!this.taskStore) return;
    try {
      if (op === "create") await this.taskStore.create(task);
      else await this.taskStore.update(task.id, task);
    } catch (err: any) {
      logger.error("intent.taskstore.fail", { metadata: { traceId, op }, err: err?.message });
    }
  }

  getStatus() {
    return {
      type: "intent",
      name: "Intent Analysis Agent",
      status: this.status,
      tasksCompleted: this.tasksCompleted,
      capabilities: [
        "natural_language_understanding",
        "intent_classification",
        "entity_extraction",
        "agent_collaboration",
      ],
    };
  }
}
