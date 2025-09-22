// path: lib/tools/http-request.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { ToolResult } from "../agents/shared/types";
import {
  AppError,
  ValidationError,
  AIServiceError,
  logError,
} from "../utils/error-handler";
import {
  validateDomain,
  validateRequestSize,
  checkRateLimit,
  redactSecrets,
} from "../utils/security";
import { createEnhancedTool } from "./registry"; // ensure ./registry/index.ts re-exports createEnhancedTool
import { ToolFn } from "./run-tool";
/**
 * RequestInit typing without requiring DOM libs.
 * If you already have DOM or undici types, feel free to remove this alias.
 */
type RequestInitLooselyTyped = Record<string, any>;

// ───────────────────────────────────────────────────────────────────────────────
// Circuit breaker (local, lightweight – you can swap to your central manager later)
// ───────────────────────────────────────────────────────────────────────────────
interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  isOpen: boolean;
}

const circuitBreakers = new Map<string, CircuitBreakerState>();

const DEFAULT_RETRY_CONFIG = {
  retries: 3,
  retryDelay: 1000,
  maxRetryDelay: 30_000,
  backoffMultiplier: 2,
  jitter: true,
  retryOnStatus: [408, 429, 500, 502, 503, 504],
  respectRetryAfter: true,
  circuitBreakerThreshold: 5,
  circuitBreakerTimeout: 60_000,
};

// Pure key builder (sync)
export function getCircuitBreakerKey(url: string): string {
  const u = new URL(url);
  return `${u.protocol}//${u.hostname}`;
}

function isCircuitBreakerOpen(
  key: string,
  threshold: number,
  timeout: number
): boolean {
  const state = circuitBreakers.get(key);
  if (!state) return false;

  if (state.isOpen) {
    const elapsed = Date.now() - state.lastFailureTime;
    if (elapsed > timeout) {
      circuitBreakers.set(key, { failures: 0, lastFailureTime: 0, isOpen: false });
      return false;
    }
    return true;
  }

  return state.failures >= threshold;
}

function recordFailure(key: string, threshold: number): void {
  const state =
    circuitBreakers.get(key) || { failures: 0, lastFailureTime: 0, isOpen: false };
  state.failures += 1;
  state.lastFailureTime = Date.now();
  if (state.failures >= threshold) state.isOpen = true;
  circuitBreakers.set(key, state);
}

function recordSuccess(key: string): void {
  const state =
    circuitBreakers.get(key) || { failures: 0, lastFailureTime: 0, isOpen: false };
  state.failures = 0;
  state.isOpen = false;
  circuitBreakers.set(key, state);
}

// ───────────────────────────────────────────────────────────────────────────────
// Retry/backoff helpers
// ───────────────────────────────────────────────────────────────────────────────
function calculateRetryDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  multiplier: number,
  jitter: boolean
): number {
  // attempt is 0-based; this yields base, base*mult, base*mult^2, ...
  const exp = baseDelay * Math.pow(multiplier, attempt);
  const capped = Math.min(exp, maxDelay);
  if (!jitter) return capped;
  const span = capped * 0.25;
  const jitterAmt = (Math.random() - 0.5) * 2 * span; // ±25%
  return Math.max(0, Math.round(capped + jitterAmt));
}

function parseRetryAfter(retryAfter: string): number {
  const n = Number(retryAfter);
  if (!Number.isNaN(n)) {
    // Heuristic: if small, treat as seconds; otherwise ms
    return n <= 60 ? n * 1000 : n;
  }
  const d = new Date(retryAfter);
  if (!Number.isNaN(d.getTime())) {
    const delta = d.getTime() - Date.now();
    return Math.max(0, delta);
  }
  return 0;
}

function mapHTTPError(e: any): { statusCode: number; message: string; data?: Record<string, unknown> } {
  if (e instanceof AppError) {
    return { statusCode: e.statusCode, message: e.message, data: { code: e.code, details: e.details } };
  }
  const msg = String(e?.message ?? "Unknown error");
  if (/timeout/i.test(msg)) return { statusCode: 408, message: "Request timed out", data: { error: msg } };
  if (/dns resolution failed/i.test(msg)) return { statusCode: 404, message: "DNS resolution failed", data: { error: msg } };
  if (/connection refused/i.test(msg)) return { statusCode: 503, message: "Connection refused", data: { error: msg } };
  return { statusCode: 500, message: "HTTP request failed", data: { error: msg } };
}

// ───────────────────────────────────────────────────────────────────────────────
// Main tool function (wrap with createEnhancedTool in the registry)
// ───────────────────────────────────────────────────────────────────────────────
export const httpRequestFn: ToolFn = async (params): Promise<ToolResult> => {
  const {
    url,
    method = "GET",
    headers = {},
    body,
    timeoutMs = 30_000,
    followRedirects = true,
    retries = DEFAULT_RETRY_CONFIG.retries,
    retryDelay = DEFAULT_RETRY_CONFIG.retryDelay,
    maxRetryDelay = DEFAULT_RETRY_CONFIG.maxRetryDelay,
    backoffMultiplier = DEFAULT_RETRY_CONFIG.backoffMultiplier,
    jitter = DEFAULT_RETRY_CONFIG.jitter,
    retryOnStatus = DEFAULT_RETRY_CONFIG.retryOnStatus,
    respectRetryAfter = DEFAULT_RETRY_CONFIG.respectRetryAfter,
    circuitBreakerThreshold = DEFAULT_RETRY_CONFIG.circuitBreakerThreshold,
    circuitBreakerTimeout = DEFAULT_RETRY_CONFIG.circuitBreakerTimeout,
  } = params || {};

  try {
    // Validate presence + URL
    if (!url) {
      throw new ValidationError("http_request: 'url' is required", {
        parameter: "url",
        received: typeof url,
        value: url,
      });
    }
    try {
      new URL(url);
    } catch {
      throw new ValidationError("http_request: Invalid URL format", {
        parameter: "url",
        received: typeof url,
        value: url,
      });
    }

    // Security & size
    const domainValidation = validateDomain(url);
    if (!domainValidation.isAllowed) {
      throw new ValidationError("http_request: Domain not allowed", {
        parameter: "url",
        domain: domainValidation.domain,
        error: domainValidation.error,
      });
    }
    if (typeof body !== "undefined") {
      const size =
        typeof body === "string"
          ? Buffer.byteLength(body, "utf8")
          : Buffer.byteLength(JSON.stringify(body), "utf8");
      if (!validateRequestSize(size.toString())) {
        throw new ValidationError("http_request: Request body too large", {
          parameter: "body",
          size,
          maxSize: 10 * 1024 * 1024,
        });
      }
    }

    // Rate limiting
    const rate = checkRateLimit(url.toString());
    if (!rate.allowed) {
      throw new AppError("http_request: Rate limit exceeded", "RATE_LIMIT_ERROR", 429, true, {
        remaining: rate.remaining,
        resetTime: rate.resetTime,
      });
    }

    // Circuit breaker
    const cbKey = getCircuitBreakerKey(url.toString());
    if (isCircuitBreakerOpen(cbKey, circuitBreakerThreshold, circuitBreakerTimeout)) {
      throw new AIServiceError("Circuit breaker is open - too many consecutive failures", {
        circuitBreakerKey: cbKey,
        threshold: circuitBreakerThreshold,
        timeout: circuitBreakerTimeout,
      });
    }

    let lastError: Error | null = null;
    let retryAfterDelay = 0;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const to = setTimeout(() => controller.abort(), timeoutMs);

        const reqInit: RequestInitLooselyTyped = {
          method: (method || "GET").toUpperCase(),
          headers: { "User-Agent": "AI-Agent-HTTP-Tool/1.0", ...(headers as Record<string, string>) },
          signal: controller.signal,
          redirect: followRedirects ? "follow" : "manual",
        };

        if (body && ["POST", "PUT", "PATCH"].includes((method || "").toUpperCase())) {
          if (typeof body === "string") {
            reqInit.body = body;
          } else {
            reqInit.body = JSON.stringify(body);
            (reqInit.headers as Record<string, string>)["Content-Type"] = "application/json";
          }
        }

        const start = Date.now();
        const response = await fetch(url, reqInit as any);
        const elapsed = Date.now() - start;

        clearTimeout(to);

        const contentType = response.headers.get("content-type") || "";
        let responseData: any;
        if (contentType.includes("application/json")) {
          try {
            responseData = await response.json();
          } catch {
            responseData = await response.text();
          }
        } else {
          responseData = await response.text();
        }

        const headersOut: Record<string, string> = {};
        response.headers.forEach((value, key) => (headersOut[key] = value));

        const result: ToolResult = {
          success: response.ok,
          statusCode: response.status,
          message: response.statusText || `HTTP ${response.status}`,
          data: {
            body: responseData,
            headers: headersOut,
            url: response.url,
            redirected: response.redirected,
            type: (response as any).type,
            responseTime: elapsed,
            attempt: attempt + 1,
          },
        };

        if (response.ok) {
          recordSuccess(cbKey);
          return result;
        }

        // For non-OK responses:
        const shouldRetry = retryOnStatus.includes(response.status);

        if (respectRetryAfter) {
          const ra = response.headers.get("retry-after");
          retryAfterDelay = ra ? parseRetryAfter(ra) : 0;
        }

        if (!shouldRetry || attempt === retries) {
          // mark failure and return final response
          recordFailure(cbKey, circuitBreakerThreshold);
          return result;
        }

        // backoff
        const base = retryAfterDelay > 0 ? retryAfterDelay : retryDelay;
        const delay = calculateRetryDelay(attempt, base, maxRetryDelay, backoffMultiplier, jitter);
        await new Promise((r) => setTimeout(r, delay));
      } catch (err: any) {
        lastError = err;
        recordFailure(cbKey, circuitBreakerThreshold);

        if (attempt === retries) break;

        const delay = calculateRetryDelay(attempt, retryDelay, maxRetryDelay, backoffMultiplier, jitter);
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    throw new AIServiceError("All retry attempts failed", {
      originalError: lastError instanceof Error ? lastError.message : String(lastError),
      attempts: retries + 1,
      circuitBreakerKey: cbKey,
    });
  } catch (error: any) {
    logError(error instanceof Error ? error : new Error(String(error)), "httpRequest");

    const mapped = mapHTTPError(error);

    const redactedData = redactSecrets({
      ...(mapped.data || {}),
      // expose cbKey deterministically but safely
      circuitBreakerKey: (() => {
        try {
          return getCircuitBreakerKey(params?.url || "");
        } catch {
          return "invalid-url";
        }
      })(),
      retryConfig: {
        retries: params?.retries ?? DEFAULT_RETRY_CONFIG.retries,
        retryDelay: params?.retryDelay ?? DEFAULT_RETRY_CONFIG.retryDelay,
        maxRetryDelay: params?.maxRetryDelay ?? DEFAULT_RETRY_CONFIG.maxRetryDelay,
        backoffMultiplier: params?.backoffMultiplier ?? DEFAULT_RETRY_CONFIG.backoffMultiplier,
        jitter: params?.jitter ?? DEFAULT_RETRY_CONFIG.jitter,
        retryOnStatus: params?.retryOnStatus ?? DEFAULT_RETRY_CONFIG.retryOnStatus,
      },
    });

    return {
      success: false,
      statusCode: mapped.statusCode,
      message: mapped.message,
      data: (redactedData as any).redacted ?? redactedData, // support your redactor’s shape
    };
  }
};

// Convenience helpers (thin wrappers over the tool)
export const httpHelpers = {
  get: (url: string, headers?: Record<string, string>) =>
    httpRequestFn({ url, method: "GET", headers }),

  post: (url: string, body: any, headers?: Record<string, string>) =>
    httpRequestFn({ url, method: "POST", body, headers }),

  put: (url: string, body: any, headers?: Record<string, string>) =>
    httpRequestFn({ url, method: "PUT", body, headers }),

  delete: (url: string, headers?: Record<string, string>) =>
    httpRequestFn({ url, method: "DELETE", headers }),

  jsonApi: (url: string, method: string, data?: any, apiKey?: string) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
    return httpRequestFn({ url, method, body: data, headers });
  },

  formData: (url: string, formData: Record<string, string>) => {
    const body = new URLSearchParams(formData).toString();
    return httpRequestFn({
      url,
      method: "POST",
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  },
};

export const httpRequestTool = createEnhancedTool("http_request", httpRequestFn);
