/**
 * Production Request Middleware
 * 
 * Enterprise-grade middleware for API endpoints with:
 * - Comprehensive validation & security
 * - Structured logging & error handling
 * - Request tracing & correlation IDs
 * - Type safety & schema validation
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateApiRequest, sanitizeApiRequestBody } from '../middleware/security-middleware';
import { createErrorResponse, createSuccessResponse, ValidationError, AuthorizationError } from '@/lib/utils/error-handler';
import { logger } from '@/lib/utils/structured-logger';
import { securityConfig } from '@/lib/env';
import { performance } from 'perf_hooks';

// ==================== TYPES ====================

export interface RequestContext {
  requestId: string;
  traceId: string;
  startTime: number;
  endpoint: string;
  method: string;
  userAgent?: string;
  clientIp?: string;
}

export interface HandlerOptions {
  validation?: {
    bodySchema?: z.ZodSchema;
    querySchema?: z.ZodSchema;
  };
  timeout?: number;
  maxBodySize?: number;
  allowedMethods?: string[];
}

export type RequestHandler<TBody = any, TQuery = any, TResult = any> = (
  body: TBody,
  query: TQuery,
  context: RequestContext
) => Promise<TResult>;

// ==================== REQUEST UTILITIES ====================


// ==================== REQUEST CONTEXT UTILITIES ====================

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateTraceId(): string {
  return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;
}

function extractClientInfo(request: NextRequest) {
  return {
    userAgent: request.headers.get('user-agent') || undefined,
    clientIp: request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown',
    contentType: request.headers.get('content-type') || undefined,
    contentLength: request.headers.get('content-length') || undefined,
  };
}

// ==================== VALIDATION UTILITIES ====================

async function validateRequestMethod(request: NextRequest, allowedMethods: string[]): Promise<void> {
  if (!allowedMethods.includes(request.method)) {
    throw new ValidationError(
      `Method ${request.method} not allowed. Allowed: ${allowedMethods.join(', ')}`,
      'METHOD_NOT_ALLOWED',
    );
  }
}

async function validateContentType(request: NextRequest): Promise<void> {
  const contentType = request.headers.get('content-type');
  if (request.method !== 'GET' && (!contentType || !contentType.includes('application/json'))) {
    throw new ValidationError(
      'Content-Type must be application/json',
      'INVALID_CONTENT_TYPE',
    );
  }
}

async function validateRequestSize(request: NextRequest, maxSize: number): Promise<void> {
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > maxSize) {
    throw new ValidationError(
      `Request too large. Maximum size: ${maxSize} bytes`,
      'REQUEST_TOO_LARGE',
    );
  }
}

// ==================== MAIN MIDDLEWARE HANDLER ====================

export async function handleRequest<TBody = any, TQuery = any, TResult = any>(
  request: NextRequest,
  handler: RequestHandler<TBody, TQuery, TResult>,
  options: HandlerOptions = {}
): Promise<NextResponse> {
  const startTime = performance.now();
  const requestId = generateRequestId();
  const traceId = generateTraceId();
  
  const context: RequestContext = {
    requestId,
    traceId,
    startTime,
    endpoint: request.nextUrl.pathname,
    method: request.method,
    ...extractClientInfo(request),
  };

  // Set response headers early
  const responseHeaders = {
    'X-Request-ID': requestId,
    'X-Trace-ID': traceId,
    'X-Powered-By': 'AI-Agent-Architecture',
  };

  try {
    // 1. METHOD VALIDATION
    await validateRequestMethod(request, options.allowedMethods || ['GET', 'POST']);

    // 2. CONTENT TYPE VALIDATION
    if (request.method !== 'GET') {
      await validateContentType(request);
    }

    // 3. REQUEST SIZE VALIDATION
    if (options.maxBodySize) {
      await validateRequestSize(request, options.maxBodySize);
    }

    // 4. SECURITY VALIDATION
    const securityResult = await validateApiRequest(request);
    if (!securityResult.isValid) {
      logger.warn('Request security validation failed', {
        requestId,
        traceId,
        endpoint: context.endpoint,
        error: securityResult.error?.message,
        clientIp: context.clientIp,
      });
      
      throw new AuthorizationError(
        securityResult.error?.message || 'Security validation failed',
        { 
          code: securityResult.error?.code || 'SECURITY_ERROR',
          statusCode: securityResult.error?.statusCode || 403 
        }
      );
     
    }

    // 5. PARSE & VALIDATE REQUEST DATA
    let body: TBody = {} as TBody;
    let query: TQuery = {} as TQuery;

    if (request.method !== 'GET') {
      const rawBody = await request.json();
      body = sanitizeApiRequestBody(rawBody);
      
      if (options.validation?.bodySchema) {
        try {
          body = options.validation.bodySchema.parse(body);
        } catch (error) {
          if (error instanceof z.ZodError) {
            const errorMessage = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
            throw new ValidationError(
              `Request validation failed: ${errorMessage}`,
              'VALIDATION_ERROR',
            );
          }
          throw error;
        }
      }
    }

    // Parse query parameters
    const searchParams = new URL(request.url).searchParams;
    const queryObj: Record<string, any> = {};
    for (const [key, value] of searchParams.entries()) {
      queryObj[key] = value;
    }
    
    if (options.validation?.querySchema) {
      try {
        query = options.validation.querySchema.parse(queryObj);
      } catch (error) {
        if (error instanceof z.ZodError) {
          const errorMessage = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
          throw new ValidationError(
            `Query validation failed: ${errorMessage}`,
            'QUERY_VALIDATION_ERROR',
          );
        }
        throw error;
      }
    } else {
      query = queryObj as TQuery;
    }

    // 6. EXECUTE HANDLER
    logger.info('Request started', {
      requestId,
      traceId,
      endpoint: context.endpoint,
      method: context.method,
      clientIp: context.clientIp,
      userAgent: context.userAgent,
    });

    const result = await (options.timeout
      ? Promise.race([
          handler(body, query, context),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error(`Handler timeout after ${options.timeout}ms`)), options.timeout)
          ),
        ])
      : handler(body, query, context));

    // 7. SUCCESS RESPONSE
    const duration = performance.now() - startTime;

    logger.info('Request completed successfully', {
      requestId,
      traceId,
      endpoint: context.endpoint,
      duration: Math.round(duration),
      resultType: typeof result,
    });

    const responseData = {
      ...result,
      metadata: {
        requestId,
        traceId,
        duration: Math.round(duration),
        timestamp: new Date().toISOString(),
      },
    };
    const response = createSuccessResponse(responseData);

    // Add custom headers
    Object.entries(responseHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;

  } catch (error) {
    // ERROR HANDLING
    const duration = performance.now() - startTime;
    
    const errorContext = {
      requestId,
      traceId,
      endpoint: context.endpoint,
      method: context.method,
      duration: Math.round(duration),
      clientIp: context.clientIp,
      userAgent: context.userAgent,
      error: (error as Error).message,
      stack: (error as Error).stack?.split('\n').slice(0, 5).join('\n'),
    };

    logger.error('Request failed', errorContext);

    const errorResponse = createErrorResponse(error as Error, context.endpoint);

    // Add custom headers to error response
    Object.entries(responseHeaders).forEach(([key, value]) => {
      errorResponse.headers.set(key, value);
    });

    return errorResponse;
  }
}

