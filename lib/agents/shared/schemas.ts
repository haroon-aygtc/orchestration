// shared/schemas.ts
import { z } from 'zod';
export const IntentInputSchema = z.object({
    text: z.string().min(1),
    context: z.record(z.any()).optional()
  });
  
  export const IntentOutputSchema = z.object({
    intent: z.string(),
    confidence: z.number().min(0).max(1),
    entities: z.array(z.object({
      type: z.string(),
      value: z.string(),
      confidence: z.number().min(0).max(1)
    })),
    actionRequired: z.boolean(),
    suggestedResponse: z.string()
  });
  
  export const NextActionsSchema = z.array(z.object({
    agent: z.enum(['retriever', 'tool', 'workflow', 'memory', 'formatter', 'guardrail']),
    parameters: z.record(z.any()),
    reasoning: z.string()
  }));

export const BasePayload = z.unknown();
