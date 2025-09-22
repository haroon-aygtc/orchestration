// Redis Streams Worker Service
// Production-grade background processing for Redis Streams

import { RedisStreamsService } from './streams-service';
import { OrchestrationService } from '../orchestration/ai-orchestration-service';
import type { RealManagerAgent } from '../real-manager-agent';
import { Server } from 'socket.io';
import { logger, LogContext } from "../utils/structured-logger";

export interface WorkerConfig {
  consumerName: string;
  pollInterval: number;
  maxRetries: number;
  retryDelay: number;
  batchSize: number;
}

export class RedisStreamsWorker {
  private streamsService: RedisStreamsService;
  private orchestrationService: OrchestrationService;
  private config: WorkerConfig;
  private isRunning = false;
  private workers: Map<string, NodeJS.Timeout> = new Map();
  private retryCounts: Map<string, number> = new Map();
  private errorCounts: Map<string, number> = new Map();
  private lastErrorTimes: Map<string, number> = new Map();
  private circuitBreakerThreshold = 10; // Max errors before circuit breaker opens
  private circuitBreakerTimeout = 60000; // 1 minute timeout

  constructor(
    streamsService: RedisStreamsService,
    orchestrationService: OrchestrationService,
    config: Partial<WorkerConfig> = {}
  ) {
    this.streamsService = streamsService;
    this.orchestrationService = orchestrationService;
    this.config = {
      consumerName: 'orchestration-worker',
      pollInterval: 5000,
      maxRetries: 3,
      retryDelay: 1000,
      batchSize: 10,
      ...config
    };
  }

  /**
   * Start all background workers
   */
  async start(): Promise<void> {
    if (this.isRunning) {

      return;
    }


    // Start orchestration events worker
    this.startWorker('orchestration-events', async () => {
      await this.processOrchestrationEvents();
    });

    // Start agent communication worker
    this.startWorker('agent-communication', async () => {
      await this.processAgentMessages();
    });

    // Start workflow steps worker
    this.startWorker('workflow-steps', async () => {
      await this.processWorkflowSteps();
    });

    // Start node executions worker
    this.startWorker('node-executions', async () => {
      await this.processNodeExecutions();
    });

    // Start coordination worker
    this.startWorker('coordination', async () => {
      await this.processCoordinationMessages();
    });

    // Start collaboration workers for real-time reasoning and suggestions
    this.startWorker('collaboration-reasoning', async () => {
      await this.processCollaborationReasoning();
    });

    this.startWorker('collaboration-suggestions', async () => {
      await this.processCollaborationSuggestions();
    });

    this.startWorker('collaboration-status', async () => {
      await this.processCollaborationStatus();
    });

    this.isRunning = true;
    logger.info('✅ All Redis Streams Workers started');
  }

  /**
   * Stop all background workers
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
        
      return;
    }

        

    for (const [name, interval] of Array.from(this.workers.entries())) {
      clearInterval(interval);
        
    }

    this.workers.clear();
    this.retryCounts.clear();
    this.isRunning = false;

        
  }

  /**
   * Check if circuit breaker is open for a worker
   */
  private isCircuitBreakerOpen(workerName: string): boolean {
    const errorCount = this.errorCounts.get(workerName) || 0;
    const lastErrorTime = this.lastErrorTimes.get(workerName) || 0;
    
    if (errorCount >= this.circuitBreakerThreshold) {
      const timeSinceLastError = Date.now() - lastErrorTime;
      if (timeSinceLastError < this.circuitBreakerTimeout) {
        return true;
      } else {
        // Reset circuit breaker after timeout
        this.errorCounts.set(workerName, 0);
        this.lastErrorTimes.delete(workerName);
        return false;
      }
    }
    
    return false;
  }


  private isWorkerRunning(workerName: string): boolean {
    return this.workers.has(workerName);
  }

  /**
   * Record error for circuit breaker
   */
  private recordError(workerName: string): void {
    const errorCount = this.errorCounts.get(workerName) || 0;
    this.errorCounts.set(workerName, errorCount + 1);
    this.lastErrorTimes.set(workerName, Date.now());
  }

  /**
   * Record success for circuit breaker
   */
  private recordSuccess(workerName: string): void {
    this.errorCounts.set(workerName, 0);
    this.lastErrorTimes.delete(workerName);
  }

  /**
   * Start a specific worker with circuit breaker pattern
   */
  private startWorker(name: string, processor: () => Promise<void>): void {
    const interval = setInterval(async () => {
      // Check circuit breaker
      if (this.isCircuitBreakerOpen(name) || this.isWorkerRunning(name)) {
            
        return;
      }

      try {
        await processor();
        // Record success and reset retry count
        this.recordSuccess(name);
        this.retryCounts.delete(name);
      } catch (error) {
        logger.error(`Error in worker ${name}:`, error as LogContext);
        this.recordError(name);
        
        // Handle retries
        const retryCount = this.retryCounts.get(name) || 0;
        if (retryCount < this.config.maxRetries) {
          this.retryCounts.set(name, retryCount + 1);
            
          
          // Exponential backoff with jitter
          const baseDelay = this.config.retryDelay * Math.pow(2, retryCount);
          const jitter = Math.random() * 1000; // Add up to 1 second jitter
          const delay = Math.min(baseDelay + jitter, 30000); // Max 30 seconds
          
          setTimeout(() => {
            processor().catch(logger.error);
          }, delay);
        } else {
          logger.error(`Worker ${name} failed after ${this.config.maxRetries} retries`);
          this.retryCounts.delete(name);
        }
      }
    }, this.config.pollInterval);

    this.workers.set(name, interval);
        
  }

  /**
   * Process orchestration events
   */
  private async processOrchestrationEvents(): Promise<void> {
    const messages = await this.streamsService.readMessages(
      'orchestration:events',
      'orchestration-processors',
      `${this.config.consumerName}-orchestration`,
      this.config.batchSize,
      1000
    );

    for (const message of messages) {
      try {
        await this.handleOrchestrationEvent(message);
        await this.streamsService.acknowledgeMessage(
          'orchestration:events',
          'orchestration-processors',
          message.id
        );
      } catch (error) {
        // Message will be retried by consumer group
      }
    }
  }

  /**
   * Process agent communication messages
   */
  private async processAgentMessages(): Promise<void> {
    const messages = await this.streamsService.readMessages(
      'agent:communication',
      'agent-processors',
      `${this.config.consumerName}-agent`,
      this.config.batchSize,
      1000
    );

    for (const message of messages) {
      try {
        await this.handleAgentMessage(message);
        await this.streamsService.acknowledgeMessage(
          'agent:communication',
          'agent-processors',
          message.id
        );
      } catch (error) {
        logger.error('Failed to process agent message:', error as LogContext);
        // Message will be retried by consumer group
      }
    }
  }

  /**
   * Process workflow steps
   */
  private async processWorkflowSteps(): Promise<void> {
    const messages = await this.streamsService.readMessages(
      'workflow:steps',
      'workflow-processors',
      `${this.config.consumerName}-workflow`,
      this.config.batchSize,
      1000
    );

    for (const message of messages) {
      try {
        await this.handleWorkflowStep(message);
        await this.streamsService.acknowledgeMessage(
          'workflow:steps',
          'workflow-processors',
          message.id
        );
      } catch (error) {
        logger.error('Failed to process workflow step:', error as LogContext);
        // Message will be retried by consumer group
      }
    }
  }

  /**
   * Process node executions
   */
  private async processNodeExecutions(): Promise<void> {
    const messages = await this.streamsService.readMessages(
      'node:executions',
      'node-processors',
      `${this.config.consumerName}-node`,
      this.config.batchSize,
      1000
    );

    for (const message of messages) {
      try {
        await this.handleNodeExecution(message);
        await this.streamsService.acknowledgeMessage(
          'node:executions',
          'node-processors',
          message.id
        );
      } catch (error) {
        logger.error('Failed to process node execution:', error as LogContext);
        // Message will be retried by consumer group
      }
    }
  }

  /**
   * Process coordination messages
   */
  private async processCoordinationMessages(): Promise<void> {
    const messages = await this.streamsService.readMessages(
      'coordination:decisions',
      'coordination-processors',
      `${this.config.consumerName}-coordination`,
      this.config.batchSize,
      1000
    );

    for (const message of messages) {
      try {
        await this.handleCoordinationMessage(message);
        await this.streamsService.acknowledgeMessage(
          'coordination:decisions',
          'coordination-processors',
          message.id
        );
      } catch (error) {
        logger.error('Failed to process coordination message:', error as LogContext);
        // Message will be retried by consumer group
      }
    }
  }

  /**
   * Handle orchestration event
   */
  private async handleOrchestrationEvent(message: any): Promise<void> {
    const { eventType, goalId, stepId, data } = message.fields;
    
        
    
    // Route to appropriate handler based on event type
    switch (eventType) {
      case 'goal.created':
        await this.handleGoalCreated(goalId, JSON.parse(data || '{}'));
        break;
      case 'step.completed':
        await this.handleStepCompleted(goalId, stepId, JSON.parse(data || '{}'));
        break;
      case 'step.failed':
        await this.handleStepFailed(goalId, stepId, JSON.parse(data || '{}'));
        break;
      default:
            
    }
  }

  /**
   * Handle agent message
   */
  private async handleAgentMessage(message: any): Promise<void> {
    const { fromAgent, toAgent, messageType, payload, correlationId } = message.fields;
    
        
    
    // Use orchestration service to handle agent communication
    await this.orchestrationService.sendAgentMessage(
      fromAgent,
      toAgent,
      messageType,
      JSON.parse(payload),
      correlationId
    );
  }

  /**
   * Handle workflow step
   */
  private async handleWorkflowStep(message: any): Promise<void> {
    const { stepId, goalId, agentType, input, status } = message.fields;
    
    if (status === 'pending') {
            
      
      // Use orchestration service to execute workflow step
      await this.orchestrationService.addWorkflowStepToStream(
        stepId,
        goalId,
        agentType,
        JSON.parse(input),
        []
      );
    }
  }

  /**
   * Handle node execution
   */
  private async handleNodeExecution(message: any): Promise<void> {
    const { nodeId, params, goalId, stepId } = message.fields;
    
            
    
    // Use orchestration service to execute node
    await this.orchestrationService.executeNodeDirectly(
      nodeId,
      JSON.parse(params)
    );
  }

  /**
   * Handle coordination message
   */
  private async handleCoordinationMessage(message: any): Promise<void> {
    const { decisionType, data } = message.fields;
    
            
    
    // Handle coordination decisions
    switch (decisionType) {
      case 'resource_allocation':
        await this.handleResourceAllocation(JSON.parse(data || '{}'));
        break;
      case 'conflict_resolution':
        await this.handleConflictResolution(JSON.parse(data || '{}'));
        break;
      default:
            
    }
  }

  /**
   * Handle goal created event
   */
  private async handleGoalCreated(goalId: string, data: any): Promise<void> {
            
    // Additional processing for goal creation
  }

  /**
   * Handle step completed event
   */
  private async handleStepCompleted(goalId: string, stepId: string, data: any): Promise<void> {
            
    // Additional processing for step completion
  }

  /**
   * Handle step failed event
   */
  private async handleStepFailed(goalId: string, stepId: string, data: any): Promise<void> {
            
    // Additional processing for step failure
  }

  /**
   * Handle resource allocation
   */
  private async handleResourceAllocation(data: any): Promise<void> {
            
    // Implement resource allocation logic
  }

  /**
   * Handle conflict resolution
   */
  private async handleConflictResolution(data: any): Promise<void> {
    
    // Implement conflict resolution logic
  }

  /**
   * Get worker status with detailed metrics
   */
  getStatus(): {
    isRunning: boolean;
    workers: string[];
    retryCounts: Record<string, number>;
    errorCounts: Record<string, number>;
    circuitBreakerStatus: Record<string, {
      isOpen: boolean;
      errorCount: number;
      lastErrorTime: number | null;
      timeUntilReset: number | null;
    }>;
    config: WorkerConfig;
  } {
    const circuitBreakerStatus: Record<string, any> = {};
    
    for (const workerName of Array.from(this.workers.keys())) {
      const errorCount = this.errorCounts.get(workerName) || 0;
      const lastErrorTime = this.lastErrorTimes.get(workerName) || null;
      const isOpen = this.isCircuitBreakerOpen(workerName);
      
      let timeUntilReset = null;
      if (isOpen && lastErrorTime) {
        const timeSinceLastError = Date.now() - lastErrorTime;
        timeUntilReset = Math.max(0, this.circuitBreakerTimeout - timeSinceLastError);
      }
      
      circuitBreakerStatus[workerName] = {
        isOpen,
        errorCount,
        lastErrorTime,
        timeUntilReset
      };
    }

    return {
      isRunning: this.isRunning,
      workers: Array.from(this.workers.keys()),
      retryCounts: Object.fromEntries(this.retryCounts),
      errorCounts: Object.fromEntries(this.errorCounts),
      circuitBreakerStatus,
      config: this.config
    };
  }

  /**
   * Reset circuit breaker for a specific worker
   */
  resetCircuitBreaker(workerName: string): void {
    this.errorCounts.set(workerName, 0);
    this.lastErrorTimes.delete(workerName);
    
  }

  /**
   * Reset all circuit breakers
   */
  resetAllCircuitBreakers(): void {
    this.errorCounts.clear();
    this.lastErrorTimes.clear();
    
  }

  /**
   * Process collaboration reasoning events
   */
  private async processCollaborationReasoning(): Promise<void> {
    try {
      const messages = await this.streamsService.readMessages(
        'collaboration:reasoning',
        'collaboration-processors',
        this.config.consumerName,
        this.config.batchSize,
        1000
      );

      for (const message of messages) {
        await this.handleCollaborationReasoning(message);
        await this.streamsService.ackMessage(
          'collaboration:reasoning',
          'collaboration-processors',
          message.id
        );
      }
    } catch (error) {
      logger.error('Error processing collaboration reasoning:', error);
    }
  }

  /**
   * Process collaboration suggestion events
   */
  private async processCollaborationSuggestions(): Promise<void> {
    try {
      const messages = await this.streamsService.readMessages(
        'collaboration:suggestions',
        'collaboration-processors',
        this.config.consumerName,
        this.config.batchSize,
        1000
      );

      for (const message of messages) {
        await this.handleCollaborationSuggestion(message);
        await this.streamsService.ackMessage(
          'collaboration:suggestions',
          'collaboration-processors',
          message.id
        );
      }
    } catch (error) {
      logger.error('Error processing collaboration suggestions:', error);
    }
  }

  /**
   * Process collaboration status events
   */
  private async processCollaborationStatus(): Promise<void> {
    try {
      const messages = await this.streamsService.readMessages(
        'collaboration:status',
        'collaboration-processors',
        this.config.consumerName,
        this.config.batchSize,
        1000
      );

      for (const message of messages) {
        await this.handleCollaborationStatus(message);
        await this.streamsService.ackMessage(
          'collaboration:status',
          'collaboration-processors',
          message.id
        );
      }
    } catch (error) {
      logger.error('Error processing collaboration status:', error);
    }
  }

  /**
   * Handle collaboration reasoning event
   */
  private async handleCollaborationReasoning(message: any): Promise<void> {
    const { goalId, stepId, text, confidence, context } = message.fields;
    
    logger.info(`[Collaboration] Reasoning event for goal ${goalId}`, {
      stepId,
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      confidence: parseFloat(confidence),
      context: context ? JSON.parse(context) : undefined
    });

    // Here you can add additional processing logic for reasoning events
    // For example: store in database, send notifications, etc.
  }

  /**
   * Handle collaboration suggestion event
   */
  private async handleCollaborationSuggestion(message: any): Promise<void> {
    const { goalId, stepId, suggestion, action, confidence, fromAgent, toAgent } = message.fields;
    
    logger.info(`[Collaboration] Suggestion event for goal ${goalId}`, {
      stepId,
      suggestion: suggestion.substring(0, 100) + (suggestion.length > 100 ? '...' : ''),
      action,
      confidence: parseFloat(confidence),
      fromAgent,
      toAgent
    });

    // Here you can add additional processing logic for suggestion events
    // For example: store in database, send notifications, etc.
  }

  /**
   * Handle collaboration status event
   */
  private async handleCollaborationStatus(message: any): Promise<void> {
    const { goalId, stepId, status, progress, meta } = message.fields;
    
    logger.info(`[Collaboration] Status event for goal ${goalId}`, {
      stepId,
      status,
      progress: progress ? parseFloat(progress) : undefined,
      meta: meta ? JSON.parse(meta) : undefined
    });

    // Here you can add additional processing logic for status events
    // For example: update UI state, send notifications, etc.
  }
}
