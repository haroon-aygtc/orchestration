import { z } from "zod";
import { SolutionAnalyzer } from "./solution/solution-analyzer";
import { CodeGenerator } from "./solution/code-generator";
import { WorkflowBuilder } from "./solution/workflow-builder";
import type { SolutionBlueprint } from "./solution/types";
import { createRealTools, getToolCategories, getToolMetrics, getToolCapabilities } from "./tools/registry";
import { generatePrefixedUUID } from "./utils/uuid";
import { TOOL_DEPS, COST_MODEL, splitDeps } from "./config/solution-design.config";
import { AgentTask, AgentTaskStore } from "./agents/shared/types";
import { TaskStatus } from "./agents/shared/task-types";


/* ----------------------------- Config (centralized) ----------------------------- */

/* --------------------------------- Types ---------------------------------- */

export interface BusinessContext {
  industry: string;
  companySize: string;
  revenue: string;
  goals: string[];
  challenges: string[];
  currentSystems: string[];
  timeline: string;
  budget: string;
  analysisResult?: unknown;
}

export interface EnhancedAgentSpec {
  name: string;
  purpose: string;
  code: string;
  actions: string[];
  dependencies: string[];
  tools: string[];
  agentType: "intent" | "retriever" | "tool" | "workflow" | "memory" | "follow" | "formatter" | "guardrail" | "llm";
}

export interface WorkflowStep {
  id: string;
  name: string;
  agentType: string;
  action: string;
  inputs: Record<string, unknown>;
  outputs: string[];
  dependencies: string[];
  tools: string[];
}

export interface MultiAgentWorkflow {
  name: string;
  description: string;
  definition: string;
  steps: WorkflowStep[];
  agents: string[];
  triggers: string[];
}

export interface AutomationSolution {
  agents: EnhancedAgentSpec[];
  workflows: MultiAgentWorkflow[];
  tools: string[];
  infrastructure: {
    database: boolean;
    redis: boolean;
    webhooks: boolean;
    scheduling: boolean;
  };
  businessContext?: BusinessContext;
  description: string;
  entryPoint: string;
  // expose deps split for package managers
  dependencies?: string[];
  devDependencies?: string[];
  uiComponents?: unknown;
}

// Enhanced Input/Output types
export const SolutionDesignInputSchema = z.object({
  userRequest: z.string().min(1),
  businessContext: z.any().optional(),
  outputPath: z.string().optional(),
  includeUI: z.boolean().optional(),
  includeMonitoring: z.boolean().optional(),
  useAllAgents: z.boolean().optional()
});
export type SolutionDesignInput = z.infer<typeof SolutionDesignInputSchema>;

export type SolutionDesignOutput = {
  solution: AutomationSolution;
  solutionId: string;
  estimatedComplexity: "simple" | "medium" | "complex" | "enterprise";
  requiredDependencies: string[];
  deploymentOptions: string[];
  costEstimate: {
    development: string;
    infrastructure: string;
    maintenance: string;
  };
};


 
/* --------------------------- SolutionDesignAgent --------------------------- */

export class SolutionDesignAgent {
  private tasksCompleted = 0;
  private status: "idle" | "busy" | "error" = "idle" as "idle" | "busy" | "error";

  constructor(private taskStore?: AgentTaskStore) {}

  async designSolution(input: SolutionDesignInput): Promise<AgentTask<SolutionDesignInput, SolutionDesignOutput>> {
    // Validate input early
    const parsed = SolutionDesignInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(`invalid_input: ${parsed.error.issues.map(i => i.message).join(", ")}`);
    }

    const task: AgentTask<SolutionDesignInput, SolutionDesignOutput> = {
      id: generatePrefixedUUID("solution-design"),
      type: "solution_design",
      input: parsed.data,
      status: TaskStatus.Running,
      startedAt: new Date(),
    };

    this.status = "busy" as "idle" | "busy" | "error";
    await this.taskStore?.create(task);

    try {
      // 1) Build solution (agents + workflows + entrypoint) from analyzer/codegen
      const { solution, blueprint } = await this.createSolution(parsed.data);

      // 2) Complexity assessment
      const analyzer = new SolutionAnalyzer();
      const complexity = analyzer.assessComplexity(blueprint);

      // 3) Dependencies (prod/dev) based on actual tools in registry
      const { dependencies, devDependencies } = await this.resolveDependencies(solution.tools);

      // 4) Deployment options from infrastructure
      const deploymentOptions = this.deriveDeploymentOptions(solution.infrastructure);

      // 5) Cost via config model
      const costEstimate = this.estimateCost(complexity, solution.tools, solution.infrastructure);

      // 6) Finalize
      const solutionId = generatePrefixedUUID("solution-design");
      solution.dependencies = dependencies;
      solution.devDependencies = devDependencies;

      task.output = {
        solution,
        solutionId,
        estimatedComplexity: complexity,
        requiredDependencies: [...dependencies, ...devDependencies],
        deploymentOptions,
        costEstimate
      };

      task.status = TaskStatus.Completed;
      task.completedAt = new Date();
      this.tasksCompleted++;
      this.status = "idle" as "idle" | "busy" | "error";

      await this.taskStore?.update(task.id, task);
      return task;

    } catch (error: any) {
      task.error = error?.message || "Solution design failed";
      task.status = TaskStatus.Failed;
      task.completedAt = new Date();
      this.status = "error";
      await this.taskStore?.update(task.id, task);
      return task;
    }
  }

  /* ----------------------- Core builder: dynamic solution ----------------------- */
  private async createSolution(input: SolutionDesignInput): Promise<{ solution: AutomationSolution; blueprint: SolutionBlueprint }> {
    const analyzer = new SolutionAnalyzer();
    const codeGenerator = new CodeGenerator();
    const workflowBuilder = new WorkflowBuilder();

    // Analyze → blueprint
    const blueprint = await analyzer.analyzeSolution(input.userRequest);

    // Agents with generated code
    const agents: EnhancedAgentSpec[] = blueprint.agents.map(agentSpec => ({
      name: agentSpec.name,
      purpose: agentSpec.purpose,
      code: codeGenerator.generateAgentCode(agentSpec),
      actions: agentSpec.actions,
      dependencies: agentSpec.dependencies || [],
      tools: agentSpec.tools,
      agentType: agentSpec.agentType
    }));

    // Workflows (respect IO if present in blueprint)
    const workflows: MultiAgentWorkflow[] = blueprint.workflows.map(workflowSpec => ({
      name: workflowSpec.name,
      description: workflowSpec.description,
      definition: workflowBuilder.generateYAMLDefinition(workflowSpec),
      steps: workflowSpec.steps.map(step => ({
        id: step.id,
        name: step.name,
        agentType: step.agentType,
        action: step.action,
        inputs: (step as any).inputs ?? {},
        outputs: (step as any).outputs ?? ["result"],
        dependencies: step.dependencies,
        tools: step.tools
      })),
      agents: blueprint.agents.map(a => a.name),
      triggers: workflowSpec.triggers
    }));

    // Dynamic infra derived from tools + triggers (no hardcoding)
    const infra = this.deriveInfrastructure(
      blueprint.tools,
      workflows.map(w => w.triggers),
      input
    );

    // Entry point
    const entryPoint = workflowBuilder.generateExecutionPlan(blueprint);

    return {
      solution: {
        agents,
        workflows,
        tools: blueprint.tools,
        infrastructure: infra,
        businessContext: input.businessContext,
        description: input.userRequest,
        entryPoint
      },
      blueprint
    };
  }

  /* ------------------- Infra, deps, deployment, cost helpers ------------------- */

  // dynamic infra from tools + triggers (+ keep your flags)
  private deriveInfrastructure(
    tools: string[],
    triggers: string[][],
    _input: SolutionDesignInput
  ): AutomationSolution["infrastructure"] {
    const flatTriggers = triggers.flat();
    return {
      database: tools.some(t => t.startsWith("db_")),
      redis: tools.some(t => t.includes("redis") || t.includes("queue") || t.includes("cache")),
      webhooks: tools.includes("webhook_trigger") || flatTriggers.some(t => /webhook/i.test(t)),
      scheduling: flatTriggers.some(t => /cron|schedule|timer/i.test(t)) || true // default scheduler available
    };
  }

  private async resolveDependencies(tools: string[]) {
    const registry = await createRealTools(); // confirms tool keys exist
    const deps = new Set<string>(["yaml","zod"]); // useful runtime deps

    for (const t of tools) {
      if (registry[t as keyof typeof registry]) {
        for (const d of (TOOL_DEPS[t] || [])) deps.add(d);
      }
    }

    // Prefer Node >= 18 global fetch
    deps.delete("axios");
    deps.delete("node-fetch");

    return splitDeps(Array.from(deps));
  }

  private deriveDeploymentOptions(infra: AutomationSolution["infrastructure"]): string[] {
    const out = new Set<string>(["standalone"]);
    if (infra.database || infra.redis) { out.add("docker"); out.add("kubernetes"); }
    if (infra.webhooks) { out.add("aws-lambda"); out.add("vercel"); out.add("netlify"); }
    if (infra.scheduling) { out.add("cron-job"); out.add("aws-eventbridge"); out.add("azure-logic-apps"); }
    return Array.from(out).sort();
  }

  private estimateCost(
    complexity: "simple" | "medium" | "complex" | "enterprise",
    tools: string[],
    infra: AutomationSolution["infrastructure"]
  ): { development: string; infrastructure: string; maintenance: string } {

    const base = COST_MODEL[complexity] ?? COST_MODEL.simple;

    let infraMult = 1;
    if (infra.database)    infraMult += 0.8;
    if (infra.redis)       infraMult += 0.4;
    if (infra.webhooks)    infraMult += 0.3;
    if (infra.scheduling)  infraMult += 0.2;

    const categories = getToolCategories();
    let toolMult = 1;
    for (const t of tools) {
      const cat = Object.entries(categories).find(([_, list]) => list.includes(t))?.[0];
      switch (cat) {
        case "communication": toolMult += 0.3; break;
        case "data":          toolMult += (t === "pdf_parse" ? 0.4 : t === "csv_parse" ? 0.1 : 0.2); break;
        case "storage":       toolMult += (t.startsWith("db_") ? 0.3 : 0.05); break;
        case "network":       toolMult += 0.1; break;
        case "security":      toolMult += 0.1; break;
        default:              toolMult += 0.1;
      }
    }

    const dev    = Math.round(base.dev   * toolMult);
    const infraC = Math.round(base.infra * infraMult);
    const maint  = Math.round(base.maint * toolMult);

    return {
      development: `$${dev.toLocaleString()}-$${Math.round(dev*1.3).toLocaleString()}`,
      infrastructure: `$${infraC}-$${Math.round(infraC*1.5)}/month`,
      maintenance: `$${maint.toLocaleString()}-$${Math.round(maint*1.2).toLocaleString()}/month`
    };
  }

  getStatus() {
    return {
      type: "solution-design",
      name: "Solution Design Agent",
      status: this.status,
      tasksCompleted: this.tasksCompleted,
      capabilities: [
        "solution_analysis",
        "blueprint_generation",
        "agent_code_generation",
        "workflow_creation"
      ]
    };
  }
}
