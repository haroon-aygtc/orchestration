// LLM Agent - Primary language model operations and communication
import { generateText } from "ai";
import { aiConfigService } from "../../ai-config-service";
import { llmService } from "../../llm/api/llm-service";
import { AGENT_CONSTANTS, ERROR_MESSAGES } from "../shared/constants";
import type { AgentTask, AgentTaskStore, LLMInput, LLMOutput } from "../shared/types";
import { TaskStatus } from "../shared/types";
import { generatePrefixedUUID } from "../../utils/uuid";


async function requireConfigured(agent: string) {
  const info = await aiConfigService.getAgentAIInfo(agent);
  if (!info.isConfigured) {
    throw new Error(ERROR_MESSAGES.AGENT_NOT_CONFIGURED(agent));
  }
}

export class LLMAgent {
  private tasksCompleted = 0;
  private status: "idle" | "busy" | "error" = "idle";
  private llmService = llmService;

  constructor(private taskStore?: AgentTaskStore) {}

  async generateResponse(input: LLMInput): Promise<AgentTask<LLMInput, LLMOutput>> {
    const task: AgentTask<LLMInput, LLMOutput> = {
      id: generatePrefixedUUID("llm-generate"),
      type: "llm_generation",
      input,
      status: AGENT_CONSTANTS.TASK_STATUSES.RUNNING as TaskStatus,
      startedAt: new Date(),
    };
    this.status = AGENT_CONSTANTS.AGENT_STATUSES.BUSY;
    await this.taskStore?.create(task);

    try {
      await requireConfigured("llm");

      const startTime = Date.now();
      const model = await aiConfigService.getModelForAgent("llm");

      const request = {
        messages: [
          {
            role: "system" as const,
            content: "You are a helpful AI assistant. Provide clear, accurate, and well-structured responses."
          },
          {
            role: "user" as const,
            content: this.buildPrompt(input)
          }
        ],
        temperature: input.options?.temperature || AGENT_CONSTANTS.LLM_SETTINGS.DEFAULT_TEMPERATURE,
        maxTokens: input.options?.maxTokens || AGENT_CONSTANTS.LLM_SETTINGS.DEFAULT_MAX_TOKENS
      };

      const response = await this.executeWithTimeout(
        generateText(request as any),
        AGENT_CONSTANTS.TIMEOUTS.LLM_RESPONSE
      );

      const processingTime = Date.now() - startTime;

      task.output = {
        response: response.text,
        metadata: {
          model: model.modelId,
          tokens: response.usage?.totalTokens || 0,
          confidence: this.calculateConfidence(response.text, input),
          processingTime
        }
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

  async chat(input: LLMInput): Promise<AgentTask<LLMInput, LLMOutput>> {
    const task: AgentTask<LLMInput, LLMOutput> = {
      id: generatePrefixedUUID("llm-chat"),
      type: "llm_chat",
      input,
      status: AGENT_CONSTANTS.TASK_STATUSES.RUNNING as TaskStatus,
      startedAt: new Date(),
    };
    this.status = AGENT_CONSTANTS.AGENT_STATUSES.BUSY;
    await this.taskStore?.create(task);

    try {
      await requireConfigured("llm");

      const startTime = Date.now();

      const request = {
        messages: [
          {
            role: "system" as const,
            content: "You are a conversational AI assistant. Engage in natural dialogue and provide helpful responses."
          },
          {
            role: "user" as const,
            content: input.prompt
          }
        ],
        temperature: input.options?.temperature || AGENT_CONSTANTS.LLM_SETTINGS.DEFAULT_TEMPERATURE,
        maxTokens: input.options?.maxTokens || AGENT_CONSTANTS.LLM_SETTINGS.DEFAULT_MAX_TOKENS
      };

      const response = await this.executeWithTimeout(
        this.llmService.chat(request),
        AGENT_CONSTANTS.TIMEOUTS.LLM_RESPONSE
      );

      const processingTime = Date.now() - startTime;

      task.output = {
        response: response.content,
        metadata: {
          model: response.model || 'unknown',
          tokens: response.usage?.totalTokens || 0,
          confidence: this.calculateConfidence(response.content, input),
          processingTime
        }
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

  private buildPrompt(input: LLMInput): string {
    let prompt = input.prompt;

    if (input.context) {
      prompt = `Context: ${JSON.stringify(input.context, null, 2)}\n\n${prompt}`;
    }

    return prompt;
  }

  private calculateConfidence(response: string, input: LLMInput): number {
    // Simple confidence calculation based on response characteristics
    let confidence = 0.8; // Base confidence

    // Longer responses tend to be more confident
    if (response.length > 500) confidence += 0.1;
    if (response.length > 1000) confidence += 0.05;

    // Structured responses are more confident
    if (response.includes('\n-') || response.includes('\n1.')) confidence += 0.05;

    // Penalize very short responses
    if (response.length < 50) confidence -= 0.1;

    return Math.max(0.1, Math.min(0.95, confidence));
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
      type: "llm",
      name: "LLM Agent",
      status: this.status,
      tasksCompleted: this.tasksCompleted,
      capabilities: AGENT_CONSTANTS.AGENT_CAPABILITIES.LLM,
    };
  }
}
