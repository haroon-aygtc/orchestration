import { hasCapability, getRuntimeInfo as detectRuntime } from "../../utils/runtime-detection";
import type { ToolResult } from "../../agents/shared/types";

const notAvailableFactory = (runtime: any) => async (): Promise<ToolResult> => ({ success: false, statusCode: 403, message: `Tool not available in ${runtime.environment} runtime`, data: null });

export const getServerTools = async () => {
  const runtime = detectRuntime();
  if (!hasCapability("file-system")) {
    const notAvailable = notAvailableFactory(runtime);
    return { emailSenderFn: notAvailable, csvParseToolFn: notAvailable, pdfParseToolFn: notAvailable, httpRequestFn: notAvailable, runToolFn: notAvailable, runtimeToolFn: notAvailable };
  }
  const [{ emailSenderFn }, { csvParseToolFn }, { pdfParseToolFn }, { httpRequestFn }, { runToolFn }] = await Promise.all([
    import("../email-sender"),
    import("../csv-parse"),     
    import("../pdf-parse"),     
    import("../http-request"),
    import("../run-tool"),
  ]);
  return { emailSenderFn, csvParseToolFn, pdfParseToolFn, httpRequestFn, runToolFn };
};
