// Tool Runner with Retry Logic and Standardized Logging
import { toolStart, toolEnd, toolError, ToolLogCtx } from '../utils/structured-logger';
import { generateUUID } from "../utils/uuid";
import { createEnhancedTool } from "./registry/index";
import { ToolResult } from "../agents/shared/types";

export type ToolFn = (params: Record<string, any>) => Promise<ToolResult>;
export type ToolRegistry = Record<string, ToolFn>;

/**
 * Run a tool with retry logic, standardized logging, and correlation tracking
 */
export async function runToolFn<T>(
  corr: string,
  toolName: string,
  fn: () => Promise<T>,
  maxRetries = 2,
  baseDelayMs = 200
): Promise<T> {
  let attempt = 0;
  let lastErr: any;
  
  while (attempt <= maxRetries) {
    const started = Date.now();
    attempt++;
    
    const ctx: ToolLogCtx = {
      corr,
      tool: toolName,
      attempt,
      params: undefined // Will be set by caller if needed
    };
    
    try {
      toolStart(ctx.tool, ctx.params);
      const result = await fn();
      const durationMs = Date.now() - started;
      
      toolEnd(ctx.tool, durationMs, true, undefined);
      
      return result;
    } catch (err: any) {
      const durationMs = Date.now() - started;
      
      toolError(ctx.tool, err, ctx.params);
      
      lastErr = err;
      
      // Don't retry on certain error types
      if (isNonRetryableError(err)) {
        break;
      }
      
      // If this was the last attempt, break
      if (attempt > maxRetries) {
        break;
      }
      
      // Exponential backoff delay
      const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  throw lastErr;
}

/**
 * Run a tool with parameters and retry logic
 */
export async function runToolWithParamsFn<T>(
  corr: string,
  toolName: string,
  params: Record<string, any>,
  fn: (params: Record<string, any>) => Promise<T>,
  maxRetries = 2,
  baseDelayMs = 200
): Promise<T> {
  return runToolFn(
    corr,
    toolName,
    () => fn(params),
    maxRetries,
    baseDelayMs
  );
}

/**
 * Check if an error should not be retried
 */
function isNonRetryableError(error: any): boolean {
  // Don't retry on validation errors, authentication errors, or permission errors
  if (error.message?.includes('validation') || 
      error.message?.includes('unauthorized') ||
      error.message?.includes('forbidden') ||
      error.message?.includes('not found') ||
      error.statusCode === 400 ||
      error.statusCode === 401 ||
      error.statusCode === 403 ||
      error.statusCode === 404) {
    return true;
  }
  
  return false;
}

/**
 * Generate a correlation ID for tool execution
 */
export function generateCorrelationId(): string {
  return generateUUID();
}

/**
 * Create a tool runner with default settings
 */
export function createToolRunner(defaultMaxRetries = 2, defaultBaseDelayMs = 200) {
  return {
    run: <T>(corr: string, toolName: string, fn: () => Promise<T>) => 
      runToolFn(corr, toolName, fn, defaultMaxRetries, defaultBaseDelayMs),
    
    runWithParams: <T>(corr: string, toolName: string, params: Record<string, any>, fn: (params: Record<string, any>) => Promise<T>) =>
      runToolWithParamsFn (corr, toolName, params, fn, defaultMaxRetries, defaultBaseDelayMs),
    
    generateCorrelationId
  };
}
export const runToolTool = createEnhancedTool("run_tool", runToolFn);