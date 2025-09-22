import type { ToolResult } from "../agents/shared/types";
import { ToolFn } from "../tools/run-tool";
import { AppError, ValidationError, ConfigurationError, logError } from "../utils/error-handler";
import { createEnhancedTool } from "./registry/index";

interface PDFParseResult {
  numpages: number;
  numrender: number;
  info: unknown;
  metadata: unknown;
  text: string;
  version: string;
}

type PDFParseFunction = (buffer: Buffer) => Promise<PDFParseResult>;

// Lazy-loaded singleton to avoid repeated dynamic imports.
let _pdfParseFn: PDFParseFunction | null = null;

async function loadPdfParse(): Promise<PDFParseFunction> {
  // Fail closed on non-Node runtimes (e.g., Edge, Browser)
  const isNode = typeof process !== "undefined" && !!process.versions?.node;
  if (!isNode) {
    throw new ConfigurationError("PDF parsing requires Node.js runtime", { 
      runtime: typeof process !== "undefined" ? "browser/edge" : "unknown" 
    });
  }

  if (_pdfParseFn) return _pdfParseFn;

  try {
    // Support both CJS and ESM loaders
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const mod: any = await import("pdf-parse");
    const fn = typeof mod === "function" ? mod : mod?.default;
    if (typeof fn !== "function") {
    throw new ConfigurationError("pdf-parse did not export a function", {
      code: "MODULE_BAD_EXPORT"
    });
    }
    _pdfParseFn = fn as PDFParseFunction;
    return _pdfParseFn;
  } catch (e: any) {
    logError(e instanceof Error ? e : new Error(String(e)), "loadPdfParse");
    throw new ConfigurationError(`Failed to load pdf-parse: ${e?.message ?? "unknown"}`, {
      code: "MODULE_LOAD_FAILED",
      originalError: e?.message ?? "unknown"
    });
  }
}

// Robust Base64 decoder that also supports data URLs.
// Validates by round-tripping (decode -> encode) to ensure correctness.
function safeDecodeBase64(input: string): Buffer {
  // Strip potential data URL prefix
  const dataUrlMatch = input.match(/^data:application\/pdf;base64,(.*)$/i);
  const b64 = dataUrlMatch ? dataUrlMatch[1] : input;

  // Decode
  let buf: Buffer;
  try {
    buf = Buffer.from(b64, "base64");
  } catch {
    const err = new Error("Invalid base64 input");
    (err as any).code = "BASE64_INVALID";
    throw err;
  }

  // Validate by re-encoding; this catches many malformed inputs
  const re = buf.toString("base64").replace(/=+$/,"");
  const inNoPad = b64.replace(/=+$/,"");
  if (re !== inNoPad) {
    const err = new Error("Invalid base64 content (round-trip mismatch)");
    (err as any).code = "BASE64_INVALID";
    throw err;
  }
  return buf;
}

function normalizeText(s: string): string {
  // Normalize newlines + trim zero-width spaces etc.
  return s
    .replace(/\r\n?/g, "\n")
    .replace(/\u200B|\u200C|\u200D|\uFEFF/g, "")
    .trim();
}

function mapError(e: any): { statusCode: number; message: string; data?: Record<string, unknown> } {
  // If it's already an AppError, use its properties
  if (e instanceof AppError) {
    return { 
      statusCode: e.statusCode, 
      message: e.message, 
      data: { code: e.code, details: e.details } 
    };
  }

  const code = e?.code as string | undefined;
  const msg = String(e?.message ?? "Unknown error");

  if (code === "BASE64_INVALID") {
    return { statusCode: 400, message: "Invalid base64 format", data: { error: msg } };
  }
  if (code === "PAYLOAD_TOO_LARGE") {
    return { statusCode: 413, message: "PDF file too large", data: { error: msg } };
  }
  if (code === "RUNTIME_UNSUPPORTED") {
    return { statusCode: 503, message: "PDF parsing unavailable on this runtime", data: { error: msg } };
  }
  if (code === "MODULE_LOAD_FAILED" || code === "MODULE_BAD_EXPORT") {
    return { statusCode: 503, message: "PDF parsing module unavailable", data: { error: msg } };
  }
  if (/not a pdf/i.test(msg)) {
    return { statusCode: 400, message: "File is not a valid PDF", data: { error: msg } };
  }
  if (/encrypted/i.test(msg)) {
    return { statusCode: 400, message: "PDF is encrypted and cannot be parsed", data: { error: msg } };
  }
  if (/corrupt|corrupted|xref/i.test(msg)) {
    return { statusCode: 400, message: "PDF appears to be corrupted", data: { error: msg } };
  }
  if (/timeout/i.test(msg)) {
    return { statusCode: 504, message: "PDF parsing timed out", data: { error: msg } };
  }
  return { statusCode: 500, message: "PDF parsing failed", data: { error: msg } };
}

export const pdfParseToolFn: ToolFn = async (params): Promise<ToolResult> => {
  // Expected params: { bufferBase64: string, timeoutMs?: number }
  try {
    const { bufferBase64 } = params as Readonly<{ bufferBase64?: unknown; timeoutMs?: unknown }>;

    if (typeof bufferBase64 !== "string" || bufferBase64.length === 0) {
      throw new ValidationError("pdf_parse: 'bufferBase64' must be a non-empty string", {
        parameter: "bufferBase64",
        received: typeof bufferBase64,
        value: bufferBase64
      });
    }

    // Decode base64 robustly
    const buffer = safeDecodeBase64(bufferBase64);

    // Enforce size cap (50MB)
    const MAX_BYTES = 50 * 1024 * 1024;
    if (buffer.length > MAX_BYTES) {
      const e = new Error(`PDF exceeds ${MAX_BYTES} bytes`);
      (e as any).code = "PAYLOAD_TOO_LARGE";
      throw e;
    }

    // Load parser
    const pdfParse = await loadPdfParse();

    // Optional timeout (default 20s)
    const timeoutMs = Number((params as any).timeoutMs ?? 20000);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs));

    // pdf-parse does not take AbortSignal natively; race the promise instead.
    const parsePromise = pdfParse(buffer);

    let result: PDFParseResult;
    try {
      result = await Promise.race([
        parsePromise,
        new Promise<never>((_, rej) => {
          controller.signal.addEventListener("abort", () => rej(Object.assign(new Error("Parsing timeout"), { code: "TIMEOUT" })));
        })
      ]);
    } finally {
      clearTimeout(timeout);
    }

    if (!result || typeof result.text !== "string") {
      return {
        success: false,
        statusCode: 500,
        message: "pdf_parse: Invalid PDF or parsing failed",
        data: { error: "Parser returned no text" }
      };
    }

    const normalizedText = normalizeText(result.text);

    return {
      success: true,
      statusCode: 200,
      message: "PDF parsed successfully",
      data: {
        contentType: "application/pdf",
        text: normalizedText,
        textLength: normalizedText.length,
        numpages: result.numpages ?? null,
        numrender: result.numrender ?? null,
        info: result.info ?? null,
        metadata: result.metadata ?? null,
        version: result.version ?? null,
        // Very rough pages heuristic if numpages missing
        pagesEstimate: result.numpages ?? Math.max(1, Math.round(normalizedText.length / 2500))
      }
    };

  } catch (error: any) {
    const mapped = mapError(error);
    return {
      success: false,
      statusCode: mapped.statusCode,
      message: mapped.message,
      data: mapped.data ?? { error: "Unknown error" }
    };
  }
};

export const pdfParseTool = createEnhancedTool("pdf_parse", pdfParseToolFn);