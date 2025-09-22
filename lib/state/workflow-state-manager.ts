// Workflow State Manager - Comprehensive state persistence and management
// Handles workflow state, checkpoints, rollbacks, and recovery

import { EventEmitter } from "events";
import { generateUUID } from "../utils/uuid";
import { PrismaClient } from "@prisma/client";

// ---------- Types ----------
export interface WorkflowState {
  id: string;
  workflowId: string;
  goalId: string;
  currentStep: string;
  completedSteps: string[];
  failedSteps: string[];
  pendingSteps: string[];
  state: "running" | "paused" | "completed" | "failed" | "cancelled";
  data: Record<string, any>;
  checkpoints: WorkflowCheckpoint[];
  metadata: {
    startedAt: Date;
    lastUpdatedAt: Date;
    completedAt?: Date;
    executionTime?: number;
    retryCount: number;
    version: number;
  };
}

export interface WorkflowCheckpoint {
  id: string;
  stepId: string;
  timestamp: Date;
  state: Record<string, any>;
  artifacts: any[];
  metrics: {
    executionTime: number;
    memoryUsage: number;
    cpuUsage: number;
  };
}

export interface StateTransition {
  from: string;
  to: string;
  timestamp: Date;
  reason: string;
  data?: any;
}

export interface WorkflowRecovery {
  workflowId: string;
  lastCheckpoint: WorkflowCheckpoint;
  recoverySteps: string[];
  estimatedRecoveryTime: number;
  dataLoss: boolean;
}

// ---------- Schemas ----------
const WorkflowStateSchema = {
  id: "string",
  workflowId: "string", 
  goalId: "string",
  currentStep: "string",
  completedSteps: "array",
  failedSteps: "array",
  pendingSteps: "array",
  state: "string",
  data: "object",
  checkpoints: "array",
  metadata: "object"
};

// ---------- State Manager ----------
export class WorkflowStateManager extends EventEmitter {
  private prisma: PrismaClient;
  private stateCache: Map<string, WorkflowState> = new Map();
  private checkpointInterval: number = 30000; // 30 seconds
  private maxCheckpoints: number = 10;
  private cleanupInterval: NodeJS.Timeout;

  constructor(prisma: PrismaClient) {
    super();
    this.prisma = prisma;
    
    // Start cleanup process
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldStates();
    }, 300000); // 5 minutes
  }

  /**
   * Create a new workflow state
   */
  async createWorkflowState(
    workflowId: string,
    goalId: string,
    steps: string[],
    initialData: Record<string, any> = {}
  ): Promise<WorkflowState> {
    const stateId = generateUUID();
    const now = new Date();

    const workflowState: WorkflowState = {
      id: stateId,
      workflowId,
      goalId,
      currentStep: steps[0] || "",
      completedSteps: [],
      failedSteps: [],
      pendingSteps: steps,
      state: "running",
      data: { ...initialData },
      checkpoints: [],
      metadata: {
        startedAt: now,
        lastUpdatedAt: now,
        retryCount: 0,
        version: 1
      }
    };

    // Save to database
    await this.saveState(workflowState);
    
    // Cache in memory
    this.stateCache.set(stateId, workflowState);
    
    this.emit('state.created', { stateId, workflowState });
    return workflowState;
  }

  /**
   * Get workflow state by ID
   */
  async getWorkflowState(stateId: string): Promise<WorkflowState | null> {
    // Check cache first
    if (this.stateCache.has(stateId)) {
      return this.stateCache.get(stateId)!;
    }

    // Load from database
    try {
      const stateData = await this.prisma.workflowState.findUnique({
        where: { id: stateId }
      });

      if (!stateData) return null;

      const workflowState: WorkflowState = {
        id: stateData.id,
        workflowId: stateData.workflowId,
        goalId: stateData.goalId,
        currentStep: stateData.currentStep,
        completedSteps: stateData.completedSteps,
        failedSteps: stateData.failedSteps,
        pendingSteps: stateData.pendingSteps,
        state: stateData.state as any,
        data: stateData.data as Record<string, any>,
        checkpoints: (stateData.checkpoints as unknown) as WorkflowCheckpoint[],
        metadata: {
          startedAt: stateData.startedAt,
          lastUpdatedAt: stateData.lastUpdatedAt,
          completedAt: stateData.completedAt || undefined,
          executionTime: stateData.executionTime || 0,
          retryCount: stateData.retryCount || 0,
          version: stateData.version || 1
        }
      };

      // Cache the state
      this.stateCache.set(stateId, workflowState);
      return workflowState;
    } catch (error) {
      console.error('Failed to load workflow state:', error);
      return null;
    }
  }

  /**
   * Update workflow state
   */
  async updateWorkflowState(
    stateId: string,
    updates: Partial<WorkflowState>
  ): Promise<WorkflowState | null> {
    const currentState = await this.getWorkflowState(stateId);
    if (!currentState) return null;

    // Create updated state
    const updatedState: WorkflowState = {
      ...currentState,
      ...updates,
      metadata: {
        ...currentState.metadata,
        lastUpdatedAt: new Date(),
        version: currentState.metadata.version + 1
      }
    };

    // Save to database
    await this.saveState(updatedState);
    
    // Update cache
    this.stateCache.set(stateId, updatedState);
    
    this.emit('state.updated', { stateId, updatedState, changes: updates });
    return updatedState;
  }

  /**
   * Mark step as completed
   */
  async markStepCompleted(
    stateId: string,
    stepId: string,
    result: any,
    artifacts: any[] = []
  ): Promise<WorkflowState | null> {
    const state = await this.getWorkflowState(stateId);
    if (!state) return null;

    // Update state
    const updatedCompletedSteps = [...state.completedSteps, stepId];
    const updatedPendingSteps = state.pendingSteps.filter(id => id !== stepId);
    const nextStep = updatedPendingSteps[0] || "";

    // Create checkpoint
    const checkpoint = await this.createCheckpoint(stateId, stepId, result, artifacts);

    const updatedState = await this.updateWorkflowState(stateId, {
      completedSteps: updatedCompletedSteps,
      pendingSteps: updatedPendingSteps,
      currentStep: nextStep,
      data: { ...state.data, [stepId]: result },
      checkpoints: [...state.checkpoints, checkpoint]
    });

    this.emit('step.completed', { stateId, stepId, result, checkpoint });
    return updatedState;
  }

  /**
   * Mark step as failed
   */
  async markStepFailed(
    stateId: string,
    stepId: string,
    error: string,
    retryable: boolean = true
  ): Promise<WorkflowState | null> {
    const state = await this.getWorkflowState(stateId);
    if (!state) return null;

    const updatedFailedSteps = [...state.failedSteps, stepId];
    const updatedPendingSteps = state.pendingSteps.filter(id => id !== stepId);
    
    let newState: WorkflowState["state"] = "failed";
    let retryCount = state.metadata.retryCount;

    if (retryable && retryCount < 3) {
      // Retry the step
      retryCount++;
      updatedPendingSteps.unshift(stepId); // Add back to pending
      newState = "running";
    }

    const updatedState = await this.updateWorkflowState(stateId, {
      failedSteps: updatedFailedSteps,
      pendingSteps: updatedPendingSteps,
      state: newState,
      metadata: {
        ...state.metadata,
        retryCount
      }
    });

    this.emit('step.failed', { stateId, stepId, error, retryable, retryCount });
    return updatedState;
  }

  /**
   * Create a checkpoint
   */
  async createCheckpoint(
    stateId: string,
    stepId: string,
    result: any,
    artifacts: any[] = []
  ): Promise<WorkflowCheckpoint> {
    const checkpoint: WorkflowCheckpoint = {
      id: generateUUID(),
      stepId,
      timestamp: new Date(),
      state: { result, artifacts },
      artifacts,
      metrics: {
        executionTime: Date.now() - ((await this.getWorkflowState(stateId))?.metadata?.startedAt?.getTime() || 0),
        memoryUsage: process.memoryUsage().heapUsed,
        cpuUsage: process.cpuUsage().user
      }
    };

    this.emit('checkpoint.created', { stateId, checkpoint });
    return checkpoint;
  }

  /**
   * Rollback to a checkpoint
   */
  async rollbackToCheckpoint(
    stateId: string,
    checkpointId: string
  ): Promise<WorkflowState | null> {
    const state = await this.getWorkflowState(stateId);
    if (!state) return null;

    const checkpoint = state.checkpoints.find(cp => cp.id === checkpointId);
    if (!checkpoint) return null;

    // Find steps to rollback
    const checkpointIndex = state.checkpoints.findIndex(cp => cp.id === checkpointId);
    const stepsToRollback = state.completedSteps.slice(checkpointIndex);

    // Update state
    const updatedState = await this.updateWorkflowState(stateId, {
      completedSteps: state.completedSteps.slice(0, checkpointIndex),
      pendingSteps: [...stepsToRollback, ...state.pendingSteps],
      currentStep: stepsToRollback[0] || "",
      data: { ...state.data, ...checkpoint.state },
      state: "running"
    });

    this.emit('rollback.executed', { stateId, checkpointId, stepsToRollback });
    return updatedState;
  }

  /**
   * Pause workflow execution
   */
  async pauseWorkflow(stateId: string): Promise<WorkflowState | null> {
    return this.updateWorkflowState(stateId, { state: "paused" });
  }

  /**
   * Resume workflow execution
   */
  async resumeWorkflow(stateId: string): Promise<WorkflowState | null> {
    return this.updateWorkflowState(stateId, { state: "running" });
  }

  /**
   * Cancel workflow execution
   */
  async cancelWorkflow(stateId: string): Promise<WorkflowState | null> {
    const currentState = await this.getWorkflowState(stateId);
    if (!currentState) return null;

    return this.updateWorkflowState(stateId, { 
      state: "cancelled",
      metadata: {
        ...currentState.metadata,
        completedAt: new Date()
      }
    });
  }

  /**
   * Get workflow recovery information
   */
  async getWorkflowRecovery(workflowId: string): Promise<WorkflowRecovery | null> {
    const states = await this.prisma.workflowState.findMany({
      where: { workflowId },
      orderBy: { lastUpdatedAt: 'desc' }
    });

    if (states.length === 0) return null;

    const latestState = states[0];
    const checkpoints = (latestState.checkpoints as any) || [];
    const lastCheckpoint = checkpoints[checkpoints.length - 1];
    
    if (!lastCheckpoint) return null;

    return {
      workflowId,
      lastCheckpoint: lastCheckpoint as WorkflowCheckpoint,
      recoverySteps: latestState.pendingSteps,
      estimatedRecoveryTime: latestState.pendingSteps.length * 30000, // 30s per step
      dataLoss: latestState.failedSteps.length > 0
    };
  }

  /**
   * Get workflow metrics
   */
  async getWorkflowMetrics(workflowId: string): Promise<{
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageExecutionTime: number;
    successRate: number;
  }> {
    const states = await this.prisma.workflowState.findMany({
      where: { workflowId }
    });

    const totalExecutions = states.length;
    const successfulExecutions = states.filter(s => s.state === "completed").length;
    const failedExecutions = states.filter(s => s.state === "failed").length;
    const averageExecutionTime = states.reduce((sum, s) => sum + (s.executionTime || 0), 0) / totalExecutions;
    const successRate = totalExecutions > 0 ? successfulExecutions / totalExecutions : 0;

    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      averageExecutionTime,
      successRate
    };
  }

  /**
   * Save state to database
   */
  private async saveState(state: WorkflowState): Promise<void> {
    try {
      await this.prisma.workflowState.upsert({
        where: { id: state.id },
        create: {
          id: state.id,
          workflowId: state.workflowId,
          goalId: state.goalId,
          currentStep: state.currentStep,
          completedSteps: state.completedSteps,
          failedSteps: state.failedSteps,
          pendingSteps: state.pendingSteps,
          state: state.state,
          data: state.data,
          checkpoints: state.checkpoints as any,
          startedAt: state.metadata.startedAt,
          lastUpdatedAt: state.metadata.lastUpdatedAt,
          completedAt: state.metadata.completedAt,
          executionTime: state.metadata.executionTime,
          retryCount: state.metadata.retryCount,
          version: state.metadata.version
        },
        update: {
          currentStep: state.currentStep,
          completedSteps: state.completedSteps,
          failedSteps: state.failedSteps,
          pendingSteps: state.pendingSteps,
          state: state.state,
          data: state.data,
          checkpoints: state.checkpoints as any,
          lastUpdatedAt: state.metadata.lastUpdatedAt,
          completedAt: state.metadata.completedAt as Date | null,
          executionTime: state.metadata.executionTime,
          retryCount: state.metadata.retryCount,
          version: state.metadata.version
        }
      });
    } catch (error) {
      console.error('Failed to save workflow state:', error);
      throw error;
    }
  }

  /**
   * Cleanup old states
   */
  private async cleanupOldStates(): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      
      await this.prisma.workflowState.deleteMany({
        where: {
          lastUpdatedAt: {
            lt: cutoffDate
          },
          state: {
            in: ["completed", "failed", "cancelled"]
          }
        }
      });

      // Clean up cache
      for (const [stateId, state] of this.stateCache.entries()) {
        if (state.metadata.lastUpdatedAt < cutoffDate) {
          this.stateCache.delete(stateId);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old states:', error);
    }
  }

  /**
   * Get all active workflows
   */
  async getActiveWorkflows(): Promise<WorkflowState[]> {
    const states = await this.prisma.workflowState.findMany({
      where: {
        state: {
          in: ["running", "paused"]
        }
      },
      orderBy: { lastUpdatedAt: 'desc' }
    });

    return states.map(state => ({
      id: state.id,
      workflowId: state.workflowId,
      goalId: state.goalId,
      currentStep: state.currentStep,
      completedSteps: state.completedSteps,
      failedSteps: state.failedSteps,
      pendingSteps: state.pendingSteps,
      state: state.state as any,
      data: state.data as Record<string, any>,
      checkpoints: state.checkpoints as unknown as WorkflowCheckpoint[],
      metadata: {
        startedAt: state.startedAt,
        lastUpdatedAt: state.lastUpdatedAt,
        completedAt: state.completedAt as Date | undefined,
        executionTime: state.executionTime as number | undefined,
        retryCount: state.retryCount,
        version: state.version
      }
    }));
  }

  /**
   * Destroy the state manager
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.stateCache.clear();
  }
}

// ---------- Factory Function ----------
export function createWorkflowStateManager(prisma: PrismaClient): WorkflowStateManager {
  return new WorkflowStateManager(prisma);
}
