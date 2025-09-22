// Parallel Execution Engine for AI Agent Architecture
// Enables concurrent execution of workflow steps and agent tasks

import { z } from "zod";
import { EventEmitter } from "events";
import { generateUUID } from "../utils/uuid";

// ---------- Types ----------
export interface ParallelTask {
  id: string;
  name: string;
  type: "agent" | "tool" | "workflow";
  agent?: string;
  tool?: string;
  input: any;
  dependencies: string[];
  timeout?: number;
  retries?: number;
  priority?: number;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  result?: any;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  executionTime?: number;
}

export interface ParallelExecutionPlan {
  id: string;
  name: string;
  tasks: ParallelTask[];
  maxConcurrency: number;
  timeout: number;
  retryPolicy: {
    maxRetries: number;
    retryDelay: number;
    exponentialBackoff: boolean;
  };
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  startedAt?: Date;
  completedAt?: Date;
  results: Map<string, any>;
  errors: Map<string, string>;
}

export interface ExecutionMetrics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  cancelledTasks: number;
  averageExecutionTime: number;
  totalExecutionTime: number;
  throughput: number; // tasks per second
  successRate: number;
}

// ---------- Schemas ----------
const TaskSchema = z.object({
  name: z.string(),
  type: z.enum(["agent", "tool", "workflow"]),
  agent: z.string().optional(),
  tool: z.string().optional(),
  input: z.any(),
  dependencies: z.array(z.string()).default([]),
  timeout: z.number().positive().optional(),
  retries: z.number().nonnegative().default(3),
  priority: z.number().default(0)
});

const ExecutionPlanSchema = z.object({
  name: z.string(),
  tasks: z.array(TaskSchema),
  maxConcurrency: z.number().positive().default(5),
  timeout: z.number().positive().default(300000), // 5 minutes
  retryPolicy: z.object({
    maxRetries: z.number().nonnegative().default(3),
    retryDelay: z.number().nonnegative().default(1000),
    exponentialBackoff: z.boolean().default(true)
  }).default({})
});

// ---------- Parallel Execution Engine ----------
export class ParallelExecutionEngine extends EventEmitter {
  private activeExecutions: Map<string, ParallelExecutionPlan> = new Map();
  private taskQueue: ParallelTask[] = [];
  private runningTasks: Set<string> = new Set();
  private maxConcurrency: number = 5;
  private metrics: ExecutionMetrics = {
    totalTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    cancelledTasks: 0,
    averageExecutionTime: 0,
    totalExecutionTime: 0,
    throughput: 0,
    successRate: 0
  };

  constructor(options: { maxConcurrency?: number } = {}) {
    super();
    this.maxConcurrency = options.maxConcurrency || 5;
  }

  /**
   * Create a parallel execution plan from task definitions
   */
  createExecutionPlan(planData: z.infer<typeof ExecutionPlanSchema>): ParallelExecutionPlan {
    const parsed = ExecutionPlanSchema.parse(planData);
    const planId = generateUUID();
    
    const tasks: ParallelTask[] = parsed.tasks.map(taskData => ({
      id: generateUUID(),
      name: taskData.name,
      type: taskData.type,
      agent: taskData.agent,
      tool: taskData.tool,
      input: taskData.input,
      dependencies: taskData.dependencies,
      timeout: taskData.timeout,
      retries: taskData.retries,
      priority: taskData.priority,
      status: "pending"
    }));

    const plan: ParallelExecutionPlan = {
      id: planId,
      name: parsed.name,
      tasks,
      maxConcurrency: parsed.maxConcurrency,
      timeout: parsed.timeout,
      retryPolicy: parsed.retryPolicy,
      status: "pending",
      results: new Map(),
      errors: new Map()
    };

    this.activeExecutions.set(planId, plan);
    return plan;
  }

  /**
   * Execute a parallel execution plan
   */
  async executePlan(planId: string, agentRegistry?: Map<string, any>, toolRegistry?: Map<string, any>): Promise<ParallelExecutionPlan> {
    const plan = this.activeExecutions.get(planId);
    if (!plan) {
      throw new Error(`Execution plan not found: ${planId}`);
    }

    plan.status = "running";
    plan.startedAt = new Date();
    this.emit('plan.started', { planId, plan });

    try {
      // Build dependency graph
      const dependencyGraph = this.buildDependencyGraph(plan.tasks);
      
      // Execute tasks in parallel respecting dependencies
      await this.executeTasksInParallel(plan, dependencyGraph, agentRegistry, toolRegistry);
      
      plan.status = "completed";
      plan.completedAt = new Date();
      this.emit('plan.completed', { planId, plan });
      
    } catch (error: any) {
      plan.status = "failed";
      plan.completedAt = new Date();
      this.emit('plan.failed', { planId, plan, error: error.message });
      throw error;
    }

    return plan;
  }

  /**
   * Build dependency graph for task execution order
   */
  private buildDependencyGraph(tasks: ParallelTask[]): Map<string, Set<string>> {
    const graph = new Map<string, Set<string>>();
    
    for (const task of tasks) {
      graph.set(task.id, new Set(task.dependencies));
    }
    
    return graph;
  }

  /**
   * Execute tasks in parallel with dependency resolution
   */
  private async executeTasksInParallel(
    plan: ParallelExecutionPlan,
    dependencyGraph: Map<string, Set<string>>,
    agentRegistry?: Map<string, any>,
    toolRegistry?: Map<string, any>
  ): Promise<void> {
    const completedTasks = new Set<string>();
    const runningTasks = new Set<string>();
    const taskMap = new Map(plan.tasks.map(task => [task.id, task]));

    while (completedTasks.size < plan.tasks.length) {
      // Find tasks that can be executed (dependencies satisfied)
      const readyTasks = plan.tasks.filter(task => 
        task.status === "pending" && 
        !runningTasks.has(task.id) &&
        !completedTasks.has(task.id) &&
        this.areDependenciesSatisfied(task.id, dependencyGraph, completedTasks)
      );

      // Sort by priority (higher priority first)
      readyTasks.sort((a, b) => (b.priority || 0) - (a.priority || 0));

      // Execute up to maxConcurrency tasks
      const tasksToExecute = readyTasks.slice(0, this.maxConcurrency - runningTasks.size);
      
      if (tasksToExecute.length === 0 && runningTasks.size === 0) {
        // No more tasks can be executed (circular dependency or all failed)
        const pendingTasks = plan.tasks.filter(task => 
          task.status === "pending" && !completedTasks.has(task.id)
        );
        if (pendingTasks.length > 0) {
          throw new Error(`Circular dependency detected or tasks cannot be executed: ${pendingTasks.map(t => t.name).join(", ")}`);
        }
        break;
      }

      // Execute tasks concurrently
      const executionPromises = tasksToExecute.map(task => 
        this.executeTask(task, plan, agentRegistry, toolRegistry)
          .then(result => {
            completedTasks.add(task.id);
            runningTasks.delete(task.id);
            plan.results.set(task.id, result);
            this.updateMetrics(task);
            this.emit('task.completed', { planId: plan.id, taskId: task.id, result });
          })
          .catch(error => {
            runningTasks.delete(task.id);
            plan.errors.set(task.id, error.message);
            this.updateMetrics(task);
            this.emit('task.failed', { planId: plan.id, taskId: task.id, error: error.message });
            
            // Retry logic
            if (task.retries && task.retries > 0) {
              task.retries--;
              task.status = "pending";
              this.emit('task.retry', { planId: plan.id, taskId: task.id, retriesLeft: task.retries });
            } else {
              completedTasks.add(task.id);
              task.status = "failed";
            }
          })
      );

      // Add to running tasks
      tasksToExecute.forEach(task => {
        runningTasks.add(task.id);
        task.status = "running";
        task.startedAt = new Date();
        this.emit('task.started', { planId: plan.id, taskId: task.id, task });
      });

      // Wait for at least one task to complete
      await Promise.race(executionPromises);
    }
  }

  /**
   * Check if all dependencies for a task are satisfied
   */
  private areDependenciesSatisfied(
    taskId: string, 
    dependencyGraph: Map<string, Set<string>>, 
    completedTasks: Set<string>
  ): boolean {
    const dependencies = dependencyGraph.get(taskId);
    if (!dependencies) return true;
    
    return Array.from(dependencies).every(depId => completedTasks.has(depId));
  }

  /**
   * Execute a single task
   */
  private async executeTask(
    task: ParallelTask,
    plan: ParallelExecutionPlan,
    agentRegistry?: Map<string, any>,
    toolRegistry?: Map<string, any>
  ): Promise<any> {
    const startTime = Date.now();
    
    try {
      let result: any;

      if (task.type === "agent" && task.agent && agentRegistry) {
        const agent = agentRegistry.get(task.agent);
        if (!agent) {
          throw new Error(`Agent not found: ${task.agent}`);
        }
        result = await this.executeWithTimeout(
          () => agent.execute(task.name, task.input),
          task.timeout || 30000
        );
      } else if (task.type === "tool" && task.tool && toolRegistry) {
        const tool = toolRegistry.get(task.tool);
        if (!tool) {
          throw new Error(`Tool not found: ${task.tool}`);
        }
        result = await this.executeWithTimeout(
          () => tool(task.input),
          task.timeout || 30000
        );
      } else if (task.type === "workflow") {
        // Execute workflow (could be another parallel execution)
        result = await this.executeWithTimeout(
          () => this.executeWorkflow(task.input),
          task.timeout || 30000
        );
      } else {
        throw new Error(`Invalid task type or missing agent/tool: ${task.type}`);
      }

      task.status = "completed";
      task.result = result;
      task.completedAt = new Date();
      task.executionTime = Date.now() - startTime;

      return result;

    } catch (error: any) {
      task.status = "failed";
      task.error = error.message;
      task.completedAt = new Date();
      task.executionTime = Date.now() - startTime;
      throw error;
    }
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(`Task timeout after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }

  /**
   * Execute workflow using real workflow engine
   */
  private async executeWorkflow(input: any): Promise<any> {
    try {
      // Import and use real workflow execution service
      const { workflowExecutionService } = await import('../workflow/workflow-execution-service')
      const result = await workflowExecutionService.executeWorkflow(input)
      return result
    } catch (error) {
      console.error('Workflow execution failed:', error)
      throw new Error(`Workflow execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Update execution metrics
   */
  private updateMetrics(task: ParallelTask): void {
    this.metrics.totalTasks++;
    
    if (task.status === "completed") {
      this.metrics.completedTasks++;
    } else if (task.status === "failed") {
      this.metrics.failedTasks++;
    } else if (task.status === "cancelled") {
      this.metrics.cancelledTasks++;
    }

    if (task.executionTime) {
      this.metrics.totalExecutionTime += task.executionTime;
      this.metrics.averageExecutionTime = this.metrics.totalExecutionTime / this.metrics.completedTasks;
    }

    this.metrics.throughput = this.metrics.completedTasks / (this.metrics.totalExecutionTime / 1000);
    this.metrics.successRate = this.metrics.completedTasks / this.metrics.totalTasks;
  }

  /**
   * Get execution metrics
   */
  getMetrics(): ExecutionMetrics {
    return { ...this.metrics };
  }

  /**
   * Get active execution plans
   */
  getActiveExecutions(): ParallelExecutionPlan[] {
    return Array.from(this.activeExecutions.values());
  }

  /**
   * Cancel an execution plan
   */
  cancelPlan(planId: string): boolean {
    const plan = this.activeExecutions.get(planId);
    if (!plan) return false;

    plan.status = "cancelled";
    plan.completedAt = new Date();
    
    // Cancel all pending tasks
    plan.tasks.forEach(task => {
      if (task.status === "pending" || task.status === "running") {
        task.status = "cancelled";
        task.completedAt = new Date();
      }
    });

    this.emit('plan.cancelled', { planId, plan });
    return true;
  }

  /**
   * Clean up completed executions
   */
  cleanup(): void {
    const completedPlans = Array.from(this.activeExecutions.entries())
      .filter(([_, plan]) => 
        plan.status === "completed" || 
        plan.status === "failed" || 
        plan.status === "cancelled"
      );

    completedPlans.forEach(([planId, _]) => {
      this.activeExecutions.delete(planId);
    });
  }
}

// ---------- Factory Function ----------
export function createParallelExecutionEngine(options?: { maxConcurrency?: number }): ParallelExecutionEngine {
  return new ParallelExecutionEngine(options);
}

// ---------- Utility Functions ----------
export function createParallelTask(
  name: string,
  type: "agent" | "tool" | "workflow",
  input: any,
  options: {
    agent?: string;
    tool?: string;
    dependencies?: string[];
    timeout?: number;
    retries?: number;
    priority?: number;
  } = {}
): ParallelTask {
  return {
    id: generateUUID(),
    name,
    type,
    agent: options.agent,
    tool: options.tool,
    input,
    dependencies: options.dependencies || [],
    timeout: options.timeout,
    retries: options.retries || 3,
    priority: options.priority || 0,
    status: "pending"
  };
}
