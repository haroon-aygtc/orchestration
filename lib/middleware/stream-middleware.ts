/**
 * Production Request Middleware
 *
 * - Strict method/content-type/size validation
 * - Structured logging with traceId / requestId propagation
 * - Safe JSON parsing; schema-validated body & query
 * - Bounded execution with timeouts (AbortSignal-aware)
 * - CORS + preflight (configurable)
 * - No assumptions; strong typing with Zod
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { performance } from "perf_hooks";
import { generatePrefixedUUID } from "../utils/uuid";
import { validateApiRequest, sanitizeApiRequestBody } from "./security-middleware";
import {
  createErrorResponse,
  createSuccessResponse,
  ValidationError,
  AuthorizationError,
} from "@/lib/utils/error-handler";

import { logger } from "@/lib/utils/structured-logger";

// ==================== TYPES ====================

export interface RequestContext {
  requestId: string;
  traceId: string;
  startTime: number;
  endpoint: string;
  method: string;
  userAgent?: string;
  clientIp?: string;
  abort?: AbortController;
}

export interface HandlerOptions {
  validation?: {
    bodySchema?: z.ZodSchema;
    querySchema?: z.ZodSchema;
  };
  timeout?: number; // ms
  maxBodySize?: number; // bytes
  allowedMethods?: Array<"GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD">;
  cors?: {
    enabled?: boolean;
    origin?: string | string[] | "*";
    methods?: string[];
    headers?: string[];
    credentials?: boolean;
    maxAge?: number; // seconds
  };
}

export type RequestHandler<TBody = unknown, TQuery = unknown, TResult = unknown> = (
  body: TBody,
  query: TQuery,
  context: RequestContext
) => Promise<TResult>;

// ==================== INTERNAL UTILS ====================

const DEFAULT_ALLOWED: NonNullable<HandlerOptions["allowedMethods"]> = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
  "HEAD",
];

function headerList(v?: string | string[] | "*") {
  return Array.isArray(v) ? v.join(", ") : v ?? "";
}


function extractClientInfo(req: NextRequest) {
  const xfwd = req.headers.get("x-forwarded-for") || undefined;
  const xreal = req.headers.get("x-real-ip") || undefined;
  const ip = (req as any).ip || xfwd || xreal || "unknown";
  return {
    userAgent: req.headers.get("user-agent") || undefined,
    clientIp: ip,
    contentType: req.headers.get("content-type") || undefined,
    contentLength: req.headers.get("content-length") || undefined,
  };
}

async function enforceMethod(req: NextRequest, allowed: HandlerOptions["allowedMethods"]) {
  const allow = allowed?.length ? allowed : DEFAULT_ALLOWED;
  if (!allow.includes(req.method as any)) {
    throw new ValidationError(
      `Method ${req.method} not allowed. Allowed: ${allow.join(", ")}`,
      "METHOD_NOT_ALLOWED"
    );
  }
}

async function enforceContentType(req: NextRequest) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return;
  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    throw new ValidationError("Content-Type must be application/json", "INVALID_CONTENT_TYPE");
  }
}

async function enforceSizeAndParseJSON<T>(
  req: NextRequest,
  maxSize = 256 * 1024 // 256KB default
): Promise<T> {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return {} as T;

  // Prefer reading as text -> size check -> JSON.parse
  const text = await req.text();
  const bytes = new TextEncoder().encode(text).length;
  if (bytes > maxSize) {
    throw new ValidationError(`Request too large. Maximum size: ${maxSize} bytes`, "REQUEST_TOO_LARGE");
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ValidationError("Invalid JSON body", "INVALID_JSON");
  }
}

function buildCorsHeaders(opts?: HandlerOptions["cors"]) {
  if (!opts?.enabled) return {};
  const origin = opts.origin ?? "*";
  const methods = opts.methods ?? DEFAULT_ALLOWED;
  const headers = opts.headers ?? ["Content-Type", "Authorization", "X-Request-ID", "X-Trace-ID"];
  const maxAge = typeof opts.maxAge === "number" ? String(opts.maxAge) : "86400";
  return {
    "Access-Control-Allow-Origin": origin === "*" ? "*" : headerList(origin),
    "Access-Control-Allow-Methods": headerList(methods),
    "Access-Control-Allow-Headers": headerList(headers),
    "Access-Control-Allow-Credentials": String(!!opts.credentials),
    "Access-Control-Max-Age": maxAge,
  };
}

function applyHeaders(resp: NextResponse, headers: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(headers)) {
    if (v !== undefined) resp.headers.set(k, v);
  }
  return resp;
}

// ==================== MAIN MIDDLEWARE ====================

export async function handleRequest<TBody = unknown, TQuery = unknown, TResult = unknown>(
  request: NextRequest,
  handler: RequestHandler<TBody, TQuery, TResult>,
  options: HandlerOptions = {}
): Promise<NextResponse> {
  const startTime = performance.now();

  // Honor inbound correlation if present
  const inboundReqId = request.headers.get("x-request-id") || undefined;
  const inboundTraceId = request.headers.get("x-trace-id") || undefined;
  const requestId = inboundReqId || generatePrefixedUUID("req");
  const traceId = inboundTraceId || generatePrefixedUUID("trace");

  const { userAgent, clientIp } = extractClientInfo(request);

  const context: RequestContext = {
    requestId,
    traceId,
    startTime,
    endpoint: request.nextUrl.pathname,
    method: request.method,
    userAgent,
    clientIp,
  };

  // Precompute response headers (incl. CORS)
  const baseHeaders: Record<string, string> = {
    "X-Request-ID": requestId,
    "X-Trace-ID": traceId,
    "X-Powered-By": "AI-Agent-Architecture",
  };
  const corsHeaders = buildCorsHeaders(options.cors);

  try {
    // OPTIONS preflight short-circuit (if CORS enabled)
    if (options.cors?.enabled && request.method === "OPTIONS") {
      return applyHeaders(NextResponse.json({}, { status: 204 }), { ...baseHeaders, ...corsHeaders });
    }

    // 1. Method guard
    await enforceMethod(request, options.allowedMethods);

    // 2. Content-type guard
    await enforceContentType(request);

    // 3. Body size + parse
    const maxBodySize = options.maxBodySize ?? 256 * 1024;
    let body = (await enforceSizeAndParseJSON<TBody>(request, maxBodySize)) as TBody;
    if (request.method !== "GET" && body) {
      body = sanitizeApiRequestBody(body as any) as TBody;
    }

    // 4. Security (auth/capabilities/rate-limits/etc.)
    const securityResult = await validateApiRequest(request);
    if (!securityResult.isValid) {
      logger.warn("request.security.fail", {
        requestId,
        traceId,
        endpoint: context.endpoint,
        clientIp: context.clientIp,
        error: securityResult.error?.message,
      });
      throw new AuthorizationError(securityResult.error?.message || "Security validation failed", {
        code: securityResult.error?.code || "SECURITY_ERROR",
        statusCode: securityResult.error?.statusCode || 403,
      });
    }

    // 5. Query parse + validation
    const q: Record<string, string> = {};
    for (const [k, v] of request.nextUrl.searchParams.entries()) q[k] = v;
    let query = q as unknown as TQuery;

    if (options.validation?.querySchema) {
      try {
        query = options.validation.querySchema.parse(q);
      } catch (error) {
        if (error instanceof z.ZodError) {
          const msg = error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
          throw new ValidationError(`Query validation failed: ${msg}`, "QUERY_VALIDATION_ERROR");
        }
        throw error;
      }
    }

    // 6. Body validation (Zod)
    if (request.method !== "GET" && options.validation?.bodySchema) {
      try {
        body = options.validation.bodySchema.parse(body);
      } catch (error) {
        if (error instanceof z.ZodError) {
          const msg = error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
          throw new ValidationError(`Request validation failed: ${msg}`, "VALIDATION_ERROR");
        }
        throw error;
      }
    }

    // 7. Execute handler with timeout (AbortSignal-aware if handler uses context.abort?.signal)
    const timeout = options.timeout ?? 15000;
    const ac = new AbortController();
    context.abort = ac;

    const run = handler(body, query, context);
    const result = (await Promise.race([
      run,
      new Promise<never>((_, rej) => setTimeout(() => {
        ac.abort();
        rej(new Error(`Handler timeout after ${timeout}ms`));
      }, timeout)),
    ])) as TResult;

    // 8. Success response
    const duration = Math.round(performance.now() - startTime);
    logger.info("request.ok", { requestId, traceId, endpoint: context.endpoint, method: context.method, duration });

    const out = createSuccessResponse({
      ...((result as any) ?? {}),
      metadata: {
        requestId,
        traceId,
        duration,
        timestamp: new Date().toISOString(),
      },
    });

    return applyHeaders(out, { ...baseHeaders, ...corsHeaders });
  } catch (error) {
    const duration = Math.round(performance.now() - startTime);
    logger.error("request.fail", {
      requestId,
      traceId,
      endpoint: context.endpoint,
      method: context.method,
      duration,
      clientIp: context.clientIp,
      userAgent: context.userAgent,
      error: (error as Error).message,
    });

    const errResp = createErrorResponse(error as Error, context.endpoint);
    return applyHeaders(errResp, { ...baseHeaders, ...corsHeaders });
  }
}
