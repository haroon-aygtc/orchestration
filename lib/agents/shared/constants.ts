// Shared constants for all agents - production-grade DRY implementation
import { aiConfigService } from "../../ai-config-service";

export const AGENT_CONSTANTS = {
  // Task statuses
  TASK_STATUSES: {
    PENDING: "pending",
    RUNNING: "running",
    COMPLETED: "completed",
    FAILED: "failed"
  } as const,

  // Agent statuses
  AGENT_STATUSES: {
    IDLE: "idle",
    BUSY: "busy",
    ERROR: "error"
  } as const,

  // Timeouts (milliseconds)
  TIMEOUTS: {
    DEFAULT_EXECUTION: 30000, // 30 seconds
    LLM_RESPONSE: 20000,      // 20 seconds
    TOOL_EXECUTION: 30000,    // 30 seconds
    RETRIEVAL: 30000,         // 30 seconds
  },

  // LLM settings
  LLM_SETTINGS: {
    DEFAULT_TEMPERATURE: 0.1,
    DEFAULT_MAX_TOKENS: 2000,
    TOOL_SELECTION_TEMPERATURE: 0.1,
    TOOL_SELECTION_MAX_TOKENS: 500,
    COLLABORATION_TEMPERATURE: 0.2,
    COLLABORATION_MAX_TOKENS: 1000,
  },

  // Tool descriptions for dynamic selection
  TOOL_DESCRIPTIONS: {
    HTTP_REQUEST: "For making HTTP requests (GET, POST, PUT, DELETE)",
    EMAIL_SENDER: "For sending emails via SMTP",
    HASH_SHA256: "For SHA-256 hashing",
    CSV_PARSE: "For parsing CSV files",
    DATA_VALIDATOR: "For validating data against schemas",
    SLACK_NOTIFY: "For sending Slack notifications",
    WEBHOOK_TRIGGER: "For triggering webhooks",
    FILE_WRITE: "For writing files to filesystem",
    PDF_PARSE: "For extracting text from PDF files"
  },

  // Agent capabilities
  AGENT_CAPABILITIES: {
    INTENT: ["natural_language_understanding", "intent_classification", "entity_extraction", "agent_collaboration"],
    RETRIEVER: ["information_retrieval", "knowledge_search", "data_querying", "context_analysis"],
    TOOL: ["api_integration", "system_interaction", "external_service_calls", "dynamic_tool_selection"],
    WORKFLOW: ["process_orchestration", "task_sequencing", "workflow_design", "automation"],
    MEMORY: ["persistent_storage", "context_preservation", "knowledge_retention", "memory_management"],
    FOLLOW: ["progress_tracking", "milestone_monitoring", "status_reporting", "risk_assessment"],
    FORMATTER: ["data_presentation", "output_formatting", "content_structuring", "visualization"],
    GUARDRAIL: ["safety_validation", "compliance_checking", "security_monitoring", "quality_assurance"],
    LLM: ["language_processing", "content_generation", "text_analysis", "communication"]
  }
} as const;


// Error messages
export const ERROR_MESSAGES = {
  UNKNOWN_TOOL: (toolName: string) => `Unknown tool: ${toolName}`,
  TIMEOUT_EXCEEDED: (timeoutMs: number) => `Operation timed out after ${timeoutMs}ms`,
  AGENT_NOT_CONFIGURED: (agent: string) => `${agent} AI not configured`,
  INTENT_ANALYSIS_FAILED: "Intent analysis failed",
  AGENT_COMMUNICATION_FAILED: (agent: string) => `Failed to execute action ${agent}`,
  JSON_PARSE_FAILED: "JSON parsing failed",
  FAILED_TO_CREATE_TASK: (error: string) => `Failed to create task: ${error}`,
  FAILED_TO_GET_TASK: (error: string) => `Failed to get task: ${error}`,
  FAILED_TO_LIST_TASKS: (error: string) => `Failed to list tasks: ${error}`,
  FAILED_TO_DELETE_TASK: (error: string) => `Failed to delete task: ${error}`
} as const;


export async function requireAgentConfigured(agent: string) {
  const info = await aiConfigService.getAgentAIInfo(agent);
  if (!info.isConfigured) {
    const err = new Error(`${agent} AI not configured. Provider=${info.provider}, Status=${info.status}`);
    (err as any).status = 503;
    throw err;
  }
}
