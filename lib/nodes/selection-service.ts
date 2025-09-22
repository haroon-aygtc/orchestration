import { nodeRegistry } from './registry';
import { PrebuiltNode, NodeSearchCriteria } from './types';
import { aiConfigService } from '../ai-config-service';
import { parseWithSchema } from '../llm/strict-json';
import { z } from 'zod';

export class NodeSelectionService {
  private aiConfig = aiConfigService;

  async selectNodesForGoal(goal: string, context: Record<string, any> = {}): Promise<PrebuiltNode[]> {
    try {
      // Use AI to analyze the goal and select appropriate nodes
      const analysis = await this.analyzeGoal(goal, context);
      
      // Search for nodes based on AI analysis
      const criteria: NodeSearchCriteria = {
        category: analysis.category,
        tags: analysis.tags,
        complexity: analysis.complexity,
        performance: analysis.performance
      };

      const candidateNodes = nodeRegistry.searchNodes(criteria);
      
      // Use AI to rank and select the best nodes
      const selectedNodes = await this.rankAndSelectNodes(candidateNodes, goal, context);
      
      return selectedNodes;
    } catch (error) {
      console.error('Error selecting nodes for goal:', error);
      // Fallback to basic search
      return nodeRegistry.searchNodes({ text: goal });
    }
  }

  private async analyzeGoal(goal: string, context: Record<string, any>): Promise<{
    category: string;
    tags: string[];
    complexity: string;
    performance: {
      maxExecutionTime: number;
      minSuccessRate: number;
    };
  }> {
    const prompt = `Analyze this goal and determine the best node selection criteria:

Goal: ${goal}
Context: ${JSON.stringify(context, null, 2)}

Return a JSON response with:
- category: primary category (data, ai, integration, ui, workflow, communication, file, database)
- tags: array of relevant tags
- complexity: simple, medium, or complex
- performance: object with maxExecutionTime (ms) and minSuccessRate (0-1)

Focus on the core functionality needed to achieve this goal.`;

    try {
      const response = await this.aiConfig.callAI('workflow-agent', [
        { role: 'user', content: prompt }
      ], {
        temperature: 0.3,
        maxTokens: 500
      });

      // Define schema for goal analysis
      const GoalAnalysisSchema = z.object({
        requirements: z.array(z.string()),
        complexity: z.enum(['simple', 'medium', 'complex']),
        categories: z.array(z.string()),
        estimatedSteps: z.number().min(1).max(20)
      });
      
      const analysis = parseWithSchema(response.content, GoalAnalysisSchema);
      return {
        category: analysis.categories[0] || 'workflow',
        tags: analysis.categories || [],
        complexity: analysis.complexity || 'medium',
        performance: {
          maxExecutionTime: analysis.estimatedSteps || 5000,
          minSuccessRate: analysis.estimatedSteps || 0.8
        }
      };
    } catch (error) {
      console.error('Error analyzing goal:', error);
      return {
        category: 'workflow',
        tags: [],
        complexity: 'medium',
        performance: {
          maxExecutionTime: 5000,
          minSuccessRate: 0.8
        }
      };
    }
  }

  private async rankAndSelectNodes(
    candidateNodes: PrebuiltNode[], 
    goal: string, 
    context: Record<string, any>
  ): Promise<PrebuiltNode[]> {
    if (candidateNodes.length === 0) return [];

    const prompt = `Rank these nodes for achieving this goal:

Goal: ${goal}
Context: ${JSON.stringify(context, null, 2)}

Available nodes:
${candidateNodes.map(node => `- ${node.id}: ${node.name} (${node.category}) - ${node.description}`).join('\n')}

Return a JSON array of node IDs ranked by relevance, with the most relevant first.
Limit to the top 5 most relevant nodes.`;

    try {
      const response = await this.aiConfig.callAI('workflow-agent', [
        { role: 'user', content: prompt }
      ], {
        temperature: 0.2,
        maxTokens: 300
      });

      // Define schema for ranked node IDs
      const RankedNodeIdsSchema = z.array(z.string());
      
      const rankedNodeIds = parseWithSchema(response.content, RankedNodeIdsSchema);
      const selectedNodes: PrebuiltNode[] = [];

      for (const nodeId of rankedNodeIds) {
        const node = candidateNodes.find(n => n.id === nodeId);
        if (node) {
          selectedNodes.push(node);
        }
      }

      return selectedNodes;
    } catch (error) {
      console.error('Error ranking nodes:', error);
      // Fallback to first 5 nodes
      return candidateNodes.slice(0, 5);
    }
  }

  async findBestNodeForTask(task: string, availableNodes: PrebuiltNode[]): Promise<PrebuiltNode | null> {
    if (availableNodes.length === 0) return null;

    const prompt = `Find the best node for this task:

Task: ${task}

Available nodes:
${availableNodes.map(node => `- ${node.id}: ${node.name} - ${node.description}`).join('\n')}

Return the node ID that best matches the task, or null if none match.`;

    try {
      const response = await this.aiConfig.callAI('workflow-agent', [
        { role: 'user', content: prompt }
      ], {
        temperature: 0.1,
        maxTokens: 100
      });

      // Define schema for single node selection
      const SelectedNodeIdSchema = z.string();
      
      const selectedNodeId = parseWithSchema(response.content, SelectedNodeIdSchema);
      return availableNodes.find(node => node.id === selectedNodeId) || null;
    } catch (error) {
      console.error('Error finding best node:', error);
      return availableNodes[0] || null;
    }
  }

  async suggestNodeComposition(goal: string, context: Record<string, any> = {}): Promise<{
    nodes: PrebuiltNode[];
    reasoning: string;
    estimatedDuration: number;
    steps: Array<{ nodeId: string; parameters: Record<string, any>; order: number }>;
    connections: Array<{ from: string; to: string; output: string; input: string }>;
  }> {
    try {
      const prompt = `Suggest a node composition for this goal:

Goal: ${goal}
Context: ${JSON.stringify(context, null, 2)}

Available nodes:
${nodeRegistry.getAllNodes().map(node => `- ${node.id}: ${node.name} (${node.category})`).join('\n')}

Return a JSON object with:
- nodes: array of node IDs to use
- connections: array of connections between nodes with from, to, output, input properties

Focus on creating a logical workflow that achieves the goal.`;

      const response = await this.aiConfig.callAI('workflow-agent', [
        { role: 'user', content: prompt }
      ], {
        temperature: 0.3,
        maxTokens: 800
      });

      // Define schema for node composition suggestion
      const NodeCompositionSuggestionSchema = z.object({
        steps: z.array(z.object({
          nodeId: z.string(),
          parameters: z.record(z.any()),
          order: z.number()
        })),
        reasoning: z.string(),
        estimatedDuration: z.number().optional()
      });
      
      const suggestion = parseWithSchema(response.content, NodeCompositionSuggestionSchema);
      
      const selectedNodes = suggestion.steps
        .map((step: { nodeId: string; parameters: Record<string, any>; order: number }) => nodeRegistry.getNode(step.nodeId))
        .filter((node: PrebuiltNode | undefined) => node !== undefined) as PrebuiltNode[];

      return {
        nodes: selectedNodes,
        steps: suggestion.steps,
        connections: suggestion.steps.map((step: { nodeId: string; parameters: Record<string, any>; order: number }) => ({
          from: step.order.toString(),
          to: step.order.toString(),
          output: step.parameters.output,
          input: step.parameters.input
        })) || [],
        reasoning: suggestion.reasoning,
        estimatedDuration: suggestion.estimatedDuration || 0
      };
    } catch (error) {
      console.error('Error suggesting composition:', error);
      return { nodes: [], steps: [], connections: [], reasoning: '', estimatedDuration: 0 };
    }
  }
}

export const nodeSelectionService = new NodeSelectionService();
