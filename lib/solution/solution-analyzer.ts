import { getToolCategories } from "../tools/registry";
import { SolutionBlueprint } from "./types";
import { aiConfigService } from "../ai-config-service";
import { generateObject } from "ai";
import { SolutionBlueprintSchema } from "./types";
import { ValidationError, AppError } from "../utils/error-handler";
import { mapAiToAppError, classifyAiError, extractRetryAfterMs, backoff } from "../utils/ai-errors";
import { logger } from "../utils/structured-logger";

export class SolutionAnalyzer {
  private getAvailableTools(): string[] {
    const categories = getToolCategories();
    // flatten unique tool names from registry (snake_case)
    return Array.from(new Set(Object.values(categories).flat() as string[]));
  }

  async analyzeSolution(userRequest: string): Promise<SolutionBlueprint> {
  
    // Input guards → AppError family
    if (typeof userRequest !== "string" || userRequest.trim().length === 0) {
      throw new ValidationError("analyzeSolution: 'userRequest' must be a non-empty string");
    }
  
    const availableTools: string[] = this.getAvailableTools?.() ?? [];
    if (!Array.isArray(availableTools)) {
      throw new AppError("getAvailableTools() must return string[]", "CONFIGURATION_ERROR", 500, true);
    }
    if (availableTools.length === 0) {
      throw new AppError("No tools available for analysis", "FAILED_PRECONDITION", 412, true);
    }
  
    const prompt =
  `Analyze this automation request and create a solution blueprint.
  
  You MUST only use tools from this approved list:
  ${availableTools.join(", ")}
  
  Request:
  ${userRequest}`;
  
    // Retry policy
    const MAX_ATTEMPTS = 3;       // 1 + 2 retries
    const PER_ATTEMPT_TIMEOUT = 45_000;
  
    let lastErr: any;
    let retryAfterMs: number | null = null;
  
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (attempt > 1) {
        const wait = retryAfterMs ?? backoff(attempt);
        await new Promise(r => setTimeout(r, wait));
        retryAfterMs = null;
      }
  
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PER_ATTEMPT_TIMEOUT);
  
      try {
        const model = await aiConfigService.getModelForAgent("llm");
  
        const { object } = await Promise.race([
          generateObject({ model, schema: SolutionBlueprintSchema, prompt }),
          new Promise<never>((_, rej) =>
            setTimeout(() => rej(Object.assign(new Error("LLM timeout"), { code: "TIMEOUT" })), PER_ATTEMPT_TIMEOUT)
          ),
        ]);
  
        clearTimeout(timer);
  
        // Defensive re-validate
        const parsed = SolutionBlueprintSchema.safeParse(object);
        if (!parsed.success) {
          const err = new Error("Blueprint schema validation failed");
          (err as any).code = "BAD_BLUEPRINT";
          (err as any).issues = parsed.error.issues;
          throw err;
        }
  
        // Sanitize tools
        const allow = new Set(availableTools);
        const bp = parsed.data;
  
        bp.tools = Array.isArray(bp.tools) ? bp.tools.filter(t => allow.has(t)) : [];
        bp.agents = Array.isArray(bp.agents)
          ? bp.agents.map(a => ({ ...a, tools: Array.isArray(a.tools) ? a.tools.filter(t => allow.has(t)) : [] }))
          : [];
  
        // Warn if stripped
        const stripped: string[] = [];
        for (const t of object?.tools ?? []) if (!allow.has(t)) stripped.push(String(t));
        for (const a of object?.agents ?? []) {
          for (const t of a?.tools ?? []) if (!allow.has(t)) stripped.push(String(t));
        }
        if (stripped.length) logger.warn('analyzeSolution: removed disallowed tools', { stripped });
  
        return bp;
      } catch (err: any) {
        clearTimeout(timer);
  
        // Classify to decide retry
        const c = classifyAiError(err);
        retryAfterMs = extractRetryAfterMs(err);
  
        logger.warn("analyzeSolution failure", { attempt, code: c.code, status: c.status, msg: String(err?.message || err), retryAfterMs });
  
        const retriable = c.retriable && attempt < MAX_ATTEMPTS;
        if (!retriable) {
          // Final mapping to AppError
          throw mapAiToAppError(err);
        }
        lastErr = err;
        continue;
      }
    }
  
    // Shouldn't get here; in case, convert last error
    throw mapAiToAppError(lastErr ?? new Error("Unknown AI error"));
  }

  assessComplexity(blueprint: SolutionBlueprint): 'simple' | 'medium' | 'complex' {
    // (keep your logic)
    const agentCount = blueprint.agents.length;
    const totalSteps = blueprint.workflows.reduce((sum, w) => sum + w.steps.length, 0);
    const uniqueAgentTypes = new Set(blueprint.agents.map(a => a.agentType)).size;
    if (agentCount <= 2 && totalSteps <= 5 && uniqueAgentTypes <= 2) return 'simple';
    if (agentCount <= 4 && totalSteps <= 10 && uniqueAgentTypes <= 4) return 'medium';
    return 'complex';
  }
}
