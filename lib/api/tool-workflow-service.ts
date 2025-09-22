// Client-safe API types and interfaces
// This file contains only types and interfaces that can be safely imported in client components

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

export type OrchestrationStep = {
  id: string;
  name: string;
  type: string;
  parameters: Record<string, any>;
  dependencies?: string[];
  timeout?: number;
  retries?: number;
};

export type OrchestrationGoal = {
  id: string;
  name: string;
  description: string;
  status: "pending" | "running" | "completed" | "failed";
  steps: OrchestrationStep[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};

export type CreateGoalRequest = {
  name: string;
  description: string;
  steps: OrchestrationStep[];
  priority?: number;
  metadata?: Record<string, any>;
};

/* =========================
 * Client-safe tool definitions
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

// Client-safe tool registry (types only)
export const CLIENT_SAFE_TOOLS: Tool[] = [
  {
    name: "http_get",
    description: "Make HTTP GET request",
    parameters: {
      url: { type: "string", required: true, description: "URL to fetch" },
      headers: { type: "object", required: false, description: "HTTP headers" },
      timeout: { type: "number", required: false, description: "Request timeout in ms" }
    },
    category: "http",
    version: "1.0.0"
  },
  {
    name: "http_post",
    description: "Make HTTP POST request",
    parameters: {
      url: { type: "string", required: true, description: "URL to post to" },
      data: { type: "object", required: true, description: "Data to send" },
      headers: { type: "object", required: false, description: "HTTP headers" },
      timeout: { type: "number", required: false, description: "Request timeout in ms" }
    },
    category: "http",
    version: "1.0.0"
  },
  {
    name: "email_send",
    description: "Send email via SMTP",
    parameters: {
      to: { type: "string", required: true, description: "Recipient email" },
      subject: { type: "string", required: true, description: "Email subject" },
      text: { type: "string", required: true, description: "Email text content" },
      html: { type: "string", required: false, description: "Email HTML content" },
      from: { type: "string", required: false, description: "Sender email" }
    },
    category: "communication",
    version: "1.0.0"
  },
  {
    name: "slack_notify",
    description: "Send Slack notification",
    parameters: {
      channel: { type: "string", required: true, description: "Slack channel" },
      text: { type: "string", required: true, description: "Message text" },
      blocks: { type: "array", required: false, description: "Slack blocks" }
    },
    category: "communication",
    version: "1.0.0"
  },
  {
    name: "file_read",
    description: "Read file from filesystem",
    parameters: {
      path: { type: "string", required: true, description: "File path" },
      encoding: { type: "string", required: false, description: "File encoding" }
    },
    category: "storage",
    version: "1.0.0"
  },
  {
    name: "file_write",
    description: "Write file to filesystem",
    parameters: {
      path: { type: "string", required: true, description: "File path" },
      content: { type: "string", required: true, description: "File content" },
      encoding: { type: "string", required: false, description: "File encoding" }
    },
    category: "storage",
    version: "1.0.0"
  },
  {
    name: "db_query",
    description: "Query database via Prisma",
    parameters: {
      entity: { type: "string", required: true, description: "Prisma entity name" },
      where: { type: "object", required: false, description: "Where clause" },
      select: { type: "object", required: false, description: "Select fields" },
      include: { type: "object", required: false, description: "Include relations" },
      orderBy: { type: "object", required: false, description: "Order by clause" },
      take: { type: "number", required: false, description: "Limit results" },
      skip: { type: "number", required: false, description: "Skip results" }
    },
    category: "database",
    version: "1.0.0"
  },
  {
    name: "db_upsert",
    description: "Upsert database record via Prisma",
    parameters: {
      entity: { type: "string", required: true, description: "Prisma entity name" },
      where: { type: "object", required: true, description: "Where clause" },
      create: { type: "object", required: true, description: "Create data" },
      update: { type: "object", required: true, description: "Update data" }
    },
    category: "database",
    version: "1.0.0"
  },
  {
    name: "db_create",
    description: "Create database record via Prisma",
    parameters: {
      entity: { type: "string", required: true, description: "Prisma entity name" },
      data: { type: "object", required: true, description: "Record data" }
    },
    category: "database",
    version: "1.0.0"
  },
  {
    name: "db_update",
    description: "Update database records via Prisma",
    parameters: {
      entity: { type: "string", required: true, description: "Prisma entity name" },
      where: { type: "object", required: true, description: "Where clause" },
      data: { type: "object", required: true, description: "Update data" }
    },
    category: "database",
    version: "1.0.0"
  },
  {
    name: "db_delete",
    description: "Delete database records via Prisma",
    parameters: {
      entity: { type: "string", required: true, description: "Prisma entity name" },
      where: { type: "object", required: true, description: "Where clause" }
    },
    category: "database",
    version: "1.0.0"
  }
];

// Client-safe API functions
export class OrchestrationService {
  private baseUrl: string;

  constructor(baseUrl: string = "/api") {
    this.baseUrl = baseUrl;
  }

  async createGoal(request: CreateGoalRequest): Promise<OrchestrationGoal> {
    const response = await fetch(`${this.baseUrl}/orchestration/goals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`Failed to create goal: ${response.statusText}`);
    }

    return response.json();
  }

  async getGoal(goalId: string): Promise<OrchestrationGoal> {
    const response = await fetch(`${this.baseUrl}/orchestration/goals/${goalId}`);

    if (!response.ok) {
      throw new Error(`Failed to get goal: ${response.statusText}`);
    }

    return response.json();
  }

  async executeWorkflow(request: WorkflowExecutionRequest): Promise<OrchestrationResponse> {
    const response = await fetch(`${this.baseUrl}/orchestration/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`Failed to execute workflow: ${response.statusText}`);
    }

    return response.json();
  }

  async getTools(): Promise<ToolsResponse> {
    const response = await fetch(`${this.baseUrl}/tools`);

    if (!response.ok) {
      throw new Error(`Failed to get tools: ${response.statusText}`);
    }

    return response.json();
  }

  async executeTool(request: ToolExecutionRequest): Promise<any> {
    const response = await fetch(`${this.baseUrl}/tools/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`Failed to execute tool: ${response.statusText}`);
    }

    return response.json();
  }

  async getIntegrationMetrics(): Promise<IntegrationMetrics> {
    const response = await fetch(`${this.baseUrl}/integrations/metrics`);

    if (!response.ok) {
      throw new Error(`Failed to get integration metrics: ${response.statusText}`);
    }

    return response.json();
  }
}

// Export default instance
export const orchestrationService = new OrchestrationService();
