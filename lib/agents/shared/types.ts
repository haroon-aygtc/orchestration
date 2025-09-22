
// Shared types for all agents - production-grade DRY implementation

import { AGENT_CONSTANTS } from './constants';

// Base task and agent interfaces
export enum TaskStatus {
  Pending = 'pending',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
}

export interface AgentTask<I = unknown, O = unknown> {
  id: string;
  type: string;
  title?: string;
  description?: string;
  input: I;
  output?: O;
  status: TaskStatus;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  agentId?: string;
  metadata?: unknown;
  parentId?: string;
}

export interface AgentTaskStore {
  create(task: AgentTask): Promise<void>;
  update(id: string, patch: Partial<AgentTask>): Promise<void>;
  get(id: string): Promise<AgentTask | null>;
  list?(filters?: { status?: TaskStatus; agentId?: string; limit?: number }): Promise<AgentTask[]>;
  delete?(id: string): Promise<void>; 
}

export interface AgentStatus {
  type: string;
  name: string;
  status: "idle" | "busy" | "error";
  tasksCompleted: number;
  capabilities: string[];
  lastActivity?: Date;
  errorCount?: number;
}

// Tool-related types
export interface ToolResult {
  success: boolean;
  data?: any;
  statusCode?: number;
  message?: string;
  error?: string;
}

export interface ToolRegistry {
  [toolName: string]: (params: Record<string, any>) => Promise<ToolResult>;
}

// Memory-related types
export interface MemoryBackend {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown, context?: string, ttl?: number): Promise<void>;
  delete?(key: string): Promise<void>;
  list?(filters?: Record<string, string>): Promise<string[]>;
  clear?(context?: string): Promise<void>;
}

// Retriever-related types
export interface RetrieverResultItem {
  source: string;
  content: string;
  relevanceScore?: number;
  metadata?: Record<string, any>;
}

export interface Retriever {
  search(query: string, sources?: string[], filters?: Record<string, any>): Promise<RetrieverResultItem[]>;
  index?(data: any, metadata?: Record<string, any>): Promise<void>;
  delete?(id: string): Promise<void>;
}

// Agent interfaces
export interface Agent<I = unknown, O = unknown> {
  execute(input: I): Promise<AgentTask<I, O>>;
  getStatus(): AgentStatus;
  getCapabilities(): string[];
}

// Specific agent input/output types
export interface IntentInput {
  text: string;
  context?: string;
}

export interface IntentEntity {
  type: string;
  value: string;
  confidence: number;
}

export interface IntentOutput {
  intent: string;
  confidence: number;
  entities: IntentEntity[];
  actionRequired: boolean;
  suggestedResponse: string;
}

export interface RetrieverInput {
  query: string;
  sources?: string[];
  filters?: Record<string, any>;
}

export interface RetrieverOutput {
  summary: string;
  recommendations: string[];
  confidence: number;
  relevantData: RetrieverResultItem[];
}

export interface ToolInput {
  toolName?: string;
  parameters: Record<string, any>;
}

export interface ToolOutput {
  toolName: string; 
  executionResult: ToolResult;
} 

export interface WorkflowInput {
  name: string;
  description: string;
  triggers: string[];
  goals: string[];
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: "trigger" | "condition" | "action" | "delay";
  parameters: Record<string, any>;
  dependencies: string[];
}

export interface WorkflowOutput {
  workflowId: string;
  name: string;
  steps: WorkflowStep[];
  estimatedDuration: number;
  successCriteria: string[];
  rollbackPlan: string[];
}

export interface MemoryInput {
  key: string;
  value: unknown;
  context?: string;
  ttl?: number;
}

export interface MemoryOutput {
  stored: true;
  key: string;
}

export interface FollowInput {
  taskId: string;
  checkpoints: string[];
  notifications?: string[];
}

export interface FollowOutput {
  taskId: string;
  currentStatus: "in_progress" | "blocked" | "completed";
  completedCheckpoints: string[];
  nextMilestone: string;
  estimatedCompletion: string;
  riskFactors: { risk: string; severity: "low" | "medium" | "high"; mitigation: string }[];
  recommendations: string[];
}

export interface FormatterInput {
  content: string;
  format: string;
  options?: Record<string, any>;
}

export interface FormatterOutput {
  formattedContent: string;
  format: string;
  metadata: Record<string, any>;
}

export interface GuardrailInput {
  content: string;
  rules?: string[];
  context?: Record<string, any>;
}

export interface GuardrailOutput {
  approved: boolean;
  violations: Array<{
    type: string;
    message: string;
    severity: "low" | "medium" | "high";
    suggestion?: string;
  }>;
  sanitizedContent?: string;
  confidence: number;
}

export interface LLMInput {
  prompt: string;
  context?: Record<string, any>;
  options?: {
    temperature?: number;
    maxTokens?: number;
    model?: string;
  };
}

export interface LLMOutput {
  response: string;
  metadata: {
    model: string;
    tokens: number;
    confidence: number;
    processingTime: number;
  };
}

// Update Goal interface to match schema (remove priority, metadata, userId; add businessProfileId, context)
export interface Goal {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  context?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  businessProfileId?: string;
}

// Update Step interface to match schema (remove title, description, order, parameters; add agent, tool, successCriteria, taskId)
export interface Step {
  id: string;
  goalId: string;
  agent: string;
  tool?: string;
  input: Record<string, any>;
  successCriteria: string;
  status: TaskStatus;
  startedAt?: Date;
  completedAt?: Date;
  result?: Record<string, any>;
  error?: string;
  taskId?: string;
}
