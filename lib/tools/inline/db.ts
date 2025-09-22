// ──────────────────────────────────────────────────────────────────────────────
// File: lib/tools/inline/db.ts
// Purpose: Prisma-backed db_* implementations + factories (single deduped)
// ──────────────────────────────────────────────────────────────────────────────
import { requireCapability } from "../../utils/runtime-detection";
import { toolStart, toolEnd } from "../../utils/structured-logger";
import type { ToolResult } from "../../agents/shared/types";
import { createEnhancedTool } from "../registry";

export type DbQueryParams  = { entity: string; where?: any; select?: any; include?: any; orderBy?: any; take?: number; skip?: number };
export type DbUpsertParams = { entity: string; where: any; create: any; update: any };
export type DbCreateParams = { entity: string; data: any };
export type DbUpdateParams = { entity: string; where: any; data: any };
export type DbDeleteParams = { entity: string; where: any };

async function withPrisma<T>(fn: (prisma: any) => Promise<T>): Promise<ToolResult> {
  const start = Date.now(); toolStart("database_operation");
  try {
    requireCapability("database", "database_operation");
    const prismaModule: any = await import("@prisma/client");
    const PrismaClient = prismaModule?.PrismaClient || prismaModule?.default || prismaModule;
    const prisma = new PrismaClient();
    try { const result = await fn(prisma); toolEnd("database_operation", Date.now() - start, true, result); return { success: true, statusCode: 200, message: "Database operation successful", data: result }; }
    finally { await prisma.$disconnect().catch(() => undefined); }
  } catch (error: any) {
    toolEnd("database_operation", Date.now() - start, false, { error: String(error?.message ?? error) });
    return { success: false, statusCode: 500, message: "Database initialization/query failed", data: { error: String(error?.message ?? error) } };
  }
}

export const dbQueryImpl = async (p: DbQueryParams): Promise<ToolResult> => {
  const { entity, where = {}, select, include, orderBy, take = 100, skip = 0 } = p || ({} as DbQueryParams);
  if (!entity) return { success: false, statusCode: 400, message: "db_query: 'entity' is required", data: null };
  return withPrisma(async (prisma) => {
    const delegate = (prisma as any)[entity]; if (!delegate?.findMany) throw new Error(`Unknown Prisma entity delegate: ${entity}`);
    const rows = await delegate.findMany({ where, select, include, orderBy, take, skip }); return { rows, count: rows.length };
  });
};

export const dbUpsertImpl = async (p: DbUpsertParams): Promise<ToolResult> => {
  const { entity, where, create, update } = p || ({} as DbUpsertParams);
  if (!entity || !where || !create || !update) return { success: false, statusCode: 400, message: "db_upsert: 'entity', 'where', 'create', 'update' are required", data: null };
  return withPrisma(async (prisma) => { const d = (prisma as any)[entity]; if (!d?.upsert) throw new Error(`Unknown Prisma entity delegate: ${entity}`); const row = await d.upsert({ where, create, update }); return { row }; });
};

export const dbCreateImpl = async (p: DbCreateParams): Promise<ToolResult> => {
  const { entity, data } = p || ({} as DbCreateParams); if (!entity || !data) return { success: false, statusCode: 400, message: "db_create: 'entity' and 'data' are required", data: null };
  return withPrisma(async (prisma) => { const d = (prisma as any)[entity]; if (!d?.create) throw new Error(`Unknown Prisma entity delegate: ${entity}`); const row = await d.create({ data }); return { row }; });
};

export const dbUpdateImpl = async (p: DbUpdateParams): Promise<ToolResult> => {
  const { entity, where, data } = p || ({} as DbUpdateParams); if (!entity || !where || !data) return { success: false, statusCode: 400, message: "db_update: 'entity', 'where', 'data' are required", data: null };
  return withPrisma(async (prisma) => { const d = (prisma as any)[entity]; if (!d?.updateMany) throw new Error(`Unknown Prisma entity delegate: ${entity}`); const result = await d.updateMany({ where, data }); return { result }; });
};

export const dbDeleteImpl = async (p: DbDeleteParams): Promise<ToolResult> => {
  const { entity, where } = p || ({} as DbDeleteParams); if (!entity || !where) return { success: false, statusCode: 400, message: "db_delete: 'entity' and 'where' are required", data: null };
  return withPrisma(async (prisma) => { const d = (prisma as any)[entity]; if (!d?.deleteMany) throw new Error(`Unknown Prisma entity delegate: ${entity}`); const result = await d.deleteMany({ where }); return { result }; });
};

export const dbQueryTool = createEnhancedTool("db_query", dbQueryImpl);
export const dbUpsertTool = createEnhancedTool("db_upsert", dbUpsertImpl);
export const dbCreateTool = createEnhancedTool("db_create", dbCreateImpl);
export const dbUpdateTool = createEnhancedTool("db_update", dbUpdateImpl);
export const dbDeleteTool = createEnhancedTool("db_delete", dbDeleteImpl);

export const createDbQueryTool  = () => async (params: Record<string, any> = {}) => dbQueryImpl(params as DbQueryParams);
export const createDbUpsertTool = () => async (params: Record<string, any> = {}) => dbUpsertImpl(params as DbUpsertParams);
export const createDbCreateTool = () => async (params: Record<string, any> = {}) => dbCreateImpl(params as DbCreateParams);
export const createDbUpdateTool = () => async (params: Record<string, any> = {}) => dbUpdateImpl(params as DbUpdateParams);
export const createDbDeleteTool = () => async (params: Record<string, any> = {}) => dbDeleteImpl(params as DbDeleteParams);

