
// ──────────────────────────────────────────────────────────────────────────────
// File: lib/tools/registry/metrics.ts
// Purpose: Central metrics state + accessors
// ──────────────────────────────────────────────────────────────────────────────
let toolMetrics = {
    executions: 0,
    errors: 0,
    totalExecutionTime: 0,
    cacheHits: 0,
    cacheMisses: 0,
    toolErrors: {} as Record<string, number>,
  };
  
  export const _metricsState = toolMetrics; // optional export for tests
  
  export const getToolMetrics = () => {
    const avg = toolMetrics.executions ? toolMetrics.totalExecutionTime / toolMetrics.executions : 0;
    const hr = toolMetrics.cacheHits + toolMetrics.cacheMisses > 0 ? (toolMetrics.cacheHits / (toolMetrics.cacheHits + toolMetrics.cacheMisses)) * 100 : 0;
    return {
      summary: {
        totalExecutions: toolMetrics.executions,
        totalErrors: toolMetrics.errors,
        errorRate: toolMetrics.executions ? (toolMetrics.errors / toolMetrics.executions) * 100 : 0,
        averageExecutionTime: Math.round(avg),
        cacheHitRate: Math.round(hr * 100) / 100,
      },
      cache: { hits: toolMetrics.cacheHits, misses: toolMetrics.cacheMisses, hitRate: Math.round(hr * 100) / 100 },
      performance: { totalExecutionTime: toolMetrics.totalExecutionTime, averageExecutionTime: Math.round(avg), slowestTools: [] },
      errors: { totalErrors: toolMetrics.errors, toolSpecificErrors: toolMetrics.toolErrors },
      timestamp: new Date().toISOString(),
    };
  };

  
export const resetToolMetrics = () => { toolMetrics = { executions: 0, errors: 0, totalExecutionTime: 0, cacheHits: 0, cacheMisses: 0, toolErrors: {} }; };

// mutate helpers used by wrappers
export const _recordExecStart = () => { toolMetrics.executions++; };
export const _recordExecSuccess = (delta: number) => { toolMetrics.totalExecutionTime += delta; };
export const _recordExecError = (toolName: string, delta: number) => { toolMetrics.errors++; toolMetrics.toolErrors[toolName] = (toolMetrics.toolErrors[toolName] || 0) + 1; toolMetrics.totalExecutionTime += delta; };
export const _recordCacheHit = () => { toolMetrics.cacheHits++; };
export const _recordCacheMiss = () => { toolMetrics.cacheMisses++; };


