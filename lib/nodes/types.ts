export interface NodeInput {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'file';
  required: boolean;
  description: string;
  defaultValue?: any;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: string[];
  };
}

export interface NodeOutput {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'file';
  description: string;
  schema?: any;
}

export interface NodeImplementation {
  execute: (params: Record<string, any>) => Promise<NodeResult>;
  validate?: (params: Record<string, any>) => Promise<ValidationResult>;
  test?: (params: Record<string, any>) => Promise<TestResult>;
}

export interface NodeResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    executionTime: number;
    memoryUsage: number;
    timestamp: Date;
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface TestResult {
  passed: boolean;
  results: {
    input: any;
    expected: any;
    actual: any;
    passed: boolean;
  }[];
}

export interface PerformanceMetrics {
  averageExecutionTime: number;
  memoryUsage: number;
  successRate: number;
  errorRate: number;
  lastExecuted: Date;
  executionCount: number;
}

export interface PrebuiltNode {
  id: string;
  name: string;
  category: 'data' | 'ai' | 'integration' | 'ui' | 'workflow' | 'communication' | 'file' | 'database';
  version: string;
  description: string;
  inputs: NodeInput[];
  outputs: NodeOutput[];
  implementation: NodeImplementation;
  metadata: {
    author: string;
    createdAt: Date;
    updatedAt: Date;
    tags: string[];
    complexity: 'simple' | 'medium' | 'complex';
    performance: PerformanceMetrics;
    dependencies: string[];
    documentation: string;
    examples: NodeExample[];
  };
}

export interface NodeExample {
  name: string;
  description: string;
  input: Record<string, any>;
  expectedOutput: any;
}

export interface NodeSearchCriteria {
  category?: string;
  tags?: string[];
  complexity?: string;
  author?: string;
  performance?: {
    maxExecutionTime?: number;
    minSuccessRate?: number;
  };
  dependencies?: string[];
  text?: string;
}

export interface NodeComposition {
  id: string;
  name: string;
  description: string;
  nodes: NodeCompositionStep[];
  connections: NodeConnection[];
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    author: string;
    version: string;
  };
}

export interface NodeCompositionStep {
  id: string;
  nodeId: string;
  position: { x: number; y: number };
  parameters: Record<string, any>;
  enabled: boolean;
}

export interface NodeConnection {
  id: string;
  from: {
    stepId: string;
    output: string;
  };
  to: {
    stepId: string;
    input: string;
  };
}
