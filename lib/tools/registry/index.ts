
// ──────────────────────────────────────────────────────────────────────────────
// File: lib/tools/registry/index.ts
// Purpose: Public entrypoints – createRealTools & high-level metadata access
// ──────────────────────────────────────────────────────────────────────────────
import { logger } from "../../utils/structured-logger";
import { getRuntimeInfo as detectRuntime } from "../../utils/runtime-detection";
import type { ToolRegistry } from "../../agents/shared/types";
import { getServerTools } from "../server/get-server-tools";
import { httpRequestFn } from "../http-request";
import { webhookTriggerFn } from "../webhook-trigger";
import { slackNotifyFn } from "../slack-notify";
import { toolSchemas } from "./schemas";
import { toolMetadata, buildDynamicDescriptions, buildCategories, getToolTagsMap } from "./metadata";
import { createHashSha256Tool } from "../inline/hash-sha256";
import { createJsonValidateTool } from "../inline/json-validate";
import { createFileWriteTool } from "../inline/file-write";
import { createDbCreateTool, createDbDeleteTool, createDbQueryTool, createDbUpdateTool, createDbUpsertTool } from "../inline/db";
import { generateCorrelationId } from "../run-tool";
import { runToolFn } from "../run-tool";
import { validateToolInput } from "./validation";
import { toolCapabilities } from "./capabilities";
import { hasCapability } from "../../utils/runtime-detection";
import { Capability } from "../../utils/runtime-detection";
import { ToolResult } from "../../agents/shared/types";
import { withMetrics } from "./wrappers";
import { withCache } from "./cache";
import { globalCache } from "./cache";
import { _recordCacheHit } from "./metrics";
import { _recordCacheMiss } from "./metrics";
import { withTimeout } from "./wrappers";

export const createRealTools = async (): Promise<ToolRegistry> => {
  const start = Date.now();
  logger.info("Creating enhanced tool registry...");

  const serverTools = await getServerTools();

  const tools: ToolRegistry = {
    // Communication / Network
    email_sender: createEnhancedTool("email_sender", serverTools.emailSenderFn, { cacheable: true, timeout: parseInt(process.env.TOOL_EMAIL_TIMEOUT || "60000"), validateInput: true }),
    slack_notify:  createEnhancedTool("slack_notify", slackNotifyFn,           { cacheable: true, timeout: parseInt(process.env.TOOL_SLACK_TIMEOUT || "30000"), validateInput: true }),
    webhook_trigger: createEnhancedTool("webhook_trigger", webhookTriggerFn,   { cacheable: false, timeout: parseInt(process.env.TOOL_WEBHOOK_TIMEOUT || "45000"), validateInput: true }),
    http_request:  createEnhancedTool("http_request",  httpRequestFn,          { cacheable: true, timeout: parseInt(process.env.TOOL_HTTP_TIMEOUT || "60000"), validateInput: true }),

    // Data Processing (server-only)
    csv_parse: createEnhancedTool("csv_parse", serverTools.csvParseToolFn, { cacheable: true, timeout: parseInt(process.env.TOOL_CSV_TIMEOUT || "120000"), validateInput: true }),
    pdf_parse: createEnhancedTool("pdf_parse", serverTools.pdfParseToolFn, { cacheable: true, timeout: parseInt(process.env.TOOL_PDF_TIMEOUT || "120000"), validateInput: true }),

    // Custom
    data_validator: createEnhancedTool("data_validator", async (params: any) => {
      const { dataValidator } = await import("../data-validator/data-validator");
      return dataValidator(params);
    }, { cacheable: true, timeout: parseInt(process.env.TOOL_VALIDATOR_TIMEOUT || "30000"), validateInput: true }),

    // Inline factories
    hash_sha256:   createEnhancedTool("hash_sha256",   createHashSha256Tool(), { cacheable: true,  timeout: parseInt(process.env.TOOL_HASH_TIMEOUT || "10000"), validateInput: true }),
    json_validate: createEnhancedTool("json_validate", createJsonValidateTool(),{ cacheable: true,  timeout: parseInt(process.env.TOOL_JSON_TIMEOUT || "10000"), validateInput: true }),
    file_write:    createEnhancedTool("file_write",    createFileWriteTool(),   { cacheable: false, timeout: parseInt(process.env.TOOL_FILE_TIMEOUT || "60000"), validateInput: true }),

    db_query:  createEnhancedTool("db_query",  createDbQueryTool(),  { cacheable: true,  timeout: parseInt(process.env.TOOL_DB_QUERY_TIMEOUT || "30000"), validateInput: true }),
    db_upsert: createEnhancedTool("db_upsert", createDbUpsertTool(), { cacheable: false, timeout: parseInt(process.env.TOOL_DB_MUTATION_TIMEOUT || "30000"), validateInput: true }),
    db_create: createEnhancedTool("db_create", createDbCreateTool(), { cacheable: false, timeout: parseInt(process.env.TOOL_DB_MUTATION_TIMEOUT || "30000"), validateInput: true }),
    db_update: createEnhancedTool("db_update", createDbUpdateTool(), { cacheable: false, timeout: parseInt(process.env.TOOL_DB_MUTATION_TIMEOUT || "30000"), validateInput: true }),
    db_delete: createEnhancedTool("db_delete", createDbDeleteTool(), { cacheable: false, timeout: parseInt(process.env.TOOL_DB_MUTATION_TIMEOUT || "30000"), validateInput: true }),
  };

  const duration = Date.now() - start;
  logger.info("Enhanced tool registry ready", {
    count: Object.keys(tools).length,
    duration,
    runtime: detectRuntime().environment,
    features: "caching, validation, capabilities, timeouts, metrics"
  });

  return tools;
};

// Dynamic metadata/inspection APIs
export const getToolDescriptions = () => buildDynamicDescriptions();
export const getToolCategories   = () => buildCategories();
export const getToolTags         = () => getToolTagsMap();
export const listAllTools = () => Object.keys(toolMetadata).map((name) => ({
  name,
  description: getToolDescriptions()[name],
  category: toolMetadata[name as keyof typeof toolMetadata]?.category,
  tags: toolMetadata[name as keyof typeof toolMetadata]?.tags,
  capabilities: toolCapabilities[name] || [],
  schemas: toolSchemas[name as keyof typeof toolSchemas] || null,
  enhanced: true,
})).filter(Boolean);

export { getToolMetrics } from "./metrics";
export { getToolCapabilities } from "./capabilities";
export { validateToolConfiguration } from "./config";
export { getToolSystemHealth } from "./health";
export { toolSchemas } from "./schemas";





// enhanced tool factory
export function createEnhancedTool(toolName: string, originalTool: any, opts: { cacheable?: boolean; cacheTtl?: number; timeout?: number; validateInput?: boolean } = {}) {
    const { cacheable = false, cacheTtl = parseInt(process.env.TOOL_CACHE_DEFAULT_TTL || "300000"), timeout = parseInt(process.env.TOOL_DEFAULT_TIMEOUT || "30000"), validateInput: doValidate = true } = opts;
    return async (params: any): Promise<ToolResult> => {
      const correlationId = generateCorrelationId();
      return runToolFn(correlationId, toolName, async () => {
        if (doValidate) {
          const v = validateToolInput(toolName, params);
          if (!v.success) throw new Error(`Tool ${toolName} input validation failed: ${v.error}`);
          params = v.data;
        }
        const req = toolCapabilities[toolName];
        if (req?.length) {
          const missing = req.filter((c) => !hasCapability(c as Capability));
          if (missing.length) throw new Error(`Tool ${toolName} requires capabilities: ${missing.join(", ")}`);
        }
        let fn = withMetrics(originalTool, toolName);
        if (cacheable) {
          const wrap = withCache(fn, `${toolName}_cache`, cacheTtl);
          fn = async (p: any) => {
            const key = `${toolName}_cache:${JSON.stringify([p])}`;
            const hit = await globalCache.get(key);
            if (typeof hit !== "undefined") { _recordCacheHit(); return hit; }
            _recordCacheMiss();
            const res = await wrap(p);
            return res as any;
          };
        }
        fn = withTimeout(fn, timeout);
        const result = await fn(params) as ToolResult;
        const schema = (toolSchemas as any)[toolName];
        if (schema && result.success && result.data) {
          try { schema.output.parse(result.data); } catch (e: any) { logger.warn(`Tool ${toolName} output validation warning: ${e.message}`); }
        }
        return result;
      }, 2, 200);
    };
  }
  