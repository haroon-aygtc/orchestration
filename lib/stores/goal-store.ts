// Goal Store - Centralized Goal and Step Management
import { TaskStatus, AgentTask, Goal, Step, AgentTaskStore } from '../agents/shared/types';
import { AgentTask } from 'dist/types';


// Update GoalStore interface accordingly
export interface GoalStore {
  createGoal(goal: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>): Promise<Goal>;
  getGoal(goalId: string): Promise<Goal | null>;
  updateGoal(goalId: string, updates: Partial<Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Goal | null>;
  listGoals(filters?: { status?: TaskStatus; businessProfileId?: string }): Promise<Goal[]>;
  deleteGoal(goalId: string): Promise<boolean>;
  
  createStep(step: Omit<Step, 'id' | 'startedAt' | 'completedAt'>): Promise<Step>;
  getStep(stepId: string): Promise<Step | null>;
  updateStep(stepId: string, updates: Partial<Omit<Step, 'id'>>): Promise<Step | null>;
  listSteps(goalId: string): Promise<Step[]>;
  deleteStep(stepId: string): Promise<boolean>;
  
  createSteps(steps: Omit<Step, 'id' | 'startedAt' | 'completedAt'>[]): Promise<Step[]>;
  updateSteps(updates: { stepId: string; updates: Partial<Omit<Step, 'id'>> }[]): Promise<Step[]>;
  
  markGoalCompleted(goalId: string): Promise<boolean>;
  markGoalFailed(goalId: string, error?: string): Promise<boolean>;
  markStepCompleted(stepId: string, result?: Record<string, any>): Promise<boolean>;
  markStepFailed(stepId: string, error: string): Promise<boolean>;
}

/**
 * PostgreSQL-based Goal Store implementation
 */
export class PostgreSQLGoalStore implements GoalStore {
  constructor(private taskStore: AgentTaskStore) {}

  async createGoal(goal: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>): Promise<Goal> {
    const goalTask = {
      id: `goal_${Date.now()}`,
      type: 'goal',
      status: goal.status,
      input: {
        title: goal.title,
        description: goal.description,
        context: goal.context,
        businessProfileId: goal.businessProfileId,
      },
      startedAt: new Date(),
    };
    
    await this.taskStore.create(goalTask as any);
    return {
      id: goalTask.id,
      title: goal.title,
      description: goal.description,
      status: goal.status,
      context: goal.context,
      createdAt: new Date(),
      updatedAt: new Date(),
      businessProfileId: goal.businessProfileId,
    };
  }

  async getGoal(goalId: string): Promise<Goal | null> {
    const goal = await this.taskStore.get(goalId);

    return goal ? this.mapGoalFromDb(goal) : null;
  }

  async updateGoal(goalId: string, updates: Partial<Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Goal | null> {
    const updated = await this.taskStore.update(goalId, {
      id: goalId,
      input: {
        ...updates,
        updatedAt: new Date(),
      }
    });
    return this.mapGoalFromDb(updated);
  }

  async listGoals(filters?: { status?: TaskStatus; businessProfileId?: string; limit?: number }): Promise<Goal[]> {
    const goals = await this.taskStore.list({
      status: filters?.status,
      agentId: filters?.businessProfileId,
      limit: filters?.limit || 100,
    });
    return goals.map(this.mapGoalFromDb);
  }

  async deleteGoal(goalId: string): Promise<boolean> {
    try {
      await this.taskStore.delete(goalId);
      return true;
    } catch {
      return false;
    }
  }

  async createStep(step: Omit<Step, 'id' | 'startedAt' | 'completedAt'>): Promise<Step> {
    const created = await this.taskStore.create(step as any);
    return this.mapStepFromDb(created);
  }

  async getStep(stepId: string): Promise<Step | null> {
    const step = await this.taskStore.get(stepId);
    return step ? this.mapStepFromDb(step) : null;
  }

  async updateStep(stepId: string, updates: Partial<Omit<Step, 'id'>>): Promise<Step | null> {
    const updated = await this.taskStore.update(stepId, {
      id: stepId,
      input: {
        ...updates,
        updatedAt: new Date(),
      }
    });
    return this.mapStepFromDb(updated);
  }

  async listSteps(goalId: string): Promise<Step[]> {
    const steps = await this.taskStore.list({
      agentId: goalId,
      limit: 100,
    });
    return steps.map(this.mapStepFromDb);
  }

  async deleteStep(stepId: string): Promise<boolean> {
    try {
      await this.taskStore.delete(stepId);
      return true;
    } catch {
      return false;
    }
  }

  async createSteps(steps: Omit<Step, 'id' | 'startedAt' | 'completedAt'>[]): Promise<Step[]> {
    return await this.taskStore.transaction((tx: AgentTaskStore) => {
      const created: Step[] = [];
      for (const step of steps) {
        const newStep = await tx.create(step as unknown as AgentTask<unknown, unknown>);
        created.push(newStep as unknown as Step);
      }
          return created;
      
    });
  }

  async updateSteps(updates: { stepId: string; updates: Partial<Omit<Step, 'id'>> }[]): Promise<Step[]> {
    const results: Step[] = [];
    
    for (const { stepId, updates: stepUpdates } of updates) {
      const updated = await this.updateStep(stepId, stepUpdates);
      if (updated) {
        results.push(updated);
        }
      }
    
    return results;
  }

  async markGoalCompleted(goalId: string): Promise<boolean> {
    const updated = await this.updateGoal(goalId, { 
      status: TaskStatus.Completed,
    });
    return updated !== null;
  }

  async markGoalFailed(goalId: string, error?: string): Promise<boolean> {
    const updated = await this.updateGoal(goalId, { 
      status: TaskStatus.Failed,
      context: error ? { error } : undefined,
    });
    return updated !== null;
  }

  async markStepCompleted(stepId: string, result?: Record<string, any>): Promise<boolean> {
    const updated = await this.updateStep(stepId, {
      status: TaskStatus.Completed,
      result,
      completedAt: new Date(),
    });
    return updated !== null;
  }

  async markStepFailed(stepId: string, error: string): Promise<boolean> {
    const updated = await this.updateStep(stepId, {
      status: TaskStatus.Failed,
      error,
      completedAt: new Date(),
    });
    return updated !== null;
  }

  private mapGoalFromDb(dbGoal: any): Goal {
    return {
      id: dbGoal.id,
      title: dbGoal.title,
      description: dbGoal.description,
      status: dbGoal.status,
      context: dbGoal.context,
      createdAt: dbGoal.createdAt,
      updatedAt: dbGoal.updatedAt,
      businessProfileId: dbGoal.businessProfileId,
    };
  }

  private mapStepFromDb(dbStep: any): Step {
    return {
      id: dbStep.id,
      goalId: dbStep.goalId,
      agent: dbStep.agent,
      tool: dbStep.tool,
      input: dbStep.input,
      successCriteria: dbStep.successCriteria,
      status: dbStep.status,
      startedAt: dbStep.startedAt,
      completedAt: dbStep.completedAt,
      result: dbStep.result,
      error: dbStep.error,
      taskId: dbStep.taskId,
    };
  }
}

/**
 * Create a Goal Store instance
 */
export function createGoalStore(prisma: PostgreSQLTaskStore): GoalStore {
  return new PostgreSQLGoalStore(prisma);
}
