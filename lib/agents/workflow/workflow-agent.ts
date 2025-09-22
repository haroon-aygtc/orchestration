// Workflow Agent - AI-powered workflow orchestration and automation
import { generateObject } from "ai";
import { z } from "zod";
import { aiConfigService } from "../../ai-config-service";
import { llmService } from "../../llm/api/llm-service";
import { AGENT_CONSTANTS, ERROR_MESSAGES, requireAgentConfigured } from "../shared/constants";
import type { AgentTask, AgentTaskStore, WorkflowInput, WorkflowStep, WorkflowOutput } from "../shared/types";
import { TaskStatus } from "../shared/types";
import { generatePrefixedUUID } from "../../utils/uuid";



export class WorkflowAgent {
  private tasksCompleted = 0;
  private status: "idle" | "busy" | "error" = "idle";
  private llmService = llmService;

  constructor(private taskStore?: AgentTaskStore) {}

  async createWorkflow(input: WorkflowInput): Promise<AgentTask<WorkflowInput, WorkflowOutput>> {
    const task: AgentTask<WorkflowInput, WorkflowOutput> = {
      id: generatePrefixedUUID("workflow"),
      type: "workflow_creation",
      input,
      status: AGENT_CONSTANTS.TASK_STATUSES.RUNNING as TaskStatus,
      startedAt: new Date(),
    };
    this.status = AGENT_CONSTANTS.AGENT_STATUSES.BUSY;
    await this.taskStore?.create(task);

    try {
      await requireAgentConfigured("workflow-agent");

      // Generate workflow structure using AI
      const workflowResponse = await this.executeWithTimeout(generateObject({
        model: await aiConfigService.getModelForAgent("workflow-agent"),
        schema: z.object({
          steps: z.array(z.object({
            id: z.string(),
            name: z.string(),
            type: z.enum(["trigger", "condition", "action", "delay"]),
            parameters: z.record(z.any()),
            dependencies: z.array(z.string())
          })),
          estimatedDuration: z.number(),
          successCriteria: z.array(z.string()),
          rollbackPlan: z.array(z.string())
        }),
        prompt: `Create a detailed workflow for the following requirements:

Name: ${input.name}
Description: ${input.description}
Triggers: ${input.triggers.join(', ')}
Goals: ${input.goals.join(', ')}

Generate a structured workflow with:
- Logical sequence of steps
- Appropriate triggers and conditions
- Realistic duration estimates
- Clear success criteria
- Comprehensive rollback plan

Return as structured JSON.`
      } as any), AGENT_CONSTANTS.TIMEOUTS.LLM_RESPONSE);

      const workflow = workflowResponse.object as any;

      task.output = {
        workflowId: generatePrefixedUUID("workflow"),
        name: input.name,
        steps: workflow.steps || [],
        estimatedDuration: workflow.estimatedDuration || 3600, // Default 1 hour
        successCriteria: workflow.successCriteria || [],
        rollbackPlan: workflow.rollbackPlan || []
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

  async executeWorkflow(input: WorkflowInput): Promise<AgentTask<WorkflowInput, WorkflowOutput>> {
    const task: AgentTask<WorkflowInput, WorkflowOutput> = {
      id: generatePrefixedUUID("workflow-execution"),
      type: "workflow_execution",
      input,
      status: AGENT_CONSTANTS.TASK_STATUSES.RUNNING as TaskStatus,
      startedAt: new Date(),
    };
    this.status = AGENT_CONSTANTS.AGENT_STATUSES.BUSY;
    await this.taskStore?.create(task);

    try {
      // First create the workflow
      const createResult = await this.createWorkflow(input);
      if (!createResult.output) {
        throw new Error("Workflow creation failed");
      }

      // Execute workflow steps (simplified for now - would need real orchestration)
      const workflowOutput: WorkflowOutput = {
        ...createResult.output,
        name: input.name,
        steps: createResult.output.steps.map((step: WorkflowStep) => ({
          ...step,
          parameters: {
            ...step.parameters,
            executed: true,
            executionTime: Date.now()
          }
        })),
        estimatedDuration: createResult.output.estimatedDuration,
        successCriteria: createResult.output.successCriteria,
        rollbackPlan: createResult.output.rollbackPlan
      };

      task.output = workflowOutput;
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
      type: "workflow",
      name: "Workflow Orchestration Agent",
      status: this.status,
      tasksCompleted: this.tasksCompleted,
      capabilities: AGENT_CONSTANTS.AGENT_CAPABILITIES.WORKFLOW,
    };
  }
}
