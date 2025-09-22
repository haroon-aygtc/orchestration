// ──────────────────────────────────────────────────────────────────────────────
// File: lib/tools/registry/validation.ts
// Purpose: Zod input validation helper
// ──────────────────────────────────────────────────────────────────────────────
import { toolSchemas } from "./schemas";
export function validateToolInput(toolName: string, params: any): { success: boolean; error?: string; data?: any } {
  try {
    const schema = (toolSchemas as any)[toolName];
    if (schema) { const data = schema.input.parse(params); return { success: true, data }; }
    return { success: true, data: params };
  } catch (e: any) { return { success: false, error: e.message }; }
}