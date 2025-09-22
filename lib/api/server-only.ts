// Server-only API services that should not be imported in client components
// This file contains imports that are only available on the server side

import { generateUUID } from "../utils/uuid";
import type { OrchestrationStep, OrchestrationGoal } from "../orchestration/shared/types";

export type WorkflowExecutionRequest = {
  workflowName: string;
  steps: OrchestrationStep[];
  mode?: "sequential";        // extend to 'parallel' if wanted
};

export type OrchestrationResponse = {
  executionId: string;
  workflowName: string;
  startedAt: string;
  finishedAt?: string;
  status: "running" | "completed" | "failed";
  results: Array<{
    stepId: string;
    name: string;
    ok: boolean;
    output?: any;
    error?: string;
    startedAt: string;
    finishedAt: string;
  }>;
};

/* =========================
 * Runtime tool registry
 * =========================
 * This is a simplified version of the tool registry that can be used
 * in the frontend for type definitions and basic tool information.
 * The actual tool execution happens on the server side.
 */

export type Tool = {
  name: string;
  description: string;
  parameters: Record<string, any>;
  category: string;
  version: string;
};

export type ToolExecutionRequest = {
  toolName: string;
  parameters: Record<string, any>;
  context?: any;
};

export type ToolsResponse = {
  tools: Tool[];
  total: number;
  categories: string[];
};

export type IntegrationMetrics = {
  totalIntegrations: number;
  activeIntegrations: number;
  successRate: number;
  averageResponseTime: number;
  lastUpdated: string;
};

// Server-only tool implementations
export const createServerTools = () => {
  return {
    // HTTP tools
    http_get: async () => {
      const mod = await import("axios").catch(() => null);
      if (!mod) throw new Error("axios not available");
      const { default: axios } = mod;
      
      return {
        execute: async (p: any) => {
          try {
            const { url, headers = {}, timeout = 30000 } = p;
            if (!url) throw new Error("http_get: 'url' is required");
            
            const response = await axios.get(url, { headers, timeout });
            return { 
              success: true, 
              data: response.data, 
              status: response.status,
              headers: response.headers,
              url: response.config.url
            };
          } catch (error: any) {
            return { 
              success: false, 
              error: error.message,
              status: error.response?.status || 0,
              data: error.response?.data || null
            };
          }
        }
      };
    },

    http_post: async () => {
      const mod = await import("axios").catch(() => null);
      if (!mod) throw new Error("axios not available");
      const { default: axios } = mod;
      
      return {
        execute: async (p: any) => {
          try {
            const { url, data, headers = {}, timeout = 30000 } = p;
            if (!url) throw new Error("http_post: 'url' is required");
            
            const response = await axios.post(url, data, { headers, timeout });
            return { 
              success: true, 
              data: response.data, 
              status: response.status,
              headers: response.headers,
              url: response.config.url
            };
          } catch (error: any) {
            return { 
              success: false, 
              error: error.message,
              status: error.response?.status || 0,
              data: error.response?.data || null
            };
          }
        }
      };
    },

    // Email tools
    email_send: async () => {
      const mod = await import("nodemailer").catch(() => null);
      if (!mod) throw new Error("nodemailer not available");
      const { createTransport } = mod;
      
      return {
        execute: async (p: any) => {
          try {
            const { to, subject, text, html, from } = p;
            if (!to || !subject || !text) {
              throw new Error("email_send: 'to', 'subject', and 'text' are required");
            }
            
            const transporter = createTransport({
              host: process.env.SMTP_HOST || "smtp.gmail.com",
              port: parseInt(process.env.SMTP_PORT || "587"),
              secure: false,
              auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
              },
            });
            
            const info = await transporter.sendMail({
              from: from || process.env.SMTP_FROM,
              to,
              subject,
              text,
              html,
            });
            
            return { 
              success: true, 
              messageId: info.messageId,
              response: info.response,
              to,
              subject
            };
          } catch (error: any) {
            return { 
              success: false, 
              error: error.message,
              to: p.to,
              subject: p.subject
            };
          }
        }
      };
    },

    // Slack tools
    slack_notify: async () => {
      const mod = await import("@slack/web-api").catch(() => null);
      if (!mod) throw new Error("@slack/web-api not available");
      const { WebClient } = mod;
      
      return {
        execute: async (p: any) => {
          try {
            const { channel, text, blocks } = p;
            if (!channel || !text) {
              throw new Error("slack_notify: 'channel' and 'text' are required");
            }
            
            const client = new WebClient(process.env.SLACK_BOT_TOKEN);
            const result = await client.chat.postMessage({
              channel,
              text,
              blocks,
            });
            
            return { 
              success: true, 
              ts: result.ts,
              channel: result.channel,
              message: result.message
            };
          } catch (error: any) {
            return { 
              success: false, 
              error: error.message,
              channel: p.channel,
              text: p.text
            };
          }
        }
      };
    },

    // File tools
    file_read: async () => {
      const mod = await import("fs/promises").catch(() => null);
      if (!mod) throw new Error("fs/promises not available");
      const { readFile } = mod;
      
      return {
        execute: async (p: any) => {
          try {
            const { path, encoding = "utf8" } = p;
            if (!path) throw new Error("file_read: 'path' is required");
            
            const content = await readFile(path, encoding);
            return { 
              success: true, 
              content,
              path,
              size: content.length
            };
          } catch (error: any) {
            return { 
              success: false, 
              error: error.message,
              path: p.path
            };
          }
        }
      };
    },

    file_write: async () => {
      const mod = await import("fs/promises").catch(() => null);
      if (!mod) throw new Error("fs/promises not available");
      const { writeFile, mkdir } = mod;
      const pathMod = await import("path").catch(() => null);
      if (!pathMod) throw new Error("path not available");
      const { dirname } = pathMod;
      
      return {
        execute: async (p: any) => {
          try {
            const { path, content, encoding = "utf8" } = p;
            if (!path || content === undefined) {
              throw new Error("file_write: 'path' and 'content' are required");
            }
            
            // Ensure directory exists
            await mkdir(dirname(path), { recursive: true });
            
            await writeFile(path, content, encoding);
            return { 
              success: true, 
              path,
              size: content.length
            };
          } catch (error: any) {
            return { 
              success: false, 
              error: error.message,
              path: p.path
            };
          }
        }
      };
    },

    // Database tools
    db_query: async () => {
      const mod = await import("@prisma/client").catch(() => null);
      if (!mod) throw new Error("@prisma/client not available");
      const { PrismaClient } = mod;
      
      return {
        execute: async (p: any) => {
          try {
            const { entity, where = {}, select, include, orderBy, take = 100, skip = 0 } = p;
            if (!entity) throw new Error("db_query: 'entity' is required");
            
            const prisma = new PrismaClient();
            const delegate = (prisma as any)[entity];
            if (!delegate || typeof delegate.findMany !== "function") {
              throw new Error("Unknown Prisma entity: " + entity);
            }
            
            const result = await delegate.findMany({
              where,
              select,
              include,
              orderBy,
              take: Math.min(take, 1000),
              skip: Math.max(skip, 0)
            });
            
            await prisma.$disconnect();
            
            return { 
              success: true, 
              data: result, 
              count: result.length,
              entity,
              query: { where, select, include, orderBy, take, skip }
            };
          } catch (error: any) {
            return { 
              success: false, 
              error: error.message,
              entity: p.entity,
              query: p
            };
          }
        }
      };
    },

    db_upsert: async () => {
      const mod = await import("@prisma/client").catch(() => null);
      if (!mod) throw new Error("@prisma/client not available");
      const { PrismaClient } = mod;
      
      return {
        execute: async (p: any) => {
          try {
            const { entity, where, create, update } = p;
            if (!entity || !where) throw new Error("db_upsert: 'entity' and 'where' are required");
            if (!create || !update) throw new Error("db_upsert: 'create' and 'update' are required");
            
            const prisma = new PrismaClient();
            const delegate = (prisma as any)[entity];
            if (!delegate || typeof delegate.upsert !== "function") {
              throw new Error("Unknown Prisma entity: " + entity);
            }
            
            const result = await delegate.upsert({
              where,
              create,
              update
            });
            
            await prisma.$disconnect();
            
            return { 
              success: true, 
              data: result,
              entity,
              operation: "upsert"
            };
          } catch (error: any) {
            return { 
              success: false, 
              error: error.message,
              entity: p.entity,
              operation: "upsert"
            };
          }
        }
      };
    },

    db_create: async () => {
      const mod = await import("@prisma/client").catch(() => null);
      if (!mod) throw new Error("@prisma/client not available");
      const { PrismaClient } = mod;
      
      return {
        execute: async (p: any) => {
          try {
            const { entity, data } = p;
            if (!entity || !data) throw new Error("db_create: 'entity' and 'data' are required");
            
            const prisma = new PrismaClient();
            const delegate = (prisma as any)[entity];
            if (!delegate || typeof delegate.create !== "function") {
              throw new Error("Unknown Prisma entity: " + entity);
            }
            
            const result = await delegate.create({ data });
            
            await prisma.$disconnect();
            
            return { 
              success: true, 
              data: result,
              entity,
              operation: "create"
            };
          } catch (error: any) {
            return { 
              success: false, 
              error: error.message,
              entity: p.entity,
              operation: "create"
            };
          }
        }
      };
    },

    db_update: async () => {
      const mod = await import("@prisma/client").catch(() => null);
      if (!mod) throw new Error("@prisma/client not available");
      const { PrismaClient } = mod;
      
      return {
        execute: async (p: any) => {
          try {
            const { entity, where, data } = p;
            if (!entity || !where || !data) throw new Error("db_update: 'entity', 'where', and 'data' are required");
            
            const prisma = new PrismaClient();
            const delegate = (prisma as any)[entity];
            if (!delegate || typeof delegate.updateMany !== "function") {
              throw new Error("Unknown Prisma entity: " + entity);
            }
            
            const result = await delegate.updateMany({ where, data });
            
            await prisma.$disconnect();
            
            return { 
              success: true, 
              data: result,
              entity,
              operation: "update"
            };
          } catch (error: any) {
            return { 
              success: false, 
              error: error.message,
              entity: p.entity,
              operation: "update"
            };
          }
        }
      };
    },

    db_delete: async () => {
      const mod = await import("@prisma/client").catch(() => null);
      if (!mod) throw new Error("@prisma/client not available");
      const { PrismaClient } = mod;
      
      return {
        execute: async (p: any) => {
          try {
            const { entity, where } = p;
            if (!entity || !where) throw new Error("db_delete: 'entity' and 'where' are required");
            
            const prisma = new PrismaClient();
            const delegate = (prisma as any)[entity];
            if (!delegate || typeof delegate.deleteMany !== "function") {
              throw new Error("Unknown Prisma entity: " + entity);
            }
            
            const result = await delegate.deleteMany({ where });
            
            await prisma.$disconnect();
            
            return { 
              success: true, 
              data: result,
              entity,
              operation: "delete"
            };
          } catch (error: any) {
            return { 
              success: false, 
              error: error.message,
              entity: p.entity,
              operation: "delete"
            };
          }
        }
      };
    }
  };
};
