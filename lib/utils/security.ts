// lib/utils/security.ts
/**
 * Production-Grade Security Utilities
 * Provides security hardening for webhooks, secrets, and domain validation
 */

import { createHmac, timingSafeEqual, randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { logger, security } from './structured-logger';
import { securityConfig } from '../config/security.config';

export interface SecurityConfig {
  webhookSecret?: string;
  allowedDomains?: string[];
  maxRequestSize?: number;
  rateLimitWindow?: number;
  rateLimitMax?: number;
}

export interface WebhookValidationResult {
  isValid: boolean;
  signature?: string;
  timestamp?: number;
  error?: string;
}

export interface DomainValidationResult {
  isAllowed: boolean;
  domain: string;
  error?: string;
}

export interface SecretRedactionResult {
  original: string;
  redacted: string;
  redactedFields: string[];
}

class SecurityManager {
  private static instance: SecurityManager;
  private config: SecurityConfig;
  private rateLimitMap: Map<string, { count: number; resetTime: number }> = new Map();

  constructor(config: SecurityConfig = {}) {
    this.config = {
      webhookSecret: securityConfig.webhooks.secretKey,
      allowedDomains: securityConfig.domains.allowed,
      maxRequestSize: securityConfig.requestSize.maxSize,
      rateLimitWindow: securityConfig.rateLimiting.windowMs,
      rateLimitMax: securityConfig.rateLimiting.maxRequests,
      ...config
    };
  }

  static getInstance(config?: SecurityConfig): SecurityManager {
    if (!SecurityManager.instance) {
      SecurityManager.instance = new SecurityManager(config);
    }
    return SecurityManager.instance;
  }

  // Webhook HMAC validation
  validateWebhookSignature(
    payload: string,
    signature: string,
    secret?: string
  ): WebhookValidationResult {
    try {
      const webhookSecret = secret || this.config.webhookSecret;
      
      if (!webhookSecret) {
        security('Webhook validation failed: No secret configured', {
          operation: 'webhook_validation',
          error: 'NO_SECRET_CONFIGURED'
        });
        return { isValid: false, error: 'No webhook secret configured' };
      }

      // Parse signature (format: sha256=hash)
      const [algorithm, hash] = signature.split('=');
      if (algorithm !== 'sha256') {
        security('Webhook validation failed: Unsupported algorithm', {
          operation: 'webhook_validation',
          algorithm,
          error: 'UNSUPPORTED_ALGORITHM'
        });
        return { isValid: false, error: 'Unsupported signature algorithm' };
      }

      // Generate expected signature
      const expectedSignature = createHmac('sha256', webhookSecret)
        .update(payload, 'utf8')
        .digest('hex');

      // Use timing-safe comparison
      const isValid = timingSafeEqual(
        Buffer.from(hash, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );

      if (!isValid) {
        security('Webhook validation failed: Invalid signature', {
          operation: 'webhook_validation',
          providedSignature: hash.substring(0, 8) + '...',
          expectedSignature: expectedSignature.substring(0, 8) + '...'
        });
      }

      return { isValid, signature: hash };
    } catch (error) {
      security('Webhook validation error', {
        operation: 'webhook_validation',
        error: error instanceof Error ? error.message : String(error)
      });
      return { isValid: false, error: 'Signature validation failed' };
    }
  }

  // Domain allowlist validation
  validateDomain(url: string): DomainValidationResult {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.toLowerCase();
      
      // Check if domain is in allowlist
      const isAllowed = this.config.allowedDomains!.length === 0 || 
        this.config.allowedDomains!.some(allowedDomain => {
          // Support wildcard domains
          if (allowedDomain.startsWith('*.')) {
            const baseDomain = allowedDomain.substring(2);
            return domain === baseDomain || domain.endsWith('.' + baseDomain);
          }
          return domain === allowedDomain;
        });

      if (!isAllowed) {
        security('Domain validation failed: Not in allowlist', {
          operation: 'domain_validation',
          domain,
          allowedDomains: this.config.allowedDomains
        });
        return { isAllowed: false, domain, error: 'Domain not in allowlist' };
      }

      return { isAllowed: true, domain };
    } catch (error) {
      security('Domain validation error', {
        operation: 'domain_validation',
        url,
        error: error instanceof Error ? error.message : String(error)
      });
      return { isAllowed: false, domain: url, error: 'Invalid URL format' };
    }
  }

  /**
   * Encrypt sensitive data (like API keys)
   */
  encrypt(text: string): string {
    try {
      const algorithm = 'aes-256-gcm';
      const key = process.env.ENCRYPTION_KEY || 'your-32-character-encryption-key-here-make-it-long-enough';
      const encryptionKey = key.length >= 32 ? key.substring(0, 32) : key.padEnd(32, '0');

      const iv = randomBytes(16);
      const cipher = createCipheriv(algorithm, encryptionKey, iv);

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      // Return format: iv:authTag:encryptedData
      return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    } catch (error) {
      logger.error('Encryption failed:', { error: error instanceof Error ? error.message : String(error) });
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt sensitive data (like API keys)
   */
  decrypt(encryptedText: string): string {
    try {
      const algorithm = 'aes-256-gcm';
      const key = process.env.ENCRYPTION_KEY || 'your-32-character-encryption-key-here-make-it-long-enough';
      const encryptionKey = key.length >= 32 ? key.substring(0, 32) : key.padEnd(32, '0');

      const parts = encryptedText.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];

      const decipher = createDecipheriv(algorithm, encryptionKey, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      logger.error('Decryption failed:', { error: error instanceof Error ? error.message : String(error) });
      throw new Error('Failed to decrypt data');
    }
  }

  // Request size validation
  validateRequestSize(content: string | Buffer): boolean {
    const size = Buffer.byteLength(content);
    const isValid = size <= this.config.maxRequestSize!;
    
    if (!isValid) {
      security('Request size validation failed', {
        operation: 'request_size_validation',
        size,
        maxSize: this.config.maxRequestSize,
        error: 'REQUEST_TOO_LARGE'
      });
    }
    
    return isValid;
  }

  // Rate limiting
  checkRateLimit(identifier: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const windowStart = now - this.config.rateLimitWindow!;
    
    // Clean up old entries
    for (const [key, value] of this.rateLimitMap.entries()) {
      if (value.resetTime < windowStart) {
        this.rateLimitMap.delete(key);
      }
    }
    
    const current = this.rateLimitMap.get(identifier);
    const resetTime = now + this.config.rateLimitWindow!;
    
    if (!current) {
      this.rateLimitMap.set(identifier, { count: 1, resetTime });
      return { allowed: true, remaining: this.config.rateLimitMax! - 1, resetTime };
    }
    
    if (current.count >= this.config.rateLimitMax!) {
      security('Rate limit exceeded', {
        operation: 'rate_limit_check',
        identifier: identifier.substring(0, 8) + '...',
        count: current.count,
        limit: this.config.rateLimitMax
      });
      return { allowed: false, remaining: 0, resetTime: current.resetTime };
    }
    
    current.count++;
    return { allowed: true, remaining: this.config.rateLimitMax! - current.count, resetTime };
  }

  // Secret redaction
  redactSecrets(data: any, sensitiveFields: string[] = ['password', 'token', 'key', 'secret', 'auth', 'credential']): SecretRedactionResult {
    const redactedFields: string[] = [];
    
    function redactObject(obj: any, path: string = ''): any {
      if (obj === null || typeof obj !== 'object') {
        return obj;
      }
      
      if (Array.isArray(obj)) {
        return obj.map((item, index) => redactObject(item, `${path}[${index}]`));
      }
      
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
          result[key] = '[REDACTED]';
          redactedFields.push(currentPath);
        } else if (typeof value === 'object' && value !== null) {
          result[key] = redactObject(value, currentPath);
        } else {
          result[key] = value;
        }
      }
      
      return result;
    }
    
    const redacted = redactObject(data);
    const original = JSON.stringify(data);
    const redactedStr = JSON.stringify(redacted);
    
    return {
      original,
      redacted: redactedStr,
      redactedFields
    };
  }

  // Input sanitization
  sanitizeInput(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/['"]/g, '') // Remove quotes
      .replace(/[;]/g, '') // Remove semicolons
      .trim();
  }

  // SQL injection prevention
  sanitizeSqlInput(input: string): string {
    return input
      .replace(/[';]/g, '') // Remove single quotes and semicolons
      .replace(/--/g, '') // Remove SQL comments
      .replace(/\/\*/g, '') // Remove SQL block comments
      .replace(/\*\//g, '')
      .trim();
  }

  // XSS prevention
  sanitizeHtml(input: string): string {
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  // Generate secure random string
  generateSecureToken(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
  }

  // Validate API key format
  validateApiKey(apiKey: string): boolean {
    // Basic validation - should be at least 20 characters and contain alphanumeric characters
    const isValid = /^[a-zA-Z0-9]{20,}$/.test(apiKey);
    
    if (!isValid) {
      security('Invalid API key format', {
        operation: 'api_key_validation',
        keyLength: apiKey.length,
        error: 'INVALID_API_KEY_FORMAT'
      });
    }
    
    return isValid;
  }

  // Get security configuration
  getConfig(): SecurityConfig {
    return { ...this.config };
  }

  // Update security configuration
  updateConfig(newConfig: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };
    security('Security configuration updated', {
      operation: 'config_update',
      updatedFields: Object.keys(newConfig)
    });
  }

  // Get security metrics
  getSecurityMetrics(): {
    rateLimitEntries: number;
    allowedDomains: number;
    maxRequestSize: number;
    rateLimitWindow: number;
    rateLimitMax: number;
  } {
    return {
      rateLimitEntries: this.rateLimitMap.size,
      allowedDomains: this.config.allowedDomains!.length,
      maxRequestSize: this.config.maxRequestSize!,
      rateLimitWindow: this.config.rateLimitWindow!,
      rateLimitMax: this.config.rateLimitMax!
    };
  }
}

// Export singleton instance
export const securityManager = SecurityManager.getInstance();

// Export convenience functions
export const validateWebhookSignature = (payload: string, signature: string, secret?: string) =>
  securityManager.validateWebhookSignature(payload, signature, secret);

export const validateDomain = (url: string) => securityManager.validateDomain(url);

export const validateRequestSize = (content: string | Buffer) => securityManager.validateRequestSize(content);

export const checkRateLimit = (identifier: string) => securityManager.checkRateLimit(identifier);

export const redactSecrets = (data: any, sensitiveFields: string[] = securityConfig.logging.sensitiveFields) =>
  securityManager.redactSecrets(data, sensitiveFields);

export const sanitizeInput = (input: string) => securityManager.sanitizeInput(input);

export const sanitizeSqlInput = (input: string) => securityManager.sanitizeSqlInput(input);

export const sanitizeHtml = (input: string) => securityManager.sanitizeHtml(input);

export const generateSecureToken = (length?: number) => securityManager.generateSecureToken(length);

export const validateApiKey = (apiKey: string) => securityManager.validateApiKey(apiKey);

export const getSecurityConfig = () => securityManager.getConfig();

export const updateSecurityConfig = (config: Partial<SecurityConfig>) => securityManager.updateConfig(config);

export const getSecurityMetrics = () => securityManager.getSecurityMetrics();

// Export encrypt/decrypt functions for API key management
export const encrypt = (text: string) => securityManager.encrypt(text);
export const decrypt = (encryptedText: string) => securityManager.decrypt(encryptedText);
