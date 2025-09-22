# Real-Time Collaboration Integration

This directory contains the collaboration system for real-time reasoning and suggestions.

## Quick Start

### 1. Import the collaboration helpers

```typescript
import { OrchestrationCollab } from "./collaboration/orchestration-integration";
```

### 2. Add collaboration events to your orchestration methods

```typescript
// In your OrchestrationService methods:

async createGoal(input: CreateGoalInput): Promise<OrchestrationGoal> {
  const goalId = generateUUID();

  // Add collaboration event
  await OrchestrationCollab.onGoalStart(goalId, input.description);

  // ... existing goal creation logic ...

  return goal;
}

async executeNextStep(goalId: string): Promise<ExecutionResult> {
  const step = await this.getNextStep(goalId);

  // Add collaboration event
  await OrchestrationCollab.onStepStart(goalId, step.id, step.description);

  try {
    const result = await this.runStep(step);

    // Add collaboration event
    await OrchestrationCollab.onStepComplete(goalId, step.id, result);

    return result;
  } catch (error) {
    // Add collaboration event
    await OrchestrationCollab.onStepFail(goalId, step.id, error.message);
    throw error;
  }
}
```

### 3. Add agent thinking events

```typescript
// In your agent methods:

async processIntent(input: IntentInput): Promise<IntentOutput> {
  // Add thinking event
  await OrchestrationCollab.emitAgentThinking(
    input.goalId,
    "Analyzing user intent and determining next actions",
    "IntentAgent",
    0.8
  );

  // ... existing processing logic ...

  return result;
}
```

## Available Methods

### Status Events

- `onGoalStart(goalId, description)` - When a goal starts
- `onPlanGeneration(goalId, stepCount)` - When a plan is generated
- `onStepStart(goalId, stepId, description)` - When a step starts
- `onStepComplete(goalId, stepId, result)` - When a step completes
- `onStepFail(goalId, stepId, error)` - When a step fails
- `onGoalComplete(goalId, result)` - When a goal completes

### Reasoning Events

- `emitAgentThinking(goalId, thought, agentName, confidence, stepId?)` - Agent thinking
- `emitProgress(goalId, progress, message, stepId?)` - Progress updates

### Suggestion Events

- `emitUserSuggestion(goalId, suggestion, action, fromAgent, confidence)` - User suggestions

### History & Stats

- `getGoalHistory(goalId)` - Get all collaboration history for a goal
- `clearGoalHistory(goalId)` - Clear history for a goal
- `getStats()` - Get collaboration statistics

## Benefits

1. **Real-time Transparency**: Users see what the system is thinking
2. **Progress Tracking**: Clear status updates throughout execution
3. **Debugging**: Easy to trace what happened during execution
4. **User Engagement**: Interactive suggestions and recommendations
5. **Audit Trail**: Complete history of reasoning and decisions

## Integration Points

The collaboration system integrates with:

- **Redis Streams**: For persistence and reliability
- **Event Bus**: For real-time broadcasting
- **WebSocket**: For client-side updates
- **OrchestrationService**: For execution flow events

## Example Usage in OrchestrationService

```typescript
// Add to your OrchestrationService class:

import { OrchestrationCollab } from "../collaboration/orchestration-integration";

class OrchestrationService {
  async createGoal(input: CreateGoalInput): Promise<OrchestrationGoal> {
    const goalId = generateUUID();

    // Add collaboration
    await OrchestrationCollab.onGoalStart(goalId, input.description);

    // ... existing logic ...

    return goal;
  }

  async executeNextStep(goalId: string): Promise<ExecutionResult> {
    const step = await this.getNextStep(goalId);

    // Add collaboration
    await OrchestrationCollab.onStepStart(goalId, step.id, step.description);

    try {
      const result = await this.runStep(step);
      await OrchestrationCollab.onStepComplete(goalId, step.id, result);
      return result;
    } catch (error) {
      await OrchestrationCollab.onStepFail(goalId, step.id, error.message);
      throw error;
    }
  }
}
```

This provides a simple, non-intrusive way to add real-time collaboration to your existing orchestration system.
