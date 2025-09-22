// path: lib/real-manager-agent.ts
import { generateText, generateObject } from "ai";
import { z } from "zod";
import { generateUUID, generatePrefixedUUID } from "./utils/uuid";
import { aiConfigService } from "./ai-config-service";
// import { bootstrapAgents } from "./agents/bootstrap"; // unused
import { OrchestrationService } from "./orchestration/ai-orchestration-service";
import { Server } from "socket.io";
import { aiConfig } from "./env";
import { AgentTaskStore, Agent, ToolResult } from "./agents/shared/types";
import type { AgentTask, Retriever, RetrieverResultItem, TaskStatus } from "./agents/shared/types";
import { logger } from "./utils/structured-logger";
/** ========== Types (real, strict) ========== */

export interface RealBusinessProfile {
  id: string;
  industry: string;
  companySize: string;
  goals: string[];
  challenges: string[];
  currentSystems: string[];
  createdAt: Date;
}

export type RealAgent = Agent;
export type RealTask = AgentTask;


export type ToolFn = (params: Record<string, any>) => Promise<ToolResult>;
export type ToolRegistry = Record<string, ToolFn>;

// RetrieverResultItem and Retriever interfaces moved to shared types

// TaskStore interface moved to shared types

export interface BusinessProfileStore {
  save(profile: RealBusinessProfile): Promise<void>;
  get(id: string): Promise<RealBusinessProfile | null>;
}

/** ========== Helpers ========== */

async function withTimeout<T>(p: Promise<T>, ms = 30_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, rej) => {
    timer = setTimeout(() => rej(new Error(`Timeout after ${ms}ms`)), ms);
  });
  try {
    return (await Promise.race([p, timeout])) as T;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function requireAgentConfigured(agent: string) {
  const info = await aiConfigService.getAgentAIInfo(agent);
  if (!info.isConfigured) {
    throw new Error(`${agent} AI not configured. Provider=${info.provider}, Status=${info.status}`);
  }
}

/** CSV parser (handles quotes, escaped quotes, commas) */
function parseCSV(csv: string): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  const lines = csv.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.length > 0);
  if (lines.length === 0) return rows;

  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === "," && !inQuotes) {
        out.push(cur);
        cur = "";
      } else {
        cur += c;
      }
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };

  const headers = parseLine(lines[0]);
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    const rec: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      rec[headers[j] || `col_${j}`] = cols[j] ?? "";
    }
    rows.push(rec);
  }
  return rows;
}

/** ========== Real Manager Agent ========== */

export class RealManagerAgent {
  private agents: Map<string, RealAgent> = new Map();
  private tasks: Map<string, AgentTask> = new Map();
  private businessProfiles: Map<string, RealBusinessProfile> = new Map();
  private orchestrationService: OrchestrationService;

  /** Optional real integrations injected */
  constructor(
    private tools?: ToolRegistry,
    private retriever?: Retriever,
    private taskStore?: AgentTaskStore,
    private profileStore?: BusinessProfileStore,
    private ioInstance?: Server
  ) {
    this.ioInstance = ioInstance;
    this.initializeRealAgents();
    this.orchestrationService = new OrchestrationService(this, this.ioInstance as Server);
  }

  /** ---------- Agent bootstrap ---------- */
  private initializeRealAgents() {
    const agentConfigs = [
      { type: "intent", name: "Intent Analysis Agent", capabilities: ["nlp", "intent_classification", "goal_extraction"] },
      { type: "retriever", name: "Data Retrieval Agent", capabilities: ["db_search", "web_search", "knowledge_retrieval"] },
      { type: "analyzer", name: "Business Analysis Agent", capabilities: ["business_analysis", "strategy_generation", "recommendations"] },
      { type: "workflow", name: "Workflow Orchestration Agent", capabilities: ["process_design", "task_sequencing", "automation"] },
      { type: "integration", name: "System Integration Agent", capabilities: ["api_integration", "data_sync", "system_connection"] },
    ];

    const now = Date.now();
    agentConfigs.forEach((cfg, i) => {
      const agent: AgentTask = {
        id: `${cfg.type}-${generateUUID()}`, // collision-safe
        type: cfg.type,
        name: cfg.name,
        status: "idle" as TaskStatus,
        capabilities: cfg.capabilities,
        tasksCompleted: 0,
        currentTask: undefined,
      };
      // Stagger IDs deterministically for old logs comparability
      Object.defineProperty(agent, "__seed", { value: now + i, enumerable: false });
      this.agents.set(agent.id, agent);
    });
  }

  /** ---------- Business interview (REAL LLM) ---------- */
  async conductRealBusinessInterview(userResponses: Record<string, string>): Promise<RealBusinessProfile> {
    const agent = this.findAgentByTypeOrThrow("analyzer");
    this.setAgentBusy(agent, "Analyzing business requirements");

    try {
      await requireAgentConfigured("llm");

      const UserResponsesSchema = z.record(z.string().min(1));
      const validatedResponses = UserResponsesSchema.parse(userResponses);

      const timeoutMs = await aiConfigService.getTimeoutMs();

      const { object: analysis } = await withTimeout(
        generateObject({
          model: await aiConfigService.getModelForAgent("llm"),
          schema: z.object({
            industry: z.string(),
            companySize: z.string(),
            goals: z.array(z.string()),
            challenges: z.array(z.string()),
            currentSystems: z.array(z.string()),
            recommendations: z.array(z.string()),
          }),
          prompt: `Analyze this business information and provide structured insights.

User Responses:
${JSON.stringify(validatedResponses, null, 2)}

Extract:
- Industry classification
- Company size
- Primary goals
- Key operational challenges
- Current technology systems
- Strategic recommendations (actionable)`,
        } as any),
        timeoutMs
      );

      const profile: RealBusinessProfile = {
        id: generatePrefixedUUID("profile"),
        industry: (analysis as any).industry as string,
        companySize: (analysis as any).companySize,
        goals: (analysis as any).goals,
        challenges: (analysis as any).challenges,
        currentSystems: (analysis as any).currentSystems,
        createdAt: new Date(),
      };

      this.businessProfiles.set(profile.id, profile);
      await this.profileStore?.save(profile);

      this.setAgentIdle(agent, true);
      return profile;
    } catch (err: any) {
      this.setAgentError(agent);
      throw new Error(`Business analysis failed: ${err?.message || String(err)}`);
    }
  }

  /** ---------- Task creation & execution ---------- */
  async createAndExecuteTask(taskData: {
    title: string;
    description: string;
    type: RealTaskType;
    input: unknown;
    agentType: string;
  }): Promise<AgentTask<unknown, unknown>> {
    const CreateTaskSchema = z.object({
      title: z.string().min(1),
      description: z.string().min(1),
      type: z.enum(["ai_analysis", "data_processing", "integration", "automation"]),
      input: z.unknown(),
      agentType: z.string().min(1),
    });
    const validated = CreateTaskSchema.parse(taskData);

    const agent = this.findAgentByTypeOrThrow(validated.agentType);

    const task: AgentTask<unknown, unknown> = {
      id: generatePrefixedUUID("task"),
      title: validated.title,
      description: validated.description,
      type: validated.type,
      status: "pending" as TaskStatus,
      input: validated.input,
      agentId: agent.id,
    };

    this.tasks.set(task.id, task);
    await this.taskStore?.create(task);

    // fire & run (non-blocking)
    void this.executeTask(task.id);
    return task;
  }

  /** Execute and persist transitions with real work */
  private async executeTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    const agent = this.agents.get(task.agentId!);
    if (!agent) return;

    task.status = "running" as TaskStatus;
    task.startedAt = new Date();
    agent.status = "busy";
    agent.currentTask = task.title;
    await this.taskStore?.update(task.id, { status: task.status as TaskStatus, startedAt: task.startedAt });

    try {
      let result: unknown;
      switch (task.type) {
        case "ai_analysis":
          result = await this.performAIAnalysis(task.input);
          break;
        case "data_processing":
          result = await this.processData(task.input);
          break;
        case "integration":
          result = await this.performIntegration(task.input);
          break;
        case "automation":
          result = await this.createAutomation(task.input);
          break;
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }

      task.output = result;
      task.status = "completed" as TaskStatus;
      task.completedAt = new Date();
      agent.status = "idle";
      agent.currentTask = undefined;
      agent.tasksCompleted++;

      await this.taskStore?.update(task.id, {
        status: task.status as TaskStatus,  
        output: task.output,
        completedAt: task.completedAt,
      });
    } catch (error: any) {
      task.error = error?.message || "Unknown error";
      task.status = "failed" as TaskStatus;
      task.completedAt = new Date();
      agent.status = "error";
      agent.currentTask = undefined;

      await this.taskStore?.update(task.id, {
        status: task.status as TaskStatus,
        error: task.error,
        completedAt: task.completedAt,
      });
    }
  }

  /** ========== REAL implementations (no mocks, no setTimeout fakes) ========== */

  /** Uses configured LLM; returns real text + timestamp */
  private async performAIAnalysis(input: unknown): Promise<{ analysis: string; timestamp: Date }> {
    await requireAgentConfigured("llm");
    const timeoutMs = await aiConfigService.getTimeoutMs();

    const { text } = await withTimeout(
      generateText({
        model: await aiConfigService.getModelForAgent("llm"),
        prompt: `Analyze the following data and provide concise, actionable insights (bulleted):
${JSON.stringify(input, null, 2)}`,
        temperature: aiConfig.temperatures.manager,
        maxTokens: 800,
      } as any),
      timeoutMs
    );
    return { analysis: text, timestamp: new Date() };
  }

  /**
   * Deterministic data processing:
   * - If { csv: string } => parse to rows
   * - If { schema, data } => JSON schema validate (AJV)
   * - If array of objects => compute basic stats
   */
  private async processData(input: any): Promise<unknown> {
    // CSV path
    if (input?.csv && typeof input.csv === "string") {
      try {
        const rows = parseCSV(input.csv);
        return { processed: true, kind: "csv->json", recordsProcessed: rows.length, dataPreview: rows.slice(0, 10) };
      } catch (error) {
        logger.error("csv.parse.fail", { error: (error as Error).message });
        return { processed: false, kind: "csv->json", error: error instanceof Error ? error.message : "Unknown error" };
      }
    }

    // JSON schema validation path
    if (input?.schema && input?.data) {
      const Ajv = (await import("ajv")) as any;
      const ajv = new Ajv({ allErrors: true, strict: false });
      const validate = ajv.compile(input.schema);
      const ok = validate(input.data);
      return { processed: true, kind: "json-validate", isValid: !!ok, errors: validate.errors ? validate.errors : [] };
    }

    // Aggregation path (array of objects)
    if (Array.isArray(input) && input.every((x) => typeof x === "object" && x)) {
      const count = input.length;
      const keys = Array.from(new Set(input.flatMap((r) => Object.keys(r))));
      return { processed: true, kind: "aggregate", recordsProcessed: count, keys, sample: input.slice(0, 5) };
    }

    // Fallback: echo with metadata
    return { processed: true, kind: "echo", type: typeof input, hasValue: input != null };
  }

  /**
   * REAL integration call:
   * - If tools registry provided and toolName present => execute tool
   * - Else perform direct HTTP request if { endpoint } given
   */
  private async performIntegration(input: any): Promise<unknown> {
    // Tool path
    if (this.tools && input?.toolName) {
      const tool = this.tools[input.toolName as string];
      if (!tool) throw new Error(`Unknown tool: ${input.toolName}`);
      const res = await withTimeout(tool(input.parameters ?? {}), 30_000);
      return { integrated: true, via: "tool", toolName: input.toolName, result: res, timestamp: new Date() };
    }

    // HTTP path
    if (input?.endpoint) {
      const method = (input.method || "POST").toUpperCase();
      const headers = { "Content-Type": "application/json", ...(input.headers || {}) };
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 30_000);
      try {
        const res = await fetch(input.endpoint, {
          method,
          headers,
          body: input.body ? (typeof input.body === "string" ? input.body : JSON.stringify(input.body)) : undefined,
          signal: controller.signal,
        });
        const txt = await res.text();
        let data: unknown;
        try {
          data = JSON.parse(txt);
        } catch {
          data = txt;
        }
        return { integrated: true, via: "http", statusCode: res.status, ok: res.ok, data, timestamp: new Date() };
      } finally {
        clearTimeout(t);
      }
    }

    throw new Error("performIntegration: neither toolName nor endpoint provided");
  }

  /** Uses LLM to design a workflow (real) */
  private async createAutomation(input: unknown): Promise<unknown> {
    await requireAgentConfigured("workflow");
    const timeoutMs = await aiConfigService.getTimeoutMs();

    const { object } = await withTimeout(
      generateObject({
        model: await aiConfigService.getModelForAgent("workflow"),
        schema: z.object({
          workflowName: z.string(),
          steps: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              action: z.string(),
              parameters: z.record(z.any()),
            })
          ),
          triggers: z.array(z.string()),
          estimatedSavings: z.string(),
        }),
        prompt: `Create an automation workflow for:
${JSON.stringify(input, null, 2)}

Return:
- Clear workflow name
- Steps (id, name, action, parameters)
- Trigger conditions
- Estimated time/cost savings`,
      } as any),
      timeoutMs
    );
    return object;
  }

  /** ========== Public status & queries ========== */

  getSystemStatus() {
    const agents = Array.from(this.agents.values());
    const tasks = Array.from(this.tasks.values());

    return {
      agents: {
        total: agents.length,
        active: agents.filter((a) => a.status === "busy").length,
        idle: agents.filter((a) => a.status === "idle").length,
        error: agents.filter((a) => a.status === "error").length,
      },
      tasks: {
        total: tasks.length,
        running: tasks.filter((t) => t.status === "running").length,
        completed: tasks.filter((t) => t.status === "completed").length,
        failed: tasks.filter((t) => t.status === "failed").length,
        pending: tasks.filter((t) => t.status === "pending").length,
      },
      performance: {
        totalTasksCompleted: agents.reduce((sum, a) => sum + a.tasksCompleted, 0),
        averageTaskTime: this.calculateAverageTaskTime(),
        successRate: this.calculateSuccessRate(),
      },
    };
  }

  private calculateAverageTaskTime(): number {
    const completed = Array.from(this.tasks.values()).filter((t) => t.status === "completed" && t.startedAt && t.completedAt);
    if (!completed.length) return 0;
    const total = completed.reduce((sum, t) => sum + (t.completedAt!.getTime() - t.startedAt!.getTime()), 0);
    return total / completed.length / 1000; // seconds
  }

  private calculateSuccessRate(): number {
    const finished = Array.from(this.tasks.values()).filter((t) => t.status === "completed" || t.status === "failed");
    if (!finished.length) return 100;
    const ok = finished.filter((t) => t.status === "completed").length;
    return (ok / finished.length) * 100;
  }

  /** ========== Added “missing” functions (useful IRL) ========== */

  /** Find agent by type; throw if absent */
  private findAgentByTypeOrThrow(type: string): RealAgent {
    const agent = Array.from(this.agents.values()).find((a) => a.type === type);
    if (!agent) throw new Error(`Agent type ${type} not available`);
    return agent;
  }

  /** Mark agent busy/idle/error */
  private setAgentBusy(agent: RealAgent, task: string) {
    agent.status = "busy";
    agent.currentTask = task;
  }
  private setAgentIdle(agent: RealAgent, incrementCompleted = false) {
    agent.status = "idle";
    agent.currentTask = undefined;
    if (incrementCompleted) agent.tasksCompleted++;
  }
  private setAgentError(agent: RealAgent) {
    agent.status = "error";
    agent.currentTask = undefined;
  }

  /** Public getters */
  getAgents(): RealAgent[] {
    return Array.from(this.agents.values());
  }
  getTasks(): AgentTask[] {
    return Array.from(this.tasks.values());
  }
  getBusinessProfiles(): RealBusinessProfile[] {
    return Array.from(this.businessProfiles.values());
  }

  /** NEW: fetch single items */
  getTaskById(id: string): AgentTask | null {
    return this.tasks.get(id) ?? null;
  }
  getAgentById(id: string): RealAgent | null {
    return this.agents.get(id) ?? null;
  }
  getBusinessProfileById(id: string): RealBusinessProfile | null {
    return this.businessProfiles.get(id) ?? null;
  }

  /** NEW: await a task to finish (with timeout) */
  async waitForTask(taskId: string, timeoutMs = 60_000): Promise<AgentTask> {
    const start = Date.now();
    // Poll in-memory + persisted (if TaskStore provided)
    while (Date.now() - start < timeoutMs) {
      const mem = this.tasks.get(taskId);
      if (mem && (mem.status === "completed" || mem.status === "failed")) return mem;
      if (this.taskStore) {
        const persisted = await this.taskStore.get(taskId);
        if (persisted && (persisted.status === "completed" || persisted.status === "failed")) return persisted;
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    const last = this.tasks.get(taskId) ?? (await this.taskStore?.get(taskId)) ?? null;
    if (last) return last;
    throw new Error(`waitForTask: timeout waiting for ${taskId}`);
  }

  /** NEW: orchestration helpers */
  getSystemStats() {
    return this.getSystemStatus();
  }
  getActiveOrchestrations() {
    return this.getTasks().filter((t) => t.status === "running" || t.status === "pending");
  }
  async conductBusinessIntelligence(responses: Record<string, string>) {
    return this.conductRealBusinessInterview(responses);
  }

  /** Starts a small, real orchestration of 3 tasks and returns their handles immediately */
  async startOrchestration(type: string) {
    const plan: Array<{ title: string; description: string; type: RealTaskType; input: unknown; agentType: string }> = [
      { title: "Business Intelligence Analysis", description: "Analyze requirements and generate insights", type: "ai_analysis", input: { phase: "intelligence", type }, agentType: "analyzer" },
      { title: "Task Planning", description: "Build automation workflow", type: "automation", input: { phase: "planning", type }, agentType: "workflow" },
      { title: "Agent Coordination", description: "Coordinate agents for execution", type: "integration", input: { phase: "coordination", type }, agentType: "integration" },
    ];

    const tasks: AgentTask[] = [];  
    for (const t of plan) tasks.push(await this.createAndExecuteTask(t));

    return { id: generatePrefixedUUID("orchestration"), type, status: "running", tasks, startedAt: new Date() };
  }

  /** ---------- Orchestration Methods (NEW) ---------- */

  // Create orchestration goal
  async createOrchestrationGoal(input: { title: string; description: string; context?: any }) {
    return await this.orchestrationService.createGoal(input);
  }

  // Generate execution plan for goal
  async generateExecutionPlan(goalId: string) {
    return await this.orchestrationService.generatePlan(goalId);
  }

  // Execute next step in orchestration
  async executeOrchestrationStep(goalId: string) {
    return await this.orchestrationService.executeNextStep(goalId);
  }

  // Get orchestration goal
  getOrchestrationGoal(goalId: string) {
    return this.orchestrationService.getGoal(goalId);
  }

  // List all orchestration goals
  listOrchestrationGoals() {
    return this.orchestrationService.listGoals();
  }

  // Add suggestion to orchestration
  addOrchestrationSuggestion(goalId: string, suggestion: {
    fromAgent: string;
    toAgent?: string;
    text: string;
    action?: {
      agent: string;
      tool?: string;
      input: any;
      successCriteria: string;
    };
    confidence: number;
  }) {
    return this.orchestrationService.addSuggestion(goalId, suggestion);
  }

  // Run complete orchestration workflow
  async runOrchestrationWorkflow(goalId: string, maxSteps = 10) {
    const goal = await this.orchestrationService.getGoal(goalId);
    if (!goal) throw new Error("Goal not found");

    // Generate plan if not exists
    if ((await goal)?.steps?.length === 0) {
      await this.generateExecutionPlan(goalId);
    }

    const results: any[] = [];
    let stepCount = 0;

    while (stepCount < maxSteps) {
      const result = await this.executeOrchestrationStep(goalId);
      results.push(result);

      if (result.status === "completed" || result.status === "blocked") {
        break;
      }

      if (result.status === "idle") {
        // No more steps to execute
        break;
      }

      stepCount++;
    }

    return {
      goalId,
      stepsExecuted: stepCount,
      results,
      finalStatus: results[results.length - 1]?.status || "unknown",
    };
  }
}
