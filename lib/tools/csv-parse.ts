import type { ToolResult } from "../agents/shared/types";
import { ToolFn } from "../tools/run-tool";
import { AppError, ValidationError, ConfigurationError, AIServiceError, logError } from "../utils/error-handler";
import { createEnhancedTool } from "../tools/registry/index";

// Dynamic import for server-side only
const getCSVParser = async () => {
  if (typeof window !== 'undefined') {
    throw new ConfigurationError('CSV parsing is only available on the server side', {
      runtime: 'browser',
      feature: 'csv-parsing'
    });
  }
  
  try {
    const { parseString } = await import('@fast-csv/parse');
    return { parseString };
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), 'getCSVParser');
    throw new ConfigurationError('Failed to load CSV parser module', {
      originalError: error instanceof Error ? error.message : String(error)
    });
  }
};

// Error mapping function for CSV-specific errors
function mapCSVError(e: any): { statusCode: number; message: string; data?: Record<string, unknown> } {
  // If it's already an AppError, use its properties
  if (e instanceof AppError) {
    return { 
      statusCode: e.statusCode, 
      message: e.message, 
      data: { code: e.code, details: e.details } 
    };
  }

  const msg = String(e?.message ?? "Unknown error");

  // Map specific CSV parsing errors
  if (/invalid csv|malformed csv/i.test(msg)) {
    return { statusCode: 400, message: "Invalid CSV format", data: { error: msg } };
  }
  if (/encoding|utf-8|utf8/i.test(msg)) {
    return { statusCode: 400, message: "CSV encoding error", data: { error: msg } };
  }
  if (/quotes|quote/i.test(msg)) {
    return { statusCode: 400, message: "CSV quote parsing error", data: { error: msg } };
  }
  if (/delimiter|separator/i.test(msg)) {
    return { statusCode: 400, message: "CSV delimiter error", data: { error: msg } };
  }
  if (/headers|column/i.test(msg)) {
    return { statusCode: 400, message: "CSV header parsing error", data: { error: msg } };
  }
  if (/timeout/i.test(msg)) {
    return { statusCode: 408, message: "CSV parsing timed out", data: { error: msg } };
  }
  if (/memory|out of memory/i.test(msg)) {
    return { statusCode: 507, message: "Insufficient memory to parse CSV", data: { error: msg } };
  }

  return { statusCode: 500, message: "CSV parsing failed", data: { error: msg } };
}

export const csvParseToolFn: ToolFn = async (params): Promise<ToolResult> => {
  try {
    const { csv, headers = true } = params;
    
    // Input validation
    if (!csv) {
      throw new ValidationError("csv_parse: 'csv' string required", {
        parameter: "csv",
        received: typeof csv,
        value: csv
      });
    }

    if (typeof csv !== 'string') {
      throw new ValidationError("csv_parse: 'csv' must be a string", {
        parameter: "csv",
        received: typeof csv,
        value: csv
      });
    }

    if (csv.length === 0) {
      throw new ValidationError("csv_parse: 'csv' cannot be empty", {
        parameter: "csv",
        received: "empty string",
        value: csv
      });
    }

    // Check for reasonable size limit (10MB)
    const MAX_CSV_SIZE = 10 * 1024 * 1024; // 10MB
    if (csv.length > MAX_CSV_SIZE) {
      throw new ValidationError("csv_parse: CSV content too large", {
        parameter: "csv",
        received: `${csv.length} characters`,
        maxSize: MAX_CSV_SIZE
      });
    }

    const { parseString } = await getCSVParser();
    const rows: any[] = [];

    await new Promise<void>((resolve, reject) => {
      parseString(csv, { headers })
        .on("data", (r: any) => rows.push(r))
        .on("end", () => resolve())
        .on("error", (e: any) => reject(e));
    });

    return { success: true, statusCode: 200, message: "CSV parsed", data: { rows, count: rows.length } };
  } catch (error: any) {
    logError(error instanceof Error ? error : new Error(String(error)), 'csvParseTool');
    const mappedError = mapCSVError(error);
    return { 
      success: false, 
      statusCode: mappedError.statusCode, 
      message: mappedError.message, 
      data: mappedError.data 
    };
  }
};

export const csvParseTool = createEnhancedTool("csv_parse", csvParseToolFn);