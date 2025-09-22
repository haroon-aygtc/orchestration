// lib/solution/workflow-builder.ts
import YAML, { Scalar } from "yaml";
import { z } from "zod";
import { SolutionBlueprint } from "./types";
import { logger } from "../utils/structured-logger";

// --- Schemas ---
const WorkflowStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  agentType: z.string(),
  action: z.string(),
  inputs: z.record(z.any()).optional().default({}),
  outputs: z.array(z.string()).optional().default([]),
  dependencies: z.array(z.string()).optional().default([]),
  tools: z.array(z.string()).optional().default([]),
});

const WorkflowSchema = z.object({
  name: z.string(),
  description: z.string().optional().default(""),
  triggers: z.array(z.string()).optional().default([]),
  steps: z.array(WorkflowStepSchema).nonempty("workflow.steps must not be empty"),
  error_handling: z
    .object({
      on_failure: z.enum(["log_and_continue", "stop", "retry"]).optional(),
      retry_attempts: z.number().int().nonnegative().optional(),
      retry_delay: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

// --- Utils ---
function pruneUndefined<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(pruneUndefined) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    out[k] = pruneUndefined(v as any);
  }
  return out as T;
}

function blockIfLong(s: string, threshold = 140) {
  if (typeof s !== "string") return s;
  if (s.includes("\n") || s.length > threshold) {
    const sc = new Scalar(s);
    // @ts-ignore - force block literal style for long/multiline text (yaml v2)
    sc.type = "BLOCK_LITERAL";
    return sc;
  }
  return s;
}

function toCamelCase(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
    .replace(/^[A-Z]/, (m) => m.toLowerCase())
    .replace(/[^a-zA-Z0-9]/g, "");
}

function safeIdent(name: string): string {
  const camel = toCamelCase(name);
  const reserved = new Set([
    "default","class","function","var","let","const","new","delete","return","if","else","switch","case","for","while","do","break","continue","try","catch","finally","throw","import","export","extends","implements","package","public","private","protected","static","yield","await","enum","interface","type","name"
  ]);
  const id = camel || "agent";
  return reserved.has(id) ? `_${id}` : id;
}

// --- Main ---
export class WorkflowBuilder {
  generateExecutionPlan(blueprint: SolutionBlueprint): string {
    const agentImports = (blueprint.agents || [])
      .map((agent) => `import { ${agent.name} } from './agents/${agent.name}';`)
      .join('\n');

    const agentInstantiations = (blueprint.agents || [])
      .map((agent) => {
        const varName = safeIdent(agent.name);
        return `const ${varName} = new ${agent.name}();`;
      })
      .join('\n    ');

    const agentMapSets = (blueprint.agents || [])
      .map((agent) => {
        const varName = safeIdent(agent.name);
        return `this.agents.set('${agent.name}', ${varName});`;
      })
      .join('\n    ');

    const workflowExecs = (blueprint.workflows || [])
      .map((workflow) => {
        const resVar = `${safeIdent(workflow.name)}Result`;
        return `\n      // Execute ${workflow.name}\n      const ${resVar} = await this.executeWorkflow('${workflow.name}', input);`;
      })
      .join("");

    const workflowResultsEntries = (blueprint.workflows || [])
      .map((w) => {
        const resVar = `${safeIdent(w.name)}Result`;
        return `'${w.name}': ${resVar}`; // QUOTED KEY
      })
      .join(',\n          ');

    const resultsBlock = (blueprint.workflows?.length ?? 0) > 0
      ? `{
          ${workflowResultsEntries}
        }`
      : `{}`;

    const workflowsJson = JSON.stringify(blueprint.workflows || [], null, 2);

    return `import { WorkflowEngine } from './core/WorkflowEngine';
${agentImports}

class SolutionExecutor {
  private agents: Map<string, any> = new Map();
  private engine: WorkflowEngine;

  constructor() {
    this.engine = new WorkflowEngine();
    this.initializeAgents();
  }

  private initializeAgents() {
    ${agentInstantiations}
    
    ${agentMapSets}
  }

  async executeSolution(input: any): Promise<any> {
    logger.info('Starting solution execution...');
    
    try {
      ${workflowExecs}
      
      return {
        success: true,
        results: ${resultsBlock}
      };
    } catch (error) {
      logger.error('Solution execution failed:', { error: error.message }, error);
      throw error;
    }
  }

  private async executeWorkflow(workflowName: string, input: any): Promise<any> {
    logger.info(\`Executing workflow: \${workflowName}\`);
    
    const workflow = this.getWorkflow(workflowName);
    if (!workflow) {
      throw new Error(\`Workflow not found: \${workflowName}\`);
    }

    const results: any[] = [];
    
    for (const step of workflow.steps) {
      const agent = this.agents.get(step.agentType);
      if (!agent) {
        throw new Error(\`Agent not found: \${step.agentType}\`);
      }
      
      const stepResult = await agent.execute(step.action, input);
      results.push(stepResult);
      
      input = { ...input, previousResult: stepResult };
    }
    
    return results;
  }

  private getWorkflow(name: string) {
    const workflows = ${workflowsJson} as any[];
    return workflows.find(w => w.name === name);
  }
}

export { SolutionExecutor };`;
  }

  generateYAMLDefinition(workflow: any): string {
    const parsed = WorkflowSchema.parse(workflow);

    const doc = pruneUndefined({
      name: parsed.name,
      description: blockIfLong(parsed.description),
      triggers: parsed.triggers,
      steps: parsed.steps.map((step) => ({
        id: step.id,
        name: step.name,
        agent: step.agentType,
        action: step.action,
        input: step.inputs,
        output: step.outputs[0] ?? "result",
        dependencies: step.dependencies,
        tools: step.tools,
      })),
      error_handling: {
        on_failure: parsed.error_handling?.on_failure ?? "log_and_continue",
        retry_attempts: parsed.error_handling?.retry_attempts ?? 3,
        retry_delay: parsed.error_handling?.retry_delay ?? 5000,
      },
    });

    return YAML.stringify(doc, {
      indent: 2,
      lineWidth: 120,
      simpleKeys: true,
    });
  }
}
