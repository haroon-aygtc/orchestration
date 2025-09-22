// Centralized Error Handling - Production Ready
import { NextResponse } from "next/server";
import { logger } from "./structured-logger";

export interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: any;
  timestamp: string;
}

export interface SuccessResponse<T = any> {
  success: true;
  data?: T;
  message?: string;
  timestamp: string;
}

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: any;

  constructor(
    message: string,
    code: string = 'INTERNAL_ERROR',
    statusCode: number = 500,
    isOperational: boolean = true,
    details?: any
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, true, details);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'DATABASE_ERROR', 500, true, details);
  }
}

export class AIServiceError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'AI_SERVICE_ERROR', 502, true, details);
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'CONFIGURATION_ERROR', 500, true, details);
  }
}

export class NetworkError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'NETWORK_ERROR', 503, true, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'AUTHENTICATION_ERROR', 401, true, details);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'AUTHORIZATION_ERROR', 403, true, details);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'RATE_LIMIT_ERROR', 429, true, details);
  }
}

export class TimeoutError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'TIMEOUT_ERROR', 408, true, details);
  }
}

export class ResourceNotFoundError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'RESOURCE_NOT_FOUND', 404, true, details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'CONFLICT_ERROR', 409, true, details);
  }
}

export class CircuitBreakerError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'CIRCUIT_BREAKER_ERROR', 503, true, details);
  }
}

// Error mapping utilities
export function mapErrorToAppError(error: unknown, context: string): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    // Map common error patterns to specific AppError types
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout') || message.includes('timed out')) {
      return new TimeoutError(`${context}: ${error.message}`, { originalError: error.message });
    }
    
    if (message.includes('network') || message.includes('connection') || message.includes('fetch')) {
      return new NetworkError(`${context}: ${error.message}`, { originalError: error.message });
    }
    
    if (message.includes('not found') || message.includes('404')) {
      return new ResourceNotFoundError(`${context}: ${error.message}`, { originalError: error.message });
    }
    
    if (message.includes('unauthorized') || message.includes('401')) {
      return new AuthenticationError(`${context}: ${error.message}`, { originalError: error.message });
    }
    
    if (message.includes('forbidden') || message.includes('403')) {
      return new AuthorizationError(`${context}: ${error.message}`, { originalError: error.message });
    }
    
    if (message.includes('rate limit') || message.includes('429')) {
      return new RateLimitError(`${context}: ${error.message}`, { originalError: error.message });
    }
    
    if (message.includes('conflict') || message.includes('409')) {
      return new ConflictError(`${context}: ${error.message}`, { originalError: error.message });
    }
    
    if (message.includes('circuit breaker') || message.includes('circuit open')) {
      return new CircuitBreakerError(`${context}: ${error.message}`, { originalError: error.message });
    }
    
    if (message.includes('validation') || message.includes('invalid')) {
      return new ValidationError(`${context}: ${error.message}`, { originalError: error.message });
    }
    
    if (message.includes('database') || message.includes('prisma') || message.includes('sql')) {
      return new DatabaseError(`${context}: ${error.message}`, { originalError: error.message });
    }
    
    if (message.includes('ai') || message.includes('openai') || message.includes('anthropic')) {
      return new AIServiceError(`${context}: ${error.message}`, { originalError: error.message });
    }
    
    if (message.includes('config') || message.includes('configuration')) {
      return new ConfigurationError(`${context}: ${error.message}`, { originalError: error.message });
    }
    
    // Default to generic AppError
    return new AppError(`${context}: ${error.message}`, 'SERVICE_ERROR', 500, true, { originalError: error.message });
  }

  // Unknown error type
  return new AppError(`${context}: Unknown error occurred`, 'UNKNOWN_ERROR', 500, true, { originalError: String(error) });
}

// Centralized error logging with structured logging
export function logError(error: Error, context?: string): void {
  const contextStr = context ? `[${context}]` : '';
  
  logger.error(`❌ ${contextStr} ${error.name}: ${error.message}`, {
    stack: error.stack,
    ...(error instanceof AppError && {
      code: error.code,
      statusCode: error.statusCode,
      isOperational: error.isOperational,
      details: error.details
    })
  }, error);
}

// API error response formatter
export function createErrorResponse(
  error: Error,
  context?: string
): NextResponse<ErrorResponse> {
  logError(error, context);

  if (error instanceof AppError) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        code: error.code,
        details: error.details,
        timestamp: new Date().toISOString()
      },
      { status: error.statusCode }
    );
  }

  // Unknown error - don't expose internal details
  return NextResponse.json(
    {
      success: false,
      error: 'An unexpected error occurred',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString()
    },
    { status: 500 }
  );
}

// Success response formatter
export function createSuccessResponse<T>(
  data?: T,
  message?: string
): NextResponse<SuccessResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
  });
}

// Service error handler with automatic mapping
export function handleServiceError(error: unknown, context: string): never {
  const mappedError = mapErrorToAppError(error, context);
  logError(mappedError, context);
  throw mappedError;
}

// Async error wrapper
export function asyncHandler<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context: string
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      handleServiceError(error, context);
    }
  };
}

// Error recovery utilities
export function isRetryableError(error: AppError): boolean {
  const retryableCodes = [
    'NETWORK_ERROR',
    'TIMEOUT_ERROR',
    'RATE_LIMIT_ERROR',
    'AI_SERVICE_ERROR',
    'CIRCUIT_BREAKER_ERROR'
  ];
  
  return retryableCodes.includes(error.code) && error.isOperational;
}

export function getRetryDelay(error: AppError, attempt: number): number {
  const baseDelay = 1000; // 1 second
  const maxDelay = 30000; // 30 seconds
  
  if (error.code === 'RATE_LIMIT_ERROR') {
    // For rate limits, use exponential backoff with jitter
    return Math.min(baseDelay * Math.pow(2, attempt) + Math.random() * 1000, maxDelay);
  }
  
  if (error.code === 'CIRCUIT_BREAKER_ERROR') {
    // For circuit breaker, wait longer
    return Math.min(baseDelay * Math.pow(2, attempt) * 2, maxDelay);
  }
  
  // Default exponential backoff
  return Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
}

// Error context builder
export function buildErrorContext(operation: string, params?: any, metadata?: any): any {
  return {
    operation,
    params: params ? JSON.stringify(params) : undefined,
    metadata,
    timestamp: new Date().toISOString()
  };
}

// Error metrics collector
export class ErrorMetrics {
  private static instance: ErrorMetrics;
  private errorCounts: Map<string, number> = new Map();
  private errorRates: Map<string, number> = new Map();
  private lastReset: Date = new Date();

  static getInstance(): ErrorMetrics {
    if (!ErrorMetrics.instance) {
      ErrorMetrics.instance = new ErrorMetrics();
    }
    return ErrorMetrics.instance;
  }

  recordError(error: AppError): void {
    const key = error.code;
    const count = this.errorCounts.get(key) || 0;
    this.errorCounts.set(key, count + 1);
    
    // Calculate error rate (errors per minute)
    const now = new Date();
    const timeDiff = now.getTime() - this.lastReset.getTime();
    if (timeDiff > 60000) { // Reset every minute
      this.errorRates.clear();
      this.lastReset = now;
    }
    
    const rate = this.errorRates.get(key) || 0;
    this.errorRates.set(key, rate + 1);
  }

  getErrorStats(): { counts: Record<string, number>; rates: Record<string, number> } {
    return {
      counts: Object.fromEntries(this.errorCounts),
      rates: Object.fromEntries(this.errorRates)
    };
  }

  reset(): void {
    this.errorCounts.clear();
    this.errorRates.clear();
    this.lastReset = new Date();
  }
}

export function handleError(error: unknown, context: string): void {
  const mappedError = mapErrorToAppError(error, context);
  logError(mappedError, context);
  throw mappedError;
}

// Export logInfo function
export function logInfo(message: string, context?: string): void {
  logger.info(message, context ? { context: context } : undefined);
}
// Export error metrics singleton
export const errorMetrics = ErrorMetrics.getInstance();
