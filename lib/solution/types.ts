import { z } from "zod";

export const AgentTypeSchema = z.enum([
  'intent', 'retriever', 'tool', 'workflow', 'memory', 
  'follow', 'formatter', 'guardrail', 'llm'
]);

export const AgentSpecSchema = z.object({
  name: z.string(),
  purpose: z.string(),
  agentType: AgentTypeSchema,
  actions: z.array(z.string()),
  tools: z.array(z.string()),
  dependencies: z.array(z.string()).optional()
});

export const WorkflowStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  agentType: AgentTypeSchema,
  action: z.string(),
  tools: z.array(z.string()),
  dependencies: z.array(z.string())
});

export const SolutionBlueprintSchema = z.object({
  name: z.string(),
  description: z.string(),
  agents: z.array(AgentSpecSchema),
  workflows: z.array(z.object({
    name: z.string(),
    description: z.string(),
    steps: z.array(WorkflowStepSchema),
    triggers: z.array(z.string())
  })),
  tools: z.array(z.string()),
  complexity: z.enum(['simple', 'medium', 'complex'])
});

export type AgentSpec = z.infer<typeof AgentSpecSchema>;
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;
export type SolutionBlueprint = z.infer<typeof SolutionBlueprintSchema>;
