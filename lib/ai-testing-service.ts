/**
 * AI Provider Testing Service
 * Comprehensive testing and validation for AI providers
 */

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { groq } from '@ai-sdk/groq';
import { APIKeyValidator, type ValidationResult } from './ai-key-validator';
import { logger, LogContext } from "./utils/structured-logger";

export interface TestResult {
  success: boolean;
  responseTime: number;
  error?: string;
  warnings?: string[];
  details?: {
    provider: string;
    model: string;
    tokensUsed?: number;
    rateLimitRemaining?: number;
    rateLimitReset?: Date;
    cost?: number;
  };
}

export interface RateLimitInfo {
  remaining: number;
  resetTime: Date;
  limit: number;
  used: number;
}

export interface ModelInfo {
  name: string;
  available: boolean;
  maxTokens: number;
  costPerToken?: number;
  capabilities: string[];
}

export class AITestingService {
  private static instance: AITestingService;
  private testCache = new Map<string, { result: TestResult; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  static getInstance(): AITestingService {
    if (!this.instance) {
      this.instance = new AITestingService();
    }
    return this.instance;
  }

  /**
   * Test API key format and functionality
   */
  async testApiKey(provider: string, apiKey: string, model?: string): Promise<TestResult> {
    const cacheKey = `${provider}-${APIKeyValidator.maskKey(apiKey)}-${model || 'default'}`;
    const cached = this.testCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      logger.info(`[ai-test] Using cached result for ${provider}`);
      return cached.result;
    }

    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      // 1. Format validation
      const formatResult = APIKeyValidator.validateFormat(provider, apiKey);
      if (!formatResult.isValid) {
        return {
          success: false,
          responseTime: 0,
          error: formatResult.error || 'Invalid API key format'
        };
      }

      // 2. Basic connectivity test
      const connectivityResult = await this.testConnectivity(provider, apiKey, model);
      if (!connectivityResult.success) {
        return connectivityResult;
      }

      // 3. Model availability test
      const modelResult = await this.testModelAvailability(provider, apiKey, model);
      if (!modelResult.success) {
        warnings.push(`Model ${model} may not be available: ${modelResult.error}`);
      }

      // 4. Rate limit check
      const rateLimitResult = await this.checkRateLimits(provider, apiKey);
      if (rateLimitResult.remaining < 10) {
        warnings.push(`Low rate limit remaining: ${rateLimitResult.remaining}`);
      }

      const result: TestResult = {
        success: true,
        responseTime: Date.now() - startTime,
        warnings: warnings.length > 0 ? warnings : undefined,
        details: {
          provider,
          model: model || 'default',
          tokensUsed: connectivityResult.details?.tokensUsed,
          rateLimitRemaining: rateLimitResult.remaining,
          rateLimitReset: rateLimitResult.resetTime,
          cost: this.calculateCost(provider, connectivityResult.details?.tokensUsed || 0)
        }
      };

      // Cache successful results
      this.testCache.set(cacheKey, { result, timestamp: Date.now() });
      
      return result;

    } catch (error) {
      const result: TestResult = {
        success: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };

      return result;
    }
  }

  /**
   * Test basic connectivity to AI provider
   */
  private async testConnectivity(provider: string, apiKey: string, model?: string): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      let aiModel;
      const testModel = model || this.getDefaultModel(provider);

      switch (provider.toLowerCase()) {
        case 'openai':
          aiModel = openai(testModel);
          break;
        case 'anthropic':
          aiModel = anthropic(testModel);
          break;
        case 'groq':
          aiModel = groq(testModel);
          break;
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }

      // Make minimal test call
      const { text, usage } = await generateText({
        model: aiModel,
        prompt: 'Test connection. Respond with "OK".'
      });

      return {
        success: true,
        responseTime: Date.now() - startTime,
        details: {
          provider,
          model: testModel,
          tokensUsed: usage?.totalTokens || 0
        }
      };

    } catch (error) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        error: this.parseError(error)
      };
    }
  }

  /**
   * Test if specific model is available
   */
  private async testModelAvailability(provider: string, apiKey: string, model?: string): Promise<TestResult> {
    if (!model) {
      return { success: true, responseTime: 0 };
    }

    const startTime = Date.now();
    
    try {
      let aiModel;
      switch (provider.toLowerCase()) {
        case 'openai':
          aiModel = openai(model);
          break;
        case 'anthropic':
          aiModel = anthropic(model);
          break;
        case 'groq':
          aiModel = groq(model);
          break;
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }

      // Test with minimal prompt
      await generateText({
        model: aiModel,
        prompt: 'Test'
      });

      return {
        success: true,
        responseTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        error: this.parseError(error)
      };
    }
  }

  /**
   * Check rate limits and usage using real API calls
   */
  private async checkRateLimits(provider: string, apiKey: string): Promise<RateLimitInfo> {
    try {
      // Make real API call to get rate limit information
      const response = await fetch(`https://api.${provider}.com/v1/usage`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch rate limits: ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        remaining: data.remaining || 0,
        resetTime: new Date(data.resetTime || Date.now() + 3600000),
        limit: data.limit || 1000,
        used: data.used || 0
      };
    } catch (error) {
      logger.error('Failed to check rate limits:', error as LogContext);
      // Fallback to conservative defaults
      return {
        remaining: 100,
        resetTime: new Date(Date.now() + 3600000),
        limit: 1000,
        used: 900
      };
    }
  }

  /**
   * Get available models for a provider
   */
  async getAvailableModels(provider: string, apiKey: string): Promise<ModelInfo[]> {
    // This would typically call the provider's models API
    // For now, return default models
    const defaultModels = {
      openai: [
        { name: 'gpt-4o', available: true, maxTokens: 128000, capabilities: ['text', 'vision'] },
        { name: 'gpt-4o-mini', available: true, maxTokens: 128000, capabilities: ['text', 'vision'] },
        { name: 'gpt-3.5-turbo', available: true, maxTokens: 16385, capabilities: ['text'] }
      ],
      anthropic: [
        { name: 'claude-3-5-sonnet-20241022', available: true, maxTokens: 200000, capabilities: ['text', 'vision'] },
        { name: 'claude-3-5-haiku-20241022', available: true, maxTokens: 200000, capabilities: ['text', 'vision'] },
        { name: 'claude-3-opus-20240229', available: true, maxTokens: 200000, capabilities: ['text', 'vision'] }
      ],
      groq: [
        { name: 'llama-3.1-70b-versatile', available: true, maxTokens: 128000, capabilities: ['text'] },
        { name: 'llama-3.1-8b-instant', available: true, maxTokens: 128000, capabilities: ['text'] },
        { name: 'mixtral-8x7b-32768', available: true, maxTokens: 32768, capabilities: ['text'] }
      ]
    };

    return defaultModels[provider.toLowerCase() as keyof typeof defaultModels] || [];
  }

  /**
   * Test multiple providers in parallel
   */
  async testMultipleProviders(providers: Array<{ provider: string; apiKey: string; model?: string }>): Promise<Map<string, TestResult>> {
    const results = new Map<string, TestResult>();
    
    const promises = providers.map(async (config) => {
      const result = await this.testApiKey(config.provider, config.apiKey, config.model);
      results.set(config.provider, result);
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Clear test cache
   */
  clearCache(): void {
    this.testCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.testCache.size,
      entries: Array.from(this.testCache.keys())
    };
  }

  private getDefaultModel(provider: string): string {
    const defaults = {
      openai: 'gpt-4o-mini',
      anthropic: 'claude-3-5-haiku-20241022',
      groq: 'llama-3.1-8b-instant'
    };
    return defaults[provider.toLowerCase() as keyof typeof defaults] || 'gpt-4o-mini';
  }

  private parseError(error: unknown): string {
    if (error instanceof Error) {
      // Parse common API errors
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        return 'Invalid API key or unauthorized access';
      }
      if (error.message.includes('429') || error.message.includes('rate limit')) {
        return 'Rate limit exceeded. Please try again later';
      }
      if (error.message.includes('403') || error.message.includes('Forbidden')) {
        return 'API key does not have permission to access this resource';
      }
      if (error.message.includes('404') || error.message.includes('Not Found')) {
        return 'Model not found or not available';
      }
      if (error.message.includes('timeout')) {
        return 'Request timeout. Please check your connection';
      }
      return error.message;
    }
    return 'Unknown error occurred';
  }

  private calculateCost(provider: string, tokens: number): number {
    // Simplified cost calculation (in USD)
    const costs = {
      openai: 0.00015, // per 1K tokens
      anthropic: 0.0003,
      groq: 0.0001
    };
    
    const costPerToken = costs[provider.toLowerCase() as keyof typeof costs] || 0.0001;
    return (tokens / 1000) * costPerToken;
  }
}
