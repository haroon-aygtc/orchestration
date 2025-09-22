// Production-grade AI Configuration Service with Database Persistence
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { groq } from "@ai-sdk/groq";
// SDK imports commented out due to dependency conflicts - using direct API calls instead
// import { google } from "@ai-sdk/google";
// import { mistral } from "@ai-sdk/mistral";
import { aiConfigDatabase } from "./database/ai-config-db";
import { APIKeyValidator } from './ai-key-validator';
import { AITestingService } from './ai-testing-service';
import { ToastManager, toastManager } from './toast-notifications';
import { 
  type ProviderId, 
  type AIProviderConfig, 
  type AIProviderConfigInput, 
  type AgentAIProvider, 
  type AgentAIMapping,
  type AIRequest,
  type AIResponse
} from './types';
import { llmProviderRegistry } from './llm/providers/registry';
import { llmService, LLMRequest } from './llm/api/llm-service';
import { logError, AppError, ConfigurationError, AIServiceError } from './utils/error-handler';
import { encrypt, decrypt } from './utils/security';
import { logger } from "./utils/structured-logger";

interface AgentAIInfo {
  agentType: string;
  provider: string;
  model: string;
  description: string;
  isConfigured: boolean;
  status: "Ready" | "Needs API Key";
}

export function maskKey(key?: string) {
  if (!key) return "";
  if (key.length <= 8) return "*".repeat(key.length);
  return `${key.slice(0, 4)}${"*".repeat(key.length - 8)}${key.slice(-4)}`;
}

/**
 * Normalize models & handle deprecations.
 */
export function normalizeModel(provider: ProviderId, model: string): string {
  if (provider === "groq") {
    if (model === "llama-3.1-70b-versatile") return "llama-3.3-70b-versatile";
    if (model === "llama-3.1-8b-instant") return "llama-3.2-11b-vision-preview";
  }
  return model;
}

/**
 * Build a concrete model handle for the Vercel AI SDK providers.
 */
export function buildProviderModel(cfg: AIProviderConfig) {
  const model = normalizeModel(cfg.provider as ProviderId, cfg.model);
  const common = { apiKey: cfg.apiKey, baseURL: cfg.baseUrl };

  switch (cfg.provider as ProviderId) {
    case "openai":
      return openai(model);
    case "anthropic":
      return anthropic(model);
    case "groq":
      return groq(model);
    case "openrouter":
      // OpenRouter uses OpenAI-compatible API
      // For now, use default OpenAI client - OpenRouter API key will be handled at request level
      return openai(model);
    case "gemini":
      // Google Gemini - direct API integration (SDK not available)
      throw new Error(`Gemini provider requires direct API implementation: ${cfg.provider}`);
    case "mistral":
      // Mistral AI - direct API integration (SDK not available)
      throw new Error(`Mistral provider requires direct API implementation: ${cfg.provider}`);
    case "deepseek":
      // DeepSeek integration - uses OpenAI-compatible API
      return openai(model);
    case "codestral":
      // CodeStral integration - uses OpenAI-compatible API
      return openai(model);
    default:
      throw new Error(`Unsupported provider: ${cfg.provider}`);
  }
}

export class AIConfigService {
  private static instance: AIConfigService;
  private configs: Map<ProviderId, AIProviderConfig> = new Map();
  private defaultProvider: ProviderId = "groq";
  private initialized: boolean = false;
  private registry = llmProviderRegistry;

  // Use smart routing instead of hardcoded mappings
  private smartRoutingEnabled: boolean = true;

  // Agent mappings - lazy loaded from database
  private agentMappings: AgentAIMapping = {};

  static getInstance(): AIConfigService {
    if (!AIConfigService.instance) AIConfigService.instance = new AIConfigService();
    return AIConfigService.instance;
  }

  /**
   * Initialize service by loading configurations from database
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Load configurations from database
      const dbConfigs = await aiConfigDatabase.getProviderConfigs();
      
      // Populate memory cache with decrypted API keys
      for (const config of dbConfigs) {
        try {
          const decryptedApiKey = decrypt(config.apiKey);
          const configWithDecryptedKey = { ...config, apiKey: decryptedApiKey };
          this.configs.set(config.provider as ProviderId, configWithDecryptedKey);
        } catch (error) {
          console.warn(`[ai] Failed to decrypt API key for ${config.provider}:`, error);
          // Use config as-is if decryption fails
          this.configs.set(config.provider as ProviderId, config);
        }
      }

      // Load from environment variables as fallback
      await this.loadFromEnv();

      this.initialized = true;
      logger.info(`[ai] AIConfigService initialized with ${this.configs.size} providers`);
    } catch (error) {
      console.error('[ai] Failed to initialize AIConfigService:', error);
      // Fallback to environment variables only
      await this.loadFromEnv();
      this.initialized = true;
    }
  }

  /**
   * Configure providers from environment variables and save to database
   */
  async loadFromEnv(): Promise<void> {
    const envs: { id: ProviderId; key: string | undefined; model: string | undefined; base?: string; to?: string | undefined }[] = [
      { id: "groq",       key: process.env.GROQ_API_KEY,       model: process.env.GROQ_MODEL,       base: process.env.GROQ_BASE_URL,       to: process.env.GROQ_TIMEOUT_MS },
      { id: "openai",     key: process.env.OPENAI_API_KEY,     model: process.env.OPENAI_MODEL,     base: process.env.OPENAI_BASE_URL,     to: process.env.OPENAI_TIMEOUT_MS },
      { id: "anthropic",  key: process.env.ANTHROPIC_API_KEY,  model: process.env.ANTHROPIC_MODEL,  base: process.env.ANTHROPIC_BASE_URL,  to: process.env.ANTHROPIC_TIMEOUT_MS },
      { id: "openrouter", key: process.env.OPENROUTER_API_KEY, model: process.env.OPENROUTER_MODEL, base: process.env.OPENROUTER_BASE_URL, to: process.env.OPENROUTER_TIMEOUT_MS },
      { id: "gemini",     key: process.env.GEMINI_API_KEY,     model: process.env.GEMINI_MODEL,     base: process.env.GEMINI_BASE_URL,     to: process.env.GEMINI_TIMEOUT_MS },
      { id: "mistral",    key: process.env.MISTRAL_API_KEY,    model: process.env.MISTRAL_MODEL,    base: process.env.MISTRAL_BASE_URL,    to: process.env.MISTRAL_TIMEOUT_MS },
      { id: "deepseek",   key: process.env.DEEPSEEK_API_KEY,   model: process.env.DEEPSEEK_MODEL,   base: process.env.DEEPSEEK_BASE_URL,   to: process.env.DEEPSEEK_TIMEOUT_MS },
      { id: "codestral",  key: process.env.CODESTRAL_API_KEY,  model: process.env.CODESTRAL_MODEL,  base: process.env.CODESTRAL_BASE_URL,  to: process.env.CODESTRAL_TIMEOUT_MS },
    ];

    for (const e of envs) {
      if (!e.key) continue;
      
      try {
        const config: AIProviderConfigInput = {
        provider: e.id,
        apiKey: e.key,
        model: e.model || this.getDefaultModelFor(e.id),
        maxTokens: this.defaultMaxTokensFor(e.id),
          temperature: 0.2,
        baseUrl: e.base,
        timeoutMs: e.to ? parseInt(e.to, 10) : undefined,
          isActive: true,
        };
        
        // Save to database
        const savedConfig = await aiConfigDatabase.saveProviderConfig(config as Omit<AIProviderConfig, "id" | "createdAt" | "updatedAt">);
        this.configs.set(e.id, savedConfig);
      } catch (error) {
        console.error(`[ai] Failed to save provider config for ${e.id}:`, error);
      }
    }

    const def = (process.env.AI_PROVIDER as ProviderId | undefined)?.toLowerCase() as ProviderId | undefined;
    if (def && this.configs.has(def)) this.setDefaultProvider(def);
  }


  private getDefaultModelFor(provider: ProviderId): string {
    // Use registry to get default model
    try {
      const providerConfig = this.registry.getProvider(provider);
      return providerConfig?.defaultModel || 'gpt-4o-mini';
    } catch (error) {
      logError(error as Error, 'getDefaultModelFor');
      return 'gpt-4o-mini'; // fallback
    }
  }

  private defaultMaxTokensFor(_provider: ProviderId): number {
    return 4096;
  }

  /**
   * Validate API key before saving (pre-save validation)
   */
  private async validateApiKey(providerId: ProviderId, apiKey: string, model: string): Promise<{ isValid: boolean; error?: string; warnings?: string[] }> {
    try {
      // 1. Format validation
      const formatResult = APIKeyValidator.validateFormat(providerId, apiKey);
      if (!formatResult.isValid) {
        return {
          isValid: false,
          error: formatResult.error || 'Invalid API key format'
        };
      }

      // 2. Test API key functionality
      const testingService = AITestingService.getInstance();
      const testResult = await testingService.testApiKey(providerId, apiKey, model);
      
      if (!testResult.success) {
        return {
          isValid: false,
          error: testResult.error || 'API key validation failed'
        };
      }

      // 3. Check for warnings
      const warnings: string[] = [];
      if (testResult.warnings && testResult.warnings.length > 0) {
        warnings.push(...testResult.warnings);
      }

      return {
        isValid: true,
        warnings: warnings.length > 0 ? warnings : undefined
      };

    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown validation error'
      };
    }
  }

  /**
   * Set provider configuration and save to database with pre-save validation
   */
  async setProviderConfig(providerId: ProviderId, config: AIProviderConfigInput): Promise<void> {
    if (config.provider !== providerId) {
      throw new Error(`Provider mismatch: map key=${providerId} payload=${config.provider}`);
    }
    if (!config.apiKey || typeof config.apiKey !== "string") {
      throw new Error(`Missing API key for provider ${providerId}`);
    }
    if (!config.model) {
      throw new Error(`Missing model for provider ${providerId}`);
    }

    // Normalize deprecated models
    const normalizedModel = normalizeModel(config.provider, config.model);
    const finalCfg: AIProviderConfigInput = { ...config, model: normalizedModel };

    try {
      // Show loading toast
      const loadingToastId = toastManager.add(ToastManager.aiProvider.testingInProgress(providerId));

      // Pre-save validation
      const validation = await this.validateApiKey(providerId, finalCfg.apiKey, normalizedModel);
      
      // Remove loading toast
      toastManager.remove(loadingToastId);

      if (!validation.isValid) {
        // Show error toast
        toastManager.add(ToastManager.aiProvider.keyValidationFailed(providerId, validation.error || 'Unknown error'));
        throw new Error(validation.error || 'API key validation failed');
      }

      // Show warnings if any
      if (validation.warnings && validation.warnings.length > 0) {
        validation.warnings.forEach(warning => {
          toastManager.add(ToastManager.general.warning('Validation Warning', warning));
        });
      }

        // Encrypt API key before saving
        const encryptedApiKey = encrypt(finalCfg.apiKey);
        const configToSave = { ...finalCfg, apiKey: encryptedApiKey };

        // Save to database
        const savedConfig = await aiConfigDatabase.saveProviderConfig(configToSave as Omit<AIProviderConfig, "id" | "createdAt" | "updatedAt">);

        // Decrypt API key for memory cache
        const decryptedApiKey = decrypt(encryptedApiKey);
        const configWithDecryptedKey = { ...savedConfig, apiKey: decryptedApiKey };
      
      // Update memory cache with decrypted API key
      this.configs.set(providerId, configWithDecryptedKey);
      
      // Show success toast
      toastManager.add(ToastManager.aiProvider.keyValidated(providerId));
      
      logger.info(`[ai] Provider ${providerId} configured and saved to database (model=${savedConfig.model}, key=${maskKey(savedConfig.apiKey)})`);
    } catch (error) {
      console.error(`[ai] Failed to save provider config for ${providerId}:`, error);
      throw error;
    }
  }

  /**
   * Set agent AI provider mapping
   */
  async setAgentMapping(agentType: string, mapping: { provider: ProviderId; model: string; description?: string }): Promise<void> {
    this.agentMappings[agentType] = {
      provider: mapping.provider,
      model: mapping.model,
      description: mapping.description || this.agentMappings[agentType]?.description || agentType,
    };

    // Find or create provider config
    const providerConfig = await aiConfigDatabase.getProviderConfig(mapping.provider, mapping.model);
    if (providerConfig) {
      await aiConfigDatabase.setAgentProvider(agentType, providerConfig.id, true, 0);
    }
  }

  async setDefaultProvider(providerId: ProviderId): Promise<void> {
    if (!this.configs.has(providerId)) {
      throw new Error(`Cannot set default provider to "${providerId}" because it is not configured`);
    }
    this.defaultProvider = providerId;
    logger.info(`[ai] Default provider set to ${providerId}`);
  }

  /**
   * Get model for agent using smart routing
   */
  async getModelForAgent(agentType: string, request?: LLMRequest) {
    await this.initialize();

    // Use smart routing for optimal provider/model selection
    if (this.smartRoutingEnabled) {
      try {
        // Create task requirements based on agent type and request
        const requirements = this.createTaskRequirements(agentType, request);

        // Get optimal provider/model using smart routing
        const routing = await this.getSmartRoutingDecision(agentType, requirements);

        // Get configured provider for the selected provider
        const cfg = this.configs.get(routing.providerId);
        if (!cfg || !cfg.apiKey) {
          throw new Error(`AI provider ${routing.providerId} not configured for agent ${agentType}`);
        }

        const effective: AIProviderConfig = {
          ...cfg,
          model: routing.modelId,
          provider: routing.providerId as any
        };

        logger.info(`🎯 Smart routing selected: ${routing.providerId}/${routing.modelId} for ${agentType}`);
        return buildProviderModel(effective);
      } catch (error) {
        console.warn(`[ai] Smart routing failed for ${agentType}, falling back to default:`, error);
      }
    }

    // Fallback to legacy method for backward compatibility
    return this.getDefaultModelForAgent(agentType);
  }

  private createTaskRequirements(agentType: string, request?: LLMRequest) {
    const baseRequirements = {
      taskType: this.mapAgentTypeToTaskType(agentType),
      complexity: this.mapAgentTypeToComplexity(agentType),
      requiredCapabilities: this.mapAgentTypeToCapabilities(agentType),
      maxCostPer1K: 0.1, // $0.10 per 1K tokens default
      maxLatency: 5000, // 5 seconds default
      contextLength: request?.messages?.length || 1000,
      maxTokens: request?.maxTokens || 2000,
      costSensitive: true,
      speedSensitive: false,
      accuracySensitive: false
    };

    // Adjust based on request characteristics
    if (request?.tools && request.tools.length > 0) {
      baseRequirements.complexity = 'high';
      baseRequirements.accuracySensitive = true;
    }

    if (request?.maxTokens && request.maxTokens > 4000) {
      baseRequirements.complexity = 'high';
    }

    return baseRequirements;
  }

  private mapAgentTypeToTaskType(agentType: string): any {
    const mapping: Record<string, any> = {
      'intent': 'chat',
      'retriever': 'analysis',
      'tool': 'reasoning',
      'workflow': 'reasoning',
      'memory': 'chat',
      'follow': 'analysis',
      'formatter': 'chat',
      'guardrail': 'analysis',
      'llm': 'chat'
    };
    return mapping[agentType] || 'chat';
  }

  private mapAgentTypeToComplexity(agentType: string): any {
    const mapping: Record<string, any> = {
      'intent': 'low',
      'retriever': 'medium',
      'tool': 'high',
      'workflow': 'high',
      'memory': 'medium',
      'follow': 'medium',
      'formatter': 'low',
      'guardrail': 'medium',
      'llm': 'medium'
    };
    return mapping[agentType] || 'medium';
  }

  private mapAgentTypeToCapabilities(agentType: string): any[] {
    const mapping: Record<string, any[]> = {
      'intent': ['text'],
      'retriever': ['text', 'json_mode'],
      'tool': ['text', 'function_calling'],
      'workflow': ['text', 'function_calling'],
      'memory': ['text'],
      'follow': ['text', 'json_mode'],
      'formatter': ['text'],
      'guardrail': ['text', 'json_mode'],
      'llm': ['text', 'function_calling']
    };
    return mapping[agentType] || ['text'];
  }

  private async getSmartRoutingDecision(agentType: string, requirements: any) {
    // For now, use a simple fallback strategy
    // In production, this would use the smart router
    const availableProviders = Array.from(this.configs.keys()).filter(providerId => {
      const instance = this.configs.get(providerId);
      return instance?.isActive && instance?.apiKey;
    });

    if (availableProviders.length === 0) {
      throw new Error('No configured AI providers available');
    }

    // Simple fallback strategy - prefer providers based on agent type
    const providerPreferences: Record<string, string[]> = {
      'intent': ['groq', 'openai', 'anthropic'],
      'retriever': ['groq', 'openai', 'gemini'],
      'tool': ['openai', 'anthropic', 'groq'],
      'workflow': ['openai', 'anthropic', 'groq'],
      'memory': ['groq', 'openai', 'anthropic'],
      'follow': ['openai', 'anthropic', 'groq'],
      'formatter': ['groq', 'openai', 'anthropic'],
      'guardrail': ['anthropic', 'openai', 'groq'],
      'llm': ['groq', 'openai', 'anthropic']
    };

    const preferredProviders = providerPreferences[agentType] || ['groq', 'openai', 'anthropic'];
    const selectedProvider = availableProviders.find(p => preferredProviders.includes(p)) || availableProviders[0];

    // Get default model for the provider
    const provider = this.configs.get(selectedProvider);
    if (!provider) {
      throw new Error(`Selected provider ${selectedProvider} not found`);
    }

    return {
      providerId: selectedProvider,
      modelId: provider.model,
      reasoning: `Selected ${selectedProvider} for ${agentType} based on preferences`,
      confidence: 0.8
    };
  }

  private async getDefaultModelForAgent(agentType: string) {
    // Legacy fallback method
    const mapping = {
      intent: 'groq',
      retriever: 'groq',
      tool: 'groq',
      workflow: 'groq',
      memory: 'groq',
      follow: 'groq',
      formatter: 'groq',
      guardrail: 'groq',
      llm: 'groq'
    };

    const provider = mapping[agentType as keyof typeof mapping] || 'groq';
    const cfg = this.configs.get(provider as ProviderId);
    if (!cfg || !cfg.apiKey) {
      throw new Error(`AI provider ${provider} not configured for agent ${agentType}`);
    }

    const effective: AIProviderConfig = { ...cfg, model: cfg.model };
    return buildProviderModel(effective);
  }

  async getConfiguredModel(providerId?: ProviderId) {
    await this.initialize();
    
    const id = providerId || this.defaultProvider;
    const cfg = this.configs.get(id);
    if (!cfg || !cfg.apiKey) throw new Error(`AI provider ${id} not configured or missing API key`);
    return buildProviderModel(cfg);
  }

  getTimeoutMs(providerId?: ProviderId): number {
    const id = providerId || this.defaultProvider;
    const cfg = this.configs.get(id);
    if (cfg?.timeoutMs && Number.isFinite(cfg.timeoutMs)) return cfg.timeoutMs!;
    
    const envKey =
      id === "groq" ? process.env.GROQ_TIMEOUT_MS :
      id === "openai" ? process.env.OPENAI_TIMEOUT_MS :
      id === "anthropic" ? process.env.ANTHROPIC_TIMEOUT_MS :
      undefined;
    return envKey ? parseInt(envKey, 10) : 30_000;
  }

  getAgentMappings(): AgentAIMapping {
    return this.agentMappings;
  }

  async getAgentAIInfo(agentType: string): Promise<AgentAIInfo> {
    await this.initialize();
    
    const mapping = this.agentMappings[agentType];
    const cfg = mapping ? this.configs.get(mapping.provider) : undefined;
    
    return {
      agentType,
      provider: mapping?.provider || "Not configured",
      model: mapping?.model || "Not configured",
      description: mapping?.description || "No description",
      isConfigured: !!(cfg && cfg.apiKey),
      status: cfg && cfg.apiKey ? "Ready" : "Needs API Key",
    };
  }

  getProviderConfig(providerId: ProviderId): AIProviderConfig | null {
    return this.configs.get(providerId) || null;
  }

  isConfigured(providerId?: ProviderId): boolean {
    const id = providerId || this.defaultProvider;
    const cfg = this.configs.get(id);
    return !!(cfg && cfg.apiKey);
  }

  /**
   * Get model by provider and model name
   */
  async getModel(provider: ProviderId, model?: string) {
    await this.initialize();
    
    const cfg = await aiConfigDatabase.getProviderConfig(provider, model);
    if (!cfg || !cfg.apiKey) throw new Error(`AI provider ${provider} not configured`);
    
    const effective: AIProviderConfig = { ...cfg, model: model ? normalizeModel(provider, model) : cfg.model };
    return buildProviderModel(effective);
  }

  /**
   * Get all available models for a provider
   */
  async getAvailableModels(provider: ProviderId): Promise<string[]> {
    await this.initialize();
    
    try {
      const configs = await aiConfigDatabase.getProviderConfigs();
      return configs
        .filter(config => config.provider === provider && config.isActive)
        .map(config => config.model);
    } catch (error) {
      logError(error as Error, 'getAvailableModels');
      return [];
    }
  }

  /**
   * Get all provider configurations
   */
  async getProviderConfigs(): Promise<AIProviderConfig[]> {
    await this.initialize();
    
    try {
      return await aiConfigDatabase.getProviderConfigs();
    } catch (error) {
      logError(error as Error, 'getProviderConfigs');
      return [];
    }
  }

  /**
   * Get agent AI providers
   */
  async getAgentProviders(agentName: string): Promise<AgentAIProvider[]> {
    await this.initialize();
    
    try {
      return await aiConfigDatabase.getAgentProviders(agentName);
    } catch (error) {
      logError(error as Error, 'getAgentProviders');
      return [];
    }
  }

  // ========== Direct AI Service Methods ==========

  /**
   * Make smart AI call using the new LLM service
   */
  async callAI(
    agentName: string,
    messages: Array<{ role: string; content: string }>,
    options?: {
      temperature?: number;
      maxTokens?: number;
      preferredProvider?: string;
      tools?: any[];
      responseFormat?: 'text' | 'json' | 'json_schema';
    }
  ): Promise<AIResponse> {
    await this.initialize();

    try {
      // Use the new LLM service with smart routing
      const request: LLMRequest = {
        messages: messages as any,
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
        tools: options?.tools,
        responseFormat: options?.responseFormat,
        userId: 'system',
        sessionId: `agent-${agentName}`
      };

      const response = await llmService.chat(request);

      return {
        content: response.content,
        usage: {
          promptTokens: response.usage.promptTokens,
          completionTokens: response.usage.completionTokens,
          totalTokens: response.usage.totalTokens
        },
        responseTime: response.responseTime,
        provider: response.provider,
        model: response.model,
        finishReason: response.finishReason,
        toolCalls: response.toolCalls,
        rawResponse: response.rawResponse
      };

    } catch (error) {
      logError(error as Error, 'callAI');
      throw new AIServiceError(`AI call failed for ${agentName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute AI request with specific provider
   */
  private async executeAIRequest(provider: any, request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();
    const providerConfig = this.registry.getProvider(provider.name as ProviderId);
    const baseUrl = providerConfig?.baseUrl || 'https://api.openai.com/v1';

    let response: Response;
    let requestBody: any;

    switch (provider.name.toLowerCase()) {
      case 'openai':
        requestBody = {
          model: request.model,
          messages: request.messages,
          temperature: request.temperature || 0.7,
          max_tokens: request.maxTokens || 1000,
        };
        response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${provider.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });
        break;

      case 'anthropic':
        requestBody = {
          model: request.model,
          messages: request.messages,
          max_tokens: request.maxTokens || 1000,
          temperature: request.temperature || 0.7,
        };
        response = await fetch(`${baseUrl}/messages`, {
          method: 'POST',
          headers: {
            'x-api-key': provider.apiKey,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(requestBody),
        });
        break;

      case 'groq':
        requestBody = {
          model: request.model,
          messages: request.messages,
          temperature: request.temperature || 0.7,
          max_tokens: request.maxTokens || 1000,
        };
        response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${provider.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });
        break;

      default:
        throw new AIServiceError(`Unsupported provider: ${provider.name}`);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new AIServiceError(
        `${provider.name} API error: ${response.status} ${response.statusText} - ${errorData.error?.message || ''}`
      );
    }

    const data = await response.json();
    const responseTime = Date.now() - startTime;

    // Parse response based on provider
    if (provider.name.toLowerCase() === 'anthropic') {
      return {
        content: data.content[0].text,
        usage: {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens,
        },
        responseTime,
      };
    } else {
      return {
        content: data.choices[0].message.content,
        usage: {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        },
        responseTime,
      };
    }
  }

  /**
   * Test AI provider configuration
   */
  async testProvider(provider: any, model: string): Promise<{ success: boolean; responseTime: number; error?: string }> {
    try {
      const startTime = Date.now();
      
      const loadingToastId = toastManager.add(ToastManager.aiProvider.testingInProgress(provider.name));
      
      const testMessages = [{ role: "user", content: 'Say "Hello, this is a test"' }];
      const request: AIRequest = {
        provider: provider.name,
        model,
        messages: testMessages,
        maxTokens: 50,
      };

      const response = await this.executeAIRequest(provider, request);
      
      toastManager.remove(loadingToastId);
      toastManager.add(ToastManager.aiProvider.connectionSuccess(provider.name, response.responseTime));

      return {
        success: true,
        responseTime: response.responseTime,
      };
    } catch (error) {
      const loadingToastId = toastManager.add(ToastManager.aiProvider.testingInProgress(provider.name));
      toastManager.remove(loadingToastId);
      
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toastManager.add(ToastManager.aiProvider.connectionFailed(provider.name, errorMessage));

      return {
        success: false,
        responseTime: Date.now(),
        error: errorMessage,
      };
    }
  }
}


// Export agent configurations for UI components
export const agentConfigs = [
  {
    key: 'intent',
    provider: 'smart-routing',
    model: 'auto',
    description: 'Natural language understanding and intent classification',
    name: 'Intent Analysis Agent',
    icon: 'Brain',
    color: 'text-purple-500'
  },
  {
    key: 'retriever',
    provider: 'smart-routing',
    model: 'auto',
    description: 'Fast retrieval and summarization',
    name: 'Data Retrieval Agent',
    icon: 'Search',
    color: 'text-blue-500'
  },
  {
    key: 'tool',
    provider: 'smart-routing',
    model: 'auto',
    description: 'Tool reasoning and execution',
    name: 'Tool Execution Agent',
    icon: 'Wrench',
    color: 'text-green-500'
  },
  {
    key: 'workflow',
    provider: 'smart-routing',
    model: 'auto',
    description: 'Workflow orchestration and planning',
    name: 'Workflow Agent',
    icon: 'GitBranch',
    color: 'text-orange-500'
  },
  {
    key: 'memory',
    provider: 'smart-routing',
    model: 'auto',
    description: 'Memory storage and retrieval',
    name: 'Memory Agent',
    icon: 'Database',
    color: 'text-indigo-500'
  },
  {
    key: 'follow',
    provider: 'smart-routing',
    model: 'auto',
    description: 'Progress tracking and monitoring',
    name: 'Follow Agent',
    icon: 'Eye',
    color: 'text-cyan-500'
  },
  {
    key: 'formatter',
    provider: 'smart-routing',
    model: 'auto',
    description: 'Data formatting and presentation',
    name: 'Formatter Agent',
    icon: 'FileText',
    color: 'text-pink-500'
  },
  {
    key: 'guardrail',
    provider: 'smart-routing',
    model: 'auto',
    description: 'Safety validation and compliance',
    name: 'Guardrail Agent',
    icon: 'Shield',
    color: 'text-red-500'
  },
  {
    key: 'llm',
    provider: 'smart-routing',
    model: 'auto',
    description: 'General language model operations',
    name: 'LLM Agent',
    icon: 'MessageSquare',
    color: 'text-teal-500'
  }
];

export const aiConfigService = AIConfigService.getInstance();

// Auto-initialize on module load
aiConfigService.initialize().catch(error => {
  console.warn(`[ai] Auto-initialization warning: ${error.message}`);
});