// shared/task-types.ts
// Centralized task/domain enums and persistence contracts

import { TaskStatus } from "./types";

// Re-export TaskStatus for external usage
export { TaskStatus };
  
  export interface PersistedTask {
    id: string;
    type: string;
    status: TaskStatus;
    input: unknown;              // JSONB-serializable
    output?: unknown;            // JSONB-serializable
    error?: string;
    startedAt?: Date;
    completedAt?: Date;
    agentId?: string;
    metadata?: Record<string, unknown>;
    parentId?: string | null;
  }
  
  export interface DatabaseTaskRepository {
    create(task: PersistedTask): Promise<void>;
    update(id: string, patch: Partial<PersistedTask>): Promise<void>;
    get(id: string): Promise<PersistedTask | null>;
    list(filters?: { status?: TaskStatus; agentId?: string; limit?: number }): Promise<PersistedTask[]>;
    delete(id: string): Promise<void>;
    cleanup?(): Promise<void>;
  }
  