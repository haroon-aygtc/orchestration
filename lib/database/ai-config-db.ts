// Production-grade AI Configuration Database Service
import { Pool } from 'pg';
import { postgresPool } from './postgresql-client';
import { type AIProviderConfig, type AgentAIProvider } from '../types';
import { DatabaseError } from '../utils/error-handler';
import { logger } from '../utils/structured-logger';

export class AIConfigDatabase {
  private pool: Pool;

  constructor() {
    this.pool = postgresPool;
  }

  // Save or update AI provider configuration
  async saveProviderConfig(config: Omit<AIProviderConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<AIProviderConfig> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO ai_provider_configs (id, provider, "apiKey", model, "maxTokens", temperature, "baseUrl", "timeoutMs", "isActive", "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
         ON CONFLICT (provider, model) DO UPDATE SET
         "apiKey" = $2, "maxTokens" = $4, temperature = $5, "baseUrl" = $6, "timeoutMs" = $7, "isActive" = $8, "updatedAt" = NOW()
         RETURNING *`,
        [
          config.provider,
          config.apiKey,
          config.model,
          config.maxTokens,
          config.temperature,
          config.baseUrl,
          config.timeoutMs,
          config.isActive
        ]
      );

      const row = result.rows[0];
      return {
        id: row.id,
        provider: row.provider,
        apiKey: row.apiKey,
        model: row.model,
        maxTokens: row.maxTokens,
        temperature: row.temperature,
        baseUrl: row.baseUrl,
        timeoutMs: row.timeoutMs,
        isActive: row.isActive,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    } catch (error) {
      logger.error('Failed to save AI provider configuration:', { error: error instanceof Error ? error.message : String(error) });
      throw new DatabaseError(`Failed to save AI provider configuration: ${error}`);
    } finally {
      client.release();
    }
  }

  // Get all active AI provider configurations
  async getProviderConfigs(): Promise<AIProviderConfig[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM ai_provider_configs WHERE "isActive" = true ORDER BY provider, model'
      );

      return result.rows.map(row => ({
        id: row.id,
        provider: row.provider,
        apiKey: row.apiKey,
        model: row.model,
        maxTokens: row.maxTokens,
        temperature: row.temperature,
        baseUrl: row.baseUrl,
        timeoutMs: row.timeoutMs,
        isActive: row.isActive,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      }));
    } catch (error) {
      logger.error('Failed to get AI provider configurations:', { error: error instanceof Error ? error.message : String(error) });
      throw new DatabaseError(`Failed to get AI provider configurations: ${error}`);
    } finally {
      client.release();
    }
  }

  // Get specific provider configuration
  async getProviderConfig(provider: string, model?: string): Promise<AIProviderConfig | null> {
    const client = await this.pool.connect();
    try {
      let query = 'SELECT * FROM ai_provider_configs WHERE provider = $1 AND "isActive" = true';
      const params = [provider];

      if (model) {
        query += ' AND model = $2';
        params.push(model);
      }

      query += ' ORDER BY "updatedAt" DESC LIMIT 1';

      const result = await client.query(query, params);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        provider: row.provider,
        apiKey: row.apiKey,
        model: row.model,
        maxTokens: row.maxTokens,
        temperature: row.temperature,
        baseUrl: row.baseUrl,
        timeoutMs: row.timeoutMs,
        isActive: row.isActive,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    } catch (error) {
      logger.error('Failed to get AI provider configuration:', { error: error instanceof Error ? error.message : String(error) });
      throw new DatabaseError(`Failed to get AI provider configuration: ${error}`);
    } finally {
      client.release();
    }
  }

  // Set agent AI provider mapping
  async setAgentProvider(agentName: string, providerId: string, isDefault: boolean = false, priority: number = 0): Promise<AgentAIProvider> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO agent_ai_providers (id, "agentName", "providerId", "isDefault", priority, "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT ("agentName", "providerId") DO UPDATE SET
         "isDefault" = $3, priority = $4, "updatedAt" = NOW()
         RETURNING *`,
        [agentName, providerId, isDefault, priority]
      );

      const row = result.rows[0];
      return {
        id: row.id,
        agentName: row.agentName,
        providerId: row.providerId,
        isDefault: row.isDefault,
        priority: row.priority,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        provider: await this.getProviderConfigById(row.providerId)
      };
    } catch (error) {
      logger.error('Failed to set agent provider:', { error: error instanceof Error ? error.message : String(error) });
      throw new DatabaseError(`Failed to set agent provider: ${error}`);
    } finally {
      client.release();
    }
  }

  // Get agent AI providers
  async getAgentProviders(agentName: string): Promise<AgentAIProvider[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT aap.*, apc.provider, apc."apiKey", apc.model, apc."maxTokens", apc.temperature, apc."baseUrl", apc."timeoutMs", apc."isActive"
         FROM agent_ai_providers aap
         JOIN ai_provider_configs apc ON aap."providerId" = apc.id
         WHERE aap."agentName" = $1 AND apc."isActive" = true
         ORDER BY aap.priority DESC, aap."isDefault" DESC, aap."createdAt" ASC`,
        [agentName]
      );

      return result.rows.map(row => ({
        id: row.id,
        agentName: row.agentName,
        providerId: row.providerId,
        isDefault: row.isDefault,
        priority: row.priority,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        provider: {
          id: row.providerId,
          provider: row.provider,
          apiKey: row.apiKey,
          model: row.model,
          maxTokens: row.maxTokens,
          temperature: row.temperature,
          baseUrl: row.baseUrl,
          timeoutMs: row.timeoutMs,
          isActive: row.isActive,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt
        }
      }));
    } catch (error) {
      logger.error('Failed to get agent providers:', { error: error instanceof Error ? error.message : String(error) });
      throw new DatabaseError(`Failed to get agent providers: ${error}`);
    } finally {
      client.release();
    }
  }

  // Get default provider for agent
  async getDefaultAgentProvider(agentName: string): Promise<AgentAIProvider | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT aap.*, apc.provider, apc."apiKey", apc.model, apc."maxTokens", apc.temperature, apc."baseUrl", apc."timeoutMs", apc."isActive"
         FROM agent_ai_providers aap
         JOIN ai_provider_configs apc ON aap."providerId" = apc.id
         WHERE aap."agentName" = $1 AND aap."isDefault" = true AND apc."isActive" = true
         ORDER BY aap.priority DESC
         LIMIT 1`,
        [agentName]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        agentName: row.agentName,
        providerId: row.providerId,
        isDefault: row.isDefault,
        priority: row.priority,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        provider: {
          id: row.providerId,
          provider: row.provider,
          apiKey: row.apiKey,
          model: row.model,
          maxTokens: row.maxTokens,
          temperature: row.temperature,
          baseUrl: row.baseUrl,
          timeoutMs: row.timeoutMs,
          isActive: row.isActive,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt
        }
      };
    } catch (error) {
      logger.error('Failed to get default agent provider:', { error: error instanceof Error ? error.message : String(error) });
      throw new DatabaseError(`Failed to get default agent provider: ${error}`);
    } finally {
      client.release();
    }
  }

  // Remove agent provider mapping
  async removeAgentProvider(agentName: string, providerId: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        'DELETE FROM agent_ai_providers WHERE "agentName" = $1 AND "providerId" = $2',
        [agentName, providerId]
      );
    } catch (error) {
      logger.error('Failed to remove agent provider:', { error: error instanceof Error ? error.message : String(error) });
      throw new DatabaseError(`Failed to remove agent provider: ${error}`);
    } finally {
      client.release();
    }
  }

  // Deactivate provider configuration
  async deactivateProviderConfig(providerId: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        'UPDATE ai_provider_configs SET "isActive" = false, "updatedAt" = NOW() WHERE id = $1',
        [providerId]
      );
    } catch (error) {
      logger.error('Failed to deactivate provider configuration:', { error: error instanceof Error ? error.message : String(error) });
      throw new DatabaseError(`Failed to deactivate provider configuration: ${error}`);
    } finally {
      client.release();
    }
  }

  // Private helper to get provider by ID
  private async getProviderConfigById(id: string): Promise<AIProviderConfig> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM ai_provider_configs WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
          throw new Error(`Provider configuration not found: ${id}`);
      }

      const row = result.rows[0];
      return {
        id: row.id,
        provider: row.provider,
        apiKey: row.apiKey,
        model: row.model,
        maxTokens: row.maxTokens,
        temperature: row.temperature,
        baseUrl: row.baseUrl,
        timeoutMs: row.timeoutMs,
        isActive: row.isActive,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    } finally {
      client.release();
    }
  }
}

// Export singleton instance
export const aiConfigDatabase = new AIConfigDatabase();
