// lib/db-task-store/postgres-task-store.ts
import type { AgentTaskStore } from "../agents/shared/types";
import type { AgentTask, TaskStatus } from "../agents/shared/types";

// Using any types to avoid Prisma import issues during build

export class PostgresTaskStore implements AgentTaskStore {
  private prisma: any;

  constructor(prisma?: any) {
    this.prisma = prisma;
  }

  private async ensurePrisma() {
    if (!this.prisma) {
      const prismaModule = await import('@prisma/client');
      const PrismaClient = (prismaModule as any).PrismaClient || (prismaModule as any).default?.PrismaClient;
      this.prisma = new PrismaClient();
    }
  }

  private toJson(v: unknown): any {
    // Prisma accepts JS objects as InputJsonValue directly
    return v ?? null;
  }

  async create(task: AgentTask<any, any>): Promise<void> {
    await this.ensurePrisma();
    await this.prisma.task.create({
      data: {
        id: task.id,
        type: task.type,
        status: task.status,
        input: this.toJson(task.input),
        output: task.output ? this.toJson(task.output) : null,
        error: task.error ?? null,
        startedAt: task.startedAt ?? new Date(),
        completedAt: task.completedAt ?? null,
        agentId: (task as any).agentId ?? null,
        metadata: (task as any).metadata ? this.toJson((task as any).metadata) : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  async update(id: string, patch: Partial<AgentTask<any, any>>): Promise<void> {
    await this.ensurePrisma();
    const data: any = { updatedAt: new Date() };
    if (patch.type !== undefined) data.type = patch.type;
    if (patch.status !== undefined) data.status = patch.status;
    if (patch.input !== undefined) data.input = this.toJson(patch.input);
    if (patch.output !== undefined) data.output = patch.output ? this.toJson(patch.output) : null;
    if (patch.error !== undefined) data.error = patch.error ?? null;
    if (patch.startedAt !== undefined) data.startedAt = patch.startedAt;
    if (patch.completedAt !== undefined) data.completedAt = patch.completedAt;
    if ((patch as any).agentId !== undefined) data.agentId = (patch as any).agentId ?? null;
    if ((patch as any).metadata !== undefined) data.metadata = (patch as any).metadata ? this.toJson((patch as any).metadata) : null;

    await this.prisma.task.update({ where: { id }, data });
  }

  async get(id: string): Promise<AgentTask<any, any> | null> {
    await this.ensurePrisma();
    const t = await this.prisma.task.findUnique({ where: { id } });
    if (!t) return null;
    return {
      id: t.id,
      type: t.type,
      status: t.status as TaskStatus,
      input: t.input ?? undefined,
      output: t.output ?? undefined,
      error: t.error ?? undefined,
      startedAt: t.startedAt ?? undefined,
      completedAt: t.completedAt ?? undefined,
      agentId: (t as any).agentId ?? undefined,
      metadata: (t as any).metadata ?? undefined,
    } as any;
  }

  async list(filters: { status?: TaskStatus; agentId?: string; limit?: number } = {}): Promise<AgentTask<any, any>[]> {
    await this.ensurePrisma();
    const { status, agentId, limit = 100 } = filters;
    const rows = await this.prisma.task.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(agentId ? { agentId } : {}),
      },
      orderBy: { startedAt: "desc" },
      take: limit,
    });
    return rows.map((t: any) => ({
      id: t.id,
      type: t.type,
      status: t.status as TaskStatus,
      input: t.input ?? undefined,
      output: t.output ?? undefined,
      error: t.error ?? undefined,
      startedAt: t.startedAt ?? undefined,
      completedAt: t.completedAt ?? undefined,
      agentId: (t as any).agentId ?? undefined,
      metadata: (t as any).metadata ?? undefined,
    })) as any[];
  }

  async delete(id: string): Promise<void> {
    await this.ensurePrisma();
    await this.prisma.task.delete({ where: { id } });
  }

  async cleanup(): Promise<void> {
    if (this.prisma) {
      await this.prisma.$disconnect().catch(() => {});
    }
  }
}

// Factory function for creating PostgresTaskStore instances (used by agents and API)
export async function createPostgresTaskStore(prisma?: any): Promise<PostgresTaskStore> {
  const store = new PostgresTaskStore(prisma);
  return store;
}

// Export singleton instance with distinct name to avoid conflicts
export const prismaTaskStore = new PostgresTaskStore();
