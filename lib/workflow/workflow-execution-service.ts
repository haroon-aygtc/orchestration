// lib/workflow/workflow-execution-service.ts
/**
 * Workflow Execution Service
 * Production-grade workflow execution engine
 */

// Define types locally since they're not exported from ../types
interface WorkflowDefinition {
  id: string;
  name: string;
  steps: WorkflowStep[];
  metadata?: Record<string, any>;
}

interface WorkflowStep {
  id: string;
  name: string;
  type: string;
  tool?: string;
  inputs?: Record<string, any>;
  config: Record<string, any>;
  dependencies?: string[];
}

export interface WorkflowExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTime: number;
  steps: Array<{
    stepId: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    result?: any;
    error?: string;
    executionTime: number;
  }>;
}

export class WorkflowExecutionService {
  private static instance: WorkflowExecutionService;

  static getInstance(): WorkflowExecutionService {
    if (!WorkflowExecutionService.instance) {
      WorkflowExecutionService.instance = new WorkflowExecutionService();
    }
    return WorkflowExecutionService.instance;
  }

  async executeWorkflow(input: any): Promise<WorkflowExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Parse workflow definition from input
      const workflow: WorkflowDefinition = input.workflow || input;
      
      if (!workflow.steps || workflow.steps.length === 0) {
        throw new Error('Workflow must have at least one step');
      }

      const stepResults: Array<{
        stepId: string;
        status: "pending" | "running" | "completed" | "failed";
        result?: any;
        error?: string;
        executionTime: number;
      }> = [];
      let currentData = input.data || {};

      // Execute steps in order
      for (const step of workflow.steps) {
        const stepStartTime = Date.now();
        
        try {
          const stepResult = await this.executeStep(step, currentData);
          stepResults.push({
            stepId: step.id,
            status: 'completed',
            result: stepResult,
            executionTime: Date.now() - stepStartTime
          });
          
          // Update current data with step output
          if (stepResult && typeof stepResult === 'object') {
            currentData = { ...currentData, ...stepResult };
          }
        } catch (error) {
          stepResults.push({
            stepId: step.id,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
            executionTime: Date.now() - stepStartTime
          });
          
          return {
            success: false,
            error: `Step ${step.id} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            executionTime: Date.now() - startTime,
            steps: stepResults
          };
        }
      }

      return {
        success: true,
        data: currentData,
        executionTime: Date.now() - startTime,
        steps: stepResults
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime,
        steps: []
      };
    }
  }

  private async executeStep(step: WorkflowStep, context: any): Promise<any> {
    // Import and use real tool registry
    const { createRealTools, getToolMetrics } = await import('../tools/registry');
    const tools = await createRealTools();
    
    if (!step.tool) {
      throw new Error(`Step ${step.id} has no tool specified`);
    }
    
    const tool = tools[step.tool];
    if (!tool) {
      throw new Error(`Tool ${step.tool} not found`);
    }

    // Prepare step inputs with context substitution
    const stepInputs = this.substituteVariables(step.inputs, context);
    
    // Execute the tool
    const result = await tool(stepInputs);
    
    if (!result.success) {
      throw new Error(result.message || 'Tool execution failed');
    }

    return result.data;
  }

  private substituteVariables(inputs: any, context: any): any {
    if (typeof inputs === 'string') {
      return inputs.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        const value = this.getNestedValue(context, path);
        return value !== undefined ? String(value) : match;
      });
    }

    if (Array.isArray(inputs)) {
      return inputs.map(item => this.substituteVariables(item, context));
    }

    if (inputs && typeof inputs === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(inputs)) {
        result[key] = this.substituteVariables(value, context);
      }
      return result;
    }

    return inputs;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }
}

// Export singleton instance
export const workflowExecutionService = WorkflowExecutionService.getInstance();
