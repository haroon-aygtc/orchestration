// LLM Provider Registry - Centralized Multi-Provider Management
// Supports 8 major LLM providers with smart routing capabilities

export type ProviderId =
  | 'openai'
  | 'anthropic'
  | 'groq'
  | 'openrouter'
  | 'gemini'
  | 'mistral'
  | 'deepseek'
  | 'codestral';

export type ProviderStatus = 'active' | 'inactive' | 'rate_limited' | 'error';

export type ModelCapability =
  | 'text'
  | 'vision'
  | 'function_calling'
  | 'json_mode'
  | 'long_context'
  | 'code_generation'
  | 'multilingual'
  | 'embedding'
  | 'moderation';

export interface LLMModel {
  id: string;
  name: string;
  provider: ProviderId;
  capabilities: ModelCapability[];
  contextWindow: number;
  maxTokens: number;
  pricing: {
    input: number;      // Cost per 1K tokens (input)
    output: number;     // Cost per 1K tokens (output)
    cached?: number;    // Cost per 1K cached tokens
  };
  performance: {
    speed: 'slow' | 'medium' | 'fast' | 'very_fast';
    accuracy: 'low' | 'medium' | 'high' | 'very_high';
    reliability: number; // 0-1 score
  };
  metadata: {
    releaseDate: string;
    deprecated?: boolean;
    version?: string;
    recommendedFor?: string[];
    notRecommendedFor?: string[];
  };
}

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  displayName: string;
  description: string;
  baseUrl: string;
  apiKeyEnvVar: string;
  apiKeyFormat: string;
  models: LLMModel[];
  defaultModel: string;
  status: ProviderStatus;
  capabilities: ModelCapability[];
  pricing: {
    currency: string;
    billing: 'tokens' | 'requests' | 'monthly';
    freeTier?: boolean;
    rateLimits?: {
      requestsPerMinute: number;
      tokensPerMinute: number;
      requestsPerDay: number;
    };
  };
  auth: {
    headerName: string;
    headerPrefix?: string;
    requiresApiKey: boolean;
    supportsCustomBaseUrl: boolean;
  };
  endpoints: {
    chat: string;
    completions: string;
    embeddings: string;
    moderation?: string;
    models: string;
  };
}

export interface ProviderInstance {
  config: ProviderConfig;
  isActive: boolean;
  isRateLimited: boolean;
  errorCount: number;
  lastError?: Date;
  requestCount: number;
  tokenUsage: {
    input: number;
    output: number;
    cached?: number;
  };
  performanceMetrics: {
    averageResponseTime: number;
    successRate: number;
    lastUsed: Date;
  };
}

// Comprehensive provider registry
export class LLMProviderRegistry {
  private providers: Map<ProviderId, ProviderConfig> = new Map();
  private instances: Map<ProviderId, ProviderInstance> = new Map();
  private models: Map<string, LLMModel> = new Map();

  constructor() {
    this.initializeProviders();
    this.initializeInstances();
    this.buildModelIndex();
  }

  private initializeProviders(): void {
    const providers: ProviderConfig[] = [
      {
        id: 'openai',
        name: 'openai',
        displayName: 'OpenAI',
        description: 'Most advanced LLM provider with GPT models',
        baseUrl: 'https://api.openai.com/v1',
        apiKeyEnvVar: 'OPENAI_API_KEY',
        apiKeyFormat: 'sk-...',
        models: [],
        defaultModel: 'gpt-4o-mini',
        status: 'active',
        capabilities: ['text', 'vision', 'function_calling', 'json_mode', 'long_context', 'embedding', 'moderation'],
        pricing: {
          currency: 'USD',
          billing: 'tokens',
          freeTier: true
        },
        auth: {
          headerName: 'Authorization',
          headerPrefix: 'Bearer',
          requiresApiKey: true,
          supportsCustomBaseUrl: true
        },
        endpoints: {
          chat: '/chat/completions',
          completions: '/completions',
          embeddings: '/embeddings',
          moderation: '/moderations',
          models: '/models'
        }
      },
      {
        id: 'anthropic',
        name: 'anthropic',
        displayName: 'Anthropic',
        description: 'Safe and powerful LLM with Claude models',
        baseUrl: 'https://api.anthropic.com/v1',
        apiKeyEnvVar: 'ANTHROPIC_API_KEY',
        apiKeyFormat: 'sk-ant-api03-...',
        models: [],
        defaultModel: 'claude-3-5-sonnet-20241022',
        status: 'active',
        capabilities: ['text', 'vision', 'function_calling', 'json_mode', 'long_context'],
        pricing: {
          currency: 'USD',
          billing: 'tokens',
          freeTier: false
        },
        auth: {
          headerName: 'x-api-key',
          requiresApiKey: true,
          supportsCustomBaseUrl: true
        },
        endpoints: {
          chat: '/messages',
          completions: '/complete',
          embeddings: '/embeddings',
          models: '/models'
        }
      },
      {
        id: 'groq',
        name: 'groq',
        displayName: 'Groq',
        description: 'Fast and cost-effective LLM provider',
        baseUrl: 'https://api.groq.com/openai/v1',
        apiKeyEnvVar: 'GROQ_API_KEY',
        apiKeyFormat: 'gsk_...',
        models: [],
        defaultModel: 'llama-3.3-70b-versatile',
        status: 'active',
        capabilities: ['text', 'function_calling', 'code_generation', 'multilingual'],
        pricing: {
          currency: 'USD',
          billing: 'tokens',
          freeTier: false
        },
        auth: {
          headerName: 'Authorization',
          headerPrefix: 'Bearer',
          requiresApiKey: true,
          supportsCustomBaseUrl: true
        },
        endpoints: {
          chat: '/chat/completions',
          completions: '/completions',
          embeddings: '/embeddings',
          moderation: '/moderations',
          models: '/models'
        }
      },
      {
        id: 'openrouter',
        name: 'openrouter',
        displayName: 'OpenRouter',
        description: 'Unified API for multiple LLM providers',
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKeyEnvVar: 'OPENROUTER_API_KEY',
        apiKeyFormat: 'sk-or-v1-...',
        models: [],
        defaultModel: 'auto',
        status: 'active',
        capabilities: ['text', 'function_calling', 'json_mode', 'multilingual'],
        pricing: {
          currency: 'USD',
          billing: 'tokens',
          freeTier: false
        },
        auth: {
          headerName: 'Authorization',
          headerPrefix: 'Bearer',
          requiresApiKey: true,
          supportsCustomBaseUrl: true
        },
        endpoints: {
          chat: '/chat/completions',
          completions: '/completions',
          embeddings: '/embeddings',
          moderation: '/moderations',
          models: '/models'
        }
      },
      {
        id: 'gemini',
        name: 'gemini',
        displayName: 'Google Gemini',
        description: 'Google\'s advanced multimodal LLM',
        baseUrl: 'https://generativelanguage.googleapis.com/v1',
        apiKeyEnvVar: 'GEMINI_API_KEY',
        apiKeyFormat: 'AIza...',
        models: [],
        defaultModel: 'gemini-pro',
        status: 'active',
        capabilities: ['text', 'vision', 'function_calling', 'json_mode', 'multilingual'],
        pricing: {
          currency: 'USD',
          billing: 'tokens',
          freeTier: true
        },
        auth: {
          headerName: 'x-goog-api-key',
          requiresApiKey: true,
          supportsCustomBaseUrl: false
        },
        endpoints: {
          chat: '/models/{model}/generateContent',
          completions: '/models/{model}/generateContent',
          embeddings: '/models/{model}/generateContent',
          moderation: '/models/{model}/generateContent',
          models: '/models'
        }
      },
      {
        id: 'mistral',
        name: 'mistral',
        displayName: 'Mistral AI',
        description: 'Open-source LLM models with high performance',
        baseUrl: 'https://api.mistral.ai/v1',
        apiKeyEnvVar: 'MISTRAL_API_KEY',
        apiKeyFormat: 'mistral-...',
        models: [],
        defaultModel: 'mistral-large-latest',
        status: 'active',
        capabilities: ['text', 'function_calling', 'json_mode', 'code_generation', 'multilingual'],
        pricing: {
          currency: 'USD',
          billing: 'tokens',
          freeTier: false
        },
        auth: {
          headerName: 'Authorization',
          headerPrefix: 'Bearer',
          requiresApiKey: true,
          supportsCustomBaseUrl: true
        },
        endpoints: {
          chat: '/chat/completions',
          completions: '/completions',
          embeddings: '/embeddings',
          moderation: '/moderations',
          models: '/models'
        }
      },
      {
        id: 'deepseek',
        name: 'deepseek',
        displayName: 'DeepSeek',
        description: 'Advanced reasoning and coding LLM',
        baseUrl: 'https://api.deepseek.com/v1',
        apiKeyEnvVar: 'DEEPSEEK_API_KEY',
        apiKeyFormat: 'sk-...',
        models: [],
        defaultModel: 'deepseek-chat',
        status: 'active',
        capabilities: ['text', 'function_calling', 'json_mode', 'code_generation', 'multilingual'],
        pricing: {
          currency: 'USD',
          billing: 'tokens',
          freeTier: false
        },
        auth: {
          headerName: 'Authorization',
          headerPrefix: 'Bearer',
          requiresApiKey: true,
          supportsCustomBaseUrl: true
        },
        endpoints: {
          chat: '/chat/completions',
          completions: '/completions',
          embeddings: '/embeddings',
          moderation: '/moderations',
          models: '/models'
        }
      },
      {
        id: 'codestral',
        name: 'codestral',
        displayName: 'CodeStral',
        description: 'Specialized coding LLM by Mistral',
        baseUrl: 'https://codestral.mistral.ai/v1',
        apiKeyEnvVar: 'CODESTRAL_API_KEY',
        apiKeyFormat: 'mistral-...',
        models: [],
        defaultModel: 'codestral-mamba-latest',
        status: 'active',
        capabilities: ['text', 'function_calling', 'code_generation', 'multilingual'],
        pricing: {
          currency: 'USD',
          billing: 'tokens',
          freeTier: false
        },
        auth: {
          headerName: 'Authorization',
          headerPrefix: 'Bearer',
          requiresApiKey: true,
          supportsCustomBaseUrl: true
        },
        endpoints: {
          chat: '/chat/completions',
          completions: '/completions',
          embeddings: '/embeddings',
          moderation: '/moderations',
          models: '/models'
        }
      }
    ];

    providers.forEach(provider => this.providers.set(provider.id, provider));
  }

  private initializeInstances(): void {
    this.providers.forEach(provider => {
      const instance: ProviderInstance = {
        config: provider,
        isActive: this.isProviderConfigured(provider),
        isRateLimited: false,
        errorCount: 0,
        requestCount: 0,
        tokenUsage: { input: 0, output: 0 },
        performanceMetrics: {
          averageResponseTime: 0,
          successRate: 1.0,
          lastUsed: new Date()
        }
      };
      this.instances.set(provider.id, instance);
    });
  }

  private buildModelIndex(): void {
    this.providers.forEach(provider => {
      provider.models.forEach(model => {
        this.models.set(model.id, model);
      });
    });
  }

  private isProviderConfigured(provider: ProviderConfig): boolean {
    return process.env[provider.apiKeyEnvVar] !== undefined;
  }

  // Public API methods
  getProvider(providerId: ProviderId): ProviderConfig | undefined {
    return this.providers.get(providerId);
  }

  getProviderInstance(providerId: ProviderId): ProviderInstance | undefined {
    return this.instances.get(providerId);
  }

  getAllProviders(): ProviderConfig[] {
    return Array.from(this.providers.values());
  }

  getActiveProviders(): ProviderConfig[] {
    return this.getAllProviders().filter(provider => {
      const instance = this.instances.get(provider.id);
      return instance?.isActive && provider.status === 'active';
    });
  }

  getModel(modelId: string): LLMModel | undefined {
    return this.models.get(modelId);
  }

  getModelsByProvider(providerId: ProviderId): LLMModel[] {
    const provider = this.providers.get(providerId);
    return provider ? provider.models : [];
  }

  getModelsByCapability(capability: ModelCapability): LLMModel[] {
    return Array.from(this.models.values()).filter(model =>
      model.capabilities.includes(capability)
    );
  }

  getModelsByPerformance(speed?: string, accuracy?: string): LLMModel[] {
    return Array.from(this.models.values()).filter(model => {
      if (speed && model.performance.speed !== speed) return false;
      if (accuracy && model.performance.accuracy !== accuracy) return false;
      return true;
    });
  }

  updateProviderStatus(providerId: ProviderId, status: ProviderStatus): void {
    const provider = this.providers.get(providerId);
    if (provider) {
      provider.status = status;
    }
  }

  updateInstanceMetrics(providerId: ProviderId, metrics: Partial<ProviderInstance>): void {
    const instance = this.instances.get(providerId);
    if (instance) {
      Object.assign(instance, metrics);
    }
  }

  // Provider validation
  validateProviderConfig(providerId: ProviderId): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const provider = this.providers.get(providerId);
    const instance = this.instances.get(providerId);

    if (!provider) {
      return { isValid: false, errors: ['Provider not found'], warnings: [] };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    if (!instance?.isActive) {
      errors.push(`Provider ${providerId} is not configured (missing ${provider.apiKeyEnvVar})`);
    }

    if (provider.status !== 'active') {
      warnings.push(`Provider ${providerId} status is ${provider.status}`);
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  // Model discovery and validation
  async discoverModels(providerId: ProviderId): Promise<LLMModel[]> {
    const provider = this.providers.get(providerId);
    const instance = this.instances.get(providerId);

    if (!provider || !instance?.isActive) {
      throw new Error(`Provider ${providerId} not configured or inactive`);
    }

    try {
      const response = await fetch(`${provider.baseUrl}${provider.endpoints.models}`, {
        headers: {
          [provider.auth.headerName]: provider.auth.headerPrefix
            ? `${provider.auth.headerPrefix} ${process.env[provider.apiKeyEnvVar]}`
            : process.env[provider.apiKeyEnvVar]!
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const data = await response.json();
      const discoveredModels = this.parseModelsFromResponse(providerId, data);

      // Update provider models
      provider.models = discoveredModels;
      this.buildModelIndex();

      return discoveredModels;
    } catch (error) {
      console.error(`Failed to discover models for ${providerId}:`, error);
      throw error;
    }
  }

  private parseModelsFromResponse(providerId: ProviderId, response: any): LLMModel[] {
    const provider = this.providers.get(providerId)!;
    const models: LLMModel[] = [];

    // Provider-specific parsing logic
    switch (providerId) {
      case 'openai':
        models.push(...this.parseOpenAIModels(response));
        break;
      case 'anthropic':
        models.push(...this.parseAnthropicModels(response));
        break;
      case 'groq':
        models.push(...this.parseGroqModels(response));
        break;
      case 'openrouter':
        models.push(...this.parseOpenRouterModels(response));
        break;
      case 'gemini':
        models.push(...this.parseGeminiModels(response));
        break;
      case 'mistral':
        models.push(...this.parseMistralModels(response));
        break;
      case 'deepseek':
        models.push(...this.parseDeepSeekModels(response));
        break;
      case 'codestral':
        models.push(...this.parseCodestralModels(response));
        break;
    }

    return models;
  }

  private parseOpenAIModels(response: any): LLMModel[] {
    return response.data.map((model: any) => ({
      id: model.id,
      name: model.id,
      provider: 'openai' as ProviderId,
      capabilities: this.mapOpenAICapabilities(model),
      contextWindow: model.context_window || 128000,
      maxTokens: model.max_tokens || 4096,
      pricing: this.getOpenAIPricing(model.id),
      performance: this.estimateOpenAIPerformance(model.id),
      metadata: {
        releaseDate: model.created ? new Date(model.created * 1000).toISOString() : new Date().toISOString(),
        deprecated: model.deprecated || false,
        version: model.version || '1.0'
      }
    }));
  }

  private parseAnthropicModels(response: any): LLMModel[] {
    // Anthropic doesn't have a public models endpoint, so we use known models
    return [
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        provider: 'anthropic',
        capabilities: ['text', 'vision', 'function_calling', 'json_mode', 'long_context'],
        contextWindow: 200000,
        maxTokens: 8192,
        pricing: { input: 3.0, output: 15.0 },
        performance: { speed: 'fast', accuracy: 'very_high', reliability: 0.95 },
        metadata: { releaseDate: '2024-10-22', version: '3.5' }
      },
      {
        id: 'claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        provider: 'anthropic',
        capabilities: ['text', 'function_calling', 'json_mode'],
        contextWindow: 200000,
        maxTokens: 4096,
        pricing: { input: 0.25, output: 1.25 },
        performance: { speed: 'very_fast', accuracy: 'high', reliability: 0.92 },
        metadata: { releaseDate: '2024-03-07', version: '3.0' }
      }
    ];
  }

  private parseGroqModels(response: any): LLMModel[] {
    return response.data.map((model: any) => ({
      id: model.id,
      name: model.id,
      provider: 'groq',
      capabilities: this.mapGroqCapabilities(model),
      contextWindow: model.context_window || 131072,
      maxTokens: model.max_tokens || 4096,
      pricing: this.getGroqPricing(model.id),
      performance: this.estimateGroqPerformance(model.id),
      metadata: { releaseDate: model.created || new Date().toISOString() }
    }));
  }

  private parseOpenRouterModels(response: any): LLMModel[] {
    return response.data.map((model: any) => ({
      id: model.id,
      name: model.name,
      provider: 'openrouter',
      capabilities: model.capabilities || ['text'],
      contextWindow: model.context_length || 128000,
      maxTokens: model.max_tokens || 4096,
      pricing: { input: model.pricing?.input || 0, output: model.pricing?.output || 0 },
      performance: { speed: 'medium', accuracy: 'high', reliability: 0.90 },
      metadata: { releaseDate: model.created_at || new Date().toISOString() }
    }));
  }

  private parseGeminiModels(response: any): LLMModel[] {
    return response.models?.map((model: any) => ({
      id: model.name,
      name: model.displayName,
      provider: 'gemini',
      capabilities: this.mapGeminiCapabilities(model),
      contextWindow: model.inputTokenLimit || 30720,
      maxTokens: model.outputTokenLimit || 2048,
      pricing: this.getGeminiPricing(model.name),
      performance: this.estimateGeminiPerformance(model.name),
      metadata: { releaseDate: model.version || new Date().toISOString() }
    })) || [];
  }

  private parseMistralModels(response: any): LLMModel[] {
    return response.data.map((model: any) => ({
      id: model.id,
      name: model.id,
      provider: 'mistral',
      capabilities: this.mapMistralCapabilities(model),
      contextWindow: model.context_length || 32768,
      maxTokens: model.max_tokens || 4096,
      pricing: this.getMistralPricing(model.id),
      performance: this.estimateMistralPerformance(model.id),
      metadata: { releaseDate: model.created || new Date().toISOString() }
    }));
  }

  private parseDeepSeekModels(response: any): LLMModel[] {
    return response.data.map((model: any) => ({
      id: model.id,
      name: model.id,
      provider: 'deepseek',
      capabilities: this.mapDeepSeekCapabilities(model),
      contextWindow: model.context_length || 32768,
      maxTokens: model.max_tokens || 4096,
      pricing: this.getDeepSeekPricing(model.id),
      performance: this.estimateDeepSeekPerformance(model.id),
      metadata: { releaseDate: model.created || new Date().toISOString() }
    }));
  }

  private parseCodestralModels(response: any): LLMModel[] {
    return response.data.map((model: any) => ({
      id: model.id,
      name: model.id,
      provider: 'codestral',
      capabilities: ['text', 'function_calling', 'code_generation'],
      contextWindow: model.context_length || 32768,
      maxTokens: model.max_tokens || 4096,
      pricing: this.getCodestralPricing(model.id),
      performance: this.estimateCodestralPerformance(model.id),
      metadata: { releaseDate: model.created || new Date().toISOString() }
    }));
  }

  // Helper methods for capabilities and pricing
  private mapOpenAICapabilities(model: any): ModelCapability[] {
    const caps: ModelCapability[] = ['text'];
    if (model.id.includes('vision')) caps.push('vision');
    if (model.id.includes('turbo') || model.id.includes('gpt-4')) caps.push('function_calling');
    if (model.id.includes('embedding')) caps.push('embedding');
    return caps;
  }

  private mapGroqCapabilities(model: any): ModelCapability[] {
    const caps: ModelCapability[] = ['text', 'function_calling'];
    if (model.id.includes('vision')) caps.push('vision');
    return caps;
  }

  private mapGeminiCapabilities(model: any): ModelCapability[] {
    const caps: ModelCapability[] = ['text', 'vision', 'function_calling', 'multilingual'];
    return caps;
  }

  private mapMistralCapabilities(model: any): ModelCapability[] {
    const caps: ModelCapability[] = ['text', 'function_calling', 'code_generation', 'multilingual'];
    if (model.id.includes('large')) caps.push('json_mode');
    return caps;
  }

  private mapDeepSeekCapabilities(model: any): ModelCapability[] {
    const caps: ModelCapability[] = ['text', 'function_calling', 'code_generation', 'multilingual'];
    if (model.id.includes('chat')) caps.push('json_mode');
    return caps;
  }

  // Pricing estimation methods
  private getOpenAIPricing(modelId: string): { input: number; output: number } {
    const pricing: Record<string, { input: number; output: number }> = {
      'gpt-4o': { input: 2.5, output: 10.0 },
      'gpt-4o-mini': { input: 0.15, output: 0.6 },
      'gpt-4-turbo': { input: 10.0, output: 30.0 },
      'gpt-3.5-turbo': { input: 1.5, output: 2.0 }
    };
    return pricing[modelId] || { input: 2.5, output: 10.0 };
  }

  private getGroqPricing(modelId: string): { input: number; output: number } {
    const pricing: Record<string, { input: number; output: number }> = {
      'llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },
      'llama-3.2-11b-vision-preview': { input: 0.04, output: 0.04 },
      'mixtral-8x7b-32768': { input: 0.24, output: 0.24 }
    };
    return pricing[modelId] || { input: 0.1, output: 0.1 };
  }

  private getGeminiPricing(modelId: string): { input: number; output: number } {
    const pricing: Record<string, { input: number; output: number }> = {
      'gemini-pro': { input: 0.5, output: 1.5 },
      'gemini-pro-vision': { input: 0.5, output: 1.5 }
    };
    return pricing[modelId] || { input: 0.5, output: 1.5 };
  }

  private getMistralPricing(modelId: string): { input: number; output: number } {
    const pricing: Record<string, { input: number; output: number }> = {
      'mistral-large-latest': { input: 2.0, output: 6.0 },
      'mistral-medium': { input: 2.7, output: 8.1 },
      'mistral-small': { input: 1.0, output: 3.0 }
    };
    return pricing[modelId] || { input: 1.0, output: 3.0 };
  }

  private getDeepSeekPricing(modelId: string): { input: number; output: number } {
    const pricing: Record<string, { input: number; output: number }> = {
      'deepseek-chat': { input: 0.14, output: 0.28 },
      'deepseek-coder': { input: 0.14, output: 0.28 }
    };
    return pricing[modelId] || { input: 0.14, output: 0.28 };
  }

  private getCodestralPricing(modelId: string): { input: number; output: number } {
    const pricing: Record<string, { input: number; output: number }> = {
      'codestral-mamba-latest': { input: 1.0, output: 3.0 }
    };
    return pricing[modelId] || { input: 1.0, output: 3.0 };
  }

  // Performance estimation methods
  private estimateOpenAIPerformance(modelId: string): { speed: string; accuracy: string; reliability: number } {
    if (modelId.includes('gpt-4')) return { speed: 'medium', accuracy: 'very_high', reliability: 0.98 };
    if (modelId.includes('turbo')) return { speed: 'fast', accuracy: 'high', reliability: 0.95 };
    return { speed: 'medium', accuracy: 'high', reliability: 0.92 };
  }

  private estimateGroqPerformance(modelId: string): { speed: string; accuracy: string; reliability: number } {
    if (modelId.includes('70b')) return { speed: 'fast', accuracy: 'high', reliability: 0.94 };
    return { speed: 'very_fast', accuracy: 'medium', reliability: 0.90 };
  }

  private estimateGeminiPerformance(modelId: string): { speed: string; accuracy: string; reliability: number } {
    return { speed: 'fast', accuracy: 'high', reliability: 0.93 };
  }

  private estimateMistralPerformance(modelId: string): { speed: string; accuracy: string; reliability: number } {
    if (modelId.includes('large')) return { speed: 'medium', accuracy: 'high', reliability: 0.96 };
    return { speed: 'fast', accuracy: 'medium', reliability: 0.91 };
  }

  private estimateDeepSeekPerformance(modelId: string): { speed: string; accuracy: string; reliability: number } {
    return { speed: 'medium', accuracy: 'high', reliability: 0.92 };
  }

  private estimateCodestralPerformance(modelId: string): { speed: string; accuracy: string; reliability: number } {
    return { speed: 'fast', accuracy: 'high', reliability: 0.94 };
  }
}

// Export singleton instance
export const llmProviderRegistry = new LLMProviderRegistry();
