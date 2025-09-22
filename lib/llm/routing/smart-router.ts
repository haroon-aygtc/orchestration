// Smart LLM Router - Intelligent Provider & Model Selection
// Analyzes task requirements and selects optimal provider/model combination

import { LLMProviderRegistry, ProviderId, LLMModel, ModelCapability, llmProviderRegistry } from '../providers/registry';
import { aiConfigService } from '../../ai-config-service';

export interface TaskRequirements {
  // Task characteristics
  taskType: 'chat' | 'completion' | 'analysis' | 'coding' | 'creative' | 'reasoning';
  complexity: 'low' | 'medium' | 'high' | 'very_high';

  // Capabilities needed
  requiredCapabilities: ModelCapability[];
  preferredCapabilities?: ModelCapability[];

  // Constraints
  maxCostPer1K: number;
  maxLatency: number; // milliseconds
  contextLength: number;
  maxTokens: number;

  // Context
  userId?: string;
  sessionId?: string;
  previousInteractions?: number;

  // Preferences
  preferredProviders?: ProviderId[];
  avoidProviders?: ProviderId[];
  costSensitive?: boolean;
  speedSensitive?: boolean;
  accuracySensitive?: boolean;
}

export interface RoutingDecision {
  providerId: ProviderId;
  modelId: string;
  model: LLMModel;
  reasoning: string;
  confidence: number;
  estimatedCost: number;
  estimatedLatency: number;
  fallbackProviders: Array<{
    providerId: ProviderId;
    modelId: string;
    reason: string;
  }>;
}

export interface RoutingMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  totalCost: number;
  providerUsage: Record<ProviderId, number>;
  modelUsage: Record<string, number>;
  errorRates: Record<ProviderId, number>;
}

export class SmartLLMRouter {
  private registry: LLMProviderRegistry;
  private metrics: RoutingMetrics;
  private providerHealth: Map<ProviderId, {
    isHealthy: boolean;
    lastChecked: Date;
    consecutiveErrors: number;
    averageResponseTime: number;
  }> = new Map();

  constructor() {
    this.registry = llmProviderRegistry;
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      totalCost: 0,
      providerUsage: {
        openai: 0,
        anthropic: 0,
        groq: 0,
        openrouter: 0,
        gemini: 0,
        mistral: 0,
        deepseek: 0,
        codestral: 0
      },
      modelUsage: {},
      errorRates: {
        openai: 0,
        anthropic: 0,
        groq: 0,
        openrouter: 0,
        gemini: 0,
        mistral: 0,
        deepseek: 0,
        codestral: 0
      }
    };
    this.initializeProviderHealth();
  }

  private initializeProviderHealth(): void {
    // Initialize health for all providers that exist in metrics
    Object.keys(this.metrics.providerUsage).forEach(providerId => {
      this.providerHealth.set(providerId as ProviderId, {
        isHealthy: true,
        lastChecked: new Date(),
        consecutiveErrors: 0,
        averageResponseTime: 1000 // Default 1 second
      });
    });

    // Also ensure we have health tracking for any providers from the registry
    try {
      this.registry.getAllProviders().forEach(provider => {
        if (provider && provider.id && !this.providerHealth.has(provider.id)) {
          this.providerHealth.set(provider.id, {
            isHealthy: true,
            lastChecked: new Date(),
            consecutiveErrors: 0,
            averageResponseTime: 1000
          });
        }
      });
    } catch (error) {
      console.warn('Could not initialize health for all providers:', error);
    }
  }

  // Main routing method
  async selectOptimalProvider(requirements: TaskRequirements): Promise<RoutingDecision> {
    // Validate input requirements
    if (!requirements) {
      throw new Error('Requirements object is required');
    }

    if (!requirements.requiredCapabilities || !Array.isArray(requirements.requiredCapabilities)) {
      throw new Error('requiredCapabilities must be a non-empty array');
    }

    if (requirements.requiredCapabilities.length === 0) {
      throw new Error('At least one required capability must be specified');
    }

    if (typeof requirements.maxCostPer1K !== 'number' || requirements.maxCostPer1K <= 0) {
      throw new Error('maxCostPer1K must be a positive number');
    }

    if (typeof requirements.contextLength !== 'number' || requirements.contextLength <= 0) {
      throw new Error('contextLength must be a positive number');
    }

    if (typeof requirements.maxTokens !== 'number' || requirements.maxTokens <= 0) {
      throw new Error('maxTokens must be a positive number');
    }

    if (requirements.maxLatency && (typeof requirements.maxLatency !== 'number' || requirements.maxLatency <= 0)) {
      throw new Error('maxLatency must be a positive number if specified');
    }

    this.metrics.totalRequests++;

    try {
      // Get all available models that meet basic requirements
      const candidateModels = this.getCandidateModels(requirements);

      if (candidateModels.length === 0) {
        throw new Error('No models available that meet the requirements');
      }

      // Score each model/provider combination
      const scoredCandidates = await this.scoreCandidates(candidateModels, requirements);

      // Sort by score (highest first)
      scoredCandidates.sort((a, b) => b.score - a.score);

      // Select the best candidate
      const bestCandidate = scoredCandidates[0];

      // Build fallback options
      const fallbackProviders = scoredCandidates
        .slice(1, 4) // Next 3 best options
        .map(candidate => ({
          providerId: candidate.providerId,
          modelId: candidate.model.id,
          reason: candidate.reasoning
        }));

      // Calculate estimated cost and latency
      const estimatedCost = this.estimateCost(bestCandidate.providerId, bestCandidate.model, requirements);
      const estimatedLatency = this.estimateLatency(bestCandidate.providerId, bestCandidate.model);

      const decision: RoutingDecision = {
        providerId: bestCandidate.providerId,
        modelId: bestCandidate.model.id,
        model: bestCandidate.model,
        reasoning: bestCandidate.reasoning,
        confidence: bestCandidate.score,
        estimatedCost,
        estimatedLatency,
        fallbackProviders
      };

      // Update metrics
      this.updateMetrics(decision, 'success');

      return decision;

    } catch (error) {
      this.metrics.failedRequests++;
      throw error;
    }
  }

  private getCandidateModels(requirements: TaskRequirements): LLMModel[] {
    try {
      // Get all providers and collect all their models
      const allProviders = this.registry.getAllProviders();
      const allModels: LLMModel[] = [];

      for (const provider of allProviders) {
        const providerModels = this.registry.getModelsByProvider(provider.id);
        allModels.push(...providerModels);
      }

      return allModels.filter(model => {
        // Check required capabilities
        const hasAllRequired = requirements.requiredCapabilities.every(cap =>
          model.capabilities.includes(cap)
        );

        // Check context length
        const hasEnoughContext = model.contextWindow >= requirements.contextLength;

        // Check max tokens
        const canHandleTokens = model.maxTokens >= requirements.maxTokens;

        // Check if provider is healthy
        const providerHealth = this.providerHealth.get(model.provider);
        const isProviderHealthy = providerHealth?.isHealthy ?? true;

        // Check if provider should be avoided
        const shouldAvoid = requirements.avoidProviders?.includes(model.provider);

        // Check if model is deprecated
        const isNotDeprecated = !model.metadata.deprecated;

        return hasAllRequired &&
               hasEnoughContext &&
               canHandleTokens &&
               isProviderHealthy &&
               !shouldAvoid &&
               isNotDeprecated;
      });
    } catch (error) {
      console.error('Failed to get candidate models:', error);
      return [];
    }
  }

  private async scoreCandidates(
    candidates: LLMModel[],
    requirements: TaskRequirements
  ): Promise<Array<{
    model: LLMModel;
    providerId: ProviderId;
    score: number;
    reasoning: string;
  }>> {

    const scoredCandidates: Array<{
      model: LLMModel;
      providerId: ProviderId;
      score: number;
      reasoning: string;
    }> = [];

    for (const model of candidates) {
      try {
        const providerId = model.provider;
        const provider = this.registry.getProvider(providerId);
        const providerInstance = this.registry.getProviderInstance(providerId);

        if (!provider) {
          console.warn(`Provider ${providerId} not found for model ${model.id}`);
          continue;
        }

        let score = 0;
        const reasoning: string[] = [];

        // 1. Provider preference (if specified)
        if (requirements.preferredProviders?.includes(providerId)) {
          score += 0.3;
          reasoning.push(`Preferred provider: ${provider.displayName}`);
        }

        // 2. Cost effectiveness
        try {
          const costScore = this.calculateCostScore(providerId, model, requirements);
          score += costScore.score;
          reasoning.push(costScore.reason);
        } catch (error) {
          console.error(`Error calculating cost score for ${providerId}/${model.id}:`, error);
          reasoning.push('Cost calculation failed');
        }

        // 3. Performance matching
        try {
          const performanceScore = this.calculatePerformanceScore(model, requirements);
          score += performanceScore.score;
          reasoning.push(performanceScore.reason);
        } catch (error) {
          console.error(`Error calculating performance score for ${model.id}:`, error);
          reasoning.push('Performance calculation failed');
        }

        // 4. Task type suitability
        try {
          const taskScore = this.calculateTaskSuitabilityScore(model, requirements);
          score += taskScore.score;
          reasoning.push(taskScore.reason);
        } catch (error) {
          console.error(`Error calculating task suitability score for ${model.id}:`, error);
          reasoning.push('Task suitability calculation failed');
        }

        // 5. Provider reliability
        try {
          const reliabilityScore = this.calculateReliabilityScore(providerId);
          score += reliabilityScore.score;
          reasoning.push(reliabilityScore.reason);
        } catch (error) {
          console.error(`Error calculating reliability score for ${providerId}:`, error);
          reasoning.push('Reliability calculation failed');
        }

        // 6. Capability matching
        try {
          const capabilityScore = this.calculateCapabilityScore(model, requirements);
          score += capabilityScore.score;
          reasoning.push(capabilityScore.reason);
        } catch (error) {
          console.error(`Error calculating capability score for ${model.id}:`, error);
          reasoning.push('Capability calculation failed');
        }

        // 7. User history (if available)
        try {
          const historyScore = await this.calculateUserHistoryScore(providerId, requirements);
          score += historyScore.score;
          reasoning.push(historyScore.reason);
        } catch (error) {
          console.error(`Error calculating user history score for ${providerId}:`, error);
          reasoning.push('User history calculation failed');
        }

        // 8. Provider load balancing
        try {
          const loadScore = this.calculateLoadBalanceScore(providerId, providerInstance);
          score += loadScore.score;
          reasoning.push(loadScore.reason);
        } catch (error) {
          console.error(`Error calculating load balance score for ${providerId}:`, error);
          reasoning.push('Load balance calculation failed');
        }

        // Normalize score to 0-1 range
        score = Math.max(0, Math.min(1, score));

        scoredCandidates.push({
          model,
          providerId,
          score,
          reasoning: reasoning.join('. ')
        });
      } catch (error) {
        console.error(`Error scoring candidate model ${model.id}:`, error);
        // Continue with other candidates
      }
    }

    return scoredCandidates;
  }

  private calculateCostScore(
    providerId: ProviderId,
    model: LLMModel,
    requirements: TaskRequirements
  ): { score: number; reason: string } {
    const costPer1KInput = model.pricing.input || 0;
    const costPer1KOutput = model.pricing.output || 0;

    // Estimate tokens (rough approximation with bounds checking)
    const estimatedInputTokens = Math.min(requirements.contextLength, 4000);
    const estimatedOutputTokens = Math.min(requirements.maxTokens, 1000);
    const estimatedTotalCost = (estimatedInputTokens / 1000 * costPer1KInput) +
                              (estimatedOutputTokens / 1000 * costPer1KOutput);

    // Handle edge cases
    if (requirements.maxCostPer1K <= 0) {
      return {
        score: -0.3,
        reason: `Invalid budget limit: ${requirements.maxCostPer1K}`
      };
    }

    if (estimatedTotalCost <= 0) {
      return {
        score: 0.2,
        reason: `Free or very low cost: $${estimatedTotalCost.toFixed(4)} per request`
      };
    }

    const costRatio = estimatedTotalCost / requirements.maxCostPer1K;

    if (costRatio <= 1) {
      // Within budget - higher score for better efficiency
      const costEfficiency = 1 - costRatio;
      return {
        score: 0.2 * costEfficiency,
        reason: `Cost efficient: $${estimatedTotalCost.toFixed(4)} per request (${(costRatio * 100).toFixed(1)}% of budget)`
      };
    } else {
      // Over budget - penalty based on how much over
      const overagePenalty = Math.min(0.5, 0.2 * (costRatio - 1));
      return {
        score: -overagePenalty,
        reason: `Too expensive: $${estimatedTotalCost.toFixed(4)} exceeds budget by ${(costRatio - 1) * 100}%`
      };
    }
  }

  private calculatePerformanceScore(
    model: LLMModel,
    requirements: TaskRequirements
  ): { score: number; reason: string } {
    let score = 0;
    const reasons: string[] = [];

    // Speed preference
    if (requirements.speedSensitive) {
      const speedScores = { very_fast: 0.25, fast: 0.2, medium: 0.1, slow: 0 };
      score += speedScores[model.performance.speed];
      reasons.push(`Speed: ${model.performance.speed}`);
    }

    // Accuracy preference
    if (requirements.accuracySensitive) {
      const accuracyScores = { very_high: 0.25, high: 0.2, medium: 0.1, low: 0 };
      score += accuracyScores[model.performance.accuracy];
      reasons.push(`Accuracy: ${model.performance.accuracy}`);
    }

    // Task complexity matching
    if (requirements.complexity === 'very_high' && model.performance.accuracy === 'very_high') {
      score += 0.15;
      reasons.push('High accuracy for complex task');
    }

    return {
      score: score,
      reason: reasons.join(', ')
    };
  }

  private calculateTaskSuitabilityScore(
    model: LLMModel,
    requirements: TaskRequirements
  ): { score: number; reason: string } {
    let score = 0;
    const reasons: string[] = [];

    // Task type specific scoring
    switch (requirements.taskType) {
      case 'coding':
        if (model.capabilities.includes('code_generation')) {
          score += 0.3;
          reasons.push('Excellent for coding tasks');
        }
        if (model.provider === 'codestral') {
          score += 0.2;
          reasons.push('Specialized coding model');
        }
        break;

      case 'creative':
        if (model.performance.accuracy === 'high' && model.performance.speed === 'fast') {
          score += 0.2;
          reasons.push('Good balance for creative tasks');
        }
        break;

      case 'reasoning':
        if (model.performance.accuracy === 'very_high') {
          score += 0.25;
          reasons.push('High accuracy for reasoning');
        }
        break;

      case 'analysis':
        if (model.capabilities.includes('json_mode') && model.performance.accuracy === 'high') {
          score += 0.2;
          reasons.push('Good for structured analysis');
        }
        break;
    }

    // Long context tasks
    if (requirements.contextLength > 16000 && model.capabilities.includes('long_context')) {
      score += 0.15;
      reasons.push('Supports long context');
    }

    return {
      score,
      reason: reasons.join(', ')
    };
  }

  private calculateReliabilityScore(providerId: ProviderId): { score: number; reason: string } {
    const health = this.providerHealth.get(providerId);
    if (!health) return { score: 0, reason: 'Provider not found' };

    const reliability = health.isHealthy ? 0.1 : -0.3;
    const errorPenalty = Math.max(-0.2, -0.05 * health.consecutiveErrors);

    return {
      score: reliability + errorPenalty,
      reason: `Reliability: ${health.isHealthy ? 'healthy' : 'unhealthy'}, ${health.consecutiveErrors} consecutive errors`
    };
  }

  private calculateCapabilityScore(
    model: LLMModel,
    requirements: TaskRequirements
  ): { score: number; reason: string } {
    let score = 0;
    const reasons: string[] = [];

    // Bonus for preferred capabilities
    if (requirements.preferredCapabilities) {
      const matchedPreferred = requirements.preferredCapabilities.filter(cap =>
        model.capabilities.includes(cap)
      ).length;
      score += 0.1 * (matchedPreferred / requirements.preferredCapabilities.length);
      reasons.push(`${matchedPreferred} preferred capabilities matched`);
    }

    // Penalty for missing vision capability when needed
    if (requirements.requiredCapabilities.includes('vision') && !model.capabilities.includes('vision')) {
      score -= 0.2;
      reasons.push('Missing vision capability');
    }

    return {
      score,
      reason: reasons.join(', ')
    };
  }

  private async calculateUserHistoryScore(
    providerId: ProviderId,
    requirements: TaskRequirements
  ): Promise<{ score: number; reason: string }> {
    // This could be enhanced with actual user preference tracking
    // For now, return neutral score
    return {
      score: 0,
      reason: 'No user history available'
    };
  }

  private calculateLoadBalanceScore(
    providerId: ProviderId,
    providerInstance?: any
  ): { score: number; reason: string } {
    // Simple load balancing - prefer less used providers
    const usage = this.metrics.providerUsage[providerId] || 0;
    const totalUsage = Object.values(this.metrics.providerUsage).reduce((sum, u) => sum + u, 0);

    if (totalUsage === 0) return { score: 0, reason: 'No usage data' };

    const usageRatio = usage / totalUsage;
    const loadBalanceScore = -0.1 * usageRatio; // Penalty for high usage

    return {
      score: loadBalanceScore,
      reason: `Usage ratio: ${(usageRatio * 100).toFixed(1)}%`
    };
  }

  private estimateCost(
    providerId: ProviderId,
    model: LLMModel,
    requirements: TaskRequirements
  ): number {
    const costPer1KInput = model.pricing.input;
    const costPer1KOutput = model.pricing.output;

    const estimatedInputTokens = Math.min(requirements.contextLength, 4000);
    const estimatedOutputTokens = Math.min(requirements.maxTokens, 1000);

    return (estimatedInputTokens / 1000 * costPer1KInput) +
           (estimatedOutputTokens / 1000 * costPer1KOutput);
  }

  private estimateLatency(providerId: ProviderId, model: LLMModel): number {
    const health = this.providerHealth.get(providerId);
    const baseLatency = this.estimateBaseLatency(model);

    return health?.averageResponseTime || baseLatency;
  }

  private estimateBaseLatency(model: LLMModel): number {
    const latencyMap: Record<string, number> = {
      'very_fast': 500,
      'fast': 1000,
      'medium': 2000,
      'slow': 4000
    };
    return latencyMap[model.performance.speed] || 2000;
  }

  // Public methods for health monitoring
  updateProviderHealth(providerId: ProviderId, responseTime: number, success: boolean): void {
    const health = this.providerHealth.get(providerId);
    if (!health) return;

    health.lastChecked = new Date();
    health.averageResponseTime = (health.averageResponseTime + responseTime) / 2;

    if (success) {
      health.consecutiveErrors = 0;
      health.isHealthy = true;
    } else {
      health.consecutiveErrors++;
      if (health.consecutiveErrors > 3) {
        health.isHealthy = false;
      }
    }
  }

  updateMetrics(decision: RoutingDecision, status: 'success' | 'error'): void {
    if (status === 'success') {
      this.metrics.successfulRequests++;
      this.metrics.providerUsage[decision.providerId] =
        (this.metrics.providerUsage[decision.providerId] || 0) + 1;
      this.metrics.modelUsage[decision.modelId] =
        (this.metrics.modelUsage[decision.modelId] || 0) + 1;
      this.metrics.totalCost += decision.estimatedCost;
    } else {
      this.metrics.failedRequests++;
      this.metrics.errorRates[decision.providerId] =
        (this.metrics.errorRates[decision.providerId] || 0) + 1;
    }
  }

  getMetrics(): RoutingMetrics {
    return { ...this.metrics };
  }

  getProviderHealth(): Record<ProviderId, any> {
    const health: Record<ProviderId, any> = {
      openai: 0,
      anthropic: 0,
      groq: 0,
      openrouter: 0,
      gemini: 0,
      mistral: 0,
      deepseek: 0,
      codestral: 0
    };
    this.providerHealth.forEach((value, key) => {
      health[key] = value;
    });
    return health;
  }

  // Utility method to get the registry instance
  static getInstance(): SmartLLMRouter {
    if (!SmartLLMRouter.instance) {
      SmartLLMRouter.instance = new SmartLLMRouter();
    }
    return SmartLLMRouter.instance;
  }

  // Static instance
  private static instance: SmartLLMRouter;
}

// Export singleton instance
export const smartLLMRouter = SmartLLMRouter.getInstance();
