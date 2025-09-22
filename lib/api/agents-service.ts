// Centralized API service for agent operations
// Based on FEONTEND.md implementation plan

export interface CreateTaskRequest {
  type: string;
  description: string;
  priority?: 'low' | 'medium' | 'high';
  agentId?: string;
}

export interface SystemStatus {
  success: boolean;
  data: {
    systemStatus: {
      status: string;
      activeAgents: number;
      totalTasks: number;
      completedTasks: number;
      memory?: {
        used: number;
        total: number;
        percentage: number;
      };
    };
    agents: Array<{
      id: string;
      type: string;
      name: string;
      status: string;
      tasksCompleted: number;
      lastActive: string;
    }>;
    tasks?: Array<{
      id: string;
      type: string;
      description: string;
      status: string;
      createdAt: string;
      completedAt?: string;
    }>;
  };
  error?: string;
}

export interface BusinessAnalysisRequest {
  responses: Record<string, string>;
}

export interface BusinessAnalysisResponse {
  success: boolean;
  analysis?: {
    summary: string;
    recommendations: string[];
    priority: 'low' | 'medium' | 'high';
  };
  error?: string;
}

export class AgentsService {
  private static readonly BASE_URL = '/api/agents';

  static async getSystemStatus(): Promise<SystemStatus> {
    try {
      const response = await fetch(this.BASE_URL);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching system status:', error);
      throw error;
    }
  }
  
  static async createTask(task: CreateTaskRequest): Promise<{ success: boolean; taskId?: string; error?: string }> {
    try {
      const response = await fetch(`${this.BASE_URL}/task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  }

  static async analyzeBusinessNeeds(request: BusinessAnalysisRequest): Promise<BusinessAnalysisResponse> {
    try {
      const response = await fetch(`${this.BASE_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error analyzing business needs:', error);
      throw error;
    }
  }
}
