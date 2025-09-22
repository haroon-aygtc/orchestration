// lib/solution/code-generator.ts
import YAML, { Scalar } from "yaml";
import { z } from "zod";
import { AgentSpec, WorkflowStep } from "./types";
import { logger } from "../utils/structured-logger";

/**
 * CODEGEN STRATEGY
 * - No per-tool static imports.
 * - Generated agents import a single runtime helper: getTool(name) from ../tools/runtime
 * - Tools are resolved dynamically and executed via a common { execute() } interface.
 * - If a tool is not present at runtime, the agent throws a clear error.
 */
export class CodeGenerator {
  generateAgentCode(spec: AgentSpec): string {
    const actions = this.generateActionMethods(spec);

    return `// AUTO-GENERATED: ${spec.name}
import { getTool, requireTool, executeTool } from '../tools/runtime';

export class ${sanitizeIdent(spec.name)} {
  public readonly name = ${JSON.stringify(spec.name)};
  public readonly purpose = ${JSON.stringify(spec.purpose)};
  public readonly agentType = ${JSON.stringify(spec.agentType)};

  async execute(action: string, input: any): Promise<any> {
    switch (action) {
${spec.actions.map(a => `      case ${JSON.stringify(a)}: return await this.${sanitizeIdent(a)}(input);`).join("\n")}
      default:
        throw new Error(\`[${spec.name}] Unknown action: \${action}\`);
    }
  }

${actions}
}
`;
  }

  private generateActionMethods(spec: AgentSpec): string {
    return spec.actions.map(action => {
      const impl = this.generateActionImplementation(spec.agentType, action);
      return `
  async ${sanitizeIdent(action)}(input: any): Promise<any> {
    try {
${impl}
    } catch (error) {
      logger.error(\`[${spec.name}] ${action} failed:\`, { error: error.message, stack: error.stack }, error);
      throw error;
    }
  }`;
    }).join("\n");
  }

  /**
   * Generate real AI-powered implementations for all agent types.
   * Each agent uses actual AI models via the AI configuration service.
   */
  private generateActionImplementation(agentType: string, action: string): string {
    if (agentType === "tool" && action === "executeTool") {
      // Dynamic tool execution; chooses the tool at runtime
      return `      const toolName: string = input.toolName;
      const params = input.parameters ?? input ?? {};
      const tool = await requireTool(toolName); // throws if missing
      const data = await executeTool(tool, params);
      return { success: true, action: ${JSON.stringify(action)}, agentType: ${JSON.stringify(agentType)}, data, timestamp: new Date().toISOString() };`;
    }

    // Real AI-powered implementations for each agent type
    const aiImplementations: Record<string, string> = {
      "intent:analyzeIntent": `
      // Real AI-powered intent analysis
      const { generateObject } = await import("ai");
      const { aiConfigService } = await import("../../ai-config-service");
      const { z } = await import("zod");
      
      const text = String(input?.text ?? "");
      const context = String(input?.context ?? "");
      
      const { object: analysis } = await generateObject({
        model: await aiConfigService.getModelForAgent("intent"),
        schema: z.object({
          intent: z.string(),
          confidence: z.number().min(0).max(1),
          entities: z.array(z.object({ type: z.string(), value: z.string(), confidence: z.number() })),
          actionRequired: z.boolean(),
          suggestedResponse: z.string()
        }),
        prompt: \`Analyze the user's intent from this text: "\${text}"\nContext: \${context}\nExtract intent, confidence, entities, and suggest next steps.\`
      });
      
      const data = {
        intent: analysis.intent,
        confidence: analysis.confidence,
        entities: analysis.entities,
        actionRequired: analysis.actionRequired,
        suggestedResponse: analysis.suggestedResponse
      };
      return { success: true, action: ${JSON.stringify(action)}, agentType: ${JSON.stringify(agentType)}, data, timestamp: new Date().toISOString() };`,

      "retriever:searchData": `
      // Real AI-powered information retrieval
      const { generateObject } = await import("ai");
      const { aiConfigService } = await import("../../ai-config-service");
      const { z } = await import("zod");
      
      const query = String(input?.query ?? input?.text ?? "");
      const sources = Array.isArray(input?.sources) ? input.sources : [];
      
      // Real production data retrieval
      const { createPostgresRetriever } = await import("../../retriever/postgres-retriever");
      const retriever = createPostgresRetriever();
      const realResults = await retriever.search(query, sources, { limit: 10 });
      
      const { object: summary } = await generateObject({
        model: await aiConfigService.getModelForAgent("retriever"),
        schema: z.object({
          summary: z.string(),
          recommendations: z.array(z.string()),
          confidence: z.number().min(0).max(1)
        }),
        prompt: \`Summarize these search results for query "\${query}": \${JSON.stringify(realResults)}\`
      });
      
      const data = {
        query,
        results: realResults,
        sources,
        summary: summary.summary,
        recommendations: summary.recommendations,
        confidence: summary.confidence,
        found: realResults.length > 0
      };
      return { success: true, action: ${JSON.stringify(action)}, agentType: ${JSON.stringify(agentType)}, data, timestamp: new Date().toISOString() };`,

      "workflow:orchestrateSteps": `
      // Real AI-powered workflow orchestration
      const { generateObject } = await import("ai");
      const { aiConfigService } = await import("../../ai-config-service");
      const { z } = await import("zod");
      
      const steps = Array.isArray(input?.steps) ? input.steps : [];
      const goals = Array.isArray(input?.goals) ? input.goals : [];
      
      const { object: workflow } = await generateObject({
        model: await aiConfigService.getModelForAgent("workflow"),
        schema: z.object({
          workflowId: z.string(),
          name: z.string(),
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
        prompt: \`Design a workflow for these steps: \${JSON.stringify(steps)}\nGoals: \${goals.join(", ")}\nCreate a detailed execution plan.\`
      });
      
      const data = {
        workflowId: workflow.workflowId,
        name: workflow.name,
        stepsPlanned: workflow.steps.length,
        estimatedDuration: workflow.estimatedDuration,
        successCriteria: workflow.successCriteria,
        rollbackPlan: workflow.rollbackPlan,
        status: 'planned'
      };
      return { success: true, action: ${JSON.stringify(action)}, agentType: ${JSON.stringify(agentType)}, data, timestamp: new Date().toISOString() };`,

      "formatter:formatData": `
      // Real AI-powered data formatting
      const { generateObject } = await import("ai");
      const { aiConfigService } = await import("../../ai-config-service");
      const { z } = await import("zod");
      
      const format = String(input?.format ?? 'json');
      const data = input?.data ?? null;
      const template = input?.template;
      const audience = input?.audience;
      
      const { object: formatted } = await generateObject({
        model: await aiConfigService.getModelForAgent("formatter"),
        schema: z.object({
          formattedData: z.any(),
          format: z.string(),
          metadata: z.object({
            originalSize: z.number(),
            formattedSize: z.number(),
            compressionRatio: z.number(),
            processingTime: z.number()
          }),
          validationResults: z.object({
            isValid: z.boolean(),
            errors: z.array(z.string()),
            warnings: z.array(z.string())
          }),
          alternativeFormats: z.array(z.string())
        }),
        prompt: \`Format this data as \${format}:\n\${JSON.stringify(data)}\nTemplate: \${template || 'none'}\nAudience: \${audience || 'general'}\`
      });
      
      return { success: true, action: ${JSON.stringify(action)}, agentType: ${JSON.stringify(agentType)}, data: formatted, timestamp: new Date().toISOString() };`,

      "guardrail:validateSafety": `
      // Real AI-powered safety validation
      const { generateObject } = await import("ai");
      const { aiConfigService } = await import("../../ai-config-service");
      const { z } = await import("zod");
      
      const content = input?.content ?? "";
      const rules = Array.isArray(input?.rules) ? input.rules : ["data_privacy", "no_secrets", "safe_operations"];
      const context = input?.context;
      
      const { object: validation } = await generateObject({
        model: await aiConfigService.getModelForAgent("guardrail"),
        schema: z.object({
          isCompliant: z.boolean(),
          riskLevel: z.enum(["low", "medium", "high", "critical"]),
          violations: z.array(z.object({
            rule: z.string(),
            severity: z.enum(["warning", "error", "critical"]),
            description: z.string(),
            suggestion: z.string()
          })),
          approvedContent: z.any().nullable(),
          blockedElements: z.array(z.string()),
          complianceScore: z.number().min(0).max(1),
          recommendations: z.array(z.string())
        }),
        prompt: \`Validate this content for safety:\n\${JSON.stringify(content)}\nRules: \${rules.join(", ")}\nContext: \${context || 'general'}\`
      });
      
      const data = {
        safe: validation.isCompliant,
        violations: validation.violations,
        confidence: validation.complianceScore,
        riskLevel: validation.riskLevel,
        recommendations: validation.recommendations,
        contentLength: String(content).length
      };
      return { success: true, action: ${JSON.stringify(action)}, agentType: ${JSON.stringify(agentType)}, data, timestamp: new Date().toISOString() };`
    };

    const key = `${agentType}:${action}`;
    if (aiImplementations[key]) return aiImplementations[key];

    // Default AI-powered fallback
    return `      // AI-powered generic action execution
      const { generateObject } = await import("ai");
      const { aiConfigService } = await import("../../ai-config-service");
      const { z } = await import("zod");
      
      const { object: result } = await generateObject({
        model: await aiConfigService.getModelForAgent("llm"),
        schema: z.object({
          action: z.string(),
          completed: z.boolean(),
          message: z.string(),
          data: z.any()
        }),
        prompt: \`Execute action \${${JSON.stringify(action)}} with input: \${JSON.stringify(input)}\`
      });
      
      return { success: true, action: ${JSON.stringify(action)}, agentType: ${JSON.stringify(agentType)}, data: result, timestamp: new Date().toISOString() };`;
  }

  /**
   * YAML generator with a proper library, validation, and safe formatting.
   */
  generateWorkflowConfig(workflow: any): string {
    // 1) Validate + normalize (Zod)
    const parsed = WorkflowDocSchema.parse(workflow);

    // 2) Build a clean object (drop undefineds)
    const doc = pruneUndefined({
      name: parsed.name,
      description: blockIfLong(parsed.description),
      version: parsed.version ?? "1.0.0",
      steps: parsed.steps.map(s => ({
        id: s.id,
        name: s.name,
        agent: s.agentType,
        action: s.action,
        tools: s.tools,
        dependencies: s.dependencies,
        timeout: s.timeout ?? 30000,
        input: s.input, // allow nested objects/arrays, keep type fidelity
      })),
      triggers: parsed.triggers.map(t => ({
        type: t.type,
        enabled: t.enabled ?? true,
        ...(t.cron ? { cron: t.cron } : {}),
      })),
      error_handling: {
        retry_attempts: parsed.error_handling?.retry_attempts ?? 3,
        retry_delay: parsed.error_handling?.retry_delay ?? 1000,
        on_failure: parsed.error_handling?.on_failure ?? "log_and_continue",
      },
    });

    // 3) Emit YAML (proper quoting, multiline via block literal, stable formatting)
    return YAML.stringify(doc, {
      indent: 2,
      lineWidth: 120,
      simpleKeys: true,
    });
  }
}

/** Keep identifiers TS-safe */
function sanitizeIdent(name: string) {
  const safe = name.replace(/[^\w]/g, "_");
  if (/^\d/.test(safe)) return "_" + safe;
  return safe;
}

// ------------------------------
// YAML helpers + schemas
// ------------------------------
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

function blockIfLong(s?: string, threshold = 140) {
  if (typeof s !== "string") return s as any;
  if (s.includes("\n") || s.length > threshold) {
    const sc = new Scalar(s);
    // @ts-ignore - yaml v2 allows assigning block literal style on Scalar
    sc.type = "BLOCK_LITERAL";
    return sc;
  }
  return s;
}

// Zod schemas align with WorkflowStep shape but add strong defaults + types
const TriggerSchema = z.object({
  type: z.string(),
  enabled: z.boolean().optional().default(true),
  cron: z.string().optional(), // optional cron for schedulers
});

const StepSchema = z.object({
  id: z.string(),
  name: z.string(),
  agentType: z.string(),
  action: z.string(),
  tools: z.array(z.string()).optional().default([]),
  dependencies: z.array(z.string()).optional().default([]),
  timeout: z.number().int().positive().optional().default(30000),
  input: z.record(z.any()).optional().default({}),
});

const WorkflowDocSchema = z.object({
  name: z.string(),
  description: z.string().optional().default(""),
  version: z.string().optional().default("1.0.0"),
  steps: z.array(StepSchema).nonempty("steps must not be empty"),
  triggers: z.array(TriggerSchema).optional().default([]),
  error_handling: z.object({
    retry_attempts: z.number().int().nonnegative().optional(),
    retry_delay: z.number().int().nonnegative().optional(),
    on_failure: z.enum(["log_and_continue", "stop", "retry"]).optional(),
  }).optional(),
});
