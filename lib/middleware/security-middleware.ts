// lib/middleware/security-middleware.ts
/**
 * Security Middleware for API Routes
 * Provides comprehensive security validation for all API endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  validateWebhookSignature, 
  validateDomain, 
  checkRateLimit, 
  redactSecrets,
  sanitizeInput,
  getSecurityMetrics
} from '../utils/security';
import { logger } from '../utils/structured-logger';
import { AppError, ValidationError, RateLimitError } from '../utils/error-handler';
import { generateUUID } from "../utils/uuid";

export interface SecurityMiddlewareConfig {
  requireWebhookSignature?: boolean;
  requireDomainValidation?: boolean;
  maxRequestSize?: number;
  rateLimitEnabled?: boolean;
  sensitiveFields?: string[];
}

export interface SecurityContext {
  requestId: string;
  clientIp: string;
  userAgent: string;
  timestamp: number;
  securityChecks: {
    webhookSignature?: boolean;
    domainValidation?: boolean;
    requestSize?: boolean;
    rateLimit?: boolean;
  };
}

class SecurityMiddleware {
  private static instance: SecurityMiddleware;
  private config: SecurityMiddlewareConfig;

  constructor(config: SecurityMiddlewareConfig = {}) {
    this.config = {
      requireWebhookSignature: false,
      requireDomainValidation: true,
      maxRequestSize: 10 * 1024 * 1024, // 10MB
      rateLimitEnabled: true,
      sensitiveFields: ['password', 'token', 'key', 'secret', 'auth', 'credential'],
      ...config
    };
  }

  static getInstance(config?: SecurityMiddlewareConfig): SecurityMiddleware {
    if (!SecurityMiddleware.instance) {
      SecurityMiddleware.instance = new SecurityMiddleware(config);
    }
    return SecurityMiddleware.instance;
  }

  // Main security middleware function
  async validateRequest(request: NextRequest): Promise<{ 
    isValid: boolean; 
    context: SecurityContext; 
    error?: AppError 
  }> {
    const requestId = generateUUID();
    const clientIp = this.getClientIp(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const timestamp = Date.now();

    const context: SecurityContext = {
      requestId,
      clientIp,
      userAgent,
      timestamp,
      securityChecks: {}
    };

    try {
      // Log API request
      logger.info('API request received', {
        method: request.method,
        url: request.url,
        requestId,
        clientIp,
        userAgent
      });

      // 1. Webhook signature validation
      if (this.config.requireWebhookSignature) {
        const signature = request.headers.get('x-hub-signature-256') || 
                         request.headers.get('x-signature') || 
                         request.headers.get('authorization');
        
        if (!signature) {
          throw new ValidationError('Webhook signature required', {
            requestId,
            clientIp,
            operation: 'webhook_signature_validation'
          });
        }

        const body = await request.text();
        const validation = validateWebhookSignature(body, signature);
        
        if (!validation.isValid) {
          logger.error('Webhook signature validation failed', {
            requestId,
            clientIp,
            operation: 'webhook_signature_validation',
            error: validation.error
          });
          throw new ValidationError('Invalid webhook signature', {
            requestId,
            clientIp,
            operation: 'webhook_signature_validation'
          });
        }

        context.securityChecks.webhookSignature = true;
      }

      // 2. Domain validation
      if (this.config.requireDomainValidation) {
        const referer = request.headers.get('referer');
        if (referer) {
          const domainValidation = validateDomain(referer);
          if (!domainValidation.isAllowed) {
            logger.error('Domain validation failed', {
              requestId,
              clientIp,
              domain: domainValidation.domain,
              operation: 'domain_validation'
            });
            throw new ValidationError('Domain not allowed', {
              requestId,
              clientIp,
              domain: domainValidation.domain,
              operation: 'domain_validation'
            });
          }
        }
        context.securityChecks.domainValidation = true;
      }

      // 3. Request size validation
      const contentLength = parseInt(request.headers.get('content-length') || '0');
      if (contentLength > this.config.maxRequestSize!) {
        logger.error('Request size validation failed', {
          requestId,
          clientIp,
          contentLength,
          maxSize: this.config.maxRequestSize,
          operation: 'request_size_validation'
        });
        throw new ValidationError('Request too large', {
          requestId,
          clientIp,
          contentLength,
          maxSize: this.config.maxRequestSize,
          operation: 'request_size_validation'
        });
      }
      context.securityChecks.requestSize = true;

      // 4. Rate limiting
      if (this.config.rateLimitEnabled) {
        const rateLimitResult = checkRateLimit(clientIp);
        if (!rateLimitResult.allowed) {
            logger.error('Rate limit exceeded', {
            requestId,
            clientIp,
            remaining: rateLimitResult.remaining,
            resetTime: rateLimitResult.resetTime,
            operation: 'rate_limit_validation'
          });
          throw new RateLimitError('Rate limit exceeded', {
            requestId,
            clientIp,
            remaining: rateLimitResult.remaining,
            resetTime: rateLimitResult.resetTime,
            operation: 'rate_limit_validation'
          });
        }
        context.securityChecks.rateLimit = true;
      }

      return { isValid: true, context };

    } catch (error) {
      const appError = error instanceof AppError ? error : new AppError(
        'Security validation failed',
        'SECURITY_VALIDATION_ERROR',
        400,
        true,
        { originalError: error instanceof Error ? error.message : String(error) }
      );

      logger.error('Security validation failed', {
        method: request.method,
        url: request.url,
        requestId,
        clientIp,
        userAgent
      });

      return { isValid: false, context, error: appError };
    }
  }

  // Sanitize request body
  sanitizeRequestBody(body: any): any {
    if (typeof body === 'string') {
      return sanitizeInput(body);
    }

    if (typeof body === 'object' && body !== null) {
      const sanitized = { ...body };
      
      // Recursively sanitize string values
      for (const [key, value] of Object.entries(sanitized)) {
        if (typeof value === 'string') {
          sanitized[key] = sanitizeInput(value);
        } else if (typeof value === 'object' && value !== null) {
          sanitized[key] = this.sanitizeRequestBody(value);
        }
      }
      
      return sanitized;
    }

    return body;
  }

  // Redact sensitive data from response
  redactResponseData(data: any): any {
    return redactSecrets(data, this.config.sensitiveFields).redacted;
  }

  // Create secure error response
  createSecureErrorResponse(error: AppError, context: SecurityContext): NextResponse {
    const redactedError = redactSecrets({
      message: error.message,
      code: error.code,
      details: error.details
    }, this.config.sensitiveFields);

    return NextResponse.json({
      success: false,
      error: redactedError.redacted,
      requestId: context.requestId,
      timestamp: new Date().toISOString()
    }, { status: error.statusCode });
  }

  // Create secure success response
  createSecureSuccessResponse(data: any, context: SecurityContext): NextResponse {
    const redactedData = this.redactResponseData(data);
    
    return NextResponse.json({
      success: true,
      data: redactedData,
      requestId: context.requestId,
      timestamp: new Date().toISOString()
    });
  }

  // Get client IP address
  private getClientIp(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const cfConnectingIp = request.headers.get('cf-connecting-ip');
    
    if (cfConnectingIp) return cfConnectingIp;
    if (realIp) return realIp;
    if (forwarded) return forwarded.split(',')[0].trim();
    
    return 'unknown';
  }

  // Update security configuration
  updateConfig(newConfig: Partial<SecurityMiddlewareConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Security middleware configuration updated', {
      operation: 'config_update',
      updatedFields: Object.keys(newConfig)
    });
  }

  // Get security metrics
  getMetrics(): any {
    return {
      ...getSecurityMetrics(),
      config: this.config
    };
  }
}

// Export singleton instance
export const securityMiddleware = SecurityMiddleware.getInstance();

// Export convenience functions
export const validateApiRequest = (request: NextRequest) => securityMiddleware.validateRequest(request);
export const sanitizeApiRequestBody = (body: any) => securityMiddleware.sanitizeRequestBody(body);
export const redactApiResponseData = (data: any) => securityMiddleware.redactResponseData(data);
export const createSecureApiErrorResponse = (error: AppError, context: SecurityContext) => 
  securityMiddleware.createSecureErrorResponse(error, context);
export const createSecureApiSuccessResponse = (data: any, context: SecurityContext) => 
  securityMiddleware.createSecureSuccessResponse(data, context);

// Higher-order function for API route protection
export function withSecurity<T extends any[], R>(
  handler: (request: NextRequest, context: SecurityContext, ...args: T) => Promise<R>,
  config?: SecurityMiddlewareConfig
) {
  const middleware = SecurityMiddleware.getInstance(config);
  
  return async (request: NextRequest, ...args: T): Promise<R> => {
    const validation = await middleware.validateRequest(request);
    
    if (!validation.isValid) {
      throw validation.error!;
    }
    
    return handler(request, validation.context, ...args);
  };
}

// Export types - SecurityContext is already exported inline above
