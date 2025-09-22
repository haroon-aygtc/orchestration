// LLM Cost Tracker & Performance Monitor
// Tracks usage, costs, and performance across all providers

import { ProviderId } from '../providers/registry';

export interface CostMetrics {
  provider: ProviderId;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  cost: number;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  agentType?: string;
}

export interface PerformanceMetrics {
  provider: ProviderId;
  model: string;
  responseTime: number;
  success: boolean;
  error?: string;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  agentType?: string;
}

export interface ProviderUsage {
  provider: ProviderId;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalTokens: {
    input: number;
    output: number;
    cached?: number;
  };
  totalCost: number;
  averageResponseTime: number;
  errorRate: number;
  lastUsed: Date;
  modelsUsed: Record<string, number>;
}

export interface UserUsage {
  userId: string;
  totalRequests: number;
  totalTokens: {
    input: number;
    output: number;
  };
  totalCost: number;
  providersUsed: ProviderId[];
  lastActivity: Date;
  monthlyUsage: {
    [month: string]: {
      requests: number;
      tokens: number;
      cost: number;
    };
  };
}

export class CostTracker {
  private costHistory: CostMetrics[] = [];
  private performanceHistory: PerformanceMetrics[] = [];
  private providerUsage: Map<ProviderId, ProviderUsage> = new Map();
  private userUsage: Map<string, UserUsage> = new Map();
  private maxHistorySize = 10000; // Keep last 10k records in memory

  constructor() {
    this.initializeProviderUsage();
  }

  private initializeProviderUsage(): void {
    // Initialize empty usage tracking for all providers
    const providers: ProviderId[] = [
      'openai', 'anthropic', 'groq', 'openrouter',
      'gemini', 'mistral', 'deepseek', 'codestral'
    ];

    providers.forEach(provider => {
      this.providerUsage.set(provider, {
        provider,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalTokens: { input: 0, output: 0 },
        totalCost: 0,
        averageResponseTime: 0,
        errorRate: 0,
        lastUsed: new Date(),
        modelsUsed: {}
      });
    });
  }

  // Record cost and usage
  trackCost(metrics: CostMetrics): void {
    this.costHistory.push(metrics);

    // Keep only recent history in memory
    if (this.costHistory.length > this.maxHistorySize) {
      this.costHistory.shift();
    }

    this.updateProviderUsage(metrics);
    this.updateUserUsage(metrics);
  }

  // Record performance metrics
  trackPerformance(metrics: PerformanceMetrics): void {
    this.performanceHistory.push(metrics);

    if (this.performanceHistory.length > this.maxHistorySize) {
      this.performanceHistory.shift();
    }

    this.updateProviderPerformance(metrics);
    this.updateUserActivity(metrics);
  }

  private updateProviderUsage(metrics: CostMetrics): void {
    const usage = this.providerUsage.get(metrics.provider);
    if (!usage) return;

    usage.totalRequests++;
    usage.totalTokens.input += metrics.inputTokens;
    usage.totalTokens.output += metrics.outputTokens;
    if (metrics.cachedTokens) {
      usage.totalTokens.cached = (usage.totalTokens.cached || 0) + metrics.cachedTokens;
    }
    usage.totalCost += metrics.cost;
    usage.lastUsed = metrics.timestamp;

    // Track model usage
    if (!usage.modelsUsed[metrics.model]) {
      usage.modelsUsed[metrics.model] = 0;
    }
    usage.modelsUsed[metrics.model]++;
  }

  private updateProviderPerformance(metrics: PerformanceMetrics): void {
    const usage = this.providerUsage.get(metrics.provider);
    if (!usage) return;

    usage.totalRequests++;
    if (metrics.success) {
      usage.successfulRequests++;
    } else {
      usage.failedRequests++;
    }

    // Update average response time
    const totalTime = usage.averageResponseTime * (usage.totalRequests - 1);
    usage.averageResponseTime = (totalTime + metrics.responseTime) / usage.totalRequests;

    // Update error rate
    usage.errorRate = usage.failedRequests / usage.totalRequests;

    usage.lastUsed = metrics.timestamp;
  }

  private updateUserUsage(metrics: CostMetrics): void {
    const userId = metrics.userId || 'anonymous';
    let userUsage = this.userUsage.get(userId);

    if (!userUsage) {
      userUsage = {
        userId,
        totalRequests: 0,
        totalTokens: { input: 0, output: 0 },
        totalCost: 0,
        providersUsed: [],
        lastActivity: new Date(),
        monthlyUsage: {}
      };
      this.userUsage.set(userId, userUsage);
    }

    userUsage.totalRequests++;
    userUsage.totalTokens.input += metrics.inputTokens;
    userUsage.totalTokens.output += metrics.outputTokens;
    userUsage.totalCost += metrics.cost;
    userUsage.lastActivity = metrics.timestamp;

    if (!userUsage.providersUsed.includes(metrics.provider)) {
      userUsage.providersUsed.push(metrics.provider);
    }

    // Track monthly usage
    const monthKey = `${metrics.timestamp.getFullYear()}-${String(metrics.timestamp.getMonth() + 1).padStart(2, '0')}`;
    if (!userUsage.monthlyUsage[monthKey]) {
      userUsage.monthlyUsage[monthKey] = {
        requests: 0,
        tokens: 0,
        cost: 0
      };
    }

    userUsage.monthlyUsage[monthKey].requests++;
    userUsage.monthlyUsage[monthKey].tokens += metrics.inputTokens + metrics.outputTokens;
    userUsage.monthlyUsage[monthKey].cost += metrics.cost;
  }

  private updateUserActivity(metrics: PerformanceMetrics): void {
    const userId = metrics.userId || 'anonymous';
    const userUsage = this.userUsage.get(userId);

    if (userUsage) {
      userUsage.lastActivity = metrics.timestamp;
    }
  }

  // Get cost analytics
  getCostAnalytics(
    startDate?: Date,
    endDate?: Date,
    provider?: ProviderId,
    userId?: string
  ): {
    totalCost: number;
    totalTokens: { input: number; output: number; cached?: number };
    costByProvider: Record<ProviderId, number>;
    costByModel: Record<string, number>;
    costByUser: Record<string, number>;
    dailyCosts: Array<{ date: string; cost: number }>;
  } {
    let filteredCosts = this.costHistory;

    if (startDate) {
      filteredCosts = filteredCosts.filter(c => c.timestamp >= startDate);
    }

    if (endDate) {
      filteredCosts = filteredCosts.filter(c => c.timestamp <= endDate);
    }

    if (provider) {
      filteredCosts = filteredCosts.filter(c => c.provider === provider);
    }

    if (userId) {
      filteredCosts = filteredCosts.filter(c => c.userId === userId);
    }

    const totalCost = filteredCosts.reduce((sum, c) => sum + c.cost, 0);
    const totalTokens = filteredCosts.reduce(
      (acc, c) => ({
        input: acc.input + c.inputTokens,
        output: acc.output + c.outputTokens,
        cached: (acc.cached || 0) + (c.cachedTokens || 0)
      }),
      { input: 0, output: 0, cached: 0 }
    );

    const costByProvider: Record<ProviderId, number> = {} as Record<ProviderId, number>;
    const costByModel: Record<string, number> = {};
    const costByUser: Record<string, number> = {};

    filteredCosts.forEach(cost => {
      costByProvider[cost.provider] = (costByProvider[cost.provider] || 0) + cost.cost;
      costByModel[cost.model] = (costByModel[cost.model] || 0) + cost.cost;
      if (cost.userId) {
        costByUser[cost.userId] = (costByUser[cost.userId] || 0) + cost.cost;
      }
    });

    // Calculate daily costs
    const dailyMap = new Map<string, number>();
    filteredCosts.forEach(cost => {
      const date = cost.timestamp.toISOString().split('T')[0];
      dailyMap.set(date, (dailyMap.get(date) || 0) + cost.cost);
    });

    const dailyCosts = Array.from(dailyMap.entries()).map(([date, cost]) => ({
      date,
      cost
    })).sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalCost,
      totalTokens,
      costByProvider,
      costByModel,
      costByUser,
      dailyCosts
    };
  }

  // Get performance analytics
  getPerformanceAnalytics(
    startDate?: Date,
    endDate?: Date,
    provider?: ProviderId,
    userId?: string
  ): {
    totalRequests: number;
    successRate: number;
    averageResponseTime: number;
    errorRateByProvider: Record<ProviderId, number>;
    performanceByProvider: Record<ProviderId, { avgTime: number; successRate: number }>;
    slowQueries: Array<{ timestamp: Date; provider: ProviderId; model: string; time: number }>;
    errorAnalysis: Array<{ provider: ProviderId; error: string; count: number }>;
  } {
    let filteredPerformance = this.performanceHistory;

    if (startDate) {
      filteredPerformance = filteredPerformance.filter(p => p.timestamp >= startDate);
    }

    if (endDate) {
      filteredPerformance = filteredPerformance.filter(p => p.timestamp <= endDate);
    }

    if (provider) {
      filteredPerformance = filteredPerformance.filter(p => p.provider === provider);
    }

    if (userId) {
      filteredPerformance = filteredPerformance.filter(p => p.userId === userId);
    }

    const totalRequests = filteredPerformance.length;
    const successfulRequests = filteredPerformance.filter(p => p.success).length;
    const successRate = totalRequests > 0 ? successfulRequests / totalRequests : 0;

    const totalResponseTime = filteredPerformance.reduce((sum, p) => sum + p.responseTime, 0);
    const averageResponseTime = totalRequests > 0 ? totalResponseTime / totalRequests : 0;

    // Error rate by provider
    const errorRateByProvider: Record<ProviderId, number> = {} as Record<ProviderId, number>;
    const performanceByProvider: Record<ProviderId, { avgTime: number; successRate: number }> = {} as Record<ProviderId, { avgTime: number; successRate: number }>;

    // Group by provider
    const providerGroups = new Map<ProviderId, PerformanceMetrics[]>();
    filteredPerformance.forEach(p => {
      if (!providerGroups.has(p.provider)) {
        providerGroups.set(p.provider, []);
      }
      providerGroups.get(p.provider)!.push(p);
    });

    providerGroups.forEach((metrics, provider) => {
      const providerErrors = metrics.filter(m => !m.success).length;
      errorRateByProvider[provider] = metrics.length > 0 ? providerErrors / metrics.length : 0;

      const totalTime = metrics.reduce((sum, m) => sum + m.responseTime, 0);
      const providerSuccesses = metrics.filter(m => m.success).length;
      performanceByProvider[provider] = {
        avgTime: metrics.length > 0 ? totalTime / metrics.length : 0,
        successRate: metrics.length > 0 ? providerSuccesses / metrics.length : 0
      };
    });

    // Find slow queries (>5 seconds)
    const slowQueries = filteredPerformance
      .filter(p => p.responseTime > 5000)
      .map(p => ({
        timestamp: p.timestamp,
        provider: p.provider,
        model: p.model || 'unknown',
        time: p.responseTime
      }))
      .sort((a, b) => b.time - a.time);

    // Error analysis
    const errorGroups = new Map<string, number>();
    filteredPerformance
      .filter(p => !p.success && p.error)
      .forEach(p => {
        const key = `${p.provider}:${p.error}`;
        errorGroups.set(key, (errorGroups.get(key) || 0) + 1);
      });

    const errorAnalysis = Array.from(errorGroups.entries()).map(([key, count]) => {
      const [provider, error] = key.split(':', 2);
      return { provider: provider as ProviderId, error, count };
    }).sort((a, b) => b.count - a.count);

    return {
      totalRequests,
      successRate,
      averageResponseTime,
      errorRateByProvider,
      performanceByProvider,
      slowQueries,
      errorAnalysis
    };
  }

  // Get provider usage statistics
  getProviderUsage(): ProviderUsage[] {
    return Array.from(this.providerUsage.values());
  }

  // Get user usage statistics
  getUserUsage(): UserUsage[] {
    return Array.from(this.userUsage.values());
  }

  // Get top users by cost
  getTopUsersByCost(limit: number = 10): Array<{ userId: string; totalCost: number; totalRequests: number }> {
    return Array.from(this.userUsage.values())
      .map(user => ({
        userId: user.userId,
        totalCost: user.totalCost,
        totalRequests: user.totalRequests
      }))
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, limit);
  }

  // Get cost breakdown by provider
  getCostBreakdown(): {
    byProvider: Array<{ provider: ProviderId; cost: number; percentage: number }>;
    byModel: Array<{ model: string; cost: number; percentage: number }>;
    totalCost: number;
  } {
    const totalCost = this.costHistory.reduce((sum, c) => sum + c.cost, 0);

    // By provider
    const byProviderMap = new Map<ProviderId, number>();
    this.costHistory.forEach(cost => {
      byProviderMap.set(cost.provider, (byProviderMap.get(cost.provider) || 0) + cost.cost);
    });

    const byProvider = Array.from(byProviderMap.entries()).map(([provider, cost]) => ({
      provider,
      cost,
      percentage: totalCost > 0 ? (cost / totalCost) * 100 : 0
    })).sort((a, b) => b.cost - a.cost);

    // By model
    const byModelMap = new Map<string, number>();
    this.costHistory.forEach(cost => {
      byModelMap.set(cost.model, (byModelMap.get(cost.model) || 0) + cost.cost);
    });

    const byModel = Array.from(byModelMap.entries()).map(([model, cost]) => ({
      model,
      cost,
      percentage: totalCost > 0 ? (cost / totalCost) * 100 : 0
    })).sort((a, b) => b.cost - a.cost);

    return { byProvider, byModel, totalCost };
  }

  // Export data for reporting
  exportData(): {
    costHistory: CostMetrics[];
    performanceHistory: PerformanceMetrics[];
    providerUsage: ProviderUsage[];
    userUsage: UserUsage[];
  } {
    return {
      costHistory: [...this.costHistory],
      performanceHistory: [...this.performanceHistory],
      providerUsage: this.getProviderUsage(),
      userUsage: this.getUserUsage()
    };
  }

  // Clear old data (for memory management)
  clearOldData(olderThan: Date): void {
    this.costHistory = this.costHistory.filter(c => c.timestamp >= olderThan);
    this.performanceHistory = this.performanceHistory.filter(p => p.timestamp >= olderThan);
  }
}

// Export singleton instance
export const costTracker = new CostTracker();
