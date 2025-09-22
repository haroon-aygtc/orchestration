// Legacy AI Provider Configuration - DEPRECATED
// This file is kept for backward compatibility but will be removed
// New implementations should use lib/llm/providers/registry.ts

import { llmProviderRegistry } from '../llm/providers/registry';
import { logger } from "../utils/structured-logger";

export interface ProviderConfig {
  name: string;
  displayName: string;
  baseUrl: string;
  models: string[];
  defaultModel: string;
  maxTokens: number;
  capabilities: string[];
}

// Legacy configurations - use registry instead
export const AI_PROVIDER_CONFIGS = {};

// Legacy agent mappings - use smart routing instead
export const DEFAULT_AGENT_MAPPINGS: Record<string, { provider: any; model: string; description: string }> = {
  intent: {
    provider: 'smart-routing',
    model: 'auto',
    description: 'Natural language understanding and intent classification'
  },
  retriever: {
    provider: 'smart-routing',
    model: 'auto',
    description: 'Fast retrieval and summarization'
  },
  tool: {
    provider: 'smart-routing',
    model: 'auto',
    description: 'Tool reasoning and execution'
  },
  workflow: {
    provider: 'smart-routing',
    model: 'auto',
    description: 'Workflow orchestration and planning'
  },
  memory: {
    provider: 'smart-routing',
    model: 'auto',
    description: 'Memory storage and retrieval'
  },
  follow: {
    provider: 'smart-routing',
    model: 'auto',
    description: 'Progress tracking and monitoring'
  },
  formatter: {
    provider: 'smart-routing',
    model: 'auto',
    description: 'Data formatting and presentation'
  },
  guardrail: {
    provider: 'smart-routing',
    model: 'auto',
    description: 'Safety validation and compliance'
  },
  llm: {
    provider: 'smart-routing',
    model: 'auto',
    description: 'General language model operations'
  }
};

// Transition functions for backward compatibility
export function getProviderConfig(provider: string) {
  logger.warn('⚠️ Using deprecated getProviderConfig. Use llmProviderRegistry instead.');
  return llmProviderRegistry.getProvider(provider as any);
}

export function getDefaultModel(provider: string): string {
  logger.warn('⚠️ Using deprecated getDefaultModel. Use llmProviderRegistry instead.');
  const providerConfig = llmProviderRegistry.getProvider(provider as any);
  return providerConfig?.defaultModel || 'auto';
}

export function getProviderModels(provider: string): string[] {
  logger.warn('⚠️ Using deprecated getProviderModels. Use llmProviderRegistry instead.');
  const models = llmProviderRegistry.getModelsByProvider(provider as any);
  return models.map(m => m.id);
}

export function getProviderBaseUrl(provider: string): string {
  logger.warn('⚠️ Using deprecated getProviderBaseUrl. Use llmProviderRegistry instead.');
  const providerConfig = llmProviderRegistry.getProvider(provider as any);
  return providerConfig?.baseUrl || '';
}

export function getAgentMapping(agentType: string): { provider: any; model: string; description: string } {
  logger.warn('⚠️ Using deprecated getAgentMapping. Use smart routing instead.');
  return DEFAULT_AGENT_MAPPINGS[agentType] || DEFAULT_AGENT_MAPPINGS.llm;
}

// New smart routing integration
export function getSmartProviderForAgent(agentType: string, taskRequirements?: any) {

  logger.info(`🎯 Getting smart provider for agent: ${agentType}`);
  return 'smart-routing';
}


