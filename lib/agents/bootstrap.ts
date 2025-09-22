// Bootstrap function to create fully functional agents with real implementations
import { IntentAgent } from "./intent/intent-agent";
import { ToolAgent } from "./tool/tool-agent";
import { RetrieverAgent } from "./retriever/retriever-agent";
import { WorkflowAgent } from "./workflow/workflow-agent";
import { MemoryAgent } from "./memory/memory-agent";
import { FollowAgent } from "./follow/follow-agent";
import { FormatterAgent } from "./formatter/formatter-agent";
import { GuardrailAgent } from "./guardrail/guardrail-agent";
import { LLMAgent } from "./llm/llm-agent";
import { SolutionDesignAgent } from "../solution-design-agent";
import { UIGeneratorAgent } from "../ui-generator-agent";
import { createRealTools, getToolMetrics } from "../tools/registry";
import { createPostgresRetriever } from "../retriever/postgres-retriever";
import { createMemory } from "../memory/memory";
import { createPostgresTaskStore } from "../db-task-store/postgres-task-store";
import { logger, LogContext } from "../utils/structured-logger";
import { AgentTaskStore } from "./shared/types";

/**
 * Bootstrap function that creates fully functional AI agents with real implementations
 * 
 * This replaces any simulation code with actual working tools and storage backends:
 * - Real email sending via SMTP
 * - Real HTTP requests and webhooks
 * - Real database operations via Prisma
 * - Real file operations
 * - Real persistent memory with TTL
 * - Real task tracking and audit trails
 * 
 * Environment Variables Required:
 * - DATABASE_URL: PostgreSQL connection string for Prisma
 * - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS: Email configuration
 * - SLACK_WEBHOOK_URL: Slack notifications (optional)
 * 
 * @returns Fully functional AI agents with real automation capabilities
 */
export async function bootstrapAgents() {
  logger.info("🚀 Bootstrapping AI agents with real implementations...");

  // Create real tool implementations
  const tools = await createRealTools();
  logger.info(`✅ Created ${Object.keys(tools).length} real tools`);
  
  // Create real PostgreSQL retriever
  const retriever = createPostgresRetriever();
  logger.info("✅ Created PostgreSQL retriever");
  
  // Create real memory backend
  const memory = createMemory();
  logger.info("✅ Created memory backend");
  
  // Create real task store
  const taskStore = await createPostgresTaskStore();
  logger.info("✅ Created Prisma task store");
  
  // Create agents with real implementations
  const agents = {
    intent: new IntentAgent(taskStore as AgentTaskStore),
    retriever: new RetrieverAgent(retriever, taskStore as AgentTaskStore),
    tool: new ToolAgent(tools, taskStore as AgentTaskStore),
    workflow: new WorkflowAgent(taskStore as AgentTaskStore),
    memory: new MemoryAgent(memory, taskStore as AgentTaskStore),
    follow: new FollowAgent(taskStore as AgentTaskStore),
    formatter: new FormatterAgent(taskStore as AgentTaskStore),
    guardrail: new GuardrailAgent(taskStore as AgentTaskStore),
    llm: new LLMAgent(taskStore as AgentTaskStore),
    solutionDesign: new SolutionDesignAgent(taskStore as AgentTaskStore),
    uiGenerator: new UIGeneratorAgent(taskStore as AgentTaskStore)
  };
  
  logger.info("🎉 AI agents bootstrapped successfully!");
  logger.info("Available agents:", Object.keys(agents));
  logger.info("Available tools:", Object.keys(tools));
  
  return agents;
}

/**
 * Validate environment configuration
 */
export function validateEnvironment(): {
  valid: boolean;
  missing: string[];
  warnings: string[];
} {
  const required = ["DATABASE_URL"];
  const optional = [
    "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS",
    "SLACK_WEBHOOK_URL"
  ];
  
  const missing: string[] = [];
  const warnings: string[] = [];
  
  // Check required variables
  for (const envVar of required) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }
  
  // Check optional variables
  for (const envVar of optional) {
    if (!process.env[envVar]) {
      warnings.push(`${envVar} not set - related tools will not work`);
    }
  }
  
  return {
    valid: missing.length === 0,
    missing,
    warnings
  };
}

/**
 * Test agent functionality
 */
export async function testAgents() {
  logger.info("🧪 Testing agent functionality...");
  
  const validation = validateEnvironment();
  if (!validation.valid) {
    logger.error("❌ Environment validation failed:");
    validation.missing.forEach(env => logger.error(`  Missing: ${env}`));
    return false;
  }
  
  if (validation.warnings.length > 0) {
    logger.warn("⚠️ Environment warnings:");
    validation.warnings.forEach(warning => logger.warn(`  ${warning}`));
  }
  
  try {
    const agents = await bootstrapAgents();
    
    // Test memory agent
    logger.info("Testing memory agent...");
    await agents.memory.storeMemory({
      key: "test-key",
      value: { message: "Hello from AI agents!" },
      context: "bootstrap-test",
      ttl: 60000 // 1 minute
    });
    
    const retrieved = await agents.memory.retrieveMemory("test-key" as string);
    
    if (retrieved === "completed") {
      logger.info("✅ Memory agent working");
    } else {
      logger.error("❌ Memory agent failed");
      return false;
    }
    
    // Test tool agent with hash (no external dependencies)
    logger.info("Testing tool agent...");
    const hashResult = await agents.tool.executeTool({
      toolName: "hash_sha256",
      parameters: { input: "test-data" }
    });
    
    if (hashResult.status === "completed") {
      logger.info("✅ Tool agent working");
    } else {
      logger.error("❌ Tool agent failed");
      return false;
    }
    
    // Test retriever agent
    logger.info("Testing retriever agent...");
    const searchResult = await agents.retriever.retrieveInformation({
      query: "test",
      sources: ["tasks"]
    });
    
    if (searchResult.status === "completed") {
      logger.info("✅ Retriever agent working");
    } else {
      logger.error("❌ Retriever agent failed");
      return false;
    }
    
    logger.info("🎉 All agent tests passed!");
    return true;
    
  } catch (error) {
    logger.error("❌ Agent testing failed:", error as LogContext);
    return false;
  }
}

/**
 * Get agent statistics
 */
export async function getAgentStats() {
  try {
    const agents = await bootstrapAgents();
    
    // Get memory stats
    const memoryStats = await agents.memory.storeMemory({
      key: "stats-request",
      value: { type: "stats" }
    });
    
    // Get task stats (if task store has stats method)
    // This would need to be implemented in the task store
    
    return {
      timestamp: new Date().toISOString(),
      memory: memoryStats,
      agents: Object.keys(agents),
      tools: Object.keys(await createRealTools())
    };
    
  } catch (error) {
    logger.error("Failed to get agent stats:", error as LogContext);
    return null;
  }
}
