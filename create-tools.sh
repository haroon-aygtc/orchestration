#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Creating Real AI Agent Tools..."

# 1) Ensure deps (adjust if you use pnpm/yarn)
echo "📦 Installing dependencies..."
npm i -E nodemailer pdf-parse @fast-csv/parse ajv @prisma/client

# 2) Create folders
echo "📁 Creating directories..."
mkdir -p lib/tools
mkdir -p lib/retriever
mkdir -p lib/memory
mkdir -p lib/tasks
mkdir -p lib/agents

# 3) email-sender.ts
echo "📧 Creating email-sender.ts..."
cat > lib/tools/email-sender.ts <<'TS'
// path: lib/tools/email-sender.ts
import nodemailer from "nodemailer";
import type { ToolFn, ToolResult } from "../specialized-agents";

export const emailSender: ToolFn = async (params): Promise<ToolResult> => {
  const { recipient, subject, text, html, fromEmail } = params;
  if (!recipient) throw new Error("email_sender: 'recipient' is required");

  const transporter = nodemailer.createTransporter({
    host: process.env.SMTP_HOST!,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
  });

  const info = await transporter.sendMail({
    from: fromEmail || process.env.SMTP_USER!,
    to: recipient,
    subject: subject ?? "Message",
    text,
    html,
  });

  return { success: true, statusCode: 200, message: "Email sent", data: { messageId: info.messageId } };
};
TS

# 4) http-request.ts
echo "🌐 Creating http-request.ts..."
cat > lib/tools/http-request.ts <<'TS'
// path: lib/tools/http-request.ts
import type { ToolFn, ToolResult } from "../specialized-agents";

export const httpRequest: ToolFn = async (params): Promise<ToolResult> => {
  const { url, method = "GET", headers = {}, body, timeoutMs } = params;
  if (!url) throw new Error("http_request: 'url' is required");

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), Number(timeoutMs || 30000));
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    let data: any; try { data = JSON.parse(text); } catch { data = text; }
    return { success: res.ok, statusCode: res.status, message: res.statusText, data };
  } finally { clearTimeout(t); }
};
TS

# 5) webhook-trigger.ts
echo "🔗 Creating webhook-trigger.ts..."
cat > lib/tools/webhook-trigger.ts <<'TS'
// path: lib/tools/webhook-trigger.ts
import type { ToolFn, ToolResult } from "../specialized-agents";

export const webhookTrigger: ToolFn = async (params): Promise<ToolResult> => {
  const { url, payload, headers = {}, method = "POST" } = params;
  if (!url) throw new Error("webhook_trigger: 'url' is required");
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(payload ?? {}),
  });
  const data = await res.text();
  return { success: res.ok, statusCode: res.status, message: res.statusText, data };
};
TS

# 6) slack-notify.ts
echo "💬 Creating slack-notify.ts..."
cat > lib/tools/slack-notify.ts <<'TS'
// path: lib/tools/slack-notify.ts
import type { ToolFn } from "../specialized-agents";

export const slackNotify: ToolFn = async (params) => {
  const { webhookUrl = process.env.SLACK_WEBHOOK_URL, message, channel, username = "AI Agent" } = params;
  if (!webhookUrl) throw new Error("slack_notify: 'webhookUrl' (or SLACK_WEBHOOK_URL env) is required");
  if (!message) throw new Error("slack_notify: 'message' is required");
  const res = await fetch(webhookUrl, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: message, channel, username }),
  });
  return { success: res.ok, statusCode: res.status, message: res.statusText };
};
TS

# 7) csv-parse.ts
echo "📊 Creating csv-parse.ts..."
cat > lib/tools/csv-parse.ts <<'TS'
// path: lib/tools/csv-parse.ts
import { parseString } from "@fast-csv/parse";
import type { ToolFn, ToolResult } from "../specialized-agents";

export const csvParseTool: ToolFn = async (params): Promise<ToolResult> => {
  const { csv, headers = true } = params;
  if (!csv) throw new Error("csv_parse: 'csv' string required");
  const rows: any[] = [];
  await new Promise<void>((resolve, reject) => {
    parseString(csv, { headers })
      .on("data", (r: any) => rows.push(r))
      .on("end", () => resolve())
      .on("error", (e: any) => reject(e));
  });
  return { success: true, statusCode: 200, message: "CSV parsed", data: rows };
};
TS

# 8) pdf-parse.ts
echo "📄 Creating pdf-parse.ts..."
cat > lib/tools/pdf-parse.ts <<'TS'
// path: lib/tools/pdf-parse.ts
import pdf from "pdf-parse";
import type { ToolFn, ToolResult } from "../specialized-agents";

export const pdfParseTool: ToolFn = async (params): Promise<ToolResult> => {
  const { bufferBase64 } = params;
  if (!bufferBase64) throw new Error("pdf_parse: 'bufferBase64' required");
  const buf = Buffer.from(bufferBase64, "base64");
  const data = await pdf(buf);
  return { success: true, statusCode: 200, message: "PDF parsed", data: { text: data.text } };
};
TS

# 9) file-write.ts
echo "💾 Creating file-write.ts..."
cat > lib/tools/file-write.ts <<'TS'
// path: lib/tools/file-write.ts
import { writeFile, mkdir } from "fs/promises";
import { dirname } from "path";
import type { ToolFn } from "../specialized-agents";

export const fileWriteTool: ToolFn = async (params) => {
  const { path, content, encoding = "utf8", ensureDir = true } = params;
  if (!path) throw new Error("file_write: 'path' required");
  if (ensureDir) await mkdir(dirname(path), { recursive: true });
  const data = typeof content === "string" ? content : Buffer.from(content);
  await writeFile(path, data, encoding === "binary" ? undefined : { encoding });
  return { success: true, statusCode: 200, message: "File written", data: { path } };
};
TS

# 10) json-validate.ts
echo "✅ Creating json-validate.ts..."
cat > lib/tools/json-validate.ts <<'TS'
// path: lib/tools/json-validate.ts
import Ajv from "ajv";
import type { ToolFn } from "../specialized-agents";

const ajv = new Ajv({ allErrors: true, strict: false });

export const jsonValidateTool: ToolFn = async (params) => {
  const { data, schema } = params;
  if (!schema) throw new Error("json_validate: 'schema' required");
  const validate = ajv.compile(schema);
  const ok = validate(data);
  return {
    success: !!ok,
    statusCode: 200,
    message: ok ? "JSON is valid" : "JSON validation failed",
    data: { errors: validate.errors ?? [] },
  };
};
TS

# 11) hash-sha256.ts
echo "🔐 Creating hash-sha256.ts..."
cat > lib/tools/hash-sha256.ts <<'TS'
// path: lib/tools/hash-sha256.ts
import { createHash } from "crypto";
import type { ToolFn } from "../specialized-agents";

export const hashSha256Tool: ToolFn = async (params) => {
  const { input } = params;
  if (input === undefined) throw new Error("hash_sha256: 'input' required");
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input));
  const hash = createHash("sha256").update(buf).digest("hex");
  return { success: true, statusCode: 200, message: "Hashed", data: { hash } };
};
TS

# 12) db-query.ts
echo "🗄️ Creating db-query.ts..."
cat > lib/tools/db-query.ts <<'TS'
// path: lib/tools/db-query.ts
import { PrismaClient } from "@prisma/client";
import type { ToolFn } from "../specialized-agents";

const prisma = new PrismaClient();

export const dbQueryTool: ToolFn = async (params) => {
  const { entity, where = {}, select, orderBy, take = 100 } = params;
  if (!entity) throw new Error("db_query: 'entity' required");
  if (!["Vendor","VendorMetric","VendorDocument","RFQ","RFQDocument","RecommendationRun","Task","Memory"].includes(entity)) {
    throw new Error(`db_query: unsupported entity '${entity}'`);
  }
  // @ts-expect-error dynamic
  const data = await prisma[entity].findMany({ where, select, orderBy, take });
  return { success: true, statusCode: 200, message: "Query OK", data };
};

export const dbUpsertTool: ToolFn = async (params) => {
  const { entity, where, create, update } = params;
  if (!entity || !where || !create || !update) throw new Error("db_upsert: 'entity','where','create','update' required");
  if (!["Vendor","VendorMetric","VendorDocument","RFQ","RFQDocument"].includes(entity)) {
    throw new Error(`db_upsert: unsupported entity '${entity}'`);
  }
  // @ts-expect-error dynamic
  const data = await prisma[entity].upsert({ where, create, update });
  return { success: true, statusCode: 200, message: "Upsert OK", data };
};
TS

# 13) registry.ts
echo "📋 Creating registry.ts..."
cat > lib/tools/registry.ts <<'TS'
// path: lib/tools/registry.ts
import type { ToolRegistry } from "../specialized-agents";
import { emailSender } from "./email-sender";
import { httpRequest } from "./http-request";
import { webhookTrigger } from "./webhook-trigger";
import { slackNotify } from "./slack-notify";
import { csvParseTool } from "./csv-parse";
import { pdfParseTool } from "./pdf-parse";
import { fileWriteTool } from "./file-write";
import { jsonValidateTool } from "./json-validate";
import { hashSha256Tool } from "./hash-sha256";
import { dbQueryTool, dbUpsertTool } from "./db-query";

export const createRealTools = (): ToolRegistry => ({
  email_sender: emailSender,
  http_request: httpRequest,
  webhook_trigger: webhookTrigger,
  slack_notify: slackNotify,
  csv_parse: csvParseTool,
  pdf_parse: pdfParseTool,
  file_write: fileWriteTool,
  json_validate: jsonValidateTool,
  hash_sha256: hashSha256Tool,
  db_query: dbQueryTool,
  db_upsert: dbUpsertTool,
});
TS

echo ""
echo "✅ All tools created successfully!"
echo ""
echo "📝 Next steps:"
echo "1. Set environment variables:"
echo "   - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (for email)"
echo "   - SLACK_WEBHOOK_URL (for Slack notifications)"
echo "   - DATABASE_URL (for Prisma database)"
echo ""
echo "2. Run: chmod +x create-tools.sh && ./create-tools.sh"
echo ""
echo "3. Your agents now have REAL automation capabilities! 🚀"
