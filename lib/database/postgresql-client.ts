// Real PostgreSQL Database Client for AI Agent System
import { Pool } from 'pg';
import type { AgentTaskStore, AgentTask, MemoryBackend } from '../agents/shared/types';
import type { TaskStatus } from '../agents/shared/types';

import { logger } from "../utils/structured-logger";
import { logError } from '../utils/error-handler';

// PostgreSQL connection pool
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    
    pool.on('error', (err) => {
      logError(err as Error, 'PostgreSQL pool error:');
    });
  }
  return pool;
}

// Real PostgreSQL Task Store
export class PostgreSQLTaskStore implements AgentTaskStore {
  private pool: Pool;

  constructor() {
    this.pool = getPool();
  }


  async upsert(task: AgentTask): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO tasks (id, type, status, input, output, error, "startedAt", "completedAt", "agentId", metadata, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET
         type = $2, status = $3, input = $4, output = $5, error = $6, "startedAt" = $7, "completedAt" = $8, "agentId" = $9, metadata = $10, "updatedAt" = NOW()`,
        [
          task.id,
          task.type,
          task.status,
          JSON.stringify(task.input),
          task.output ? JSON.stringify(task.output) : null,
          task.error,
          task.startedAt || new Date(),
          task.completedAt,
          task.agentId,
          task.metadata ? JSON.stringify(task.metadata) : null
        ]
      );
      logger.info('Real task upserted in PostgreSQL:', { id: task.id });
    } catch (error) {
      logError(error as Error, '❌ PostgreSQL task upsert failed:');
      throw new Error(`Failed to upsert task: ${error}`);
    } finally {
      client.release();
    }
  }

  async delete(id: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('DELETE FROM tasks WHERE id = $1', [id]);
      logger.info('Real task deleted from PostgreSQL:', { id });
    } catch (error) {
      logError(error as Error, '❌ PostgreSQL task delete failed:');
      throw new Error(`Failed to delete task: ${error}`);
    } finally {
      client.release();
    }
  }

  async findUnique(id: string): Promise<AgentTask | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query('SELECT * FROM tasks WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        return null;
      }
      const row = result.rows[0];
      return {
        id: row.id,
        type: row.type,
        status: row.status,
        input: JSON.parse(row.input),
        output: row.output ? JSON.parse(row.output) : undefined,
        error: row.error,
        startedAt: row.startedAt,
        completedAt: row.completedAt,
        agentId: row.agentId,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined
      };
    } catch (error) {
      logError(error as Error, '❌ PostgreSQL task findUnique failed:');
      throw new Error(`Failed to find unique task: ${error}`);
    } finally {
      client.release();
    }
  }

  async findMany(options: { status?: TaskStatus; agentId?: string; limit?: number } = {}): Promise<AgentTask[]> {
    const client = await this.pool.connect();
    try {
      let query = 'SELECT * FROM tasks';
      const values: unknown[] = [];
      let paramIndex = 1;

      const conditions = [];
      if (options.status) {
        conditions.push(`status = $${paramIndex++}`);
        values.push(options.status);
      }
      if (options.agentId) {
        conditions.push(`"agentId" = $${paramIndex++}`);
        values.push(options.agentId);
      }
      
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      query += ' ORDER BY "startedAt" DESC';

      if (options.limit) {
        query += ` LIMIT $${paramIndex}`;
        values.push(options.limit);
      }

      const result = await client.query(query, values);

      return result.rows.map(row => ({
        id: row.id,
        type: row.type,
        status: row.status,
        input: JSON.parse(row.input),
        output: row.output ? JSON.parse(row.output) : undefined,
        error: row.error,
        startedAt: row.startedAt,
        completedAt: row.completedAt,
        agentId: row.agentId,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined
      }));
    } catch (error) {
      logError(error as Error, '❌ PostgreSQL task findMany failed:');
      throw new Error(`Failed to find many tasks: ${error}`);
    } finally {
      client.release();
    }
  }

  async create(task: AgentTask): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO tasks (id, type, status, input, output, error, "startedAt", "completedAt", "agentId", metadata, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          task.id,
          task.type,
          task.status,
          JSON.stringify(task.input),
          task.output ? JSON.stringify(task.output) : null,
          task.error,
          task.startedAt || new Date(),
          task.completedAt,
          task.agentId,
          task.metadata ? JSON.stringify(task.metadata) : null,
          new Date(), // createdAt
          new Date()  // updatedAt
        ]
      );
      logger.info('Real task created in PostgreSQL:', { id: task.id });
    } catch (error) {
      logError(error as Error, '❌ PostgreSQL task creation failed:');
      throw new Error(`Failed to create task: ${error}`);
    } finally {
      client.release();
    }
  }

  async update(id: string, patch: Partial<AgentTask>): Promise<void> {
    const client = await this.pool.connect();
    try {
      const updates: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (patch.type !== undefined) {
        updates.push(`type = $${paramIndex++}`);
        values.push(patch.type);
      }
      if (patch.status !== undefined) {
        updates.push(`status = $${paramIndex++}`);
        values.push(patch.status);
      }
      if (patch.input !== undefined) {
        updates.push(`input = $${paramIndex++}`);
        values.push(JSON.stringify(patch.input));
      }
      if (patch.output !== undefined) {
        updates.push(`output = $${paramIndex++}`);
        values.push(patch.output ? JSON.stringify(patch.output) : null);
      }
      if (patch.error !== undefined) {
        updates.push(`error = $${paramIndex++}`);
        values.push(patch.error);
      }
      if (patch.completedAt !== undefined) {
        updates.push(`"completedAt" = $${paramIndex++}`);
        values.push(patch.completedAt);
      }
      if (patch.agentId !== undefined) {
        updates.push(`"agentId" = $${paramIndex++}`);
        values.push(patch.agentId);
      }
      if (patch.metadata !== undefined) {
        updates.push(`metadata = $${paramIndex++}`);
        values.push(patch.metadata ? JSON.stringify(patch.metadata) : null);
      }

      updates.push(`"updatedAt" = NOW()`);
      values.push(id);

      await client.query(
        `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
        values
      );
      
      logger.info('Real task updated in PostgreSQL:', { id });
    } catch (error) {
      logError(error as Error, '❌ PostgreSQL task update failed:');
      throw new Error(`Failed to update task: ${error}`);
    } finally {
      client.release();
    }
  }

  async get(id: string): Promise<AgentTask | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM tasks WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        type: row.type,
        status: row.status,
        input: JSON.parse(row.input),
        output: row.output ? JSON.parse(row.output) : undefined,
        error: row.error,
        startedAt: row.startedAt,
        completedAt: row.completedAt,
        agentId: row.agentId,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined
      };
    } catch (error) {
      logError(error as Error, '❌ PostgreSQL task get failed:');
      throw new Error(`Failed to get task: ${error}`);
    } finally {
      client.release();
    }
  }

  async list(options: { status?: TaskStatus; agentId?: string; limit?: number } = {}): Promise<AgentTask[]> {
    const client = await this.pool.connect();
    try {
      let query = 'SELECT * FROM tasks';
      const values: unknown[] = [];
      let paramIndex = 1;

      const conditions = [];
      if (options.status) {
        conditions.push(`status = $${paramIndex++}`);
        values.push(options.status);
      }
      if (options.agentId) {
        conditions.push(`"agentId" = $${paramIndex++}`);
        values.push(options.agentId);
      }
      
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      query += ' ORDER BY "startedAt" DESC';

      if (options.limit) {
        query += ` LIMIT $${paramIndex}`;
        values.push(options.limit);
      }

      const result = await client.query(query, values);

      return result.rows.map(row => ({
        id: row.id,
        type: row.type,
        status: row.status,
        input: JSON.parse(row.input),
        output: row.output ? JSON.parse(row.output) : undefined,
        error: row.error,
        startedAt: row.startedAt,
        completedAt: row.completedAt,
        agentId: row.agentId,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined
      }));
    } catch (error) {
      logError(error as Error, '❌ PostgreSQL task list failed:');
      throw new Error(`Failed to list tasks: ${error}`);
    } finally {
      client.release();
    }
  }

  // Keep save method for backward compatibility
  async save(task: AgentTask): Promise<void> {
    const existing = await this.get(task.id);
    if (existing) {
      await this.update(task.id, task);
    } else {
      await this.create(task);
    }
  }

}

// Real PostgreSQL Memory Backend
export class PostgreSQLMemoryBackend implements MemoryBackend {
  private pool: Pool;

  constructor() {
    this.pool = getPool();
  }

  async set(key: string, value: unknown, context?: string, ttlMs?: number): Promise<void> {
    const client = await this.pool.connect();
    try {
      const expiresAt = ttlMs ? new Date(Date.now() + ttlMs) : null;
      
      await client.query(
        `INSERT INTO memories (id, key, value, context, "expiresAt", "startedAt", "completedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT (key) DO UPDATE SET
         value = $2, context = $3, "expiresAt" = $4, "completedAt" = NOW()`,
        [key, JSON.stringify(value), context, expiresAt]
      );
      
      logger.info('Real memory stored in PostgreSQL:', { key });
    } catch (error) {
      logError(error as Error, '❌ PostgreSQL memory set failed:');
      throw new Error(`Failed to store memory: ${error}`);
    } finally {
      client.release();
    }
  }

  async get(key: string): Promise<unknown | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT value FROM memories 
         WHERE key = $1 AND ("expiresAt" IS NULL OR "expiresAt" > NOW())`,
        [key]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return JSON.parse(result.rows[0].value);
    } catch (error) {
      logError(error as Error, '❌ PostgreSQL memory get failed:');
      throw new Error(`Failed to get memory: ${error}`);
    } finally {
      client.release();
    }
  }

  async delete(key: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('DELETE FROM memories WHERE key = $1', [key]);
      logger.info('Real memory deleted from PostgreSQL:', { key });
    } catch (error) {
      logError(error as Error, '❌ PostgreSQL memory delete failed:');
      throw new Error(`Failed to delete memory: ${error}`);
    } finally {
      client.release();
    }
  }

  async list(filters?: Record<string, string>): Promise<string[]> {
    const client = await this.pool.connect();
    try {
      let query = 'SELECT key FROM memories WHERE ("expiresAt" IS NULL OR "expiresAt" > NOW())';
      const values: unknown[] = [];

      if (filters?.key) {
        query += ' AND key LIKE $1';
        values.push(`%${filters.key}%`);
      }

      const result = await client.query(query, values);
      return result.rows.map(row => row.key);
    } catch (error) {
      logError(error as Error, '❌ PostgreSQL memory list failed:');
      throw new Error(`Failed to list memories: ${error}`);
    } finally {
      client.release();
    }
  }
}

// Export instances - renamed to avoid conflicts with Prisma-based store
export const postgresqlTaskStore = new PostgreSQLTaskStore();
export const postgresMemoryBackend = new PostgreSQLMemoryBackend();

// Export pool for direct access
export const postgresPool = getPool();
