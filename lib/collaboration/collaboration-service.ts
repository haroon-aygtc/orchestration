// Simple collaboration service for real-time reasoning and suggestions
import { emitCollaborationEvent } from '../real-time/event-bus';
import { 
  createReasoningEvent, 
  createStatusEvent, 
  createSuggestionEvent,
  type CollaborationEvent 
} from '../types/collaboration';
import { logger } from '../utils/structured-logger';

export class CollaborationService {
  private reasoningHistory: Map<string, CollaborationEvent[]> = new Map();
  private statusHistory: Map<string, CollaborationEvent[]> = new Map();
  private suggestionHistory: Map<string, CollaborationEvent[]> = new Map();

  /**
   * Emit reasoning event for real-time thinking
   */
  async emitReasoning(
    goalId: string,
    text: string,
    confidence: number = 0.8,
    stepId?: string,
    context?: Record<string, any>
  ): Promise<void> {
    const event = createReasoningEvent(goalId, text, confidence, stepId, context);
    
    // Store in history
    this.addToHistory(this.reasoningHistory, goalId, event);
    
    // Emit to event bus
    await emitCollaborationEvent(event);
    
    logger.info(`[Collaboration] Reasoning emitted for goal ${goalId}`, {
      stepId,
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      confidence
    });
  }

  /**
   * Emit status event for system progress
   */
  async emitStatus(
    goalId: string,
    status: string,
    stepId?: string,
    progress?: number,
    meta?: Record<string, any>
  ): Promise<void> {
    const event = createStatusEvent(goalId, status, stepId, progress, meta);
    
    // Store in history
    this.addToHistory(this.statusHistory, goalId, event);
    
    // Emit to event bus
    await emitCollaborationEvent(event);
    
    logger.info(`[Collaboration] Status emitted for goal ${goalId}`, {
      stepId,
      status,
      progress
    });
  }

  /**
   * Emit suggestion event for user recommendations
   */
  async emitSuggestion(
    goalId: string,
    suggestion: string,
    action: string,
    confidence: number = 0.7,
    fromAgent: string,
    toAgent?: string,
    stepId?: string
  ): Promise<void> {
    const event = createSuggestionEvent(goalId, suggestion, action, confidence, fromAgent, toAgent, stepId);
    
    // Store in history
    this.addToHistory(this.suggestionHistory, goalId, event);
    
    // Emit to event bus
    await emitCollaborationEvent(event);
    
    logger.info(`[Collaboration] Suggestion emitted for goal ${goalId}`, {
      stepId,
      suggestion: suggestion.substring(0, 100) + (suggestion.length > 100 ? '...' : ''),
      action,
      confidence,
      fromAgent,
      toAgent
    });
  }

  /**
   * Get reasoning history for a goal
   */
  getReasoningHistory(goalId: string): CollaborationEvent[] {
    return this.reasoningHistory.get(goalId) || [];
  }

  /**
   * Get status history for a goal
   */
  getStatusHistory(goalId: string): CollaborationEvent[] {
    return this.statusHistory.get(goalId) || [];
  }

  /**
   * Get suggestion history for a goal
   */
  getSuggestionHistory(goalId: string): CollaborationEvent[] {
    return this.suggestionHistory.get(goalId) || [];
  }

  /**
   * Get all collaboration history for a goal
   */
  getAllHistory(goalId: string): {
    reasoning: CollaborationEvent[];
    status: CollaborationEvent[];
    suggestions: CollaborationEvent[];
  } {
    return {
      reasoning: this.getReasoningHistory(goalId),
      status: this.getStatusHistory(goalId),
      suggestions: this.getSuggestionHistory(goalId)
    };
  }

  /**
   * Clear history for a goal
   */
  clearHistory(goalId: string): void {
    this.reasoningHistory.delete(goalId);
    this.statusHistory.delete(goalId);
    this.suggestionHistory.delete(goalId);
  }

  /**
   * Clear all history
   */
  clearAllHistory(): void {
    this.reasoningHistory.clear();
    this.statusHistory.clear();
    this.suggestionHistory.clear();
  }

  /**
   * Get collaboration statistics
   */
  getStats(): {
    totalGoals: number;
    totalReasoning: number;
    totalStatus: number;
    totalSuggestions: number;
  } {
    const allGoalIds = new Set([
      ...this.reasoningHistory.keys(),
      ...this.statusHistory.keys(),
      ...this.suggestionHistory.keys()
    ]);

    const totalReasoning = Array.from(this.reasoningHistory.values())
      .reduce((sum, events) => sum + events.length, 0);
    
    const totalStatus = Array.from(this.statusHistory.values())
      .reduce((sum, events) => sum + events.length, 0);
    
    const totalSuggestions = Array.from(this.suggestionHistory.values())
      .reduce((sum, events) => sum + events.length, 0);

    return {
      totalGoals: allGoalIds.size,
      totalReasoning,
      totalStatus,
      totalSuggestions
    };
  }

  /**
   * Helper method to add event to history
   */
  private addToHistory(history: Map<string, CollaborationEvent[]>, goalId: string, event: CollaborationEvent): void {
    const events = history.get(goalId) || [];
    events.push(event);
    
    // Keep only last 100 events per goal to prevent memory leaks
    if (events.length > 100) {
      events.splice(0, events.length - 100);
    }
    
    history.set(goalId, events);
  }
}

// Export singleton instance
export const collaborationService = new CollaborationService();
