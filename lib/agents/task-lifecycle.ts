// agents/task-lifecycle.ts
import type { DatabaseTaskRepository } from '../agents/shared/task-types';
import { TaskStatus } from '../agents/shared/task-types';

export function makeTaskLifecycle(repo: DatabaseTaskRepository) {
  return {
    async start(id: string) {
      await repo.update(id, { status: TaskStatus.Running, startedAt: new Date() });
    },
    async complete(id: string, output: unknown) {
      await repo.update(id, { status: TaskStatus.Completed, output, completedAt: new Date() });
    },
    async fail(id: string, error: string) {
      await repo.update(id, { status: TaskStatus.Failed, error, completedAt: new Date() });
    },
  };
}
