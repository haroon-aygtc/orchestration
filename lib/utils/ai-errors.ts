// lib/errors/ai-errors.ts
import {
    AppError,
    ValidationError,
    AIServiceError,
    ConfigurationError,
  } from "./error-handler"; // <- your file’s path
  
  export type AiErrorClass =
    | "TIMEOUT"
    | "RATE_LIMITED"
    | "SERVICE_UNAVAILABLE"
    | "BAD_REQUEST"
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "PROVIDER_ERROR"
    | "NETWORK_ERROR"
    | "BAD_BLUEPRINT"
    | "INVALID_PARAMS"
    | "FAILED_PRECONDITION"
    | "INTERNAL";
  
  export function classifyAiError(err: any): {
    code: AiErrorClass;
    status?: number;
    retriable: boolean;
  } {
    const name = err?.name;
    const code = err?.code;
    const status = err?.status ?? err?.response?.status;
  
    if (name === "AbortError" || code === "TIMEOUT" || /timeout/i.test(String(err?.message || "")))
      return { code: "TIMEOUT", status: 408, retriable: true };
  
    if (typeof status === "number") {
      if (status === 429) return { code: "RATE_LIMITED", status, retriable: true };
      if ([502, 503, 504].includes(status)) return { code: "SERVICE_UNAVAILABLE", status, retriable: true };
      if (status === 400) return { code: "BAD_REQUEST", status, retriable: false };
      if (status === 401) return { code: "UNAUTHORIZED", status, retriable: false };
      if (status === 403) return { code: "FORBIDDEN", status, retriable: false };
      if (status === 404) return { code: "NOT_FOUND", status, retriable: false };
      if (status >= 500) return { code: "SERVICE_UNAVAILABLE", status, retriable: true };
    }
  
    if (code === "BAD_BLUEPRINT") return { code: "BAD_BLUEPRINT", status: 422, retriable: false };
    if (code && /ECONNRESET|EPIPE|ETIMEDOUT|ENOTFOUND|ECONNREFUSED/i.test(String(code)))
      return { code: "NETWORK_ERROR", status: 502, retriable: true };
  
    return { code: "PROVIDER_ERROR", status, retriable: false };
  }
  
  export function mapAiToAppError(err: any): AppError {
    const c = classifyAiError(err);
  
    switch (c.code) {
      case "TIMEOUT":
        return new AIServiceError("AI timeout", { status: c.status, cause: err });
      case "RATE_LIMITED":
        return new AIServiceError("AI rate limited", { status: c.status, cause: err });
      case "SERVICE_UNAVAILABLE":
        return new AIServiceError("AI service unavailable", { status: c.status, cause: err });
      case "BAD_REQUEST":
        return new ValidationError("Bad request to AI provider", { status: c.status, cause: err });
      case "UNAUTHORIZED":
        return new ConfigurationError("AI provider unauthorized (check keys)", { status: c.status, cause: err });
      case "FORBIDDEN":
        return new ConfigurationError("AI provider forbidden (permissions)", { status: c.status, cause: err });
      case "NOT_FOUND":
        return new AIServiceError("AI endpoint not found", { status: c.status, cause: err });
      case "NETWORK_ERROR":
        return new AIServiceError("Network error talking to AI", { status: c.status, cause: err });
      case "BAD_BLUEPRINT":
        return new ValidationError("Blueprint schema validation failed", { status: c.status, issues: err?.issues });
      case "INVALID_PARAMS":
        return new ValidationError("Invalid parameters", { cause: err });
      case "FAILED_PRECONDITION":
        return new AppError("Failed precondition", "FAILED_PRECONDITION", 412, true, { cause: err });
      default:
        return new AIServiceError("AI provider error", { status: c.status, cause: err });
    }
  }
  
  // util: Retry-After support
  export function extractRetryAfterMs(err: any): number | null {
    const h = err?.response?.headers?.["retry-after"] || err?.headers?.["retry-after"];
    if (!h) return null;
    const s = String(h).trim();
    if (/^\d+$/.test(s)) return parseInt(s, 10) * 1000;
    const d = Date.parse(s);
    return Number.isNaN(d) ? null : Math.max(0, d - Date.now());
  }
  
  export function backoff(attempt: number, base = 300, cap = 5000): number {
    const prev = Math.min(cap, base * Math.pow(2, attempt - 1));
    return Math.min(cap, prev + Math.random() * base);
  }
  