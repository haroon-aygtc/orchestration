// Centralized orchestration types - aligned with existing system
// Re-export from main types file to maintain consistency

// Import the base type for extension
import type { PlanStep } from '../types/index';

export type {
  // Main types from centralized location
  Goal as OrchestrationGoal,
  PlanStep as OrchestrationStep,
  Artifact as OrchestrationArtifact,
  Suggestion as OrchestrationSuggestion,
  GoalStatus as OrchestrationGoalStatus,
  StepStatus as OrchestrationStepStatus,
  OrchestrationEvent,
  EventPayload,
  OrchestrationResult,
  ToolInfo as ToolCatalogItem
} from '../types/index';

// Orchestration-specific types not in main types
export interface OrchestrationStepExtended extends PlanStep {
  timeoutMs?: number; // Additional field for orchestration-specific needs
}

