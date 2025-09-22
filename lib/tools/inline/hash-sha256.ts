// ──────────────────────────────────────────────────────────────────────────────
// File: lib/tools/inline/hash-sha256.ts
// Purpose: Inline tool factory – hash_sha256
// ──────────────────────────────────────────────────────────────────────────────
import { requireCapability } from "../../utils/runtime-detection";
import type { ToolResult } from "../../agents/shared/types";
import { ToolFn } from "../run-tool";

export const createHashSha256Tool = () => async (params: Record<string, any> = {}): Promise<ToolResult> => {
  requireCapability("crypto", "hash_sha256");
  const crypto = await import("crypto");
  const input = params?.input;
  if (typeof input === "undefined") return { success: false, statusCode: 400, message: "hash_sha256: 'input' is required", data: null };
  const hash = crypto.createHash("sha256").update(String(input)).digest("hex");
  return { success: true, statusCode: 200, message: "Hash generated", data: { hash } };
};  

export const hashSha256Tool: ToolFn = createHashSha256Tool();