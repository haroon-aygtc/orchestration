/**
 * data-validator - Advanced data validation tool
 *
 * Created by: Enhanced Tool System
 * Category: validation
 * Date: 2025-09-20T19:54:05.297Z
 */

import { z } from 'zod';
import { logger } from '../../utils/structured-logger';

// Input schema for data-validator
const inputSchema = z.object({
    data: z.any(),
    rules: z.array(z.string()).optional(),
    strict: z.boolean().default(false),
    schema: z.object({}).optional(),
    required: z.boolean().default(false),
    maxLength: z.number().optional(),
    minLength: z.number().optional(),
    pattern: z.string().optional(),
    type: z.enum(['string', 'number', 'boolean', 'object', 'array']).optional()
});

// Output schema for data-validator
const outputSchema = z.object({
  success: z.boolean(),
  statusCode: z.number(),
  message: z.string(),
  data: z.object({
    valid: z.boolean(),
    errors: z.array(z.string()).optional(),
    warnings: z.array(z.string()).optional(),
    score: z.number().optional()
  }).optional()
});

/**
 * Advanced data validation tool with comprehensive validation rules
 */
export const dataValidator = async (params: Record<string, any>) => {
  try {
    const { data, rules = [], strict = false, schema, required = false, maxLength, minLength, pattern, type } = params;

    const errors: string[] = [];
    const warnings: string[] = [];
    let score = 100; // Start with perfect score

    // 1. Required data check
    if (required && (data === null || data === undefined || data === '')) {
      errors.push('Data is required but not provided');
      score -= 30;
    }

    // 2. Null/undefined check
    if (data === null || data === undefined) {
      if (strict) {
        errors.push('Data cannot be null or undefined in strict mode');
        score -= 50;
      } else {
        warnings.push('Data is null or undefined');
        score -= 10;
      }
    }

    // 3. Type validation
    if (data !== null && data !== undefined && type) {
      const actualType = Array.isArray(data) ? 'array' : typeof data;
      if (actualType !== type) {
        errors.push(`Expected type ${type}, got ${actualType}`);
        score -= 40;
      }
    }

    // 4. String-specific validations
    if (typeof data === 'string') {
      if (maxLength && data.length > maxLength) {
        errors.push(`String length ${data.length} exceeds maximum ${maxLength}`);
        score -= 20;
      }

      if (minLength && data.length < minLength) {
        errors.push(`String length ${data.length} is below minimum ${minLength}`);
        score -= 20;
      }

      if (pattern && !new RegExp(pattern).test(data)) {
        errors.push(`String does not match required pattern: ${pattern}`);
        score -= 25;
      }
    }

    // 5. Object-specific validations
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      if (strict && Object.keys(data).length === 0) {
        warnings.push('Object is empty');
        score -= 5;
      }

      // Check for suspicious properties
      const suspiciousProps = ['__proto__', 'constructor', 'prototype'];
      for (const prop of suspiciousProps) {
        if (data.hasOwnProperty(prop)) {
          errors.push(`Suspicious property detected: ${prop}`);
          score -= 50;
        }
      }
    }

    // 6. Array-specific validations
    if (Array.isArray(data)) {
      if (strict && data.length === 0) {
        warnings.push('Array is empty');
        score -= 10;
      }

      if (maxLength && data.length > maxLength) {
        errors.push(`Array length ${data.length} exceeds maximum ${maxLength}`);
        score -= 15;
      }

      if (minLength && data.length < minLength) {
        errors.push(`Array length ${data.length} is below minimum ${minLength}`);
        score -= 15;
      }
    }

    // 7. Custom rules validation
    for (const rule of rules) {
      try {
        const ruleResult = await evaluateRule(data, rule);
        if (!ruleResult.valid) {
          errors.push(ruleResult.error || `Rule failed: ${rule}`);
          score -= 30;
        }
      } catch (error: any) {
        errors.push(`Invalid rule: ${rule} - ${error.message}`);
        score -= 25;
      }
    }

    // 8. Schema validation
    if (schema) {
      try {
        // Simple schema validation - in production you'd use a proper schema validator
        const schemaKeys = Object.keys(schema);
        const dataKeys = typeof data === 'object' && data !== null ? Object.keys(data) : [];

        for (const key of schemaKeys) {
          if (dataKeys.includes(key)) {
            // Key exists, could add type checking here
          } else if (strict) {
            errors.push(`Required schema key missing: ${key}`);
            score -= 20;
          }
        }
      } catch (error: any) {
        errors.push(`Schema validation error: ${error.message}`);
        score -= 25;
      }
    }

    // Ensure score doesn't go below 0
    score = Math.max(0, score);

    logger.info(`Data validation completed`, {
      score,
      errorCount: errors.length,
      warningCount: warnings.length,
      valid: errors.length === 0
    });

    return {
      success: errors.length === 0,
      statusCode: errors.length === 0 ? 200 : 400,
      message: errors.length === 0 ? `Data validation passed with score ${score}/100` : `Data validation failed with ${errors.length} errors`,
      data: {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
        score: score
      }
    };
  } catch (error: any) {
    return {
      success: false,
      statusCode: 500,
      message: `Data validation error: ${error?.message || 'Unknown error'}`,
      data: {
        valid: false,
        errors: [`Internal validation error: ${error?.message || 'Unknown error'}`]
      }
    };
  }
};

/**
 * Evaluate custom validation rules
 */
async function evaluateRule(data: any, rule: string): Promise<{ valid: boolean; error?: string }> {
  // Simple rule evaluator - in production you'd use a more sophisticated rule engine
  const rules = {
    'not-empty': () => {
      if (data === null || data === undefined || data === '') return { valid: false, error: 'Value cannot be empty' };
      return { valid: true };
    },
    'is-email': () => {
      if (typeof data !== 'string') return { valid: false, error: 'Value must be a string for email validation' };
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(data) ? { valid: true } : { valid: false, error: 'Invalid email format' };
    },
    'is-url': () => {
      if (typeof data !== 'string') return { valid: false, error: 'Value must be a string for URL validation' };
      try {
        new URL(data);
        return { valid: true };
      } catch {
        return { valid: false, error: 'Invalid URL format' };
      }
    },
    'is-number': () => {
      return typeof data === 'number' && !isNaN(data) ? { valid: true } : { valid: false, error: 'Value must be a valid number' };
    },
    'is-boolean': () => {
      return typeof data === 'boolean' ? { valid: true } : { valid: false, error: 'Value must be a boolean' };
    }
  };

  // Check if rule matches any predefined rule
  for (const [ruleName, validator] of Object.entries(rules)) {
    if (rule.includes(ruleName)) {
      return validator();
    }
  }

  // If no predefined rule matches, treat as custom rule and assume valid
  return { valid: true };
}

// Export tool metadata
export const dataValidatorMetadata = {
  name: 'data-validator',
  version: '1.0.0',
  category: 'validation',
  description: 'Advanced data validation tool with comprehensive validation rules',
  inputSchema,
  outputSchema,
  capabilities: ['validation', 'custom', 'security'],
  runtime: {
    requires: ['basic'],
    supports: ['sync', 'async']
  }
};

export default dataValidator;
