/**
 * Environment Configuration System
 * 
 * Centralized, type-safe environment variable validation and configuration management.
 * All hardcoded values have been moved here with proper defaults and validation.
 */

import { z } from 'zod';

// Environment variable schema with comprehensive validation
const envSchema = z.object({
  // Application Settings
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug', 'trace']).default('info'),
  
  // Database Configuration
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  
  // AI Provider Configuration
  AI_PROVIDER: z.enum(['openai', 'anthropic', 'groq', 'gemini', 'mistral', 'openrouter', 'deepseek', 'codestral']).default('groq'),
  
  // OpenAI Configuration
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_BASE_URL: z.string().url().optional(),
  OPENAI_TIMEOUT_MS: z.coerce.number().min(1000).max(300000).default(60000),
  OPENAI_MAX_RETRIES: z.coerce.number().min(0).max(10).default(3),
  
  // Anthropic Configuration
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-3-5-sonnet-20241022'),
  ANTHROPIC_BASE_URL: z.string().url().optional(),
  ANTHROPIC_TIMEOUT_MS: z.coerce.number().min(1000).max(300000).default(60000),
  ANTHROPIC_MAX_RETRIES: z.coerce.number().min(0).max(10).default(3),
  
  // Groq Configuration
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default('llama-3.1-8b-instant'),
  GROQ_BASE_URL: z.string().url().optional(),
  GROQ_TIMEOUT_MS: z.coerce.number().min(1000).max(300000).default(45000),
  GROQ_MAX_RETRIES: z.coerce.number().min(0).max(10).default(3),
  
  // Other AI Providers
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-1.5-flash'),
  GEMINI_BASE_URL: z.string().url().optional(),
  GEMINI_TIMEOUT_MS: z.coerce.number().min(1000).max(300000).default(60000),
  GEMINI_MAX_RETRIES: z.coerce.number().min(0).max(10).default(3),
  
  MISTRAL_API_KEY: z.string().optional(),
  MISTRAL_MODEL: z.string().default('mistral-large-latest'),
  MISTRAL_BASE_URL: z.string().url().optional(),
  MISTRAL_TIMEOUT_MS: z.coerce.number().min(1000).max(300000).default(60000),
  MISTRAL_MAX_RETRIES: z.coerce.number().min(0).max(10).default(3),
  
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default('meta-llama/llama-3.1-8b-instruct:free'),
  OPENROUTER_BASE_URL: z.string().url().optional(),
  OPENROUTER_TIMEOUT_MS: z.coerce.number().min(1000).max(300000).default(60000),
  OPENROUTER_MAX_RETRIES: z.coerce.number().min(0).max(10).default(3),
  
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_MODEL: z.string().default('deepseek-chat'),
  DEEPSEEK_BASE_URL: z.string().url().optional(),
  DEEPSEEK_TIMEOUT_MS: z.coerce.number().min(1000).max(300000).default(60000),
  DEEPSEEK_MAX_RETRIES: z.coerce.number().min(0).max(10).default(3),
  
  CODESTRAL_API_KEY: z.string().optional(),
  CODESTRAL_MODEL: z.string().default('codestral-latest'),
  CODESTRAL_BASE_URL: z.string().url().optional(),
  CODESTRAL_TIMEOUT_MS: z.coerce.number().min(1000).max(300000).default(60000),
  CODESTRAL_MAX_RETRIES: z.coerce.number().min(0).max(10).default(3),
  
  // Agent Temperature Settings (replacing hardcoded values)
  AGENT_TEMPERATURE_DEFAULT: z.coerce.number().min(0).max(2).default(0.1),
  AGENT_TEMPERATURE_TOOL_SELECTION: z.coerce.number().min(0).max(2).default(0.1),
  AGENT_TEMPERATURE_INTENT_ANALYSIS: z.coerce.number().min(0).max(2).default(0.1),
  AGENT_TEMPERATURE_COLLABORATION: z.coerce.number().min(0).max(2).default(0.2),
  AGENT_TEMPERATURE_LLM: z.coerce.number().min(0).max(2).default(0.7),
  AGENT_TEMPERATURE_MANAGER: z.coerce.number().min(0).max(2).default(0.3),
  AGENT_LIMITS_INTENT_MAX_TOKENS: z.coerce.number().min(100).max(4096).default(1200),
  AGENT_LIMITS_COLLAB_MAX_TOKENS: z.coerce.number().min(100).max(4096).default(800),
  AGENT_TIMEOUTS_INTENT_ANALYSIS_MS: z.coerce.number().min(1000).max(60000).default(15000),
  AGENT_TIMEOUTS_COLLABORATION_MS: z.coerce.number().min(1000).max(60000).default(12000),
  // Tool Timeout Configuration (replacing hardcoded values)
  TOOL_DEFAULT_TIMEOUT: z.coerce.number().min(1000).max(600000).default(30000),
  TOOL_EMAIL_TIMEOUT: z.coerce.number().min(1000).max(600000).default(60000),
  TOOL_SLACK_TIMEOUT: z.coerce.number().min(1000).max(600000).default(30000),
  TOOL_WEBHOOK_TIMEOUT: z.coerce.number().min(1000).max(600000).default(45000),
  TOOL_HTTP_TIMEOUT: z.coerce.number().min(1000).max(600000).default(60000),
  TOOL_CSV_TIMEOUT: z.coerce.number().min(1000).max(600000).default(120000),
  TOOL_PDF_TIMEOUT: z.coerce.number().min(1000).max(600000).default(120000),
  TOOL_VALIDATOR_TIMEOUT: z.coerce.number().min(1000).max(600000).default(30000),
  TOOL_HASH_TIMEOUT: z.coerce.number().min(1000).max(600000).default(10000),
  TOOL_JSON_TIMEOUT: z.coerce.number().min(1000).max(600000).default(10000),
  TOOL_FILE_TIMEOUT: z.coerce.number().min(1000).max(600000).default(60000),
  DATABASE_QUERY_TIMEOUT: z.coerce.number().min(1000).max(600000).default(30000),
  DATABASE_MUTATION_TIMEOUT: z.coerce.number().min(1000).max(600000).default(30000),
  
  // Tool Retry Configuration
  TOOL_MAX_RETRIES: z.coerce.number().min(0).max(10).default(3),
  TOOL_RETRY_BASE_DELAY: z.coerce.number().min(100).max(10000).default(1000),
  TOOL_RETRY_MAX_DELAY: z.coerce.number().min(1000).max(60000).default(10000),
  TOOL_RETRY_BACKOFF_MULTIPLIER: z.coerce.number().min(1).max(5).default(2),
  
  // Redis Configuration
  REDIS_TIMEOUT_MS: z.coerce.number().min(1000).max(60000).default(5000),
  REDIS_MAX_RETRIES: z.coerce.number().min(0).max(10).default(3),
  REDIS_RETRY_DELAY_MS: z.coerce.number().min(100).max(10000).default(1000),
  REDIS_CONNECTION_POOL_SIZE: z.coerce.number().min(1).max(50).default(10),
  
  // Orchestration Configuration
  ORCHESTRATION_STEP_TIMEOUT_MS: z.coerce.number().min(1000).max(600000).default(300000),
  ORCHESTRATION_MESSAGE_TIMEOUT_MS: z.coerce.number().min(1000).max(600000).default(30000),
  ORCHESTRATION_MAX_PARALLEL_STEPS: z.coerce.number().min(1).max(100).default(10),
  ORCHESTRATION_THROUGHPUT_WINDOW_MS: z.coerce.number().min(1000).max(300000).default(60000),
  
  // Email Configuration
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().min(1).max(65535).default(587),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  
  // Webhook Configuration
  SLACK_WEBHOOK_URL: z.string().url().optional(),
  WEBHOOK_SECRET: z.string().optional(),
  WEBHOOK_TIMEOUT_MS: z.coerce.number().min(1000).max(60000).default(15000),
  
  // Security Configuration
  JWT_SECRET: z.string().optional(),
  ENCRYPTION_KEY: z.string().optional(),
  
  // CORS Configuration
  CORS_ORIGINS: z.string().transform((val) => val.split(',').map(s => s.trim())).default('http://localhost:3000,http://localhost:3001'),
  ALLOWED_DOMAINS: z.string().transform((val) => val.split(',').map(s => s.trim())).default('localhost,127.0.0.1'),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().min(1000).max(3600000).default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().min(1).max(10000).default(100),
  
  // Monitoring & Observability
  ENABLE_METRICS: z.coerce.boolean().default(true),
  METRICS_PORT: z.coerce.number().min(1).max(65535).default(9090),
  ENABLE_TRACING: z.coerce.boolean().default(false),
  JAEGER_ENDPOINT: z.string().url().optional(),
  
  // Development Settings
  DEBUG: z.string().default('ai-agent:*'),
  CACHE_ENABLED: z.coerce.boolean().default(true),
  CACHE_TTL_MS: z.coerce.number().min(1000).max(86400000).default(300000), // 5 minutes default
  
  // Test Configuration (only used in test environment)
  TEST_DATABASE_URL: z.string().optional(),
  TEST_REDIS_URL: z.string().optional(),
  
  // Feature Flags
  FEATURE_ADVANCED_LOGGING: z.coerce.boolean().default(true),
  FEATURE_CIRCUIT_BREAKER: z.coerce.boolean().default(true),
  FEATURE_REQUEST_DEDUPLICATION: z.coerce.boolean().default(true),
  FEATURE_PERFORMANCE_MONITORING: z.coerce.boolean().default(true),
});

// Parse and validate environment variables
function parseEnv(): z.infer<typeof envSchema> {
  try {
    const parsed = envSchema.parse(process.env);
    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      throw new Error(`Environment validation failed:\n${errorMessages.join('\n')}`);
    }
    throw error;
  }
}

// Export parsed and validated environment
export const env = parseEnv();

// Export type for TypeScript inference
export type Env = typeof env;

// Configuration objects derived from environment
export const appConfig = {
  env: env.NODE_ENV,
  port: env.PORT,
  logLevel: env.LOG_LEVEL,
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
} as const;

export const databaseConfig = {
  url: env.NODE_ENV === 'test' ? env.TEST_DATABASE_URL || env.DATABASE_URL : env.DATABASE_URL,
  timeout: env.DATABASE_QUERY_TIMEOUT,
  mutationTimeout: env.DATABASE_MUTATION_TIMEOUT,
} as const;

export const redisConfig = {
  url: env.NODE_ENV === 'test' ? env.TEST_REDIS_URL || env.REDIS_URL : env.REDIS_URL,
  timeout: env.REDIS_TIMEOUT_MS,
  maxRetries: env.REDIS_MAX_RETRIES,
  retryDelay: env.REDIS_RETRY_DELAY_MS,
  poolSize: env.REDIS_CONNECTION_POOL_SIZE,
} as const;

export const aiConfig = {
  defaultProvider: env.AI_PROVIDER,
  providers: {
    openai: {
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL,
      baseUrl: env.OPENAI_BASE_URL,
      timeout: env.OPENAI_TIMEOUT_MS,
      maxRetries: env.OPENAI_MAX_RETRIES,
    },
    anthropic: {
      apiKey: env.ANTHROPIC_API_KEY,
      model: env.ANTHROPIC_MODEL,
      baseUrl: env.ANTHROPIC_BASE_URL,
      timeout: env.ANTHROPIC_TIMEOUT_MS,
      maxRetries: env.ANTHROPIC_MAX_RETRIES,
    },
    groq: {
      apiKey: env.GROQ_API_KEY,
      model: env.GROQ_MODEL,
      baseUrl: env.GROQ_BASE_URL,
      timeout: env.GROQ_TIMEOUT_MS,
      maxRetries: env.GROQ_MAX_RETRIES,
    },
    gemini: {
      apiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_MODEL,
      baseUrl: env.GEMINI_BASE_URL,
      timeout: env.GEMINI_TIMEOUT_MS,
      maxRetries: env.GEMINI_MAX_RETRIES,
    },
    mistral: {
      apiKey: env.MISTRAL_API_KEY,
      model: env.MISTRAL_MODEL,
      baseUrl: env.MISTRAL_BASE_URL,
      timeout: env.MISTRAL_TIMEOUT_MS,
      maxRetries: env.MISTRAL_MAX_RETRIES,
    },
    openrouter: {
      apiKey: env.OPENROUTER_API_KEY,
      model: env.OPENROUTER_MODEL,
      baseUrl: env.OPENROUTER_BASE_URL,
      timeout: env.OPENROUTER_TIMEOUT_MS,
      maxRetries: env.OPENROUTER_MAX_RETRIES,
    },
    deepseek: {
      apiKey: env.DEEPSEEK_API_KEY,
      model: env.DEEPSEEK_MODEL,
      baseUrl: env.DEEPSEEK_BASE_URL,
      timeout: env.DEEPSEEK_TIMEOUT_MS,
      maxRetries: env.DEEPSEEK_MAX_RETRIES,
    },
    codestral: {
      apiKey: env.CODESTRAL_API_KEY,
      model: env.CODESTRAL_MODEL,
      baseUrl: env.CODESTRAL_BASE_URL,
      timeout: env.CODESTRAL_TIMEOUT_MS,
      maxRetries: env.CODESTRAL_MAX_RETRIES,
    },
  },
  temperatures: {
    default: env.AGENT_TEMPERATURE_DEFAULT,
    toolSelection: env.AGENT_TEMPERATURE_TOOL_SELECTION,
    intentAnalysis: env.AGENT_TEMPERATURE_INTENT_ANALYSIS,
    collaboration: env.AGENT_TEMPERATURE_COLLABORATION,
    llm: env.AGENT_TEMPERATURE_LLM,
    manager: env.AGENT_TEMPERATURE_MANAGER,
  },
  limits: {
    intentMaxTokens: env.AGENT_LIMITS_INTENT_MAX_TOKENS,
    collabMaxTokens: env.AGENT_LIMITS_COLLAB_MAX_TOKENS,
  },
  timeouts: {
    intentAnalysisMs: env.AGENT_TIMEOUTS_INTENT_ANALYSIS_MS,
    collaborationMs: env.AGENT_TIMEOUTS_COLLABORATION_MS,
  },
} as const;

export const toolConfig = {
  timeouts: {
    default: env.TOOL_DEFAULT_TIMEOUT,
    email: env.TOOL_EMAIL_TIMEOUT,
    slack: env.TOOL_SLACK_TIMEOUT,
    webhook: env.TOOL_WEBHOOK_TIMEOUT,
    http: env.TOOL_HTTP_TIMEOUT,
    csv: env.TOOL_CSV_TIMEOUT,
    pdf: env.TOOL_PDF_TIMEOUT,
    validator: env.TOOL_VALIDATOR_TIMEOUT,
    hash: env.TOOL_HASH_TIMEOUT,
    json: env.TOOL_JSON_TIMEOUT,
    file: env.TOOL_FILE_TIMEOUT,
    dbQuery: env.DATABASE_QUERY_TIMEOUT,
    dbMutation: env.DATABASE_MUTATION_TIMEOUT,
  },
  retries: {
    max: env.TOOL_MAX_RETRIES,
    baseDelay: env.TOOL_RETRY_BASE_DELAY,
    maxDelay: env.TOOL_RETRY_MAX_DELAY,
    backoffMultiplier: env.TOOL_RETRY_BACKOFF_MULTIPLIER,
  },
} as const;

export const orchestrationConfig = {
  timeouts: {
    step: env.ORCHESTRATION_STEP_TIMEOUT_MS,
    message: env.ORCHESTRATION_MESSAGE_TIMEOUT_MS,
  },
  maxParallelSteps: env.ORCHESTRATION_MAX_PARALLEL_STEPS,
  throughputWindow: env.ORCHESTRATION_THROUGHPUT_WINDOW_MS,
} as const;

export const emailConfig = {
  smtp: {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER && env.SMTP_PASS ? {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    } : undefined,
  },
  timeout: env.TOOL_EMAIL_TIMEOUT,
} as const;

export const securityConfig = {
  cors: {
    origins: env.CORS_ORIGINS,
    allowedDomains: env.ALLOWED_DOMAINS,
  },
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  },
  secrets: {
    jwt: env.JWT_SECRET,
    encryption: env.ENCRYPTION_KEY,
    webhook: env.WEBHOOK_SECRET,
  },
} as const;

export const monitoringConfig = {
  metrics: {
    enabled: env.ENABLE_METRICS,
    port: env.METRICS_PORT,
  },
  tracing: {
    enabled: env.ENABLE_TRACING,
    jaegerEndpoint: env.JAEGER_ENDPOINT,
  },
} as const;

export const featureFlags = {
  advancedLogging: env.FEATURE_ADVANCED_LOGGING,
  circuitBreaker: env.FEATURE_CIRCUIT_BREAKER,
  requestDeduplication: env.FEATURE_REQUEST_DEDUPLICATION,
  performanceMonitoring: env.FEATURE_PERFORMANCE_MONITORING,
} as const;

// Export validation function for testing
export function validateEnvironment(): { valid: boolean; errors: string[] } {
  try {
    parseEnv();
    return { valid: true, errors: [] };
  } catch (error) {
    return {
      valid: false,
      errors: error instanceof Error ? [error.message] : ['Unknown validation error'],
    };
  }
}

// Fail fast on invalid configuration in non-test environments
if (env.NODE_ENV !== 'test') {
  const validation = validateEnvironment();
  if (!validation.valid) {
    console.error('❌ Environment validation failed:');
    validation.errors.forEach(error => console.error(`  ${error}`));
    process.exit(1);
  }
}
