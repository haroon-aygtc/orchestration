// Tool Agent - Dynamic tool execution with intelligent selection
import { llmService } from "../../llm/api/llm-service";
import { parseWithSchema } from "../../llm/strict-json";
import { runToolFn } from "../../tools/run-tool";
import { z } from "zod";
import { generatePrefixedUUID } from "../../utils/uuid";
import type { AgentTask, AgentTaskStore, ToolRegistry, ToolInput, ToolOutput } from "../shared/types";
import { handleError } from "../../utils/error-handler";
import { toolConfig, aiConfig } from "../../env";
import { TaskStatus } from "../shared/types";


// Use generatePrefixedUUID directly instead of wrapper

export class ToolAgent {
  private tasksCompleted = 0;
  private status: "idle" | "busy" | "error" = "idle";
  private llmService = llmService;

  constructor(private tools: ToolRegistry, private taskStore?: AgentTaskStore) {}

  async executeTool(input: ToolInput, correlationId?: string): Promise<AgentTask<ToolInput, ToolOutput>> {
    const task: AgentTask<ToolInput, ToolOutput> = {
      id: generatePrefixedUUID("tool"),
      type: "tool_execution",
      input,
      status: "running" as TaskStatus,
      startedAt: new Date(),
    };
    this.status = "busy" as "idle" | "busy" | "error";
    await this.taskStore?.create(task);

    try {
      // Dynamic tool selection if toolName not provided
      let selectedToolName = input.toolName;
      let selectedParameters = input.parameters;

      if (!selectedToolName) {
        const selection = await this.selectOptimalTool(input.parameters);
        selectedToolName = selection.toolName;
        selectedParameters = selection.parameters;
      }

      const tool = this.tools[selectedToolName];
      if (!tool) throw new Error(`Unknown tool: ${selectedToolName}`);

      // Use runTool for standardized logging and retry logic
      const result = await runToolFn(
        correlationId || task.id,
        selectedToolName,
        () => this.executeWithTimeout(tool(selectedParameters), toolConfig.timeouts.default),
        toolConfig.retries.max,
        toolConfig.retries.baseDelay
      );

      task.output = {
        toolName: selectedToolName,
        executionResult: result,
      };
      task.status = "completed" as TaskStatus;
      task.completedAt = new Date();
      this.tasksCompleted++;
      this.status = "idle" as "idle" | "busy" | "error";
      await this.taskStore?.update(task.id, task);
      return task;

    } catch (error: any) {
      handleError(error, 'tool-agent');
      task.error = error?.message || "Unknown error";
      task.status = "failed" as TaskStatus  ;
      task.completedAt = new Date();
      this.status = "error" as "idle" | "busy" | "error";
      await this.taskStore?.update(task.id, task);
      return task;
    }
  }

  private async selectOptimalTool(parameters: Record<string, any>): Promise<{
    toolName: string;
    parameters: Record<string, any>;
    reasoning: string;
  }> {
    // Analyze task requirements to select best tool
    const taskDescription = this.analyzeTask(parameters);

    const request = {
      messages: [
        {
          role: "system" as const,
          content: `You are an expert tool selection AI. Analyze the task and select the most appropriate tool from the available registry.

Available tools: ${Object.keys(this.tools).join(', ')}

For each tool, consider:
- http_request: For making HTTP requests (GET, POST, PUT, DELETE)
- email_sender: For sending emails via SMTP
- hash_sha256: For SHA-256 hashing
- csv_parse: For parsing CSV files
- data_validator: For validating data against schemas
- slack_notify: For sending Slack notifications
- webhook_trigger: For triggering webhooks
- file_write: For writing files to filesystem
- pdf_parse: For extracting text from PDF files

Return JSON with:
- toolName: The selected tool name
- parameters: Parameters to pass to the tool
- reasoning: Why this tool was selected`
        },
        {
          role: "user" as const,
          content: `Task: ${taskDescription}

Parameters: ${JSON.stringify(parameters, null, 2)}

Select the best tool and provide the parameters.`
        }
      ],
      responseFormat: "json" as const,
      temperature: aiConfig.temperatures.toolSelection,
      maxTokens: 500
    };

    const response = await this.llmService.chat(request);
    
    // Define schema for tool selection
    const ToolSelectionSchema = z.object({
      toolName: z.string(),
      parameters: z.record(z.any()).optional(),
      reasoning: z.string()
    });
    
    const selection = parseWithSchema(response.content, ToolSelectionSchema);

    return {
      toolName: selection.toolName,
      parameters: selection.parameters || parameters,
      reasoning: selection.reasoning
    };
  }

  private analyzeTask(parameters: Record<string, any>): string {
    if (parameters.url || parameters.method) {
      return "Making an HTTP request to an external service";
    }
    if (parameters.recipient || parameters.subject) {
      return "Sending an email notification";
    }
    if (parameters.input && typeof parameters.input === 'string' && parameters.input.length === 64) {
      return "Generating a hash of provided data";
    }
    if (parameters.csv || parameters.delimiter) {
      return "Parsing CSV data";
    }
    if (parameters.schema || parameters.validation) {
      return "Validating data against a schema";
    }
    if (parameters.message || parameters.channel) {
      return "Sending a notification";
    }
    if (parameters.webhook || parameters.endpoint) {
      return "Triggering a webhook";
    }
    if (parameters.file || parameters.path || parameters.content) {
      return "Writing or manipulating files";
    }
    if (parameters.pdf || parameters.extract) {
      return "Extracting text from PDF documents";
    }
    return "Performing a system or data operation";
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
      type: "tool",
      name: "Tool Execution Agent",
      status: this.status,
      tasksCompleted: this.tasksCompleted,
      capabilities: ["api_integration", "system_interaction", "external_service_calls", "dynamic_tool_selection"],
    };
  }
}
