
// ──────────────────────────────────────────────────────────────────────────────
// File: lib/tools/inline/json-validate.ts
// Purpose: Inline tool factory – json_validate (AJV backed)
// ──────────────────────────────────────────────────────────────────────────────
import type { ToolResult } from "../../agents/shared/types";
import Ajv from "ajv"; import addFormats from "ajv-formats";
const ajv = new Ajv({ allErrors: true, strict: false }); addFormats(ajv);

type JsonValidateParams = { data: any; schema?: Record<string, any> };

export const jsonValidateImpl = async (params: JsonValidateParams): Promise<ToolResult> => {
  if (!params || typeof (params as any).data === "undefined") return { success: false, statusCode: 400, message: "json_validate: 'data' is required", data: null };
  const { data, schema } = params; try {
    const parsed = typeof data === "string" ? JSON.parse(data) : data;
    if (!schema) return { success: true, statusCode: 200, message: "JSON parsed successfully (no schema)", data: { parsed } };
    const validate = ajv.compile(schema); const valid = validate(parsed);
    if (!valid) return { success: false, statusCode: 422, message: "JSON validation failed", data: { errors: validate.errors } };
    return { success: true, statusCode: 200, message: "JSON is valid", data: { parsed } };
  } catch (e: any) { return { success: false, statusCode: 400, message: "Invalid JSON", data: { error: String(e?.message ?? e) } }; }
};

export const createJsonValidateTool = () => async (params: Record<string, any> = {}) => jsonValidateImpl(params as JsonValidateParams);

