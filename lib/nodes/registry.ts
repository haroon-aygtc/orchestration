import { PrebuiltNode, NodeSearchCriteria, NodeComposition, NodeCompositionStep, NodeConnection, PerformanceMetrics, ValidationResult, NodeResult } from './types';
import { createRealTools, getToolDescriptions, getToolCategories, getToolMetrics, getToolCapabilities } from '../tools/registry';
import { logger } from "../utils/structured-logger";
// Define types locally since they're not exported from registry
type ToolResult = {
  success: boolean;
  data?: any;
  error?: string;
};

type ToolFn = (params?: Record<string, any>) => Promise<ToolResult>;

export class NodeRegistry {
  private nodes: Map<string, PrebuiltNode> = new Map();
  private compositions: Map<string, NodeComposition> = new Map();
  private performanceTracker: Map<string, PerformanceMetrics> = new Map();

  constructor() {
    this.initializeFromExistingTools();
  }

  private async initializeFromExistingTools(): Promise<void> {
    try {
      const existingTools = await createRealTools();
      const toolDescriptions = await getToolDescriptions();
      const toolCategories = await getToolCategories();

      for (const [toolName, toolFn] of Object.entries(existingTools)) {
        const node = this.convertToolToNode(
          toolName, 
          toolFn as ToolFn, 
          toolDescriptions[toolName as keyof typeof toolDescriptions] || '', 
          (toolCategories as Record<string, string[]>)[toolName as keyof typeof toolCategories] || []
        );
        this.register(node);
      }

      logger.info(`Initialized ${this.nodes.size} nodes from existing tools`);
    } catch (error) {
      logger.error('Failed to initialize nodes from existing tools:', { error });
      throw error;
    }
  }

  private convertToolToNode(toolName: string, toolFn: ToolFn, description: string, categories: string[]): PrebuiltNode {
    const nodeId = `node_${toolName}`;
    
    return {
      id: nodeId,
      name: this.formatNodeName(toolName),
      category: this.mapCategory(categories[0] || 'workflow'),
      version: '1.0.0',
      description: description || `Execute ${toolName} operation`,
      inputs: this.inferInputs(toolName, toolFn),
      outputs: this.inferOutputs(toolName),
      implementation: {
        execute: async (params: Record<string, any>) => {
          const startTime = Date.now();
          try {
            const result = await toolFn(params);
            const executionTime = Date.now() - startTime;
            
            this.updatePerformanceMetrics(nodeId, executionTime, true);
            
            return {
              success: true,
              data: result,
              metadata: {
                executionTime,
                memoryUsage: process.memoryUsage().heapUsed,
                timestamp: new Date()
              }
            };
          } catch (error) {
            const executionTime = Date.now() - startTime;
            this.updatePerformanceMetrics(nodeId, executionTime, false);
            
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
              metadata: {
                executionTime,
                memoryUsage: process.memoryUsage().heapUsed,
                timestamp: new Date()
              }
            };
          }
        },
        validate: async (params: Record<string, any>) => {
          return this.validateNodeInputs(nodeId, params);
        }
      },
      metadata: {
        author: 'System',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: this.generateTags(toolName, categories[0] || 'workflow'),
        complexity: this.assessComplexity(toolName),
        performance: this.getPerformanceMetrics(nodeId),
        dependencies: this.getDependencies(toolName),
        documentation: this.generateDocumentation(toolName, description),
        examples: this.generateExamples(toolName)
      }
    };
  }

  private formatNodeName(toolName: string): string {
    return toolName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private mapCategory(category: string): PrebuiltNode['category'] {
    const categoryMap: Record<string, PrebuiltNode['category']> = {
      'data': 'data',
      'integration': 'integration',
      'communication': 'communication',
      'file': 'file',
      'database': 'database',
      'ai': 'ai',
      'workflow': 'workflow',
      'ui': 'ui'
    };
    return categoryMap[category] || 'workflow';
  }

  private inferInputs(toolName: string, toolFn: ToolFn): PrebuiltNode['inputs'] {
    const commonInputs: Record<string, PrebuiltNode['inputs']> = {
      'http_request': [
        { name: 'url', type: 'string', required: true, description: 'Target URL for the HTTP request' },
        { name: 'method', type: 'string', required: false, description: 'HTTP method', defaultValue: 'GET' },
        { name: 'headers', type: 'object', required: false, description: 'HTTP headers' },
        { name: 'body', type: 'string', required: false, description: 'Request body' }
      ],
      'email_sender': [
        { name: 'to', type: 'string', required: true, description: 'Recipient email address' },
        { name: 'subject', type: 'string', required: true, description: 'Email subject' },
        { name: 'body', type: 'string', required: true, description: 'Email body' },
        { name: 'from', type: 'string', required: false, description: 'Sender email address' }
      ],
      'csv_parse': [
        { name: 'filePath', type: 'string', required: true, description: 'Path to CSV file' },
        { name: 'delimiter', type: 'string', required: false, description: 'CSV delimiter', defaultValue: ',' },
        { name: 'hasHeader', type: 'boolean', required: false, description: 'Whether CSV has header row', defaultValue: true }
      ],
      'pdf_parse': [
        { name: 'filePath', type: 'string', required: true, description: 'Path to PDF file' },
        { name: 'extractText', type: 'boolean', required: false, description: 'Extract text content', defaultValue: true },
        { name: 'extractMetadata', type: 'boolean', required: false, description: 'Extract metadata', defaultValue: false }
      ],
      'database_query': [
        { name: 'query', type: 'string', required: true, description: 'SQL query to execute' },
        { name: 'params', type: 'array', required: false, description: 'Query parameters' }
      ],
      'file_write': [
        { name: 'filePath', type: 'string', required: true, description: 'Path where to write the file' },
        { name: 'content', type: 'string', required: true, description: 'Content to write' },
        { name: 'encoding', type: 'string', required: false, description: 'File encoding', defaultValue: 'utf8' }
      ],
      'file_read': [
        { name: 'filePath', type: 'string', required: true, description: 'Path to file to read' },
        { name: 'encoding', type: 'string', required: false, description: 'File encoding', defaultValue: 'utf8' }
      ],
      'json_validate': [
        { name: 'jsonString', type: 'string', required: true, description: 'JSON string to validate' },
        { name: 'schema', type: 'object', required: false, description: 'JSON schema for validation' }
      ],
      'slack_notify': [
        { name: 'message', type: 'string', required: true, description: 'Message to send' },
        { name: 'channel', type: 'string', required: false, description: 'Slack channel' },
        { name: 'webhookUrl', type: 'string', required: true, description: 'Slack webhook URL' }
      ],
      'webhook_trigger': [
        { name: 'url', type: 'string', required: true, description: 'Webhook URL to trigger' },
        { name: 'payload', type: 'object', required: false, description: 'Payload to send' },
        { name: 'method', type: 'string', required: false, description: 'HTTP method', defaultValue: 'POST' }
      ],
      'data_analyzer': [
        { name: 'data', type: 'array', required: true, description: 'Data to analyze' },
        { name: 'analysisType', type: 'string', required: false, description: 'Type of analysis', defaultValue: 'summary' }
      ]
    };

    return commonInputs[toolName] || [
      { name: 'input', type: 'string', required: true, description: 'Input parameter' }
    ];
  }

  private inferOutputs(toolName: string): PrebuiltNode['outputs'] {
    const commonOutputs: Record<string, PrebuiltNode['outputs']> = {
      'http_request': [
        { name: 'response', type: 'object', description: 'HTTP response data' },
        { name: 'status', type: 'number', description: 'HTTP status code' },
        { name: 'headers', type: 'object', description: 'Response headers' }
      ],
      'email_sender': [
        { name: 'success', type: 'boolean', description: 'Whether email was sent successfully' },
        { name: 'messageId', type: 'string', description: 'Email message ID' }
      ],
      'csv_parse': [
        { name: 'data', type: 'array', description: 'Parsed CSV data' },
        { name: 'headers', type: 'array', description: 'CSV headers' },
        { name: 'rowCount', type: 'number', description: 'Number of rows parsed' }
      ],
      'pdf_parse': [
        { name: 'text', type: 'string', description: 'Extracted text content' },
        { name: 'metadata', type: 'object', description: 'PDF metadata' },
        { name: 'pageCount', type: 'number', description: 'Number of pages' }
      ],
      'database_query': [
        { name: 'results', type: 'array', description: 'Query results' },
        { name: 'rowCount', type: 'number', description: 'Number of rows returned' }
      ],
      'file_write': [
        { name: 'success', type: 'boolean', description: 'Whether file was written successfully' },
        { name: 'filePath', type: 'string', description: 'Path where file was written' },
        { name: 'bytesWritten', type: 'number', description: 'Number of bytes written' }
      ],
      'file_read': [
        { name: 'content', type: 'string', description: 'File content' },
        { name: 'filePath', type: 'string', description: 'Path of read file' },
        { name: 'size', type: 'number', description: 'File size in bytes' }
      ],
      'json_validate': [
        { name: 'valid', type: 'boolean', description: 'Whether JSON is valid' },
        { name: 'errors', type: 'array', description: 'Validation errors' }
      ],
      'slack_notify': [
        { name: 'success', type: 'boolean', description: 'Whether notification was sent' },
        { name: 'timestamp', type: 'string', description: 'Notification timestamp' }
      ],
      'webhook_trigger': [
        { name: 'response', type: 'object', description: 'Webhook response' },
        { name: 'status', type: 'number', description: 'Response status code' }
      ],
      'data_analyzer': [
        { name: 'analysis', type: 'object', description: 'Analysis results' },
        { name: 'summary', type: 'string', description: 'Analysis summary' }
      ]
    };

    return commonOutputs[toolName] || [
      { name: 'result', type: 'object', description: 'Operation result' }
    ];
  }

  private generateTags(toolName: string, category: string): string[] {
    const tags = [category, toolName];
    
    if (toolName.includes('http') || toolName.includes('webhook')) tags.push('network');
    if (toolName.includes('file') || toolName.includes('csv') || toolName.includes('pdf')) tags.push('file');
    if (toolName.includes('email') || toolName.includes('slack')) tags.push('notification');
    if (toolName.includes('database') || toolName.includes('query')) tags.push('database');
    if (toolName.includes('json') || toolName.includes('validate')) tags.push('validation');
    
    return Array.from(new Set(tags));
  }

  private assessComplexity(toolName: string): 'simple' | 'medium' | 'complex' {
    const complexTools = ['database_query', 'data_analyzer', 'pdf_parse'];
    const mediumTools = ['http_request', 'csv_parse', 'file_write'];
    
    if (complexTools.includes(toolName)) return 'complex';
    if (mediumTools.includes(toolName)) return 'medium';
    return 'simple';
  }

  private getDependencies(toolName: string): string[] {
    const dependencies: Record<string, string[]> = {
      'http_request': ['axios'],
      'email_sender': ['nodemailer'],
      'csv_parse': ['csv-parser'],
      'pdf_parse': ['pdf-parse'],
      'database_query': ['prisma'],
      'slack_notify': ['axios']
    };
    
    return dependencies[toolName] || [];
  }

  private generateDocumentation(toolName: string, description: string): string {
    return `# ${this.formatNodeName(toolName)}

${description}

## Usage
This node executes the ${toolName} operation with the provided parameters.

## Inputs
See the inputs section for detailed parameter information.

## Outputs
See the outputs section for detailed return information.

## Examples
See the examples section for usage examples.
`;
  }

  private generateExamples(toolName: string): PrebuiltNode['metadata']['examples'] {
    const examples: Record<string, PrebuiltNode['metadata']['examples']> = {
      'http_request': [
        {
          name: 'Basic GET Request',
          description: 'Make a simple GET request',
          input: { url: 'https://api.example.com/data' },
          expectedOutput: { response: {}, status: 200, headers: {} }
        }
      ],
      'email_sender': [
        {
          name: 'Send Notification',
          description: 'Send a notification email',
          input: { to: 'user@example.com', subject: 'Notification', body: 'Hello World' },
          expectedOutput: { success: true, messageId: 'msg_123' }
        }
      ]
    };
    
    return examples[toolName] || [];
  }

  private updatePerformanceMetrics(nodeId: string, executionTime: number, success: boolean): void {
    const current = this.performanceTracker.get(nodeId) || {
      averageExecutionTime: 0,
      memoryUsage: 0,
      successRate: 0,
      errorRate: 0,
      lastExecuted: new Date(),
      executionCount: 0
    };

    current.executionCount++;
    current.averageExecutionTime = (current.averageExecutionTime + executionTime) / 2;
    current.memoryUsage = process.memoryUsage().heapUsed;
    current.successRate = success ? (current.successRate + 1) / 2 : current.successRate;
    current.errorRate = success ? current.errorRate : (current.errorRate + 1) / 2;
    current.lastExecuted = new Date();

    this.performanceTracker.set(nodeId, current);
  }

  private getPerformanceMetrics(nodeId: string): PrebuiltNode['metadata']['performance'] {
    return this.performanceTracker.get(nodeId) || {
      averageExecutionTime: 0,
      memoryUsage: 0,
      successRate: 0,
      errorRate: 0,
      lastExecuted: new Date(),
      executionCount: 0
    };
  }

  private async validateNodeInputs(nodeId: string, params: Record<string, any>): Promise<ValidationResult> {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return { valid: false, errors: ['Node not found'], warnings: [] };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    for (const input of node.inputs) {
      if (input.required && !(input.name in params)) {
        errors.push(`Required input '${input.name}' is missing`);
      }

      if (input.name in params) {
        const value = params[input.name];
        const type = typeof value;

        if (input.type === 'string' && type !== 'string') {
          errors.push(`Input '${input.name}' must be a string`);
        } else if (input.type === 'number' && type !== 'number') {
          errors.push(`Input '${input.name}' must be a number`);
        } else if (input.type === 'boolean' && type !== 'boolean') {
          errors.push(`Input '${input.name}' must be a boolean`);
        } else if (input.type === 'object' && type !== 'object') {
          errors.push(`Input '${input.name}' must be an object`);
        } else if (input.type === 'array' && !Array.isArray(value)) {
          errors.push(`Input '${input.name}' must be an array`);
        }

        if (input.validation) {
          if (input.validation.min !== undefined && value < input.validation.min) {
            errors.push(`Input '${input.name}' must be at least ${input.validation.min}`);
          }
          if (input.validation.max !== undefined && value > input.validation.max) {
            errors.push(`Input '${input.name}' must be at most ${input.validation.max}`);
          }
          if (input.validation.pattern && !new RegExp(input.validation.pattern).test(value)) {
            errors.push(`Input '${input.name}' does not match required pattern`);
          }
          if (input.validation.enum && !input.validation.enum.includes(value)) {
            errors.push(`Input '${input.name}' must be one of: ${input.validation.enum.join(', ')}`);
          }
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  // Public API methods
  register(node: PrebuiltNode): void {
    this.nodes.set(node.id, node);
  }

  getNode(nodeId: string): PrebuiltNode | undefined {
    return this.nodes.get(nodeId);
  }

  getAllNodes(): PrebuiltNode[] {
    return Array.from(this.nodes.values());
  }

  searchNodes(criteria: NodeSearchCriteria): PrebuiltNode[] {
    let results = Array.from(this.nodes.values());

    if (criteria.category) {
      results = results.filter(node => node.category === criteria.category);
    }

    if (criteria.tags && criteria.tags.length > 0) {
      results = results.filter(node => 
        criteria.tags!.some(tag => node.metadata.tags.includes(tag))
      );
    }

    if (criteria.complexity) {
      results = results.filter(node => node.metadata.complexity === criteria.complexity);
    }

    if (criteria.author) {
      results = results.filter(node => node.metadata.author === criteria.author);
    }

    if (criteria.performance) {
      if (criteria.performance.maxExecutionTime) {
        results = results.filter(node => 
          node.metadata.performance.averageExecutionTime <= criteria.performance!.maxExecutionTime!
        );
      }
      if (criteria.performance.minSuccessRate) {
        results = results.filter(node => 
          node.metadata.performance.successRate >= criteria.performance!.minSuccessRate!
        );
      }
    }

    if (criteria.dependencies && criteria.dependencies.length > 0) {
      results = results.filter(node => 
        criteria.dependencies!.some(dep => node.metadata.dependencies.includes(dep))
      );
    }

    if (criteria.text) {
      const searchText = criteria.text.toLowerCase();
      results = results.filter(node => 
        node.name.toLowerCase().includes(searchText) ||
        node.description.toLowerCase().includes(searchText) ||
        node.metadata.tags.some(tag => tag.toLowerCase().includes(searchText))
      );
    }

    return results;
  }

  async executeNode(nodeId: string, params: Record<string, any>): Promise<NodeResult> {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return {
        success: false,
        error: `Node ${nodeId} not found`
      };
    }

    return await node.implementation.execute(params);
  }

  async validateNode(nodeId: string, params: Record<string, any>): Promise<ValidationResult> {
    const node = this.nodes.get(nodeId);
    if (!node || !node.implementation.validate) {
      return { valid: true, errors: [], warnings: [] };
    }

    return await node.implementation.validate(params);
  }

  // Composition methods
  createComposition(composition: NodeComposition): void {
    this.compositions.set(composition.id, composition);
  }

  getComposition(compositionId: string): NodeComposition | undefined {
    return this.compositions.get(compositionId);
  }

  getAllCompositions(): NodeComposition[] {
    return Array.from(this.compositions.values());
  }

  async executeComposition(compositionId: string, initialParams: Record<string, any>): Promise<NodeResult> {
    const composition = this.compositions.get(compositionId);
    if (!composition) {
      return {
        success: false,
        error: `Composition ${compositionId} not found`
      };
    }

    // Execute composition steps in order
    let currentParams = initialParams;
    let lastResult: NodeResult = { success: true, data: currentParams };

    for (const step of composition.nodes) {
      if (!step.enabled) continue;

      const node = this.nodes.get(step.nodeId);
      if (!node) {
        return {
          success: false,
          error: `Node ${step.nodeId} not found in composition`
        };
      }

      // Merge step parameters with current params
      const stepParams = { ...currentParams, ...step.parameters };
      
      const result = await node.implementation.execute(stepParams);
      if (!result.success) {
        return result;
      }

      lastResult = result;
      currentParams = result.data || currentParams;
    }

    return lastResult;
  }
}

// Export singleton instance
export const nodeRegistry = new NodeRegistry();
