
// ──────────────────────────────────────────────────────────────────────────────
// File: lib/tools/registry/schemas.ts
// Purpose: Zod input/output schemas for each tool
// ──────────────────────────────────────────────────────────────────────────────
import { z } from "zod";

export const toolSchemas = {
  email_sender: {
    input: z.object({
      recipient: z.string().email(),
      subject: z.string().min(1),
      text: z.string().optional(),
      html: z.string().optional(),
      fromEmail: z.string().email().optional(),
      cc: z.array(z.string().email()).optional(),
      bcc: z.array(z.string().email()).optional(),
    }),
    output: z.object({
      success: z.boolean(),
      statusCode: z.number(),
      message: z.string(),
      data: z.object({ messageId: z.string().optional(), timestamp: z.string().optional() }).optional(),
    })
  },
  http_request: {
    input: z.object({
      url: z.string().url(),
      method: z.enum(["GET","POST","PUT","DELETE","PATCH"]).default("GET"),
      headers: z.record(z.string()).optional(),
      body: z.any().optional(),
      timeoutMs: z.number().positive().optional(),
      followRedirects: z.boolean().default(true),
    }),
    output: z.object({
      success: z.boolean(),
      statusCode: z.number(),
      message: z.string(),
      data: z.object({ body: z.any(), headers: z.record(z.string()), responseTime: z.number().optional() }).optional(),
    })
  },
  webhook_trigger: {
    input: z.object({
      url: z.string().url(),
      payload: z.any(),
      method: z.enum(["GET","POST","PUT","DELETE","PATCH"]).default("POST"),
      headers: z.record(z.string()).optional(),
      secret: z.string().optional(),
      timeout: z.number().positive().optional(),
    }),
    output: z.object({
      success: z.boolean(),
      statusCode: z.number(),
      message: z.string(),
      data: z.object({ webhookUrl: z.string(), method: z.string(), responseTime: z.number().optional() }).optional(),
    })
  },
  slack_notify: {
    input: z.object({
      webhookUrl: z.string().url().optional(),
      message: z.string().min(1),
      channel: z.string().optional(),
      username: z.string().optional(),
    }),
    output: z.object({ success: z.boolean(), statusCode: z.number(), message: z.string(), data: z.any().optional() })
  },
  csv_parse: {
    input: z.object({ csv: z.string().min(1), headers: z.boolean().default(true) }),
    output: z.object({ success: z.boolean(), statusCode: z.number(), message: z.string(), data: z.object({ rows: z.array(z.record(z.any())), count: z.number() }).optional() })
  },
  pdf_parse: {
    input: z.object({ bufferBase64: z.string().min(1), timeoutMs: z.number().optional() }),
    output: z.object({ success: z.boolean(), statusCode: z.number(), message: z.string(), data: z.object({ text: z.string().optional(), numpages: z.number().optional(), metadata: z.any().optional() }).optional() })
  },
  data_validator: {
    input: z.object({ data: z.any(), rules: z.array(z.string()).optional(), strict: z.boolean().default(false) }),
    output: z.object({ success: z.boolean(), statusCode: z.number(), message: z.string(), data: z.object({ valid: z.boolean(), errors: z.array(z.any()).optional() }).optional() })
  }
} as const;





