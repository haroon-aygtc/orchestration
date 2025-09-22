// Circuit Breaker for LLM Calls
/**
 * Circuit breaker pattern implementation for LLM service calls
 * Prevents cascade failures and provides automatic recovery
 */

export interface CircuitBreakerOptions {
  failureThreshold: number;    // Number of failures before opening circuit
  cooldownMs: number;         // Time to wait before trying again
  monitoringPeriod: number;   // Time window for failure counting
  successThreshold?: number;  // Number of successes needed to close circuit
}

export interface CircuitBreakerState {
  isOpen: boolean;
  failures: number;
  successes: number;
  lastFailureTime: number;
  lastSuccessTime: number;
}

export class CircuitBreaker {
  private failures = 0;
  private successes = 0;
  private openUntil = 0;
  private lastFailureTime = 0;
  private lastSuccessTime = 0;
  private monitoringStartTime = Date.now();
  private totalRequests = 0;
  private totalTokens = 0;
  private totalCost = 0;

  constructor(private options: CircuitBreakerOptions) {}

  /**
   * Check if the circuit breaker allows the operation
   */
  allow(): boolean {
    const now = Date.now();
    
    // Reset monitoring window if needed
    if (now - this.monitoringStartTime > this.options.monitoringPeriod) {
      this.resetMonitoring();
    }
    
    // If circuit is open, check if cooldown period has passed
    if (this.isOpen()) {
      if (now >= this.openUntil) {
        // Cooldown period passed, allow one attempt (half-open state)
        return true;
      }
      return false;
    }
    
    return true;
  }

  /**
   * Record a successful operation
   */
  recordSuccess(tokens?: number, cost?: number): void {
    this.successes++;
    this.lastSuccessTime = Date.now();
    this.totalRequests++;
    
    if (tokens) this.totalTokens += tokens;
    if (cost) this.totalCost += cost;
    
    // If we have enough successes and circuit is half-open, close it
    if (this.isOpen() && this.successes >= (this.options.successThreshold || 1)) {
      this.close();
    }
  }

  /**
   * Record a failed operation
   */
  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    this.totalRequests++;
    
    // If we've hit the failure threshold, open the circuit
    if (this.failures >= this.options.failureThreshold) {
      this.open();
    }
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.allow()) {
      throw new Error(`Circuit breaker is open. Last failure: ${new Date(this.lastFailureTime).toISOString()}`);
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Get current circuit breaker state
   */
  getState(): CircuitBreakerState {
    return {
      isOpen: this.isOpen(),
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime
    };
  }

  /**
   * Get circuit breaker health metrics
   */
  getHealth(): {
    isHealthy: boolean;
    failureRate: number;
    successRate: number;
    timeSinceLastFailure: number;
    timeSinceLastSuccess: number;
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
  } {
    const now = Date.now();
    const totalOperations = this.failures + this.successes;
    
    return {
      isHealthy: !this.isOpen(),
      failureRate: totalOperations > 0 ? this.failures / totalOperations : 0,
      successRate: totalOperations > 0 ? this.successes / totalOperations : 0,
      timeSinceLastFailure: this.lastFailureTime > 0 ? now - this.lastFailureTime : Infinity,
      timeSinceLastSuccess: this.lastSuccessTime > 0 ? now - this.lastSuccessTime : Infinity,
      totalRequests: this.totalRequests,
      totalTokens: this.totalTokens,
      totalCost: this.totalCost
    };
  }

  /**
   * Manually close the circuit breaker
   */
  close(): void {
    this.openUntil = 0;
    this.resetMonitoring();
  }

  /**
   * Manually open the circuit breaker
   */
  open(): void {
    this.openUntil = Date.now() + this.options.cooldownMs;
  }

  /**
   * Reset monitoring counters
   */
  reset(): void {
    this.failures = 0;
    this.successes = 0;
    this.openUntil = 0;
    this.lastFailureTime = 0;
    this.lastSuccessTime = 0;
    this.monitoringStartTime = Date.now();
  }

  private isOpen(): boolean {
    return this.openUntil > 0 && Date.now() < this.openUntil;
  }

  private resetMonitoring(): void {
    this.failures = 0;
    this.successes = 0;
    this.monitoringStartTime = Date.now();
  }
}

/**
 * Create a circuit breaker with default settings for LLM calls
 */
export function createLLMCircuitBreaker(options?: Partial<CircuitBreakerOptions>): CircuitBreaker {
  const defaultOptions: CircuitBreakerOptions = {
    failureThreshold: 5,
    cooldownMs: 15000, // 15 seconds
    monitoringPeriod: 60000, // 1 minute
    successThreshold: 2
  };

  return new CircuitBreaker({ ...defaultOptions, ...options });
}

/**
 * Circuit breaker manager for multiple services
 */
export class CircuitBreakerManager {
  private breakers = new Map<string, CircuitBreaker>();

  getBreaker(serviceName: string, options?: Partial<CircuitBreakerOptions>): CircuitBreaker {
    if (!this.breakers.has(serviceName)) {
      this.breakers.set(serviceName, createLLMCircuitBreaker(options));
    }
    return this.breakers.get(serviceName)!;
  }

  getHealth(): Record<string, any> {
    const health: Record<string, any> = {};
    for (const [name, breaker] of this.breakers) {
      health[name] = breaker.getHealth();
    }
    return health;
  }

  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}

// Global circuit breaker manager
export const circuitBreakerManager = new CircuitBreakerManager();
