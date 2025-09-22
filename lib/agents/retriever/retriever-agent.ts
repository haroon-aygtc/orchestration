// Retriever Agent - Real information retrieval with knowledge search
import { generateObject } from "ai";
import { z } from "zod";
import { aiConfigService } from "../../ai-config-service";
import { llmService } from "../../llm/api/llm-service";
import { AGENT_CONSTANTS, ERROR_MESSAGES } from "../shared/constants";
import type { AgentTask, AgentTaskStore, Retriever, RetrieverInput, RetrieverOutput } from "../shared/types";
import { TaskStatus } from "../shared/types";
import { generatePrefixedUUID } from "../../utils/uuid";

async function requireAgentConfigured(agent: string) {
  const info = await aiConfigService.getAgentAIInfo(agent);
  if (!info.isConfigured) {
    throw new Error(ERROR_MESSAGES.AGENT_NOT_CONFIGURED(agent));
  }
}


export class RetrieverAgent {
  private tasksCompleted = 0;
  private status: "idle" | "busy" | "error" = "idle";
  private llmService = llmService;

  constructor(private retriever: Retriever, private taskStore?: AgentTaskStore) {}

  async retrieveInformation(input: RetrieverInput): Promise<AgentTask<RetrieverInput, RetrieverOutput>> {
    const task: AgentTask<RetrieverInput, RetrieverOutput> = {
      id: generatePrefixedUUID("retriever"),
      type: "information_retrieval",
      input,
      status: AGENT_CONSTANTS.TASK_STATUSES.RUNNING as TaskStatus,
      startedAt: new Date(),
    };
    this.status = AGENT_CONSTANTS.AGENT_STATUSES.BUSY;
    await this.taskStore?.create(task);

    try {
      // Real retrieval (DB/vector/index/http), strictly no LLM fabrication here
      const rows = await this.executeWithTimeout(
        this.retriever.search(input.query, input.sources, input.filters),
        AGENT_CONSTANTS.TIMEOUTS.RETRIEVAL
      );
      // Summarize with LLM (separate from retrieval)
      await requireAgentConfigured("llm");
      const { object: summary } = await this.executeWithTimeout(generateObject({
        model: await aiConfigService.getModelForAgent("llm"),
        schema: z.object({
          summary: z.string(),
          recommendations: z.array(z.string()),
          confidence: z.number().min(0).max(1)
        }),
        prompt: `Summarize the following retrieved items and suggest actionable next steps:
${JSON.stringify(rows, null, 2)}`
      } as any), AGENT_CONSTANTS.TIMEOUTS.LLM_RESPONSE);

      task.output = {
        relevantData: rows,
        summary: (summary as any)?.summary ?? "",
        recommendations: (summary as any)?.recommendations ?? [],
        confidence: (summary as any)?.confidence ?? 0,
      };
      task.status = AGENT_CONSTANTS.TASK_STATUSES.COMPLETED as TaskStatus;
      task.completedAt = new Date();
      this.tasksCompleted++;
      this.status = AGENT_CONSTANTS.AGENT_STATUSES.IDLE;
      await this.taskStore?.update(task.id, task);
      return task;
    } catch (error: any) {
      task.error = error?.message || ERROR_MESSAGES.JSON_PARSE_FAILED;
      task.status = AGENT_CONSTANTS.TASK_STATUSES.FAILED as TaskStatus;
      task.completedAt = new Date();
      this.status = AGENT_CONSTANTS.AGENT_STATUSES.ERROR;
      await this.taskStore?.update(task.id, task);
      return task;
    }
  }

  private async executeWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timeoutId: NodeJS.Timeout | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(ERROR_MESSAGES.TIMEOUT_EXCEEDED(timeoutMs))), timeoutMs);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  getStatus() {
    return {
      type: "retriever",
      name: "Data Retrieval Agent",
      status: this.status,
      tasksCompleted: this.tasksCompleted,
      capabilities: AGENT_CONSTANTS.AGENT_CAPABILITIES.RETRIEVER,
    };
  }
}
