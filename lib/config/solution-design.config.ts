import { z } from "zod";

const ToolDepsSchema = z.record(z.array(z.string()));
const CostSchema = z.object({
  simple: z.object({ dev: z.number().positive(), infra: z.number().nonnegative(), maint: z.number().nonnegative() }),
  medium: z.object({ dev: z.number().positive(), infra: z.number().nonnegative(), maint: z.number().nonnegative() }),
  complex: z.object({ dev: z.number().positive(), infra: z.number().nonnegative(), maint: z.number().nonnegative() }),
  enterprise: z.object({ dev: z.number().positive(), infra: z.number().nonnegative(), maint: z.number().nonnegative() })
});

function parseJSON<T>(env: string | undefined, fallback: T, schema: z.ZodType<T>): T {
  if (!env) return fallback;
  try { return schema.parse(JSON.parse(env)); } catch { return fallback; }
}

const defaultToolDeps = {
  // Communication
  email_sender: ["nodemailer", "@types/nodemailer"],
  slack_notify: ["@slack/web-api"],
  webhook_trigger: [],       // use global fetch (Node >= 18)
  // Network
  http_request: [],          // prefer global fetch
  // Data
  csv_parse: ["@fast-csv/parse"],
  pdf_parse: ["pdf-parse"],
  json_validate: ["ajv"],
  hash_sha256: [],           // built-in 'crypto'
  // Storage
  file_write: [],            // built-in 'fs/promises'
  db_query: ["@prisma/client", "pg", "@types/pg"],
  db_upsert: ["@prisma/client", "pg", "@types/pg"]
};

const defaultCostModel = {
  simple:     { dev: 2000,  infra: 50,   maint: 300  },
  medium:     { dev: 5000,  infra: 150,  maint: 800  },
  complex:    { dev: 15000, infra: 400,  maint: 2000 },
  enterprise: { dev: 45000, infra: 1200, maint: 6000 }
};

export const TOOL_DEPS: Record<string, string[]> =
  parseJSON(process.env.AXON_TOOL_DEPS_JSON, defaultToolDeps, ToolDepsSchema);

export const COST_MODEL = parseJSON(process.env.AXON_COST_MODEL_JSON, defaultCostModel, CostSchema);

export function splitDeps(pkgs: string[]) {
  const dev = new Set<string>();
  const prod = new Set<string>();
  for (const p of pkgs) {
    if (!p) continue;
    if (p.startsWith("@types/") || p === "typescript") dev.add(p);
    else prod.add(p);
  }
  return { dependencies: Array.from(prod).sort(), devDependencies: Array.from(dev).sort() };
}
