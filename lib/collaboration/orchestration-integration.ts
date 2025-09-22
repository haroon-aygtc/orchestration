// Simple integration helpers for adding collaboration to OrchestrationService
import { collaborationService } from './collaboration-service';
import { logger } from '../utils/structured-logger';

/**
 * Simple collaboration integration for OrchestrationService
 * This provides easy-to-use methods that can be called from orchestration methods
 */
export class OrchestrationCollaboration {
  
  /**
   * Emit reasoning when starting a goal
   */
  static async onGoalStart(goalId: string, goalDescription: string): Promise<void> {
    await collaborationService.emitReasoning(
      goalId,
      `Starting goal: ${goalDescription}`,
      0.9
    );
    
    await collaborationService.emitStatus(
      goalId,
      'goal.started',
      undefined,
      0
    );
  }

  /**
   * Emit reasoning when generating a plan
   */
  static async onPlanGeneration(goalId: string, stepCount: number): Promise<void> {
    await collaborationService.emitReasoning(
      goalId,
      `Generated execution plan with ${stepCount} steps`,
      0.8
    );
    
    await collaborationService.emitStatus(
      goalId,
      'plan.generated',
      undefined,
      10,
      { stepCount }
    );
  }

  /**
   * Emit reasoning when starting a step
   */
  static async onStepStart(goalId: string, stepId: string, stepDescription: string): Promise<void> {
    await collaborationService.emitReasoning(
      goalId,
      `Executing step: ${stepDescription}`,
      0.7,
      stepId
    );
    
    await collaborationService.emitStatus(
      goalId,
      'step.started',
      stepId,
      undefined,
      { description: stepDescription }
    );
  }

  /**
   * Emit reasoning when completing a step
   */
  static async onStepComplete(goalId: string, stepId: string, result: any): Promise<void> {
    await collaborationService.emitReasoning(
      goalId,
      `Step completed successfully`,
      0.9,
      stepId,
      { resultType: typeof result }
    );
    
    await collaborationService.emitStatus(
      goalId,
      'step.completed',
      stepId,
      undefined,
      { success: true }
    );
  }

  /**
   * Emit reasoning when a step fails
   */
  static async onStepFail(goalId: string, stepId: string, error: string): Promise<void> {
    await collaborationService.emitReasoning(
      goalId,
      `Step failed: ${error}`,
      0.6,
      stepId,
      { error }
    );
    
    await collaborationService.emitStatus(
      goalId,
      'step.failed',
      stepId,
      undefined,
      { error }
    );
  }

  /**
   * Emit reasoning when goal is completed
   */
  static async onGoalComplete(goalId: string, result: any): Promise<void> {
    await collaborationService.emitReasoning(
      goalId,
      `Goal completed successfully`,
      0.95
    );
    
    await collaborationService.emitStatus(
      goalId,
      'goal.completed',
      undefined,
      100,
      { resultType: typeof result }
    );
  }

  /**
   * Emit suggestion for user action
   */
  static async emitUserSuggestion(
    goalId: string,
    suggestion: string,
    action: string,
    fromAgent: string = 'orchestration',
    confidence: number = 0.7
  ): Promise<void> {
    await collaborationService.emitSuggestion(
      goalId,
      suggestion,
      action,
      confidence,
      fromAgent
    );
  }

  /**
   * Emit reasoning for agent thinking
   */
  static async emitAgentThinking(
    goalId: string,
    thought: string,
    agentName: string,
    confidence: number = 0.6,
    stepId?: string
  ): Promise<void> {
    await collaborationService.emitReasoning(
      goalId,
      `[${agentName}] ${thought}`,
      confidence,
      stepId,
      { agent: agentName }
    );
  }

  /**
   * Emit progress update
   */
  static async emitProgress(
    goalId: string,
    progress: number,
    message: string,
    stepId?: string
  ): Promise<void> {
    await collaborationService.emitStatus(
      goalId,
      'progress.update',
      stepId,
      progress,
      { message }
    );
  }

  /**
   * Get collaboration history for a goal
   */
  static getGoalHistory(goalId: string) {
    return collaborationService.getAllHistory(goalId);
  }

  /**
   * Clear collaboration history for a goal
   */
  static clearGoalHistory(goalId: string): void {
    collaborationService.clearHistory(goalId);
  }

  /**
   * Get collaboration statistics
   */
  static getStats() {
    return collaborationService.getStats();
  }
}

// Export for easy use
export const OrchestrationCollab = OrchestrationCollaboration;
