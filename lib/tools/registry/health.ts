// ──────────────────────────────────────────────────────────────────────────────
// File: lib/tools/registry/health.ts
// Purpose: System health composed from metrics + config
// ──────────────────────────────────────────────────────────────────────────────
import { getToolMetrics } from "./metrics";
import { validateToolConfiguration } from "./config";
import { toolMetadata } from "./metadata";

export const getToolSystemHealth = () => {
  const metrics = getToolMetrics();
  const config = validateToolConfiguration();
  const total = Object.keys(toolMetadata).length;
  const health: any = {
    status: "healthy" as "healthy" | "degraded" | "unhealthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    tools: { total, available: total },
    performance: { errorRate: metrics.summary.errorRate, cacheHitRate: metrics.cache.hitRate, averageExecutionTime: metrics.summary.averageExecutionTime },
    configuration: config,
  };
  if (metrics.summary.errorRate > 10) health.status = "degraded";
  if (metrics.summary.errorRate > 50 || !config.isValid) health.status = "unhealthy";
  return health;
};
