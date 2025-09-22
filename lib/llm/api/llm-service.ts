// LLM Service Layer - Unified API for All Providers
// Handles actual communication with LLM providers through a common interface

import { LLMProviderRegistry, ProviderId, LLMModel, llmProviderRegistry } from '../providers/registry';
import { smartLLMRouter, TaskRequirements, RoutingDecision } from '../routing/smart-router';
import { costTracker } from '../monitoring/cost-tracker';
import { circuitBreakerManager } from '../circuit-breaker';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { groq } from '@ai-sdk/groq';

export interface LLMRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    name?: string;
    toolCallId?: string;
  }>;
  temperature?: number;
  maxTokens?: number;
  tools?: any[];
  responseFormat?: 'text' | 'json' | 'json_schema';
  jsonSchema?: any;
  stream?: boolean;
  userId?: string;
  sessionId?: string;
}

export interface LLMResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  responseTime: number;
  provider: ProviderId;
  model: string;
  finishReason: string;
  toolCalls?: any[];
  rawResponse?: any;
}

export interface LLMStreamResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  responseTime: number;
  provider: ProviderId;
  model: string;
  finishReason?: string;
  toolCalls?: any[];
}

export interface LLMError extends Error {
  code: string;
  provider: ProviderId;
  model: string;
  retryable: boolean;
  details?: any;
}

export class LLMService {
  private registry: LLMProviderRegistry;
  private router: typeof smartLLMRouter;
  private budgetTracker = new Map<string, { tokens: number; cost: number }>();

  constructor() {
    this.registry = llmProviderRegistry;
    this.router = smartLLMRouter;
  }

  // Main chat completion method with smart routing and circuit breaker
  async chat(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    const circuitBreaker = circuitBreakerManager.getBreaker('llm-service');
    const correlationId = request.sessionId || 'unknown';

    // Check budget limits
    this.checkBudgetLimits(correlationId, request);

    try {
      return await circuitBreaker.execute(async () => {
        // Determine task requirements
        const requirements = this.analyzeTaskRequirements(request);

        // Get optimal provider/model
        const routing = await this.router.selectOptimalProvider(requirements);

        // Execute request with selected provider
        const response = await this.executeRequest(routing, request);

        // Update metrics and budget
        const responseTime = Date.now() - startTime;
        this.router.updateProviderHealth(routing.providerId, responseTime, true);
        
        // Track usage
        this.trackUsage(correlationId, response.usage?.totalTokens || 0, this.calculateCost(routing.providerId, routing.modelId, response.usage));
        circuitBreaker.recordSuccess(response.usage?.totalTokens,this.calculateCost(routing.providerId, routing.modelId, response.usage));

        return {
          ...response,
          responseTime
        };
      });

    } catch (error) {
      const responseTime = Date.now() - startTime;

      // Update error metrics
      if (error instanceof Error) {
        const llmError = error as LLMError;
        this.router.updateProviderHealth(llmError.provider, responseTime, false);
        circuitBreaker.recordFailure();
      }

      throw error;
    }
  }

  // Streaming chat completion
  async *chatStream(request: LLMRequest): AsyncGenerator<LLMStreamResponse> {
    const startTime = Date.now();

    try {
      // Determine task requirements
      const requirements = this.analyzeTaskRequirements(request);

      // Get optimal provider/model
      const routing = await this.router.selectOptimalProvider(requirements);

      // Execute streaming request
      yield* this.executeStreamRequest(routing, request, startTime);

    } catch (error) {
      const responseTime = Date.now() - startTime;

      // Update error metrics
      if (error instanceof Error) {
        const llmError = error as LLMError;
        this.router.updateProviderHealth(llmError.provider, responseTime, false);
      }

      throw error;
    }
  }

  // Get available models with filtering
  getAvailableModels(filters?: {
    provider?: ProviderId;
    capabilities?: string[];
    maxCost?: number;
    minContextLength?: number;
  }): LLMModel[] {
    const modelsMap = new Map<string, LLMModel>();

    // Get models from all providers
    this.registry.getAllProviders().forEach(provider => {
      provider.models.forEach(model => {
        modelsMap.set(model.id, model);
      });
    });

    let models = Array.from(modelsMap.values());

    if (filters) {
      if (filters.provider) {
        models = models.filter(m => m.provider === filters.provider);
      }

      if (filters.capabilities) {
        models = models.filter(m =>
          filters.capabilities!.every(cap => m.capabilities.includes(cap as any))
        );
      }

      if (filters.maxCost) {
        models = models.filter(m =>
          m.pricing.input <= filters.maxCost! && m.pricing.output <= filters.maxCost!
        );
      }

      if (filters.minContextLength) {
        models = models.filter(m => m.contextWindow >= filters.minContextLength!);
      }
    }

    return models;
  }

  // Get provider status
  getProviderStatus(): Record<ProviderId, {
    isConfigured: boolean;
    isActive: boolean;
    isHealthy: boolean;
    modelCount: number;
    errorRate: number;
  }> {
    const status: Record<string, any> = {};

    this.registry.getAllProviders().forEach(provider => {
      const instance = this.registry.getProviderInstance(provider.id);
      const health = this.router.getProviderHealth()[provider.id];

      status[provider.id] = {
        isConfigured: instance?.isActive || false,
        isActive: provider.status === 'active',
        isHealthy: health?.isHealthy || false,
        modelCount: provider.models.length,
        errorRate: this.router.getMetrics().errorRates[provider.id] || 0
      };
    });

    return status;
  }

  // Budget management methods
  private checkBudgetLimits(correlationId: string, request: LLMRequest): void {
    const maxTokens = parseInt(process.env.LLM_MAX_TOKENS_PER_CORRELATION || '100000');
    const maxCost = parseFloat(process.env.LLM_MAX_COST_PER_CORRELATION || '10.0');
    
    const current = this.budgetTracker.get(correlationId) || { tokens: 0, cost: 0 };
    const estimatedTokens = request.maxTokens || 1000;
    
    if (current.tokens + estimatedTokens > maxTokens) {
      throw new Error(`Token budget exceeded for correlation ${correlationId}. Current: ${current.tokens}, Requested: ${estimatedTokens}, Max: ${maxTokens}`);
    }
    
    if (current.cost > maxCost) {
      throw new Error(`Cost budget exceeded for correlation ${correlationId}. Current: ${current.cost}, Max: ${maxCost}`);
    }
  }

  private trackUsage(correlationId: string, tokens: number, cost: number): void {
    const current = this.budgetTracker.get(correlationId) || { tokens: 0, cost: 0 };
    this.budgetTracker.set(correlationId, {
      tokens: current.tokens + tokens,
      cost: current.cost + cost
    });
  }

  // Private methods
  private analyzeTaskRequirements(request: LLMRequest): TaskRequirements {
    const hasTools = request.tools && request.tools.length > 0;
    const hasSystemMessage = request.messages.some(m => m.role === 'system');
    const messageLength = request.messages.reduce((sum, m) => sum + m.content.length, 0);
    const hasJsonSchema = request.responseFormat === 'json' || request.responseFormat === 'json_schema';

    // Determine task type
    let taskType: TaskRequirements['taskType'] = 'chat';
    let complexity: TaskRequirements['complexity'] = 'medium';

    if (hasTools) {
      taskType = 'reasoning';
      complexity = 'high';
    } else if (hasJsonSchema) {
      taskType = 'analysis';
      complexity = 'medium';
    } else if (messageLength > 10000) {
      taskType = 'analysis';
      complexity = 'high';
    } else if (request.messages.length > 10) {
      taskType = 'reasoning';
      complexity = 'medium';
    }

    // Determine required capabilities
    const requiredCapabilities: any[] = ['text'];
    if (hasTools) requiredCapabilities.push('function_calling');
    if (hasJsonSchema) requiredCapabilities.push('json_mode');

    // Check for vision content
    const hasVision = request.messages.some(m =>
      m.content.includes('data:image') || m.content.includes('image_url')
    );
    if (hasVision) requiredCapabilities.push('vision');

    return {
      taskType,
      complexity,
      requiredCapabilities,
      preferredCapabilities: hasJsonSchema ? ['json_mode'] : undefined,
      maxCostPer1K: 0.1, // $0.10 per 1K tokens default
      maxLatency: 5000, // 5 seconds default
      contextLength: this.estimateContextLength(request.messages),
      maxTokens: request.maxTokens || 2000,
      costSensitive: true,
      speedSensitive: false,
      accuracySensitive: taskType === 'reasoning' || taskType === 'analysis'
    };
  }

  private estimateContextLength(messages: LLMRequest['messages']): number {
    // Rough estimation: 1 token ≈ 4 characters
    return messages.reduce((sum, message) => {
      return sum + message.content.length;
    }, 0) / 4;
  }

  private async executeRequest(
    routing: RoutingDecision,
    request: LLMRequest
  ): Promise<Omit<LLMResponse, 'responseTime'>> {
    const cost = this.calculateCost(routing.providerId, routing.modelId, request.maxTokens || 0);
    const provider = this.registry.getProvider(routing.providerId);
    const instance = this.registry.getProviderInstance(routing.providerId);

    if (!provider || !instance?.isActive) {
      throw this.createLLMError(
        'PROVIDER_NOT_CONFIGURED',
        routing.providerId,
        routing.modelId,
        `Provider ${routing.providerId} not configured or inactive`
      );
    }

    const startTime = Date.now();

    try {
      let response: Omit<LLMResponse, 'responseTime'>;

      switch (routing.providerId) {
        case 'openai':
          response = await this.executeOpenAIRequest(routing, request, startTime);
          break;
        case 'anthropic':
          response = await this.executeAnthropicRequest(routing, request, startTime);
          break;
        case 'groq':
          response = await this.executeGroqRequest(routing, request, startTime);
          break;
        case 'openrouter':
          response = await this.executeOpenRouterRequest(routing, request, startTime);
          break;
        case 'gemini':
          response = await this.executeGeminiRequest(routing, request, startTime);
          break;
        case 'mistral':
          response = await this.executeMistralRequest(routing, request, startTime);
          break;
        case 'deepseek':
          response = await this.executeDeepSeekRequest(routing, request, startTime);
          break;
        case 'codestral':
          response = await this.executeCodestralRequest(routing, request, startTime);
          break;
        default:
          throw this.createLLMError(
            'PROVIDER_NOT_IMPLEMENTED',
            routing.providerId,
            routing.modelId,
            `Provider ${routing.providerId} not implemented`
          );
      }

      // Track successful request
      const responseTime = Date.now() - startTime;
      this.trackSuccessfulRequest(routing, request, response, responseTime);

      return response;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.trackFailedRequest(routing, request, error, responseTime);
      throw this.handleRequestError(error, routing.providerId, routing.modelId);
    }
  }

  private async *executeStreamRequest(
    routing: RoutingDecision,
    request: LLMRequest,
    startTime: number
  ): AsyncGenerator<LLMStreamResponse> {
    // For now, implement basic streaming for OpenAI/Groq
    // Can be extended to other providers as needed

    try {
      if (routing.providerId === 'openai' || routing.providerId === 'groq') {
        yield* this.executeOpenAIStreamRequest(routing, request, startTime);
      } else {
        // Fallback to regular request for non-streaming providers
        const response = await this.executeRequest(routing, request);
        yield {
          content: response.content,
          usage: response.usage,
          responseTime: Date.now() - startTime,
          provider: response.provider,
          model: response.model,
          finishReason: response.finishReason,
          toolCalls: response.toolCalls
        };
      }
    } catch (error) {
      throw this.handleRequestError(error, routing.providerId, routing.modelId);
    }
  }

  // Provider-specific implementations
  private async executeOpenAIRequest(
    routing: RoutingDecision,
    request: LLMRequest,
    startTime: number
  ): Promise<Omit<LLMResponse, 'responseTime'>> {
    const model = openai(routing.modelId);

    // Convert messages to the expected format
    const messages = request.messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      ...(msg.name && { name: msg.name }),
      ...(msg.toolCallId && { toolCallId: msg.toolCallId })
    }));

    const response = await (model as any).chat({
      messages: messages as any,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
      tools: request.tools,
      toolChoice: request.tools ? 'auto' : undefined
    });

    const usage = response.usage || {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0
    };

    return {
      content: response.text,
      usage: {
        promptTokens: usage.promptTokens || 0,
        completionTokens: usage.completionTokens || 0,
        totalTokens: usage.totalTokens || 0
      },
      provider: routing.providerId,
      model: routing.modelId,
      finishReason: response.finishReason || 'stop',
      toolCalls: response.toolCalls,
      rawResponse: response
    };
  }

  private async executeAnthropicRequest(
    routing: RoutingDecision,
    request: LLMRequest,
    startTime: number
  ): Promise<Omit<LLMResponse, 'responseTime'>> {
    const model = anthropic(routing.modelId);

    // Convert messages to Anthropic format
    const messages = request.messages.map(msg => ({
      role: msg.role === 'system' ? 'system' : msg.role === 'user' ? 'user' : msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    }));

    const response = await (model as any).messages({
      messages: messages as any,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
      tools: request.tools?.map(tool => ({
        name: tool.function.name,
        description: tool.function.description,
        inputSchema: tool.function.parameters
      }))
    });

    const usage = response.usage || {
      inputTokens: 0,
      outputTokens: 0
    };

    return {
      content: response.text,
      usage: {
        promptTokens: usage.inputTokens || 0,
        completionTokens: usage.outputTokens || 0,
        totalTokens: (usage.inputTokens || 0) + (usage.outputTokens || 0)
      },
      provider: routing.providerId,
      model: routing.modelId,
      finishReason: response.stopReason || 'stop',
      toolCalls: response.toolCalls,
      rawResponse: response
    };
  }

  private async executeGroqRequest(
    routing: RoutingDecision,
    request: LLMRequest,
    startTime: number
  ): Promise<Omit<LLMResponse, 'responseTime'>> {
    const model = groq(routing.modelId);

    // Convert messages to the expected format
    const messages = request.messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      ...(msg.name && { name: msg.name }),
      ...(msg.toolCallId && { toolCallId: msg.toolCallId })
    }));

    const response = await (model as any).chat({
      messages: messages as any,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
      tools: request.tools
    });

    const usage = response.usage || {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0
    };

    return {
      content: response.text,
      usage: {
        promptTokens: usage.promptTokens || 0,
        completionTokens: usage.completionTokens || 0,
        totalTokens: usage.totalTokens || 0
      },
      provider: routing.providerId,
      model: routing.modelId,
      finishReason: response.finishReason || 'stop',
      toolCalls: response.toolCalls,
      rawResponse: response
    };
  }

  private async executeOpenRouterRequest(
    routing: RoutingDecision,
    request: LLMRequest,
    startTime: number
  ): Promise<Omit<LLMResponse, 'responseTime'>> {
    const provider = this.registry.getProvider('openrouter')!;
    const apiKey = process.env[provider.apiKeyEnvVar];

    if (!apiKey) {
      throw this.createLLMError(
        'API_KEY_MISSING',
        'openrouter',
        routing.modelId,
        'OpenRouter API key not configured'
      );
    }

    const response = await fetch(`${provider.baseUrl}${provider.endpoints.chat}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: routing.modelId,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        tools: request.tools,
        stream: false
      })
    });

    if (!response.ok) {
      throw this.createLLMError(
        'API_ERROR',
        'openrouter',
        routing.modelId,
        `HTTP ${response.status}: ${response.statusText}`
      );
    }

    const data = await response.json();
    const usage = data.usage || {};

    return {
      content: data.choices[0]?.message?.content || '',
      usage: {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0
      },
      provider: routing.providerId,
      model: routing.modelId,
      finishReason: data.choices[0]?.finish_reason || 'stop',
      toolCalls: data.choices[0]?.message?.tool_calls,
      rawResponse: data
    };
  }

  private async executeGeminiRequest(
    routing: RoutingDecision,
    request: LLMRequest,
    startTime: number
  ): Promise<Omit<LLMResponse, 'responseTime'>> {
    const provider = this.registry.getProvider('gemini')!;
    const apiKey = process.env[provider.apiKeyEnvVar];

    if (!apiKey) {
      throw this.createLLMError(
        'API_KEY_MISSING',
        'gemini',
        routing.modelId,
        'Gemini API key not configured'
      );
    }

    const geminiMessages = request.messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : msg.role,
      parts: [{ text: msg.content }]
    }));

    const requestBody = {
      contents: geminiMessages,
      generationConfig: {
        temperature: request.temperature,
        maxOutputTokens: request.maxTokens,
        topK: 40,
        topP: 0.95
      }
    };

    const endpoint = provider.endpoints.chat.replace('{model}', routing.modelId);
    const response = await fetch(`${provider.baseUrl}${endpoint}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw this.createLLMError(
        'API_ERROR',
        'gemini',
        routing.modelId,
        `HTTP ${response.status}: ${response.statusText}`
      );
    }

    const data = await response.json();

    return {
      content: data.candidates[0]?.content?.parts[0]?.text || '',
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0
      },
      provider: routing.providerId,
      model: routing.modelId,
      finishReason: data.candidates[0]?.finishReason || 'stop',
      rawResponse: data
    };
  }

  private async executeMistralRequest(
    routing: RoutingDecision,
    request: LLMRequest,
    startTime: number
  ): Promise<Omit<LLMResponse, 'responseTime'>> {
    const provider = this.registry.getProvider('mistral')!;
    const apiKey = process.env[provider.apiKeyEnvVar];

    if (!apiKey) {
      throw this.createLLMError(
        'API_KEY_MISSING',
        'mistral',
        routing.modelId,
        'Mistral API key not configured'
      );
    }

    const response = await fetch(`${provider.baseUrl}${provider.endpoints.chat}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: routing.modelId,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        tools: request.tools
      })
    });

    if (!response.ok) {
      throw this.createLLMError(
        'API_ERROR',
        'mistral',
        routing.modelId,
        `HTTP ${response.status}: ${response.statusText}`
      );
    }

    const data = await response.json();
    const usage = data.usage || {};

    return {
      content: data.choices[0]?.message?.content || '',
      usage: {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0
      },
      provider: routing.providerId,
      model: routing.modelId,
      finishReason: data.choices[0]?.finish_reason || 'stop',
      toolCalls: data.choices[0]?.message?.tool_calls,
      rawResponse: data
    };
  }

  private async executeDeepSeekRequest(
    routing: RoutingDecision,
    request: LLMRequest,
    startTime: number
  ): Promise<Omit<LLMResponse, 'responseTime'>> {
    const provider = this.registry.getProvider('deepseek')!;
    const apiKey = process.env[provider.apiKeyEnvVar];

    if (!apiKey) {
      throw this.createLLMError(
        'API_KEY_MISSING',
        'deepseek',
        routing.modelId,
        'DeepSeek API key not configured'
      );
    }

    const response = await fetch(`${provider.baseUrl}${provider.endpoints.chat}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: routing.modelId,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        tools: request.tools
      })
    });

    if (!response.ok) {
      throw this.createLLMError(
        'API_ERROR',
        'deepseek',
        routing.modelId,
        `HTTP ${response.status}: ${response.statusText}`
      );
    }

    const data = await response.json();
    const usage = data.usage || {};

    return {
      content: data.choices[0]?.message?.content || '',
      usage: {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0
      },
      provider: routing.providerId,
      model: routing.modelId,
      finishReason: data.choices[0]?.finish_reason || 'stop',
      toolCalls: data.choices[0]?.message?.tool_calls,
      rawResponse: data
    };
  }

  private async executeCodestralRequest(
    routing: RoutingDecision,
    request: LLMRequest,
    startTime: number
  ): Promise<Omit<LLMResponse, 'responseTime'>> {
    const provider = this.registry.getProvider('codestral')!;
    const apiKey = process.env[provider.apiKeyEnvVar];

    if (!apiKey) {
      throw this.createLLMError(
        'API_KEY_MISSING',
        'codestral',
        routing.modelId,
        'CodeStral API key not configured'
      );
    }

    const response = await fetch(`${provider.baseUrl}${provider.endpoints.chat}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: routing.modelId,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        tools: request.tools
      })
    });

    if (!response.ok) {
      throw this.createLLMError(
        'API_ERROR',
        'codestral',
        routing.modelId,
        `HTTP ${response.status}: ${response.statusText}`
      );
    }

    const data = await response.json();
    const usage = data.usage || {};

    return {
      content: data.choices[0]?.message?.content || '',
      usage: {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0
      },
      provider: routing.providerId,
      model: routing.modelId,
      finishReason: data.choices[0]?.finish_reason || 'stop',
      toolCalls: data.choices[0]?.message?.tool_calls,
      rawResponse: data
    };
  }

  private async *executeOpenAIStreamRequest(
    routing: RoutingDecision,
    request: LLMRequest,
    startTime: number
  ): AsyncGenerator<LLMStreamResponse> {
    const model = openai(routing.modelId);

    // Convert messages to the expected format
    const messages = request.messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      ...(msg.name && { name: msg.name }),
      ...(msg.toolCallId && { toolCallId: msg.toolCallId })
    }));

    const response = await (model as any).chat({
      messages: messages as any,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
      tools: request.tools,
      stream: true
    });

    let totalTokens = 0;
    let content = '';

    for await (const chunk of response) {
      if (chunk.type === 'text-delta') {
        content += chunk.textDelta;
      }

      if (chunk.type === 'tool-call-delta') {
        // Handle tool calls if needed
      }

      if (chunk.type === 'usage') {
        totalTokens = chunk.usage.totalTokens;
      }

      yield {
        content: chunk.textDelta || '',
        responseTime: Date.now() - startTime,
        provider: routing.providerId,
        model: routing.modelId,
        finishReason: chunk.finishReason
      };
    }

    // Final response with usage
    yield {
      content,
      usage: {
        promptTokens: 0, // Will be added when available
        completionTokens: 0,
        totalTokens
      },
      responseTime: Date.now() - startTime,
      provider: routing.providerId,
      model: routing.modelId
    };
  }

  private createLLMError(
    code: string,
    provider: ProviderId,
    model: string,
    message: string,
    retryable: boolean = true,
    details?: any
  ): LLMError {
    const error = new Error(message) as LLMError;
    error.code = code;
    error.provider = provider;
    error.model = model;
    error.retryable = retryable;
    error.details = details;
    return error;
  }

  private handleRequestError(error: any, providerId: ProviderId, modelId: string): LLMError {
    if (error instanceof Error && 'code' in error) {
      return error as LLMError;
    }

    // Convert common errors to LLMError
    if (error?.response?.status === 429) {
      return this.createLLMError(
        'RATE_LIMITED',
        providerId,
        modelId,
        'Rate limit exceeded',
        true,
        error.response
      );
    }

    if (error?.response?.status >= 500) {
      return this.createLLMError(
        'SERVER_ERROR',
        providerId,
        modelId,
        'Server error from provider',
        true,
        error.response
      );
    }

    if (error?.response?.status === 401) {
      return this.createLLMError(
        'AUTHENTICATION_ERROR',
        providerId,
        modelId,
        'Authentication failed',
        false,
        error.response
      );
    }

    return this.createLLMError(
      'UNKNOWN_ERROR',
      providerId,
      modelId,
      error?.message || 'Unknown error occurred',
      true,
      error
    );
  }

  // Tracking methods
  private trackSuccessfulRequest(
    routing: RoutingDecision,
    request: LLMRequest,
    response: Omit<LLMResponse, 'responseTime'>,
    responseTime: number
  ): void {
    // Track cost
    const costMetrics = {
      provider: routing.providerId,
      model: routing.modelId,
      inputTokens: response.usage.promptTokens,
      outputTokens: response.usage.completionTokens,
      cost: this.calculateCost(routing.providerId, routing.modelId, response.usage),
      timestamp: new Date(),
      userId: request.userId,
      sessionId: request.sessionId
    };

    costTracker.trackCost(costMetrics);

    // Track performance
    const performanceMetrics = {
      provider: routing.providerId,
      model: routing.modelId,
      responseTime,
      success: true,
      timestamp: new Date(),
      userId: request.userId,
      sessionId: request.sessionId
    };

    costTracker.trackPerformance(performanceMetrics);
  }

  private trackFailedRequest(
    routing: RoutingDecision,
    request: LLMRequest,
    error: any,
    responseTime: number
  ): void {
    // Track failed performance
    const performanceMetrics = {
      provider: routing.providerId,
      model: routing.modelId,
      responseTime,
      success: false,
      error: error?.message || 'Unknown error',
      timestamp: new Date(),
      userId: request.userId,
      sessionId: request.sessionId
    };

    costTracker.trackPerformance(performanceMetrics);
  }

  private calculateCost(providerId: ProviderId, modelId: string, usage: any): number {
    const model = this.registry.getModel(modelId);
    if (!model) return 0;

    const inputCost = (usage.promptTokens / 1000) * model.pricing.input;
    const outputCost = (usage.completionTokens / 1000) * model.pricing.output;

    return inputCost + outputCost;
  }
}

// Export singleton instance
export const llmService = new LLMService();
