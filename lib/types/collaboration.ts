// Simple collaboration event types for real-time reasoning and suggestions
import { z } from 'zod';

// Base collaboration event schema
export const CollaborationEventSchema = z.object({
  id: z.string(),
  goalId: z.string(),
  stepId: z.string().optional(),
  timestamp: z.string(),
  correlationId: z.string(),
});

// Reasoning event - what the agent is thinking
export const ReasoningEventSchema = CollaborationEventSchema.extend({
  kind: z.literal('reasoning'),
  text: z.string(),
  confidence: z.number().min(0).max(1),
  context: z.record(z.any()).optional(),
});

// Status event - what the system is doing
export const StatusEventSchema = CollaborationEventSchema.extend({
  kind: z.literal('status'),
  status: z.string(),
  progress: z.number().min(0).max(100).optional(),
  meta: z.record(z.any()).optional(),
});

// Suggestion event - recommendations for users
export const SuggestionEventSchema = CollaborationEventSchema.extend({
  kind: z.literal('suggestion'),
  suggestion: z.string(),
  action: z.string(),
  confidence: z.number().min(0).max(1),
  fromAgent: z.string(),
  toAgent: z.string().optional(),
});

// Union type for all collaboration events
export type CollaborationEvent = 
  | z.infer<typeof ReasoningEventSchema>
  | z.infer<typeof StatusEventSchema>
  | z.infer<typeof SuggestionEventSchema>;

// Helper types for easier usage
export type ReasoningEvent = z.infer<typeof ReasoningEventSchema>;
export type StatusEvent = z.infer<typeof StatusEventSchema>;
export type SuggestionEvent = z.infer<typeof SuggestionEventSchema>;

// Event creation helpers
export function createReasoningEvent(
  goalId: string,
  text: string,
  confidence: number = 0.8,
  stepId?: string,
  context?: Record<string, any>
): ReasoningEvent {
  return {
    id: `reasoning_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    kind: 'reasoning',
    goalId,
    stepId,
    text,
    confidence,
    context,
    timestamp: new Date().toISOString(),
    correlationId: `corr_${Date.now()}`,
  };
}

export function createStatusEvent(
  goalId: string,
  status: string,
  stepId?: string,
  progress?: number,
  meta?: Record<string, any>
): StatusEvent {
  return {
    id: `status_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    kind: 'status',
    goalId,
    stepId,
    status,
    progress,
    meta,
    timestamp: new Date().toISOString(),
    correlationId: `corr_${Date.now()}`,
  };
}

export function createSuggestionEvent(
  goalId: string,
  suggestion: string,
  action: string,
  confidence: number = 0.7,
  fromAgent: string,
  toAgent?: string,
  stepId?: string
): SuggestionEvent {
  return {
    id: `suggestion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    kind: 'suggestion',
    goalId,
    stepId,
    suggestion,
    action,
    confidence,
    fromAgent,
    toAgent,
    timestamp: new Date().toISOString(),
    correlationId: `corr_${Date.now()}`,
  };
}
