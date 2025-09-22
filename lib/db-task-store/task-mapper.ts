// db/task-mapper.ts
import type { PersistedTask } from '../agents/shared/task-types';
import type { AgentTask } from '../agents/shared/types';
import { BasePayload } from '../agents/shared/schemas';


export function toPersisted<I, O>(t: AgentTask<I, O>): PersistedTask {
  // Validate payloads at boundary (replace with stricter schemas per task type)
  BasePayload.parse(t.input);
  if (t.output !== undefined) BasePayload.parse(t.output);

  return {
    id: t.id,
    type: t.type,
    status: t.status,
    input: t.input,
    output: t.output,
    error: t.error,
    startedAt: t.startedAt,
    completedAt: t.completedAt,
    agentId: t.agentId,
    metadata: (t.metadata ?? {}) as Record<string, unknown>,
    parentId: t.parentId ?? null,
  };
}

export function toAgent<I = unknown, O = unknown>(p: PersistedTask): AgentTask<I, O> {
  BasePayload.parse(p.input);
  if (p.output !== undefined) BasePayload.parse(p.output);

  return {
    id: p.id,
    type: p.type,
    input: p.input as I,
    output: p.output as O | undefined,
    status: p.status,
    startedAt: p.startedAt,
    completedAt: p.completedAt,
    error: p.error,
    agentId: p.agentId ?? undefined,
    metadata: p.metadata,
    parentId: p.parentId ?? undefined,
  };
}
