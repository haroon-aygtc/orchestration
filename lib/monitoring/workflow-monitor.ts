// Workflow Monitoring and Analytics System
// Comprehensive monitoring, metrics, and analytics for AI agent workflows

import { EventEmitter } from "events";
import { PrismaClient } from "@prisma/client";
import { generatePrefixedUUID } from "../utils/uuid";

// ---------- Types ----------
export interface WorkflowMetrics {
  id: string;
  workflowId: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  cancelledExecutions: number;
  averageExecutionTime: number;
  successRate: number;
  failureRate: number;
  throughput: number; // executions per hour
  lastExecutedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface StepMetrics {
  stepId: string;
  stepName: string;
  agentType: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  successRate: number;
  commonErrors: string[];
  performanceTrend: PerformanceDataPoint[];
}

export interface PerformanceDataPoint {
  timestamp: Date;
  executionTime: number;
  success: boolean;
  memoryUsage: number;
  cpuUsage: number;
}

export interface WorkflowAlert {
  id: string;
  workflowId: string;
  type: "performance" | "failure" | "timeout" | "resource";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  threshold?: number;
  currentValue?: number;
  triggeredAt: Date;
  resolvedAt?: Date;
  acknowledged: boolean;
}

export interface SystemHealth {
  overall: "healthy" | "degraded" | "unhealthy";
  agents: AgentHealth[];
  workflows: WorkflowHealth[];
  resources: ResourceHealth;
  alerts: WorkflowAlert[];
  lastChecked: Date;
}

export interface AgentHealth {
  name: string;
  status: "healthy" | "degraded" | "unhealthy";
  responseTime: number;
  successRate: number;
  errorRate: number;
  lastActive: Date;
  issues: string[];
}

export interface WorkflowHealth {
  workflowId: string;
  status: "healthy" | "degraded" | "unhealthy";
  successRate: number;
  averageExecutionTime: number;
  failureRate: number;
  lastExecuted: Date;
  issues: string[];
}

export interface ResourceHealth {
  cpu: {
    usage: number;
    status: "healthy" | "degraded" | "unhealthy";
  };
  memory: {
    usage: number;
    status: "healthy" | "degraded" | "unhealthy";
  };
  disk: {
    usage: number;
    status: "healthy" | "degraded" | "unhealthy";
  };
  network: {
    latency: number;
    status: "healthy" | "degraded" | "unhealthy";
  };
}

export interface AnalyticsReport {
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    totalWorkflows: number;
    totalExecutions: number;
    successRate: number;
    averageExecutionTime: number;
    topPerformingAgents: string[];
    topFailingAgents: string[];
  };
  trends: {
    executionTrend: PerformanceDataPoint[];
    successRateTrend: PerformanceDataPoint[];
    performanceTrend: PerformanceDataPoint[];
  };
  insights: string[];
  recommendations: string[];
}

// ---------- Monitoring Service ----------
export class WorkflowMonitor extends EventEmitter {
  private prisma: PrismaClient;
  private metrics: Map<string, WorkflowMetrics> = new Map();
  private stepMetrics: Map<string, StepMetrics> = new Map();
  private alerts: WorkflowAlert[] = [];
  private healthCheckInterval: NodeJS.Timeout;
  private metricsCollectionInterval: NodeJS.Timeout;
  private alertThresholds: Map<string, number> = new Map();

  constructor(prisma: PrismaClient) {
    super();
    this.prisma = prisma;
    
    // Initialize alert thresholds
    this.initializeAlertThresholds();
    
    // Start health monitoring
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 60000); // 1 minute
    
    // Start metrics collection
    this.metricsCollectionInterval = setInterval(() => {
      this.collectMetrics();
    }, 30000); // 30 seconds
  }

  /**
   * Record workflow execution
   */
  async recordWorkflowExecution(
    workflowId: string,
    executionTime: number,
    success: boolean,
    error?: string
  ): Promise<void> {
    try {
      // Update workflow metrics
      await this.updateWorkflowMetrics(workflowId, executionTime, success);
      
      // Record performance data point
      await this.recordPerformanceDataPoint(workflowId, executionTime, success);
      
      // Check for alerts
      await this.checkAlerts(workflowId, executionTime, success);
      
      this.emit('workflow.recorded', { workflowId, executionTime, success, error });
    } catch (error) {
      console.error('Failed to record workflow execution:', error);
    }
  }

  /**
   * Record step execution
   */
  async recordStepExecution(
    stepId: string,
    stepName: string,
    agentType: string,
    executionTime: number,
    success: boolean,
    error?: string
  ): Promise<void> {
    try {
      // Update step metrics
      await this.updateStepMetrics(stepId, stepName, agentType, executionTime, success, error);
      
      this.emit('step.recorded', { stepId, stepName, agentType, executionTime, success, error });
    } catch (error) {
      console.error('Failed to record step execution:', error);
    }
  }

  /**
   * Get workflow metrics
   */
  async getWorkflowMetrics(workflowId: string): Promise<WorkflowMetrics | null> {
    try {
      const metrics = await this.prisma.workflowMetrics.findUnique({
        where: { workflowId }
      });

      if (!metrics) return null;

      return {
        id: metrics.id,
        workflowId: metrics.workflowId,
        totalExecutions: metrics.totalExecutions,
        successfulExecutions: metrics.successfulExecutions,
        failedExecutions: metrics.failedExecutions,
        cancelledExecutions: 0, // Not tracked in current schema
        averageExecutionTime: metrics.averageExecutionTime,
        successRate: metrics.successRate,
        failureRate: 1 - metrics.successRate,
        throughput: this.calculateThroughput(metrics),
        lastExecutedAt: metrics.lastExecutedAt || undefined,
        createdAt: metrics.createdAt,
        updatedAt: metrics.updatedAt
      };
    } catch (error) {
      console.error('Failed to get workflow metrics:', error);
      return null;
    }
  }

  /**
   * Get system health status
   */
  async getSystemHealth(): Promise<SystemHealth> {
    try {
      const agents = await this.getAgentHealth();
      const workflows = await this.getWorkflowHealth();
      const resources = await this.getResourceHealth();
      const activeAlerts = this.alerts.filter(alert => !alert.resolvedAt);

      const overall = this.calculateOverallHealth(agents, workflows, resources, activeAlerts);

      return {
        overall,
        agents,
        workflows,
        resources,
        alerts: activeAlerts,
        lastChecked: new Date()
      };
    } catch (error) {
      console.error('Failed to get system health:', error);
      return {
        overall: "unhealthy",
        agents: [],
        workflows: [],
        resources: {
          cpu: { usage: 0, status: "unhealthy" },
          memory: { usage: 0, status: "unhealthy" },
          disk: { usage: 0, status: "unhealthy" },
          network: { latency: 0, status: "unhealthy" }
        },
        alerts: [],
        lastChecked: new Date()
      };
    }
  }

  /**
   * Generate analytics report
   */
  async generateAnalyticsReport(
    startDate: Date,
    endDate: Date
  ): Promise<AnalyticsReport> {
    try {
      // Get workflow executions in date range
      const executions = await this.prisma.workflowState.findMany({
        where: {
          startedAt: {
            gte: startDate,
            lte: endDate
          }
        }
      });

      // Calculate summary metrics
      const totalWorkflows = new Set(executions.map(e => e.workflowId)).size;
      const totalExecutions = executions.length;
      const successfulExecutions = executions.filter(e => e.state === "completed").length;
      const successRate = totalExecutions > 0 ? successfulExecutions / totalExecutions : 0;
      const averageExecutionTime = executions.reduce((sum, e) => sum + (e.executionTime || 0), 0) / totalExecutions;

      // Get agent performance
      const agentPerformance = await this.getAgentPerformance(startDate, endDate);
      const topPerformingAgents = agentPerformance
        .sort((a, b) => b.successRate - a.successRate)
        .slice(0, 5)
        .map(a => a.agentType);
      const topFailingAgents = agentPerformance
        .sort((a, b) => a.successRate - b.successRate)
        .slice(0, 5)
        .map(a => a.agentType);

      // Generate trends
      const trends = await this.generateTrends(startDate, endDate);

      // Generate insights and recommendations
      const insights = this.generateInsights(executions, agentPerformance);
      const recommendations = this.generateRecommendations(executions, agentPerformance);

      return {
        period: { start: startDate, end: endDate },
        summary: {
          totalWorkflows,
          totalExecutions,
          successRate,
          averageExecutionTime,
          topPerformingAgents,
          topFailingAgents
        },
        trends,
        insights,
        recommendations
      };
    } catch (error) {
      console.error('Failed to generate analytics report:', error);
      throw error;
    }
  }

  /**
   * Create alert
   */
  async createAlert(
    workflowId: string,
    type: WorkflowAlert["type"],
    severity: WorkflowAlert["severity"],
    message: string,
    threshold?: number,
    currentValue?: number
  ): Promise<WorkflowAlert> {
    const alert: WorkflowAlert = {
      id: generatePrefixedUUID("alert"),
      workflowId,
      type,
      severity,
      message,
      threshold,
      currentValue,
      triggeredAt: new Date(),
      acknowledged: false
    };

    this.alerts.push(alert);
    this.emit('alert.created', alert);
    return alert;
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId: string): Promise<boolean> {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) return false;

    alert.acknowledged = true;
    this.emit('alert.acknowledged', alert);
    return true;
  }

  /**
   * Resolve alert
   */
  async resolveAlert(alertId: string): Promise<boolean> {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) return false;

    alert.resolvedAt = new Date();
    this.emit('alert.resolved', alert);
    return true;
  }

  // ---------- Private Methods ----------

  private async updateWorkflowMetrics(
    workflowId: string,
    executionTime: number,
    success: boolean
  ): Promise<void> {
    try {
      const existing = await this.prisma.workflowMetrics.findUnique({
        where: { workflowId }
      });

      if (existing) {
        await this.prisma.workflowMetrics.update({
          where: { workflowId },
          data: {
            totalExecutions: existing.totalExecutions + 1,
            successfulExecutions: existing.successfulExecutions + (success ? 1 : 0),
            failedExecutions: existing.failedExecutions + (success ? 0 : 1),
            averageExecutionTime: this.calculateAverageExecutionTime(
              existing.averageExecutionTime,
              existing.totalExecutions,
              executionTime
            ),
            successRate: this.calculateSuccessRate(
              existing.successfulExecutions + (success ? 1 : 0),
              existing.totalExecutions + 1
            ),
            lastExecutedAt: new Date()
          }
        });
      } else {
        await this.prisma.workflowMetrics.create({
          data: {
            workflowId,
            totalExecutions: 1,
            successfulExecutions: success ? 1 : 0,
            failedExecutions: success ? 0 : 1,
            averageExecutionTime: executionTime,
            successRate: success ? 1 : 0,
            lastExecutedAt: new Date()
          }
        });
      }
    } catch (error) {
      console.error('Failed to update workflow metrics:', error);
    }
  }

  private async updateStepMetrics(
    stepId: string,
    stepName: string,
    agentType: string,
    executionTime: number,
    success: boolean,
    error?: string
  ): Promise<void> {
    // This would update step-specific metrics
    // Implementation depends on your step metrics storage strategy
  }

  private async recordPerformanceDataPoint(
    workflowId: string,
    executionTime: number,
    success: boolean
  ): Promise<void> {
    // Record performance data point for trend analysis
    // This could be stored in a time-series database or Redis
  }

  private async checkAlerts(
    workflowId: string,
    executionTime: number,
    success: boolean
  ): Promise<void> {
    const metrics = await this.getWorkflowMetrics(workflowId);
    if (!metrics) return;

    // Check performance alerts
    if (executionTime > (this.alertThresholds.get('execution_time') || 300000)) {
      await this.createAlert(
        workflowId,
        'performance',
        'high',
        `Workflow execution time exceeded threshold: ${executionTime}ms`,
        this.alertThresholds.get('execution_time'),
        executionTime
      );
    }

    // Check failure rate alerts
    if (metrics.failureRate > (this.alertThresholds.get('failure_rate') || 0.2)) {
      await this.createAlert(
        workflowId,
        'failure',
        'critical',
        `Workflow failure rate exceeded threshold: ${(metrics.failureRate * 100).toFixed(1)}%`,
        this.alertThresholds.get('failure_rate'),
        metrics.failureRate
      );
    }
  }

  private async getAgentHealth(): Promise<AgentHealth[]> {
    // Get agent health status
    // This would query agent status and performance metrics
    return [];
  }

  private async getWorkflowHealth(): Promise<WorkflowHealth[]> {
    // Get workflow health status
    // This would query workflow metrics and status
    return [];
  }

  private async getResourceHealth(): Promise<ResourceHealth> {
    // Get system resource health
    const cpuUsage = process.cpuUsage();
    const memoryUsage = process.memoryUsage();
    
    return {
      cpu: {
        usage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to percentage
        status: this.getResourceStatus((cpuUsage.user + cpuUsage.system) / 1000000, 80)
      },
      memory: {
        usage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
        status: this.getResourceStatus((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100, 85)
      },
      disk: {
        usage: 0, // Would need to implement disk usage check
        status: "healthy"
      },
      network: {
        latency: 0, // Would need to implement network latency check
        status: "healthy"
      }
    };
  }

  private getResourceStatus(usage: number, threshold: number): "healthy" | "degraded" | "unhealthy" {
    if (usage < threshold * 0.7) return "healthy";
    if (usage < threshold) return "degraded";
    return "unhealthy";
  }

  private calculateOverallHealth(
    agents: AgentHealth[],
    workflows: WorkflowHealth[],
    resources: ResourceHealth,
    alerts: WorkflowAlert[]
  ): "healthy" | "degraded" | "unhealthy" {
    const criticalAlerts = alerts.filter(a => a.severity === "critical" && !a.acknowledged);
    if (criticalAlerts.length > 0) return "unhealthy";

    const unhealthyAgents = agents.filter(a => a.status === "unhealthy").length;
    const unhealthyWorkflows = workflows.filter(w => w.status === "unhealthy").length;
    const unhealthyResources = Object.values(resources).filter(r => r.status === "unhealthy").length;

    if (unhealthyAgents > 0 || unhealthyWorkflows > 0 || unhealthyResources > 0) {
      return "degraded";
    }

    return "healthy";
  }

  private calculateThroughput(metrics: any): number {
    // Calculate executions per hour
    const hoursSinceStart = (Date.now() - new Date(metrics.createdAt).getTime()) / (1000 * 60 * 60);
    return hoursSinceStart > 0 ? metrics.totalExecutions / hoursSinceStart : 0;
  }

  private calculateAverageExecutionTime(
    currentAverage: number,
    currentCount: number,
    newValue: number
  ): number {
    return (currentAverage * currentCount + newValue) / (currentCount + 1);
  }

  private calculateSuccessRate(successful: number, total: number): number {
    return total > 0 ? successful / total : 0;
  }

  private async performHealthCheck(): Promise<void> {
    const health = await this.getSystemHealth();
    this.emit('health.checked', health);
  }

  private async collectMetrics(): Promise<void> {
    // Collect and store metrics
    this.emit('metrics.collected', { timestamp: new Date() });
  }

  private initializeAlertThresholds(): void {
    this.alertThresholds.set('execution_time', 300000); // 5 minutes
    this.alertThresholds.set('failure_rate', 0.2); // 20%
    this.alertThresholds.set('success_rate', 0.8); // 80%
    this.alertThresholds.set('memory_usage', 0.85); // 85%
    this.alertThresholds.set('cpu_usage', 0.8); // 80%
  }

  private async getAgentPerformance(startDate: Date, endDate: Date): Promise<any[]> {
    // Get agent performance data for the period
    return [];
  }

  private async generateTrends(startDate: Date, endDate: Date): Promise<any> {
    // Generate trend data for the period
    return {
      executionTrend: [],
      successRateTrend: [],
      performanceTrend: []
    };
  }

  private generateInsights(executions: any[], agentPerformance: any[]): string[] {
    const insights: string[] = [];
    
    if (executions.length > 0) {
      const successRate = executions.filter(e => e.state === "completed").length / executions.length;
      if (successRate < 0.8) {
        insights.push("Workflow success rate is below 80%, indicating potential issues with agent reliability");
      }
    }

    return insights;
  }

  private generateRecommendations(executions: any[], agentPerformance: any[]): string[] {
    const recommendations: string[] = [];
    
    if (executions.length > 0) {
      const avgExecutionTime = executions.reduce((sum, e) => sum + (e.executionTime || 0), 0) / executions.length;
      if (avgExecutionTime > 300000) { // 5 minutes
        recommendations.push("Consider implementing parallel execution to reduce workflow execution time");
      }
    }

    return recommendations;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
    }
  }
}

// ---------- Factory Function ----------
export function createWorkflowMonitor(prisma: PrismaClient): WorkflowMonitor {
  return new WorkflowMonitor(prisma);
}
