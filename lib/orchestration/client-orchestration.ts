// Client-safe orchestration service for browser environments
// This provides the same interface but without server-side dependencies

import { 
  type OrchestrationGoal, 
  type OrchestrationStep, 
  type OrchestrationSuggestion} from '../types';
import io from 'socket.io-client'; // Added for real-time WebSocket
import { logger } from "../utils/structured-logger";
import type { CollaborationEvent } from '../types/collaboration';

// Client-safe orchestration service that makes API calls instead of direct operations
export class ClientOrchestrationService {
  private goals: Map<string, OrchestrationGoal> = new Map();
  private socket: any; // Socket.io client
  private collaborationHistory: Map<string, CollaborationEvent[]> = new Map();

  constructor() {
    this.socket = io(process.env.REACT_APP_API_URL || 'http://localhost:5000'); // Configurable via env
    this.setupSocketListeners();
  }

  // Setup real-time listeners
  private setupSocketListeners() {
    this.socket.on('goal.created', (goal: OrchestrationGoal) => {
      this.goals.set(goal.id, goal);
    });
    this.socket.on('goal.updated', (data: { goalId: string, steps?: OrchestrationStep[], suggestion?: OrchestrationSuggestion }) => {
      const goal = this.goals.get(data.goalId);
      if (goal) {
        if (data.steps) goal.steps = data.steps;
        if (data.suggestion) goal.suggestions.push(data.suggestion);
        this.goals.set(data.goalId, goal);
      }
    });
    this.socket.on('step.started', (data: { goalId: string, stepId: string, step: OrchestrationStep }) => {
      const goal = this.goals.get(data.goalId);
      if (goal) {
        const step = goal.steps.find(s => s.id === data.stepId);
        if (step) {
          step.status = 'RUNNING';
          step.startedAt = new Date();
        }
        this.goals.set(data.goalId, goal);
      }
    });
    this.socket.on('step.completed', (data: { goalId: string, stepId: string, result: any }) => {
      const goal = this.goals.get(data.goalId);
      if (goal) {
        const step = goal.steps.find(s => s.id === data.stepId);
        if (step) {
          step.status = 'COMPLETED';
          step.result = data.result;
          step.completedAt = new Date();
        }
        this.goals.set(data.goalId, goal);
      }
    });
    this.socket.on('step.failed', (data: { goalId: string, stepId: string, error: string }) => {
      const goal = this.goals.get(data.goalId);
      if (goal) {
        const step = goal.steps.find(s => s.id === data.stepId);
        if (step) {
          step.status = 'FAILED';
          step.error = data.error;
          step.completedAt = new Date();
        }
        this.goals.set(data.goalId, goal);
      }
    });
    this.socket.on('goal.completed', (data: { goalId: string }) => {
      const goal = this.goals.get(data.goalId);
      if (goal) {
        goal.status = 'COMPLETED';
        this.goals.set(data.goalId, goal);
      }
    });
    this.socket.on('clarification.needed', (data: { goalId: string, questions: string[] }) => {
      // Handle clarification in UI (e.g., dispatch to store)
      logger.info(`Clarification needed for goal ${data.goalId}:`, data.questions);
    });

    // Add collaboration event listeners for real-time reasoning and suggestions
    this.socket.on('collab:reasoning', (event: CollaborationEvent) => {
      this.handleCollaborationEvent(event);
    });

    this.socket.on('collab:status', (event: CollaborationEvent) => {
      this.handleCollaborationEvent(event);
    });

    this.socket.on('collab:suggestion', (event: CollaborationEvent) => {
      this.handleCollaborationEvent(event);
    });
  }

  // Create a new orchestration goal via API
  async createGoal(input: {
    title: string;
    description: string;
    context?: unknown;
  }): Promise<OrchestrationGoal> {
    const response = await fetch('/api/orchestration/create-goal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error('Failed to create goal');
    const goal = await response.json();
    this.goals.set(goal.id, goal);
    return goal;
  }

  // Get a goal by ID (sync with server)
  async getGoal(goalId: string): Promise<OrchestrationGoal | null> {
    const response = await fetch(`/api/orchestration/goals/${goalId}`);
    if (!response.ok) return null;
    const goal = await response.json();
    this.goals.set(goalId, goal);
    return goal;
  }

  // List all goals (sync with server)
  async listGoals(): Promise<OrchestrationGoal[]> {
    const response = await fetch('/api/orchestration/goals');
    if (!response.ok) throw new Error('Failed to list goals');
    const goals = await response.json();
    goals.forEach((g: OrchestrationGoal) => this.goals.set(g.id, g));
    return goals;
  }

  // Plan steps for a goal via API
  async planSteps(goalId: string): Promise<OrchestrationStep[]> {
    const response = await fetch(`/api/orchestration/plan-steps/${goalId}`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to plan steps');
    const steps = await response.json();
    const goal = this.goals.get(goalId);
    if (goal) {
      goal.steps = steps;
      goal.updatedAt = new Date();
      this.goals.set(goalId, goal);
    }
    return steps;
  }

  // Execute next step via API
  async executeNextStep(goalId: string): Promise<{ status: string; stepId?: string }> {
    const response = await fetch(`/api/orchestration/execute-next-step/${goalId}`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to execute step');
    const res = await response.json();
    // State will be updated via Socket.io
    return res;
  }

  // Add suggestion to goal via API
  async addSuggestion(
    goalId: string,
    suggestion: Omit<OrchestrationSuggestion, "id" | "goalId" | "createdAt">
  ): Promise<void> {
    const response = await fetch(`/api/orchestration/add-suggestion/${goalId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(suggestion),
    });
    if (!response.ok) throw new Error('Failed to add suggestion');
    // State will be updated via Socket.io
  }

  

  // Handle collaboration events
  private handleCollaborationEvent(event: CollaborationEvent): void {
    // Store in collaboration history
    const history = this.collaborationHistory.get(event.goalId) || [];
    history.push(event);
    
    // Keep only last 100 events per goal to prevent memory leaks
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
    this.collaborationHistory.set(event.goalId, history);

    // Log the event
    logger.info(`[Collaboration] ${event.kind} for goal ${event.goalId}`, {
      stepId: event.stepId,
      timestamp: event.timestamp
    });

    // Emit custom events for UI components to listen to
    this.emitCollaborationEvent(event);
  }

  // Emit collaboration events for UI components
  private emitCollaborationEvent(event: CollaborationEvent): void {
    // Create custom events that UI components can listen to
    const customEvent = new CustomEvent('collaboration', {
      detail: event
    });
    window.dispatchEvent(customEvent);
  }

  // Get collaboration history for a goal
  getCollaborationHistory(goalId: string): CollaborationEvent[] {
    return this.collaborationHistory.get(goalId) || [];
  }

  // Get all collaboration history
  getAllCollaborationHistory(): Map<string, CollaborationEvent[]> {
    return new Map(this.collaborationHistory);
  }

  // Clear collaboration history for a goal
  clearCollaborationHistory(goalId: string): void {
    this.collaborationHistory.delete(goalId);
  }

  // Clear all collaboration history
  clearAllCollaborationHistory(): void {
    this.collaborationHistory.clear();
  }

  // Added: Get UI schema for goal
  async getUISchema(goalId: string): Promise<any> {
    const response = await fetch(`/api/orchestration/ui-schema/${goalId}`);
    if (!response.ok) throw new Error('Failed to get UI schema');
    return await response.json();
  }
}

// Export a singleton instance
export const clientOrchestrationService = new ClientOrchestrationService();