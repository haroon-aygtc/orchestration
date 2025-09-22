// ──────────────────────────────────────────────────────────────────────────────
// File: lib/tools/registry/wrappers.ts
// Purpose: Capability checks, timeout, metrics, caching, and enhanced tool factory
// ──────────────────────────────────────────────────────────────────────────────
import { Capability, hasCapability } from "../../utils/runtime-detection";
import { logger } from "../../utils/structured-logger";
import { validateToolInput } from "./validation";
import { _recordExecError, _recordExecStart, _recordExecSuccess, _recordCacheHit, _recordCacheMiss } from "./metrics";

// timeout wrapper
export function withTimeout<T extends any[], R>(fn: (...args: T) => Promise<R>, timeoutMs: number) {
  return async (...args: T): Promise<R> => {
    const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Tool execution timeout")), timeoutMs));
    return Promise.race([fn(...args), timeoutPromise]);
  };
}

// capability wrapper
export function withCapabilityCheck<T extends any[], R>(fn: (...args: T) => Promise<R>, reqCaps: string[], toolName: string) {
  return async (...args: T): Promise<R> => {
    const missing = reqCaps.filter((c) => !hasCapability(c as Capability));
    if (missing.length) throw new Error(`Tool ${toolName} requires capabilities: ${missing.join(", ")}`);
    return fn(...args);
  };
}

// metrics wrapper
export function withMetrics<T extends any[], R>(fn: (...args: T) => Promise<R>, toolName: string) {
  return async (...args: T): Promise<R> => {
    const start = Date.now();
    _recordExecStart();
    try {
      const res = await fn(...args);
      _recordExecSuccess(Date.now() - start);
      return res;
    } catch (e) {
      _recordExecError(toolName, Date.now() - start);
      logger.error(`Tool ${toolName} execution failed`, { error: e instanceof Error ? e.message : String(e), toolName });
      throw e;
    }
  };
}

export function withErrorHandling<T extends any[], R>(fn: (...args: T) => Promise<R>, toolName: string) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (e) {
      logger.error(`Tool execution failed`, { error: e instanceof Error ? e.message : String(e), toolName });
      throw e;
    }
  };
}

export function withValidation<T extends any[], R>(fn: (...args: T) => Promise<R>, toolName: string) {
  return async (...args: T): Promise<R> => {
    const validation = validateToolInput(toolName, args[0]);
    if (!validation.success) throw new Error(`Tool ${toolName} input validation failed: ${validation.error}`);
    return fn(...args);
  };
}



