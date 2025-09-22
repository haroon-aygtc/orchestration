// Real Tools API - Execute actual tools on server-side
import { NextRequest, NextResponse } from 'next/server';
import { createRealTools, getToolMetrics, getToolCapabilities, validateToolConfiguration, getToolSystemHealth } from '@/lib/tools/registry';
import { z } from 'zod';
import { validateApiRequest } from '@/lib/middleware/security-middleware';
import { logger } from '@/lib/utils/structured-logger';
import { securityConfig } from '@/lib/env';

// Enhanced validation schemas
const ToolInputSchema = z.object({
  toolName: z.string()
    .min(1, 'Tool name is required')
    .max(100, 'Tool name too long')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Tool name contains invalid characters'),
  parameters: z.record(z.any()).optional().default({}),
});

const HealthQuerySchema = z.object({
  detailed: z.coerce.boolean().optional().default(false),
  include: z.array(z.enum(['metrics', 'capabilities', 'configuration'])).optional(),
});

// Standard API response schemas
const SuccessResponseSchema = z.object({
  success: z.literal(true),
  data: z.any(),
  timestamp: z.string().optional(),
});

const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.string().optional(),
  timestamp: z.string().optional(),
});

let tools: any = null;

// Helper functions
async function getTools() {
  if (!tools) {
    logger.info('Initializing REAL Tools', { context: 'tools-api' });
    tools = await createRealTools();
    logger.info('Real tools initialized', { 
      context: 'tools-api',
      toolCount: Object.keys(tools).length 
    });
  }
  return tools;
}

function validateRequestMethod(request: NextRequest, allowedMethods: string[]): boolean {
  return allowedMethods.includes(request.method);
}

function validateContentType(request: NextRequest): boolean {
  const contentType = request.headers.get('content-type');
  return !contentType || contentType.includes('application/json');
}

async function validateRequestSize(request: NextRequest, maxSizeBytes: number = 1024 * 1024): Promise<boolean> {
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > maxSizeBytes) {
    return false;
  }
  return true;
}

function createErrorResponse(error: string, code?: string, status: number = 400): NextResponse {
  return NextResponse.json({
    success: false,
    error,
    code,
    timestamp: new Date().toISOString()
  }, { status });
}

function createSuccessResponse(data: any, status: number = 200): NextResponse {
  return NextResponse.json({
    success: true,
    data,
    timestamp: new Date().toISOString()
  }, { status });
}


// GET /api/tools - List tools or health check
export async function GET(request: NextRequest) {
  // Method validation
  if (!validateRequestMethod(request, ['GET'])) {
    logger.warn('Invalid HTTP method for GET endpoint', { 
      method: request.method,
      context: 'tools-api' 
    });
    return createErrorResponse('Method not allowed', 'METHOD_NOT_ALLOWED', 405);
  }

  // Security validation including rate limiting
  const securityResult = await validateApiRequest(request);
  if (!securityResult.isValid) {
    logger.warn('Security validation failed', { 
      context: 'tools-api',
      error: securityResult.error?.message 
    });
    return createErrorResponse(
      securityResult.error?.message || 'Security validation failed',
      securityResult.error?.code || 'SECURITY_ERROR',
      securityResult.error?.statusCode || 403
    );
  }

  try {
    const url = new URL(request.url);
    
    // Health check endpoint
    if (url.pathname.endsWith('/health')) {
      logger.info('Health check requested', { context: 'tools-api' });
      
      const health = getToolSystemHealth();
      const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

      const responseData = {
        status: health.status,
        uptime: health.uptime,
        timestamp: health.timestamp,
        performance: health.performance,
        tools: health.tools,
        configuration: health.configuration
      };

      logger.info('Health check completed', { 
        context: 'tools-api',
        status: health.status,
        toolCount: health.tools?.total || health.tools?.available || 0
      });

      return createSuccessResponse(responseData, statusCode);
    }

    // Regular tools listing
    logger.info('Tools listing requested', { context: 'tools-api' });
    
    const toolRegistry = await getTools();
    const toolMetrics = getToolMetrics();
    const toolCapabilities = getToolCapabilities();

    const toolList = Object.keys(toolRegistry).map(name => ({
      name,
      description: `Enhanced ${name.replace(/_/g, ' ')} tool`,
      category: getToolCategory(name),
      capabilities: toolCapabilities[name] || [],
      enhanced: true,
      metrics: {
        executions: toolMetrics.summary.totalExecutions,
        errorRate: toolMetrics.summary.errorRate,
        cacheHitRate: toolMetrics.cache.hitRate
      }
    }));

    const configValidation = validateToolConfiguration();
    const systemHealth = getToolSystemHealth();

    const responseData = {
      tools: toolList,
      count: toolList.length,
      enhancedFeatures: [
        'Advanced caching with TTL',
        'Schema validation with Zod',
        'Capability-based access control',
        'Built-in timeout management',
        'Production monitoring & metrics',
        'Singleflight deduplication',
        'Configuration validation',
        'Health monitoring',
        'Per-tool error tracking'
      ],
      customTools: {
        available: true,
        templates: ['communication', 'data-processing', 'network', 'validation', 'utility'],
        creationCommand: 'node scripts/create-tool.js [tool-name] [category]'
      },
      configuration: {
        isValid: configValidation.isValid,
        warnings: configValidation.warnings,
        errors: configValidation.errors
      },
      health: {
        status: systemHealth.status,
        uptime: systemHealth.uptime,
        errorRate: systemHealth.performance.errorRate
      }
    };

    logger.info('Tools listing completed', { 
      context: 'tools-api',
      toolCount: toolList.length,
      healthStatus: systemHealth.status
    });

    return createSuccessResponse(responseData);
    
  } catch (error: any) {
    logger.error('Failed to list tools', { 
      context: 'tools-api',
      error: error.message,
      stack: error.stack
    });
    return createErrorResponse(
      'Failed to retrieve tools list',
      'TOOLS_LIST_ERROR',
      500
    );
  }
}

// POST /api/tools/execute - Execute a real tool
export async function POST(request: NextRequest) {
  // Method validation
  if (!validateRequestMethod(request, ['POST'])) {
    logger.warn('Invalid HTTP method for POST endpoint', { 
      method: request.method,
      context: 'tools-api' 
    });
    return createErrorResponse('Method not allowed', 'METHOD_NOT_ALLOWED', 405);
  }

  // Content type validation
  if (!validateContentType(request)) {
    logger.warn('Invalid content type', { 
      contentType: request.headers.get('content-type'),
      context: 'tools-api' 
    });
    return createErrorResponse('Content-Type must be application/json', 'INVALID_CONTENT_TYPE', 415);
  }

  // Request size validation
  if (!(await validateRequestSize(request))) {
    logger.warn('Request too large', { context: 'tools-api' });
    return createErrorResponse('Request entity too large', 'REQUEST_TOO_LARGE', 413);
  }

  // Security validation including rate limiting
  const securityResult = await validateApiRequest(request);
  if (!securityResult.isValid) {
    logger.warn('Security validation failed for tool execution', { 
      context: 'tools-api',
      error: securityResult.error?.message 
    });
    return createErrorResponse(
      securityResult.error?.message || 'Security validation failed',
      securityResult.error?.code || 'SECURITY_ERROR',
      securityResult.error?.statusCode || 403
    );
  }

  const startTime = Date.now();
  let toolName = 'unknown';

  try {
    // Parse and validate request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      logger.warn('Invalid JSON in request body', { 
        context: 'tools-api',
        error: error instanceof Error ? error.message : String(error)
      });
      return createErrorResponse('Invalid JSON in request body', 'INVALID_JSON', 400);
    }

    // Validate input schema
    let validatedInput;
    try {
      validatedInput = ToolInputSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn('Input validation failed', { 
          context: 'tools-api',
          errors: error.errors
        });
        return createErrorResponse(
          `Validation failed: ${error.errors.map(e => e.message).join(', ')}`,
          'VALIDATION_ERROR',
          400
        );
      }
      throw error;
    }

    const { toolName: requestToolName, parameters } = validatedInput;
    toolName = requestToolName;

    logger.info('Tool execution requested', { 
      context: 'tools-api',
      toolName,
      hasParameters: Object.keys(parameters).length > 0
    });

    // Get tool registry and validate tool exists
    const toolRegistry = await getTools();
    const tool = toolRegistry[toolName];
    
    if (!tool) {
      logger.warn('Tool not found', { 
        context: 'tools-api',
        toolName,
        availableTools: Object.keys(toolRegistry).slice(0, 5) // Only log first 5 for brevity
      });
      return createErrorResponse(
        `Tool '${toolName}' not found`,
        'TOOL_NOT_FOUND',
        404
      );
    }
    
    // Execute tool with timeout and error handling
    let result;
    try {
      result = await tool(parameters);
    } catch (toolError: any) {
      logger.error('Tool execution failed', { 
        context: 'tools-api',
        toolName,
        error: toolError.message,
        stack: toolError.stack,
        executionTime: Date.now() - startTime
      });
      return createErrorResponse(
        `Tool execution failed: ${toolError.message}`,
        'TOOL_EXECUTION_ERROR',
        500
      );
    }

    const executionTime = Date.now() - startTime;
    
    logger.info('Tool executed successfully', { 
      context: 'tools-api',
      toolName,
      executionTime,
      hasResult: !!result
    });
    
    return createSuccessResponse({
      toolName,
      result,
      executionTime
    });
    
  } catch (error: any) {
    const executionTime = Date.now() - startTime;
    
    logger.error('Tool execution system error', { 
      context: 'tools-api',
      toolName,
      error: error.message,
      stack: error.stack,
      executionTime
    });
    
    return createErrorResponse(
      'Internal server error during tool execution',
      'SYSTEM_ERROR',
      500
    );
  }
}

function getToolCategory(toolName: string): string {
  if (toolName.includes('email')) return 'communication';
  if (toolName.includes('http') || toolName.includes('webhook')) return 'network';
  if (toolName.includes('csv') || toolName.includes('pdf') || toolName.includes('json')) return 'data';
  if (toolName.includes('file') || toolName.includes('db')) return 'storage';
  if (toolName.includes('hash')) return 'security';
  return 'utility';
}
