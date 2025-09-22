// Centralized Type Definitions - Production Ready
// All shared types across the AI Agent Architecture

// ========== AI Configuration Types ==========
export type ProviderId =
  | "openai"
  | "anthropic"
  | "groq"
  | "openrouter"
  | "gemini"
  | "mistral"
  | "deepseek"
  | "codestral";

export interface AIProviderConfig {
  id: string;
  provider: ProviderId;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  baseUrl?: string;
  timeoutMs?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AIProviderConfigInput {
  provider: ProviderId;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  baseUrl?: string;
  timeoutMs?: number;
  isActive?: boolean;
}

export interface AgentAIProvider {
  id: string;
  agentName: string;
  providerId: string;
  isDefault: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
  provider: AIProviderConfig;
}

export interface AgentAIMapping {
  [agentType: string]: {
    provider: ProviderId;
    model: string;
    description: string;
  };
}

// ========== Orchestration Types ==========
export type GoalStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
export type StepStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export interface Goal {
  id: string;
  title: string;
  description: string;
  status: GoalStatus;
  context?: unknown;
  createdAt: Date;
  updatedAt: Date;
  steps: PlanStep[];
  artifacts: Artifact[];
  suggestions: Suggestion[];
}

export interface PlanStep {
  id: string;
  goalId: string;
  agent: string;
  tool?: string;
  input: unknown;
  successCriteria: string;
  status: StepStatus;
  startedAt?: Date;
  completedAt?: Date; 
  result?: unknown;
  dependsOn?: string[];
  error?: string;
  taskId?: string;
  timeout?: number; // Standard timeout field
}

export interface Artifact {
  id: string;
  goalId: string;
  kind: "text" | "json" | "table" | "file" | string;
  by: string;
  data: unknown;
  createdAt: Date;
}

export interface Suggestion {
  id: string;
  goalId: string;
  fromAgent: string;
  toAgent?: string;
  text: string;
  action?: {
    agent: string ;
    tool?: string;
    input: unknown;
    successCriteria: string;
  };
  confidence: number;
  createdAt: Date;
}

// ========== API Types ==========
export interface AIRequest {
  provider: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
}

export interface AIResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  responseTime: number;
  provider?: string;
  model?: string;
  finishReason?: string;
  toolCalls?: any[];
  rawResponse?: any;
}

// ========== Event Types ==========
export type OrchestrationEvent = 
  | "goal.created"
  | "goal.updated"
  | "plan.generated" 
  | "step.started"
  | "step.completed"
  | "step.failed"
  | "artifact.ready"
  | "suggestion.created"
  | "goal.completed";

export interface EventPayload {
  goalId: string;
  stepId?: string;
  error?: string;
  data?: any;
  goal?: Goal;
  steps?: PlanStep[];
  step?: PlanStep;
  result?: any;
  suggestion?: Suggestion;
}

// ========== Tool Types ==========
export interface ToolInfo {
  name: string;
  purpose: string;
  category:
    | "communication"
    | "integration"
    | "data"
    | "storage"
    | "validation"
    | "security"
    | "database";
}

// ========== Validation Types ==========
export interface ValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
  provider?: string;
  keyType?: string;
}

export interface APIKeyInfo {
  provider: string;
  keyType: string;
  isValid: boolean;
  format: string;
  length: number;
  prefix: string;
}

// ========== Toast Types ==========
export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// ========== Utility Types ==========
export interface OrchestrationResult {
  status: "step_completed" | "step_failed" | "completed" | "blocked" | "idle" | "extended" | string;
  stepId?: string;
  error?: string;
  added?: number;
}

// Type aliases for backward compatibility
export type OrchestrationGoal = Goal;
export type OrchestrationStep = PlanStep;
export type OrchestrationArtifact = Artifact;
export type OrchestrationSuggestion = Suggestion;
export type OrchestrationStatus = GoalStatus;
