// lib/utils/structured-logger.ts
/**
 * Production-Grade Structured Logging with Trace IDs
 * Provides consistent, structured logging across the application
 */

import { generateUUID } from './uuid';
import { redactSecrets } from './security';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export type LogContext = Record<string, any>;

// Standardized tool logging context
export interface ToolLogCtx {
  corr: string;        // correlation ID
  tool: string;        // tool name
  attempt: number;     // attempt number (1-based)
  params?: unknown;    // tool parameters
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  traceId?: string;
  spanId?: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  metadata?: {
    service: string;
    version: string;
    environment: string;
    runtime: string;
  };
}

class StructuredLogger {
  private static instance: StructuredLogger;
  private traceId: string | null = null;
  private spanId: string | null = null;
  private serviceName: string;
  private version: string;
  private environment: string;
  private runtime: string;

  constructor() {
    this.serviceName = process.env.SERVICE_NAME || 'ai-agent-architecture';
    this.version = process.env.SERVICE_VERSION || '1.0.0';
    this.environment = process.env.NODE_ENV || 'development';
    this.runtime = typeof process !== 'undefined' && process.versions?.node ? 'node' : 'browser';
  }

  static getInstance(): StructuredLogger {
    if (!StructuredLogger.instance) {
      StructuredLogger.instance = new StructuredLogger();
    }
    return StructuredLogger.instance;
  }

  // Trace management
  startTrace(traceId?: string): string {
    this.traceId = traceId || generateUUID();
    this.spanId = generateUUID();
    return this.traceId;
  }

  startSpan(spanId?: string): string {
    this.spanId = spanId || generateUUID();
    return this.spanId;
  }

  getCurrentTraceId(): string | null {
    return this.traceId;
  }

  getCurrentSpanId(): string | null {
    return this.spanId;
  }

  endTrace(): void {
    this.traceId = null;
    this.spanId = null;
  }

  // Core logging methods
  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      traceId: this.traceId || undefined,
      spanId: this.spanId || undefined,
      context,
      metadata: {
        service: this.serviceName,
        version: this.version,
        environment: this.environment,
        runtime: this.runtime
      }
    };

    if (error) {
      logEntry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      };
    }

    // Output based on environment
    if (this.environment === 'production') {
      // In production, use JSON format for log aggregation
      console.log(JSON.stringify(logEntry));
    } else {
      // In development, use pretty format
      const prefix = `[${logEntry.timestamp}] [${level.toUpperCase()}]`;
      const traceInfo = logEntry.traceId ? ` [trace:${logEntry.traceId}]` : '';
      const spanInfo = logEntry.spanId ? ` [span:${logEntry.spanId}]` : '';
      
      console.log(`${prefix}${traceInfo}${spanInfo} ${message}`);
      
      if (context && Object.keys(context).length > 0) {
        console.log('  Context:', context);
      }
      
      if (error) {
        console.error('  Error:', error);
      }
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: LogContext, error?: Error): void {
    this.log('error', message, context, error);
  }

  fatal(message: string, context?: LogContext, error?: Error): void {
    this.log('fatal', message, context, error);
  }

  // Standardized tool logging with correlation ID and attempt tracking
  toolStart(ctx: ToolLogCtx): void {
    this.info(`Tool execution started: ${ctx.tool}`, {
      corr: ctx.corr,
      tool: ctx.tool,
      attempt: ctx.attempt,
      params: this.sanitizeParams(ctx.params),
      action: 'tool_start',
      traceId: this.traceId || undefined,
    });
  }

  toolEnd(ctx: ToolLogCtx & { durationMs: number; success: boolean; result?: unknown }): void {
    this.info(`Tool execution completed: ${ctx.tool}`, {
      corr: ctx.corr,
      tool: ctx.tool,
      attempt: ctx.attempt,
      durationMs: ctx.durationMs,
      success: ctx.success,
      result: this.sanitizeResult(ctx.result),
      action: 'tool_end',
      traceId: this.traceId || undefined,
    });
  }

  toolError(ctx: ToolLogCtx & { error: Error }): void {
    this.error(`Tool execution failed: ${ctx.tool}`, {
      corr: ctx.corr,
      tool: ctx.tool,
      attempt: ctx.attempt,
      params: this.sanitizeParams(ctx.params),
      action: 'tool_error',
      traceId: this.traceId || undefined,
    }, ctx.error);
  }

  // Legacy methods for backward compatibility
  toolStartLegacy(toolName: string, params?: any): void {
    this.toolStart({ corr: 'legacy', tool: toolName, attempt: 1, params });
  }

  toolEndLegacy(toolName: string, duration: number, success: boolean, result?: any): void {
    this.toolEnd({ corr: 'legacy', tool: toolName, attempt: 1, durationMs: duration, success, result });
  }

  toolErrorLegacy(toolName: string, error: Error, params?: any): void {
    this.toolError({ corr: 'legacy', tool: toolName, attempt: 1, error, params });
  }

  // API-specific logging
  apiRequest(method: string, path: string, params?: any): void {
    this.info(`API request: ${method} ${path}`, {
      method,
      path,
      params: this.sanitizeParams(params),
      action: 'api_request'
    });
  }

  apiResponse(method: string, path: string, statusCode: number, duration: number): void {
    this.info(`API response: ${method} ${path}`, {
      method,
      path,
      statusCode,
      duration,
      action: 'api_response'
    });
  }

  apiError(method: string, path: string, error: Error, params?: any): void {
    this.error(`API error: ${method} ${path}`, {
      method,
      path,
      params: this.sanitizeParams(params),
      action: 'api_error'
    }, error);
  }

  // Workflow-specific logging
  workflowStart(workflowId: string, steps: string[]): void {
    this.info(`Workflow started: ${workflowId}`, {
      workflowId,
      steps,
      action: 'workflow_start'
    });
  }

  workflowStep(workflowId: string, stepId: string, status: string, duration?: number): void {
    this.info(`Workflow step: ${workflowId}/${stepId}`, {
      workflowId,
      stepId,
      status,
      duration,
      action: 'workflow_step'
    });
  }

  workflowEnd(workflowId: string, success: boolean, duration: number, result?: any): void {
    this.info(`Workflow completed: ${workflowId}`, {
      workflowId,
      success,
      duration,
      result: this.sanitizeResult(result),
      action: 'workflow_end'
    });
  }

  // Agent-specific logging
  agentAction(agentName: string, action: string, params?: any): void {
    this.info(`Agent action: ${agentName}/${action}`, {
      agent: agentName,
      action: 'agent_action',
      params: this.sanitizeParams(params)
    });
  }

  // Performance logging
  performance(operation: string, duration: number, context?: LogContext): void {
    this.info(`Performance: ${operation}`, {
      operation,
      duration,
      ...context,
      action: 'performance'
    });
  }

  // Security logging
  security(event: string, context?: LogContext): void {
    this.warn(`Security event: ${event}`, {
      event,
      ...context,
      action: 'security'
    });
  }

  // Data sanitization using security utilities
  private sanitizeParams(params: any): any {
    if (!params) return params;
    
    // Use centralized security utility for secret redaction
    const redactionResult = redactSecrets(params);
    return JSON.parse(redactionResult.redacted);
  }

  private sanitizeResult(result: any): any {
    if (!result) return result;
    
    // Limit result size for logging
    const resultStr = JSON.stringify(result);
    if (resultStr.length > 1000) {
      return { ...result, _truncated: true, _originalSize: resultStr.length };
    }
    
    return result;
  }

  // Create child logger with additional context
  child(context: LogContext): StructuredLogger {
    const child = new StructuredLogger();
    child.traceId = this.traceId;
    child.spanId = this.spanId;
    child.serviceName = this.serviceName;
    child.version = this.version;
    child.environment = this.environment;
    child.runtime = this.runtime;
    
    // Merge context
    const originalLog = child.log.bind(child);
    child.log = (level: LogLevel, message: string, logContext?: LogContext, error?: Error) => {
      const mergedContext = { ...context, ...logContext };
      originalLog(level, message, mergedContext, error);
    };
    
    return child;
  }
}

// Export singleton instance
export const logger = StructuredLogger.getInstance();

// Export convenience functions
export const startTrace = (traceId?: string) => logger.startTrace(traceId);
export const startSpan = (spanId?: string) => logger.startSpan(spanId);
export const endTrace = () => logger.endTrace();
export const getCurrentTraceId = () => logger.getCurrentTraceId();
export const getCurrentSpanId = () => logger.getCurrentSpanId();

// Export logging functions
export const debug = (message: string, context?: LogContext) => logger.debug(message, context);
export const info = (message: string, context?: LogContext) => logger.info(message, context);
export const warn = (message: string, context?: LogContext) => logger.warn(message, context);
export const error = (message: string, context?: LogContext, err?: Error) => logger.error(message, context, err);
export const fatal = (message: string, context?: LogContext, err?: Error) => logger.fatal(message, context, err);

// Export specialized logging functions
export const toolStart = (toolName: string, params?: any) => logger.toolStartLegacy(toolName, params);
export const toolEnd = (toolName: string, duration: number, success: boolean, result?: any) => 
  logger.toolEndLegacy(toolName, duration, success, result);
export const toolError = (toolName: string, error: Error, params?: any) => logger.toolErrorLegacy(toolName, error, params);

export const apiRequest = (method: string, path: string, params?: any) => logger.apiRequest(method, path, params);
export const apiResponse = (method: string, path: string, statusCode: number, duration: number) => 
  logger.apiResponse(method, path, statusCode, duration);
export const apiError = (method: string, path: string, error: Error, params?: any) => 
  logger.apiError(method, path, error, params);

export const workflowStart = (workflowId: string, steps: string[]) => logger.workflowStart(workflowId, steps);
export const workflowStep = (workflowId: string, stepId: string, status: string, duration?: number) => 
  logger.workflowStep(workflowId, stepId, status, duration);
export const workflowEnd = (workflowId: string, success: boolean, duration: number, result?: any) => 
  logger.workflowEnd(workflowId, success, duration, result);

export const agentAction = (agentName: string, action: string, params?: any) => 
  logger.agentAction(agentName, action, params);

export const performance = (operation: string, duration: number, context?: LogContext) => 
  logger.performance(operation, duration, context);

export const security = (event: string, context?: LogContext) => logger.security(event, context);

// Export child logger creator
export const createChildLogger = (context: LogContext) => logger.child(context);
