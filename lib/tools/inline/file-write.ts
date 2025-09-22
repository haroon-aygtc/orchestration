// ──────────────────────────────────────────────────────────────────────────────
// File: lib/tools/inline/file-write.ts
// Purpose: Hardened file_write implementation + factory
// ──────────────────────────────────────────────────────────────────────────────
import { requireCapability } from "../../utils/runtime-detection";
import { toolStart, toolEnd } from "../../utils/structured-logger";
import type { ToolResult } from "../../agents/shared/types";

export type FileWriteParams = { path: string; content: string | Uint8Array | Buffer; encoding?: "utf8" | "binary"; ensureDir?: boolean; baseDir?: string; maxSizeBytes?: number };

async function safeJoin(baseDir: string, userPath: string) {
  const path = await import("path");
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(resolvedBase, userPath);
  if (!resolvedTarget.startsWith(resolvedBase + path.sep) && resolvedTarget !== resolvedBase) throw new Error("Path traversal detected");
  return { path, resolvedBase, resolvedTarget };
}

export const fileWriteImpl = async (params: FileWriteParams): Promise<ToolResult> => {
  const start = Date.now(); toolStart("file_write", params);
  try {
    requireCapability("file-system", "file_write");
    const fs = await import("fs/promises");
    const { path: userPath, content, encoding = "utf8", ensureDir = true, baseDir = process.env.TOOL_FILE_BASE_DIR ?? "./storage", maxSizeBytes = parseInt(process.env.TOOL_FILE_MAX_BYTES || "10485760") } = params || ({} as FileWriteParams);
    if (!userPath) return { success: false, statusCode: 400, message: "file_write: 'path' is required", data: null };
    const payload = typeof content === "string" ? Buffer.from(content, encoding === "binary" ? "utf8" : encoding) : Buffer.from(content);
    if (payload.byteLength > maxSizeBytes) return { success: false, statusCode: 413, message: `file_write: content exceeds limit (${payload.byteLength} > ${maxSizeBytes})`, data: null };
    const { path, resolvedTarget } = await safeJoin(baseDir, userPath);
    if (ensureDir) await fs.mkdir(path.dirname(resolvedTarget), { recursive: true });
    await fs.writeFile(resolvedTarget, payload);
    toolEnd("file_write", Date.now() - start, true, { path: resolvedTarget });
    return { success: true, statusCode: 200, message: "File written", data: { path: resolvedTarget } };
  } catch (err: any) {
    toolEnd("file_write", Date.now() - start, false, { error: String(err?.message ?? err) });
    return { success: false, statusCode: 500, message: "File write failed", data: { error: String(err?.message ?? err) } };
  }
};

export const createFileWriteTool = () => async (params: Record<string, any> = {}) => fileWriteImpl(params as FileWriteParams);
