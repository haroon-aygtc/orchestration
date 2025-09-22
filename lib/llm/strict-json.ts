// LLM Response Validation - Strict JSON Parser with Zod Schema Validation
import { ZodSchema, ZodError } from "zod";

/**
 * Safely parse LLM responses with Zod schema validation
 * Handles providers that wrap JSON with prose and provides clear error messages
 */
export function parseWithSchema<T>(raw: unknown, schema: ZodSchema<T>): T {
  try {
    // Handle string responses (most common case)
    const obj = typeof raw === "string" ? JSON.parse(extractJson(raw)) : raw;
    
    // Validate with Zod schema
    const result = schema.safeParse(obj);
    
    if (!result.success) {
      throw new Error(`LLM schema validation failed: ${result.error.message}`);
    }
    
    return result.data;
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(`LLM response validation failed: ${error.message}`);
    }
    if (error instanceof SyntaxError) {
      throw new Error(`LLM response is not valid JSON: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Extract JSON from text that may contain prose around the JSON
 * Handles cases where LLM providers wrap JSON with explanatory text
 */
function extractJson(s: string): string {
  // First try to parse as-is
  try {
    JSON.parse(s);
    return s;
  } catch {
    // Look for JSON object at the end of the string
    const jsonMatch = s.match(/\{[\s\S]*\}$/);
    if (jsonMatch) {
      return jsonMatch[0];
    }
    
    // Look for JSON array at the end of the string
    const arrayMatch = s.match(/\[[\s\S]*\]$/);
    if (arrayMatch) {
      return arrayMatch[0];
    }
    
    // If no JSON found, return original string for better error message
    return s;
  }
}

/**
 * Parse LLM response with fallback for non-critical paths
 * Returns fallback value if parsing fails instead of throwing
 */
export function parseWithSchemaSafe<T>(
  raw: unknown, 
  schema: ZodSchema<T>, 
  fallback: T
): T {
  try {
    return parseWithSchema(raw, schema);
  } catch {
    return fallback;
  }
}
