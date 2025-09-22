import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateUUID } from "@/lib/utils/uuid";
import { createPostgresTaskStore } from "@/lib/db-task-store/postgres-task-store";
import { validateApiRequest } from "@/lib/middleware/security-middleware";
import { bootstrapAgents } from "@/lib/agents/bootstrap";
// If you have a logger, prefer it over console:
import { logger } from "@/lib/utils/structured-logger";
import { PersistedTask } from "@/lib/agents/shared/task-types";
import { TaskStatus } from "@/lib/agents/shared/task-types";

const AgentTypeEnum = z.enum([
  "intent",
  "retriever",
  "tool",
  "workflow",
  "memory",
  "follow",
  "formatter",
  "guardrail",
  "llm",
]);

const RequestSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  type: z.string().optional().default("automation"),
  agentType: AgentTypeEnum.default("intent"),
  input: z.record(z.unknown()).optional().default({}),
});

type RequestBody = z.infer<typeof RequestSchema>;

const EXECUTE_INLINE = false; // true = run now and return result; false = enqueue and return 202

export async function POST(request: NextRequest) {
  const traceId = `trace_${generateUUID()}`;

  // Basic method/content-type guard
  if (request.method !== "POST") {
    return NextResponse.json(
      { success: false, error: "Method Not Allowed", traceId },
      { status: 405 }
    );
  }
  const ct = request.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    return NextResponse.json(
      { success: false, error: "Content-Type must be application/json", traceId },
      { status: 415 }
    );
  }

  // Security check (auth/rate-limit/etc.)
  const securityResult = await validateApiRequest(request);
  if (!securityResult.isValid) {
    return NextResponse.json(
      {
        success: false,
        error: securityResult.error?.message || "Security validation failed",
        traceId,
      },
      { status: securityResult.error?.statusCode || 403 }
    );
  }

  // Parse and validate body (size limits can be added in middleware)
  let body: RequestBody;
  try {
    const raw = await request.json();
    body = RequestSchema.parse(raw);
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Invalid request body", traceId },
      { status: 400 }
    );
  }

  const { title, description, type, agentType, input } = body;
  const taskId = generateUUID();

  // Build task
  const task = {
    id: taskId,
    type,
    status: "pending" as const,
    input: { title, description, ...input },
    startedAt: new Date(),
    agentId: agentType,
    traceId,
  };

  // Persist task (create)
  const taskStore = await createPostgresTaskStore();
  try {
    await taskStore.create(task as PersistedTask);
  } catch (err) {
    logger?.error?.("task.create.fail", { traceId, taskId, err: (err as Error).message });
    return NextResponse.json(
      { success: false, error: "Failed to persist task", traceId },
      { status: 500 }
    );
  }

  // Dispatch map with minimal per-agent input guards
  const dispatch = async () => {
    // Transition to running
    try {
      await taskStore.update(taskId, { status: "running" as TaskStatus, startedAt: new Date() });
    } catch (err) {
      logger?.error?.("task.update.running.fail", { traceId, taskId, err: (err as Error).message });
    }

    try {
      const agents = await bootstrapAgents();

      // Validate agent exists
      if (!(agentType in agents)) {
        throw new Error(`Unknown agent type: ${agentType}`);
      }

      // Narrow type by keys on the agents object
      const agent = agents[agentType as keyof typeof agents];

      // Per-agent schema stubs (tighten these as your agents require)
      const IntentInput = z.object({
        text: z.string().min(1),
        context: z.record(z.unknown()).optional(),
      });
      const RetrieverInput = z.object({
        query: z.string().min(1),
        context: z.record(z.unknown()).optional(),
      });
      const ToolInput = z.object({
        toolName: z.string().optional(),
        parameters: z.record(z.unknown()).optional().default({}),
        context: z.record(z.unknown()).optional(),
      });
      const WorkflowInput = z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        triggers: z.array(z.unknown()).optional().default([]),
        goals: z.array(z.unknown()).optional().default([]),
      });
      const MemoryInput = z.object({
        key: z.string().min(1),
        value: z.unknown(),
        context: z.record(z.unknown()).optional(),
      });
      const FollowInput = z.object({
        taskId: z.string().min(1),
        checkpoints: z.array(z.string()).optional().default(["started", "in-progress", "completed"]),
        notifications: z.unknown().optional(),
      });
      const FormatterInput = z.object({
        content: z.string().min(1),
        format: z.enum(["text", "markdown", "html", "json"]).default("text"),
        context: z.record(z.unknown()).optional(),
      });
      const GuardrailInput = z.object({
        content: z.string().min(1),
        context: z.record(z.unknown()).optional(),
      });
      const LLMInput = z.object({
        prompt: z.string().min(1),
        context: z.record(z.unknown()).optional(),
      });

      let result: unknown;

      switch (agentType) {
        case "intent":
          if (!("processIntent" in (agent as any))) throw new Error("Agent missing processIntent");
          result = await (agent as any).processIntent(
            IntentInput.parse({
              text: `${title} ${description}`.trim(),
              context: { taskId, agentType, traceId },
            })
          );
          break;

        case "retriever":
          if (!("retrieveInformation" in (agent as any))) throw new Error("Agent missing retrieveInformation");
          result = await (agent as any).retrieveInformation(
            RetrieverInput.parse({
              query: `${title} ${description}`.trim(),
              context: { taskId, agentType, traceId },
            })
          );
          break;

        case "tool":
          if (!("executeTool" in (agent as any))) throw new Error("Agent missing executeTool");
          result = await (agent as any).executeTool(
            ToolInput.parse({
              toolName: (input as any)?.toolName,
              parameters: (input as any)?.parameters ?? {},
              context: { taskId, agentType, traceId },
            })
          );
          break;

        case "workflow":
          if (!("createWorkflow" in (agent as any))) throw new Error("Agent missing createWorkflow");
          result = await (agent as any).createWorkflow(
            WorkflowInput.parse({
              name: title,
              description,
              triggers: (input as any)?.triggers ?? [],
              goals: (input as any)?.goals ?? [],
            })
          );
          break;

        case "memory":
          if (!("storeMemory" in (agent as any))) throw new Error("Agent missing storeMemory");
          result = await (agent as any).storeMemory(
            MemoryInput.parse({
              key: `task-${taskId}`,
              value: { title, description, ...(input || {}) },
              context: { taskId, agentType, traceId },
            })
          );
          break;

        case "follow":
          if (!("trackProgress" in (agent as any))) throw new Error("Agent missing trackProgress");
          result = await (agent as any).trackProgress(
            FollowInput.parse({
              taskId,
              checkpoints: (input as any)?.checkpoints ?? undefined,
              notifications: (input as any)?.notifications,
            })
          );
          break;

        case "formatter":
          if (!("formatOutput" in (agent as any))) throw new Error("Agent missing formatOutput");
          result = await (agent as any).formatOutput(
            FormatterInput.parse({
              content: `${title} ${description}`.trim(),
              format: (input as any)?.format ?? "text",
              context: { taskId, agentType, traceId },
            })
          );
          break;

        case "guardrail":
          if (!("validateContent" in (agent as any))) throw new Error("Agent missing validateContent");
          result = await (agent as any).validateContent(
            GuardrailInput.parse({
              content: `${title} ${description}`.trim(),
              context: { taskId, agentType, traceId },
            })
          );
          break;

        case "llm":
          if (!("generateResponse" in (agent as any))) throw new Error("Agent missing generateResponse");
          result = await (agent as any).generateResponse(
            LLMInput.parse({
              prompt: `${title} ${description}`.trim(),
              context: { taskId, agentType, traceId },
            })
          );
          break;
      }

      try {
        await taskStore.update(taskId, { status: "completed" as TaskStatus, output: result, completedAt: new Date() });
      } catch (err) {
        logger?.error?.("task.update.completed.fail", { traceId, taskId, err: (err as Error).message });
      }

      logger?.info?.("task.completed", { traceId, taskId, agentType });
      return result;
    } catch (error) {
      logger?.error?.("task.execution.fail", {
        traceId,
        taskId,
        agentType,
        err: (error as Error).message,
      });
      try {
        await taskStore.update(taskId, {
          status: "failed" as TaskStatus,
          error: (error as Error).message,
          completedAt: new Date(),
        });
      } catch (err) {
        logger?.error?.("task.update.failed.fail", { traceId, taskId, err: (err as Error).message });
      }
      throw error;
    }
  };

  if (EXECUTE_INLINE) {
    // Run now and return result
    try {
      const result = await dispatch();
      const resp = NextResponse.json(
        { success: true, taskId, result, traceId },
        { status: 200 }
      );
      resp.headers.set("X-Trace-ID", traceId);
      return resp;
    } catch (err) {
      return NextResponse.json(
        { success: false, taskId, error: (err as Error).message, traceId },
        { status: 500 }
      );
    }
  } else {
    // Enqueue/dispatch without blocking. In serverless, prefer a real queue/worker.
    // Here we at least detach the promise and return 202.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    dispatch();

    const resp = NextResponse.json(
      {
        success: true,
        taskId,
        message: "Task accepted for execution",
        traceId,
      },
      { status: 202 }
    );
    resp.headers.set("Location", `/api/tasks/${taskId}`);
    resp.headers.set("X-Trace-ID", traceId);
    return resp;
  }
}
