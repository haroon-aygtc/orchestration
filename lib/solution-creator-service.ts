import fs from 'fs';
import path from 'path';
import { SolutionDesignAgent, type AutomationSolution } from './solution-design-agent';
import type { AgentTaskStore } from './agents/shared/types';

export interface SolutionCreationResult {
  solutionId: string;
  path: string;
  agents: string[];
  workflows: string[];
  runInstructions: string;
  packageInfo: {
    scripts(scripts: any): unknown;
    name: string;
    version: string;
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };
}

export class SolutionCreatorService {
  private designAgent: SolutionDesignAgent;

  constructor(taskStore?: AgentTaskStore) {
    this.designAgent = new SolutionDesignAgent(taskStore);
  }

  async createStandaloneSolution(
    userProblem: string,
    outputBasePath: string = './solutions',
    options: {
      includeUI?: boolean;
      includeMonitoring?: boolean;
      businessContext?: any;
    } = {}
  ): Promise<SolutionCreationResult> {
    if (!userProblem || !userProblem.trim()) {
      throw new Error("Problem description is required");
    }

    if (!fs.existsSync(outputBasePath)) {
      fs.mkdirSync(outputBasePath, { recursive: true });
    }

    // 1) Design
    const designTask = await this.designAgent.designSolution({
      userRequest: userProblem,
      outputPath: outputBasePath,
      includeUI: options.includeUI,
      includeMonitoring: options.includeMonitoring,
      businessContext: options.businessContext
    });

    if (designTask.status === "failed" || !designTask.output) {
      throw new Error(`Solution design failed: ${designTask.error}`);
    }

    const { solution, solutionId } = designTask.output;

    // Prefer split deps from agent; fall back to legacy field if needed
    const prodDeps = Array.isArray(solution.dependencies) ? solution.dependencies : [];
    const devDeps = Array.isArray(solution.devDependencies) ? solution.devDependencies : [];
    const legacyDeps = Array.isArray(designTask.output.requiredDependencies) ? designTask.output.requiredDependencies : [];
    const mergedProdDeps = prodDeps.length ? prodDeps : legacyDeps; // keep legacy compatibility

    // 2) FS layout
    const solutionPath = path.join(outputBasePath, solutionId);
    this.createDirectoryStructure(solutionPath);

    // 3) Files
    await this.generateSolutionFiles(solutionPath, solution);

    // 4) package.json (use split deps)
    const packageInfo = this.createPackageJson(solutionPath, solutionId, mergedProdDeps, devDeps);

    // 5) README
    this.generateDocumentation(solutionPath, solution, userProblem);

    return {
      solutionId,
      path: solutionPath,
      agents: solution.agents.map(a => a.name),
      workflows: solution.workflows.map(w => w.name),
      runInstructions: `cd ${solutionPath} && npm install && npm run build && npm start`,
      packageInfo
    };
  }

  private createDirectoryStructure(solutionPath: string): void {
    const directories = ['agents', 'workflows', 'core', 'tools', 'config', 'logs', 'dist'];
    fs.mkdirSync(solutionPath, { recursive: true });
    for (const dir of directories) {
      fs.mkdirSync(path.join(solutionPath, dir), { recursive: true });
    }
  }

  private async generateSolutionFiles(
    solutionPath: string, 
    solution: AutomationSolution
  ): Promise<void> {
    // Agents
    for (const agent of solution.agents) {
      const safeName = agent.name.replace(/[^\w.-]/g, '_');
      const agentPath = path.join(solutionPath, 'agents', `${safeName}.ts`);
      fs.writeFileSync(agentPath, agent.code, 'utf8');
    }

    // Workflows
    for (const workflow of solution.workflows) {
      const safeName = workflow.name.replace(/[^\w.-]/g, '_');
      const workflowPath = path.join(solutionPath, 'workflows', `${safeName}.yaml`);
      fs.writeFileSync(workflowPath, workflow.definition, 'utf8');
    }

    // Core infra
    this.generateCoreFiles(solutionPath);

    // Entry point
    const entryPath = path.join(solutionPath, 'index.ts');
    fs.writeFileSync(entryPath, solution.entryPoint, 'utf8');

    // tsconfig + env files
    this.generateTsConfig(solutionPath);
    this.generateEnvFiles(solutionPath);

    // Optional UI
    if (solution.uiComponents) {
      await this.generateUIFiles(solutionPath, solution.uiComponents);
    }
  }

  private generateCoreFiles(solutionPath: string): void {
    // BaseAgent
    const baseAgentCode = `export abstract class BaseAgent {
  protected name: string;

  constructor(name: string) { this.name = name; }

  abstract execute(action: string, input: any): Promise<any>;

  protected log(message: string, ...args: any[]): void {
    console.log(\`[\${this.name}] \${message}\`, ...args);
  }
  protected logError(message: string, error: any): void {
    console.error(\`[\${this.name}] ERROR: \${message}\`, error);
  }
}`;
    fs.writeFileSync(path.join(solutionPath, 'core', 'BaseAgent.ts'), baseAgentCode, 'utf8');

    // Runtime Tools
    const runtimeToolsCode = `/**
 * Runtime Tool Registry for Generated Solutions
 * 
 * Lazy-loads real implementations only when requested.
 * Works with Node >= 18 (global fetch). No axios/node-fetch.
 */

type Tool = { execute: (params: any) => Promise<any> } | ((params: any) => Promise<any>);
type ToolMap = Record<string, () => Promise<Tool | undefined>>;

/** Try both shapes: {execute()} or function */
export async function executeTool(tool: any, params: any) {
  if (!tool) throw new Error("tool not found");
  if (typeof tool === "function") return tool(params);
  if (typeof tool.execute === "function") return tool.execute(params);
  throw new Error("invalid tool interface");
}

export async function getTool(name: string) {
  const loader = REGISTRY[name];
  return loader ? await loader() : undefined;
}

export async function requireTool(name: string) {
  const t = await getTool(name);
  if (!t) throw new Error(\`tool not registered: \${name}\`);
  return t;
}

export function getAvailableTools(): string[] {
  return Object.keys(REGISTRY);
}

export function validateToolParams(name: string, params: any): { valid: boolean; error?: string } {
  const requiredParams = getRequiredParams(name);
  const missingParams = requiredParams.filter(param => !(param in params));
  
  if (missingParams.length > 0) {
    return { 
      valid: false, 
      error: \`Missing required parameters: \${missingParams.join(', ')}\` 
    };
  }
  
  return { valid: true };
}

export async function executeToolWithValidation(name: string, params: any): Promise<any> {
  const validation = validateToolParams(name, params);
  if (!validation.valid) {
    throw new Error(\`Tool validation failed: \${validation.error}\`);
  }
  
  const tool = await requireTool(name);
  return await executeTool(tool, params);
}

/* -------------------------- Real tool implementations -------------------------- */

const REGISTRY: ToolMap = {
  // Network
  http_request: async () => ({
    execute: async (p: any) => {
      const url = String(p?.url);
      const method = String(p?.method ?? "GET").toUpperCase();
      const headers = (p?.headers && typeof p.headers === "object") ? p.headers : {};
      const body = p?.body ? (typeof p.body === "string" ? p.body : JSON.stringify(p.body)) : undefined;
      
      try {
        const res = await fetch(url, { method, headers, body });
        const ct = res.headers.get("content-type") || "";
        const data = ct.includes("application/json") ? await res.json() : await res.text();
        return { 
          success: true, 
          status: res.status, 
          ok: res.ok, 
          headers: Object.fromEntries(res.headers.entries()), 
          data 
        };
      } catch (error: any) {
        return { 
          success: false, 
          error: error.message, 
          status: 0, 
          ok: false 
        };
      }
    }
  }),

  webhook_trigger: async () => ({
    execute: async (p: any) => {
      const url = String(p?.url);
      const headers = (p?.headers && typeof p.headers === "object") ? p.headers : {};
      const body = p?.body ? (typeof p.body === "string" ? p.body : JSON.stringify(p.body)) : undefined;
      
      try {
        const res = await fetch(url, { method: "POST", headers, body });
        return { 
          success: true, 
          status: res.status, 
          ok: res.ok 
        };
      } catch (error: any) {
        return { 
          success: false, 
          error: error.message, 
          status: 0, 
          ok: false 
        };
      }
    }
  }),

  // Communication
  email_sender: async () => {
    try {
      const mod = await import("nodemailer"); 
      const nodemailer = mod.default || mod;
      const transport = nodemailer.createTransporter({
        host: process.env.SMTP_HOST,
        port: +(process.env.SMTP_PORT || 587),
        secure: false,
        auth: process.env.SMTP_USER && process.env.SMTP_PASS ? { 
          user: process.env.SMTP_USER, 
          pass: process.env.SMTP_PASS 
        } : undefined
      });
      
      return {
        execute: async (p: any) => {
          try {
            const info = await transport.sendMail({
              from: p.from || process.env.SMTP_USER,
              to: p.to, 
              subject: p.subject, 
              text: p.text, 
              html: p.html || p.content
            });
            return { 
              success: true, 
              messageId: info.messageId, 
              accepted: info.accepted, 
              rejected: info.rejected 
            };
          } catch (error: any) {
            return { 
              success: false, 
              error: error.message 
            };
          }
        }
      };
    } catch (error: any) {
      return {
        execute: async () => ({ 
          success: false, 
          error: \`Email tool not available: \${error.message}\` 
        })
      };
    }
  },

  slack_notify: async () => {
    try {
      const mod = await import("@slack/web-api"); 
      const { WebClient } = mod as any;
      const client = new WebClient(process.env.SLACK_BOT_TOKEN);
      
      return { 
        execute: async (p: any) => {
          try {
            const result = await client.chat.postMessage({ 
              channel: p.channel, 
              text: p.text || p.message 
            });
            return { 
              success: true, 
              result 
            };
          } catch (error: any) {
            return { 
              success: false, 
              error: error.message 
            };
          }
        } 
      };
    } catch (error: any) {
      return {
        execute: async () => ({ 
          success: false, 
          error: \`Slack tool not available: \${error.message}\` 
        })
      };
    }
  },

  // Data
  csv_parse: async () => {
    try {
      const { parse } = await import("@fast-csv/parse");
      return {
        execute: async (p: any) => new Promise((resolve, reject) => {
          const rows: any[] = [];
          const stream = parse({ headers: p?.headers ?? true })
            .on("error", reject)
            .on("data", (r) => rows.push(r))
            .on("end", () => resolve({ success: true, data: rows }));
          
          if (typeof p?.csv === "string") {
            stream.write(p.csv); 
            stream.end();
          } else if (p?.filePath) {
            const fs = require('fs');
            fs.createReadStream(p.filePath).pipe(stream);
          } else if (p?.stream) {
            p.stream.pipe(stream);
          } else {
            reject(new Error("csv_parse: provide {csv:string}, {filePath:string}, or {stream:Readable}"));
          }
        })
      };
    } catch (error: any) {
      return {
        execute: async () => ({ 
          success: false, 
          error: \`CSV tool not available: \${error.message}\` 
        })
      };
    }
  },

  pdf_parse: async () => {
    try {
      const pdf = await import("pdf-parse");
      return { 
        execute: async (p: any) => {
          try {
            const result = pdf.default ? pdf.default(p.buffer) : (pdf as any)(p.buffer);
            return { 
              success: true, 
              data: { 
                text: result.text, 
                pages: result.numpages 
              } 
            };
          } catch (error: any) {
            return { 
              success: false, 
              error: error.message 
            };
          }
        } 
      };
    } catch (error: any) {
      return {
        execute: async () => ({ 
          success: false, 
          error: \`PDF tool not available: \${error.message}\` 
        })
      };
    }
  },

  json_validate: async () => {
    try {
      const mod = await import("ajv"); 
      const Ajv = (mod as any).default || mod as any;
      const ajv = new Ajv({ allErrors: true, strict: false });
      
      return {
        execute: async (p: any) => {
          try {
            const validate = ajv.compile(p.schema);
            const ok = validate(p.data);
            return { 
              success: true, 
              valid: ok, 
              errors: validate.errors || [] 
            };
          } catch (error: any) {
            return { 
              success: false, 
              error: error.message 
            };
          }
        }
      };
    } catch (error: any) {
      return {
        execute: async () => ({ 
          success: false, 
          error: \`JSON validation tool not available: \${error.message}\` 
        })
      };
    }
  },

  hash_sha256: async () => ({
    execute: async (p: any) => {
      try {
        const { createHash } = await import("crypto");
        const h = createHash("sha256");
        h.update(typeof p?.data === "string" ? p.data : JSON.stringify(p?.data ?? ""));
        return { 
          success: true, 
          hash: h.digest("hex") 
        };
      } catch (error: any) {
        return { 
          success: false, 
          error: error.message 
        };
      }
    }
  }),

  // Storage
  file_write: async () => ({
    execute: async (p: any) => {
      try {
        const fs = await import("fs/promises");
        const path = await import("path");
        
        const file = String(p?.path);
        const data = typeof p?.data === "string" ? p.data : JSON.stringify(p?.data ?? "");
        
        // Ensure directory exists
        if (p?.ensureDir !== false) {
          await fs.mkdir(path.dirname(file), { recursive: true });
        }
        
        await fs.writeFile(file, data, "utf8");
        return { 
          success: true, 
          path: file 
        };
      } catch (error: any) {
        return { 
          success: false, 
          error: error.message 
        };
      }
    }
  }),

  db_query: async () => {
    try {
      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();
      
      return {
        execute: async (p: any) => {
          try {
            const { entity, where = {}, select, include, orderBy, take = 100, skip = 0 } = p;
            if (!entity) throw new Error("db_query: 'entity' is required");
            
            // Get the Prisma delegate for the entity
            const delegate = (prisma as any)[entity];
            if (!delegate || typeof delegate.findMany !== "function") {  
              throw new Error("Unknown Prisma entity: " + entity);
            }
            
            // Execute the query with proper parameters
            const result = await delegate.findMany({
              where,
              select,
              include,
              orderBy,
              take: Math.min(take, 1000), // Limit to prevent large queries
              skip: Math.max(skip, 0)
            });
            
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
              entity: p.entity
            };
          } finally {
            await prisma.$disconnect();
          }
        }
      };
    } catch (error: any) {
      return {
        execute: async () => ({ 
          success: false, 
          error: \`Database tool not available: \${error.message}\` 
        })
      };
    }
  },

  db_upsert: async () => {
    try {
      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();
      
      return {
        execute: async (p: any) => {
          try {
            const { entity, where, create, update } = p;
            if (!entity || !where) throw new Error("db_upsert: 'entity' and 'where' are required");
            if (!create || !update) throw new Error("db_upsert: 'create' and 'update' are required");
            
            // Get the Prisma delegate for the entity
            const delegate = (prisma as any)[entity];
            if (!delegate || typeof delegate.upsert !== "function") {
              throw new Error("Unknown Prisma entity: " + entity);
            }
            
            // Execute the upsert operation
            const result = await delegate.upsert({
              where,
              create,
              update
            });
            
            return { 
              success: true, 
              data: result,
              entity,
              operation: 'upsert'
            };
          } catch (error: any) {
            return { 
              success: false, 
              error: error.message,
              entity: p.entity
            };
          } finally {
            await prisma.$disconnect();
          }
        }
      };
    } catch (error: any) {
      return {
        execute: async () => ({ 
          success: false, 
          error: \`Database tool not available: \${error.message}\` 
        })
      };
    }
  },

  db_create: async () => {
    try {
      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();
      
      return {
        execute: async (p: any) => {
          try {
            const { entity, data } = p;
            if (!entity || !data) throw new Error("db_create: 'entity' and 'data' are required");
            
            const delegate = (prisma as any)[entity];
            if (!delegate || typeof delegate.create !== "function") {
              throw new Error("Unknown Prisma entity: " + entity);
            }
            
            const result = await delegate.create({ data });
            
            return { 
              success: true, 
              data: result,
              entity,
              operation: 'create'
            };
          } catch (error: any) {
            return { 
              success: false, 
              error: error.message,
              entity: p.entity
            };
          } finally {
            await prisma.$disconnect();
          }
        }
      };
    } catch (error: any) {
      return {
        execute: async () => ({ 
          success: false, 
          error: \`Database tool not available: \${error.message}\` 
        })
      };
    }
  },

  db_update: async () => {
    try {
      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();
      
      return {
        execute: async (p: any) => {
          try {
            const { entity, where, data } = p;
            if (!entity || !where || !data) throw new Error("db_update: 'entity', 'where', and 'data' are required");
            
            const delegate = (prisma as any)[entity];
            if (!delegate || typeof delegate.updateMany !== "function") {
              throw new Error("Unknown Prisma entity: " + entity);
            }
            
            const result = await delegate.updateMany({ where, data });
            
            return { 
              success: true, 
              data: result,
              entity,
              operation: 'update'
            };
          } catch (error: any) {
            return { 
              success: false, 
              error: error.message,
              entity: p.entity
            };
          } finally {
            await prisma.$disconnect();
          }
        }
      };
    } catch (error: any) {
      return {
        execute: async () => ({ 
          success: false, 
          error: \`Database tool not available: \${error.message}\` 
        })
      };
    }
  },

  db_delete: async () => {
    try {
      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();
      
      return {
        execute: async (p: any) => {
          try {
            const { entity, where } = p;
            if (!entity || !where) throw new Error("db_delete: 'entity' and 'where' are required");
            
            const delegate = (prisma as any)[entity];
            if (!delegate || typeof delegate.deleteMany !== "function") {
              throw new Error("Unknown Prisma entity: " + entity);
            }
            
            const result = await delegate.deleteMany({ where });
            
            return { 
              success: true, 
              data: result,
              entity,
              operation: 'delete'
            };
          } catch (error: any) {
            return { 
              success: false, 
              error: error.message,
              entity: p.entity
            };
          } finally {
            await prisma.$disconnect();
          }
        }
      };
    } catch (error: any) {
      return {
        execute: async () => ({ 
          success: false, 
          error: \`Database tool not available: \${error.message}\` 
        })
      };
    }
  }
};

// Helper function to get required parameters for each tool
function getRequiredParams(name: string): string[] {
  const required: Record<string, string[]> = {
    email_sender: ["to", "subject", "content"],
    http_request: ["url"],
    webhook_trigger: ["url", "body"],
    slack_notify: ["channel", "text"],
    csv_parse: ["csv"],
    pdf_parse: ["buffer"],
    json_validate: ["data", "schema"],
    hash_sha256: ["data"],
    file_write: ["path", "data"],
    db_query: ["entity"],
    db_upsert: ["entity", "where", "create"]
  };
  
  return required[name] || [];
}`;
    fs.writeFileSync(path.join(solutionPath, 'tools', 'runtime.ts'), runtimeToolsCode, 'utf8');

    // WorkflowEngine
    const workflowEngineCode = `import * as yaml from 'yaml';
import * as fs from 'fs';
import * as path from 'path';
import { BaseAgent } from './BaseAgent';

export class WorkflowEngine {
  private agents: Map<string, BaseAgent> = new Map();
  private workflows: Map<string, any> = new Map();

  registerAgent(name: string, agent: BaseAgent): void {
    this.agents.set(name, agent);
    console.log(\`Registered agent: \${name}\`);
  }

  loadWorkflow(name: string, filePath: string): void {
    const fullPath = path.resolve(filePath);
    const content = fs.readFileSync(fullPath, 'utf8');
    const workflow = yaml.parse(content);
    this.workflows.set(name, workflow);
    console.log(\`Loaded workflow: \${name}\`);
  }

  async execute(workflowName: string): Promise<any> {
    const workflow = this.workflows.get(workflowName);
    if (!workflow) throw new Error(\`Workflow not found: \${workflowName}\`);

    console.log(\`Executing workflow: \${workflowName}\`);
    const results = [];

    for (const step of workflow.steps) {
      try {
        console.log(\`Executing step: \${step.name}\`);
        const agentName = step.config?.agent || step.agent || step.name; // tolerate different YAML shapes
        const action = step.config?.action || step.action || 'run';
        const input = step.config?.input ?? step.inputs ?? {};

        const agent = this.agents.get(agentName);
        if (!agent) throw new Error(\`Agent not found: \${agentName}\`);

        const result = await agent.execute(action, input);
        results.push({ step: step.name, result });
      } catch (error) {
        console.error(\`Step failed: \${step.name}\`, error);
        if (workflow.error_handling?.on_failure !== 'log_and_continue') throw error;
      }
    }
    return { workflow: workflowName, results };
  }
}`;
    fs.writeFileSync(path.join(solutionPath, 'core', 'WorkflowEngine.ts'), workflowEngineCode, 'utf8');

    // Logger (simple)
    const loggerCode = `export class Logger {
  constructor(private context: string) {}
  info(message: string, ...args: any[]): void { console.log(\`[\${new Date().toISOString()}] [\${this.context}] INFO: \${message}\`, ...args); }
  error(message: string, ...args: any[]): void { console.error(\`[\${new Date().toISOString()}] [\${this.context}] ERROR: \${message}\`, ...args); }
  warn(message: string, ...args: any[]): void { console.warn(\`[\${new Date().toISOString()}] [\${this.context}] WARN: \${message}\`, ...args); }
  debug(message: string, ...args: any[]): void { console.debug(\`[\${new Date().toISOString()}] [\${this.context}] DEBUG: \${message}\`, ...args); }
}`;
    fs.writeFileSync(path.join(solutionPath, 'core', 'Logger.ts'), loggerCode, 'utf8');
  }

  private generateTsConfig(solutionPath: string): void {
    const tsConfig = {
      compilerOptions: {
        target: "ES2020",
        module: "commonjs",
        lib: ["ES2020"],
        outDir: "./dist",
        rootDir: "./",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        resolveJsonModule: true,
        declaration: true,
        declarationMap: true,
        sourceMap: true
      },
      include: ["**/*.ts"],
      exclude: ["node_modules", "dist"]
    };
    fs.writeFileSync(path.join(solutionPath, 'tsconfig.json'), JSON.stringify(tsConfig, null, 2), 'utf8');
  }

  private generateEnvFiles(solutionPath: string): void {
    const envExample = `# Environment Configuration
NODE_ENV=production
LOG_LEVEL=info

# Example service configs
# DATABASE_URL=postgresql://user:password@localhost:5432/dbname
# API_KEY=your_api_key_here
# EMAIL_HOST=smtp.gmail.com
# EMAIL_PORT=587
`;
    fs.writeFileSync(path.join(solutionPath, '.env.example'), envExample, 'utf8');

    const gitignore = `node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
dist/
build/
.env
.env.*
logs/
*.log
pids/
*.pid
*.seed
coverage/
.vscode/
.idea/
.DS_Store
Thumbs.db
`;
    fs.writeFileSync(path.join(solutionPath, '.gitignore'), gitignore, 'utf8');
  }

  private createPackageJson(
    solutionPath: string, 
    solutionId: string, 
    prodDeps: string[],
    devDeps: string[]
  ): any {
    const packageInfo = {
      name: solutionId.toLowerCase().replace(/_/g, '-'),
      version: "1.0.0",
      description: "Generated automation solution",
      main: "dist/index.js",
      scripts: {
        build: "tsc",
        start: "node dist/index.js",
        dev: "ts-node index.ts",
        clean: "rm -rf dist",
        "build:watch": "tsc --watch"
      },
      dependencies: this.createDependencyMap(prodDeps),
      devDependencies: {
        ...this.createDevDependencyMap(devDeps),
        "typescript": "^5.4.0",
        "ts-node": "^10.9.2",
        "@types/node": "^20.12.7"
      },
      engines: { node: ">=18.0.0" },
      keywords: ["automation", "ai", "workflow"],
      author: "AI Agent Architecture",
      license: "MIT"
    };
    fs.writeFileSync(path.join(solutionPath, 'package.json'), JSON.stringify(packageInfo, null, 2), 'utf8');
    return packageInfo;
  }

  // Known stable versions (expand as needed). Unknown deps default to ^1.0.0.
  private createDependencyMap(dependencies: string[]): Record<string, string> {
    const versionMap: Record<string, string> = {
      // Core used by generated code
      "yaml": "^2.3.4",
      "zod": "^3.23.8",
      // Tool-based deps (align with your registry)
      "nodemailer": "^6.9.8",
      "@types/nodemailer": "^6.4.14",
      "@slack/web-api": "^7.0.0",
      "@prisma/client": "^5.18.0",
      "pg": "^8.11.3",
      "@types/pg": "^8.10.2",
      "@fast-csv/parse": "^5.0.0",
      "pdf-parse": "^1.1.1",
      "ajv": "^8.12.0"
      // intentionally no axios/node-fetch; Node >=18 has global fetch
    };
    const result: Record<string, string> = {};
    for (const dep of new Set(dependencies)) {
      result[dep] = versionMap[dep] || '^1.0.0';
    }
    return result;
  }

  private createDevDependencyMap(dependencies: string[]): Record<string, string> {
    const versionMap: Record<string, string> = {
      "@types/nodemailer": "^6.4.14",
      "@types/pg": "^8.10.2"
    };
    const result: Record<string, string> = {};
    for (const dep of new Set(dependencies)) {
      result[dep] = versionMap[dep] || '^1.0.0';
    }
    return result;
  }

  private generateDocumentation(
    solutionPath: string, 
    solution: AutomationSolution, 
    userProblem: string
  ): void {
    const flowLines = solution.workflows.map(workflow => {
      const names = workflow.steps.map(s => s.name).join(' → ');
      return `#### ${workflow.name}\n- **Steps:** ${workflow.steps.length}\n- **Flow:** ${names}\n`;
    }).join('\n');

    const infra = solution.infrastructure;
    const infraLines = `- **Database:** ${infra.database ? 'Yes' : 'No'}
- **Redis:** ${infra.redis ? 'Yes' : 'No'}
- **Webhooks:** ${infra.webhooks ? 'Yes' : 'No'}
- **Scheduling:** ${infra.scheduling ? 'Yes' : 'No'}`;

    const readme = `# Automation Solution

## Description
${solution.description}

**Original Request:** ${userProblem}

## Infrastructure
${infraLines}

## Agents
${solution.agents.map(agent => `- **${agent.name}** — ${agent.purpose}`).join('\n')}

## Workflows
${flowLines}

## Installation & Usage

1. **Install dependencies**
   \`\`\`bash
   npm install
   \`\`\`

2. **Configure environment**
   \`\`\`bash
   cp .env.example .env
   \`\`\`

3. **Build**
   \`\`\`bash
   npm run build
   \`\`\`

4. **Run**
   \`\`\`bash
   npm start
   \`\`\`

## Development
- Dev mode: \`npm run dev\`
- Watch: \`npm run build:watch\`
- Clean build: \`npm run clean && npm run build\`
`;
    fs.writeFileSync(path.join(solutionPath, 'README.md'), readme, 'utf8');
  }

  private async generateUIFiles(solutionPath: string, uiComponents: any): Promise<void> {
    if (!uiComponents) return;
    const uiPath = path.join(solutionPath, 'ui');
    const directories = ['src', 'src/components', 'src/pages', 'src/lib', 'public'];
    for (const dir of directories) fs.mkdirSync(path.join(uiPath, dir), { recursive: true });

    // Components
    if (uiComponents.components) {
      for (const component of uiComponents.components) {
        const safe = String(component.name).replace(/[^\w.-]/g, '_');
        const componentPath = path.join(uiPath, 'src', 'components', `${safe}.tsx`);
        fs.writeFileSync(componentPath, component.code, 'utf8');
      }
    }

    // Pages
    if (uiComponents.pages) {
      for (const page of uiComponents.pages) {
        const safe = String(page.name).replace(/[^\w.-]/g, '_');
        const pagePath = path.join(uiPath, 'src', 'pages', `${safe}.tsx`);
        fs.writeFileSync(pagePath, page.code, 'utf8');
      }
    }

    // Routes
    if (uiComponents.routes) {
      const routesPath = path.join(uiPath, 'src', 'lib', 'routes.tsx');
      fs.writeFileSync(routesPath, uiComponents.routes, 'utf8');
    }

    // package.json
    if (uiComponents.packageJson) {
      const packagePath = path.join(uiPath, 'package.json');
      fs.writeFileSync(packagePath, JSON.stringify(uiComponents.packageJson, null, 2), 'utf8');
    }

    // Config files
    if (uiComponents.configFiles) {
      for (const [filename, content] of Object.entries(uiComponents.configFiles)) {
        fs.writeFileSync(path.join(uiPath, filename), String(content), 'utf8');
      }
    }

    // Main entry
    const mainEntryCode = `import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './lib/routes';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);`;
    fs.writeFileSync(path.join(uiPath, 'src', 'main.tsx'), mainEntryCode, 'utf8');

    // Index HTML
    const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Automation Solution UI</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;
    fs.writeFileSync(path.join(uiPath, 'index.html'), indexHtml, 'utf8');

    // CSS
    const cssContent = `/* basic reset + tailwind layer slots if you wire it */
:root { color-scheme: light dark; }`;
    fs.writeFileSync(path.join(uiPath, 'src', 'index.css'), cssContent, 'utf8');
  }
}
