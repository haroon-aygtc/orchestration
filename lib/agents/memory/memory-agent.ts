// Memory Agent - Persistent storage and context preservation
import { AGENT_CONSTANTS } from "../shared/constants";
import type { AgentTask, AgentTaskStore, MemoryBackend, MemoryInput, MemoryOutput } from "../shared/types";
import { TaskStatus } from "../shared/task-types";
import { generatePrefixedUUID } from "../../utils/uuid";


export class MemoryAgent {
  private tasksCompleted = 0;
  private status: "idle" | "busy" | "error" = "idle";

  constructor(private memory: MemoryBackend, private taskStore?: AgentTaskStore) {}

  async storeMemory(input: MemoryInput): Promise<AgentTask<MemoryInput, MemoryOutput>> {
    const task: AgentTask<MemoryInput, MemoryOutput> = {
      id: generatePrefixedUUID("memory-store"),
      type: "memory_storage",
      input,
      status: AGENT_CONSTANTS.TASK_STATUSES.RUNNING as TaskStatus,
      startedAt: new Date(),
    };
    this.status = AGENT_CONSTANTS.AGENT_STATUSES.BUSY;
    await this.taskStore?.create(task);

    try {
      await this.executeWithTimeout(
        this.memory.set(input.key, input.value, input.context, input.ttl),
        AGENT_CONSTANTS.TIMEOUTS.DEFAULT_EXECUTION
      );

      task.output = {
        stored: true,
        key: input.key
      };

      task.status = AGENT_CONSTANTS.TASK_STATUSES.COMPLETED as TaskStatus;
      task.completedAt = new Date();
      this.tasksCompleted++;
      this.status = AGENT_CONSTANTS.AGENT_STATUSES.IDLE;
      await this.taskStore?.update(task.id, task);
      return task;
    } catch (error: any) {
      task.error = error?.message || "Memory storage failed";
      task.status = AGENT_CONSTANTS.TASK_STATUSES.FAILED as TaskStatus;
      task.completedAt = new Date();
      this.status = AGENT_CONSTANTS.AGENT_STATUSES.ERROR;
      await this.taskStore?.update(task.id, task);
      return task;
    }
  }

  async retrieveMemory(key: string): Promise<unknown> {
    try {
      return await this.executeWithTimeout(
        this.memory.get(key),
        AGENT_CONSTANTS.TIMEOUTS.DEFAULT_EXECUTION
      );
    } catch (error) {
      console.error("Memory retrieval failed:", error);
      return null;
    }
  }

  async deleteMemory(key: string): Promise<boolean> {
    try {
      await this.executeWithTimeout(
        this.memory.delete?.(key) || Promise.resolve(),
        AGENT_CONSTANTS.TIMEOUTS.DEFAULT_EXECUTION
      );
      return true;
    } catch (error) {
      console.error("Memory deletion failed:", error);
      return false;
    }
  }

  async listMemory(context?: string): Promise<string[]> {
    try {
      if (this.memory.list) {
        return await this.executeWithTimeout(
          this.memory.list(context ? { context } : undefined),
          AGENT_CONSTANTS.TIMEOUTS.DEFAULT_EXECUTION
        );
      }
      return [];
    } catch (error) {
      console.error("Memory listing failed:", error);
      return [];
    }
  }

  async clearMemory(context?: string): Promise<boolean> {
    try {
      if (this.memory.clear) {
        await this.executeWithTimeout(
          this.memory.clear(context),
          AGENT_CONSTANTS.TIMEOUTS.DEFAULT_EXECUTION
        );
        return true;
      }
      return false;
    } catch (error) {
      console.error("Memory clearing failed:", error);
      return false;
    }
  }

  private async executeWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timeoutId: NodeJS.Timeout | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
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
      type: "memory",
      name: "Memory Agent",
      status: this.status,
      tasksCompleted: this.tasksCompleted,
      capabilities: AGENT_CONSTANTS.AGENT_CAPABILITIES.MEMORY,
    };
  }
}
