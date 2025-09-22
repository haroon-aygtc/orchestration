
// ──────────────────────────────────────────────────────────────────────────────
// File: lib/tools/registry/metadata.ts
// Purpose: Tool metadata + dynamic descriptions/categories/tags
// ──────────────────────────────────────────────────────────────────────────────
import { getRuntimeInfo as detectRuntime } from "../../utils/runtime-detection";
import { toolCapabilities } from "./capabilities";

export const toolMetadata = {
  email_sender:   { description: "Send emails via server transport (SMTP/provider)", category: "communication", tags: ["email","communication","notification"] },
  http_request:   { description: "Perform HTTP requests with headers/body",       category: "network",       tags: ["http","api","network","web"] },
  webhook_trigger:{ description: "Trigger outbound webhooks with JSON payloads",  category: "network",       tags: ["webhook","api","network"] },
  slack_notify:   { description: "Send messages to Slack via webhook",            category: "communication", tags: ["slack","notification","messaging"] },
  csv_parse:      { description: "Parse CSV into structured JSON",                category: "data",          tags: ["csv","parse","file"] },
  pdf_parse:      { description: "Extract text/metadata from PDF",                category: "data",          tags: ["pdf","parse","document"] },
  data_validator: { description: "Custom validation with configurable rules",     category: "custom",        tags: ["validation","custom","rules"] },
  file_write:     { description: "Write files to disk in a safe base dir",        category: "storage",       tags: ["file","write","storage","filesystem"] },
  json_validate:  { description: "Validate JSON against JSON Schema (AJV)",       category: "data",          tags: ["json","validate","schema"] },
  hash_sha256:    { description: "Generate SHA-256 digest for input",             category: "security",      tags: ["hash","sha256","crypto"] },
  db_query:       { description: "Query database via Prisma delegate",            category: "database",      tags: ["database","query","prisma","read"] },
  db_upsert:      { description: "Upsert via Prisma (unique key required)",       category: "database",      tags: ["database","upsert","prisma","write"] },
  db_create:      { description: "Create a new record via Prisma",                category: "database",      tags: ["database","create","prisma","write"] },
  db_update:      { description: "Update multiple records via Prisma",            category: "database",      tags: ["database","update","prisma","write"] },
  db_delete:      { description: "Delete multiple records via Prisma",            category: "database",      tags: ["database","delete","prisma","write"] },
} as const;

export const buildDynamicDescriptions = () => {
  const runtime = detectRuntime();
  return Object.keys(toolMetadata).reduce((acc, toolName) => {
    const m = (toolMetadata as any)[toolName];
    const caps = toolCapabilities[toolName] || [];
    acc[toolName] = `${m.description}. Runtime: ${runtime.environment}${caps.length ? ", Capabilities: " + caps.join(", ") : ""}`;
    return acc;
  }, {} as Record<string,string>);
};

export const buildCategories = () => {
  const categories: Record<string, string[]> = {};
  Object.entries(toolMetadata).forEach(([name, m]) => { const c = (m as any).category || "utility"; (categories[c] ||= []).push(name); });
  const cross = {
    network: ["webhook_trigger","http_request"],
    communication: ["slack_notify","webhook_trigger"],
    data: ["csv_parse","pdf_parse","json_validate"],
    security: ["hash_sha256","json_validate"],
    storage: ["file_write","db_query","db_upsert","db_create","db_update","db_delete"],
  } as Record<string,string[]>;
  for (const [c, arr] of Object.entries(cross)) { (categories[c] ||= []); arr.forEach(t => { if (!categories[c].includes(t)) categories[c].push(t); }); }
  return categories;
};

export const getToolTagsMap = () => Object.fromEntries(Object.entries(toolMetadata).map(([k,v]) => [k, (v as any).tags || []]));
