// path: lib/redis/streams-production-test.ts
// Production-grade Redis Streams testing and validation
// Comprehensive tests for all implemented features

import Redis from 'ioredis';
import { RedisStreamsService } from './streams-service';
import { ProductionRedisStreamsManager } from './streams-production-example';
import { logger } from '../utils/structured-logger';

export interface TestResults {
  passed: number;
  failed: number;
  total: number;
  duration: number;
  errors: string[];
  details: Array<{
    test: string;
    status: 'passed' | 'failed';
    duration: number;
    error?: string;
  }>;
}

export class StreamsProductionTester {
  private manager: ProductionRedisStreamsManager;
  private streamsService: RedisStreamsService;
  private testResults: TestResults;

  constructor(redisConfig: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  }) {
    this.manager = new ProductionRedisStreamsManager(redisConfig);
    this.streamsService = this.manager.getStreamsService();
    this.testResults = {
      passed: 0,
      failed: 0,
      total: 0,
      duration: 0,
      errors: [],
      details: [],
    };
  }

  /**
   * Run all production tests
   */
  async runAllTests(): Promise<TestResults> {
    const startTime = Date.now();
    logger.info('🧪 Starting Production Redis Streams Tests...');

    try {
      // Initialize the system
      await this.manager.initialize();

      // Run all test suites
      await this.testBasicFunctionality();
      await this.testPelJanitor();
      await this.testStreamCleanup();
      await this.testMonitoring();
      await this.testErrorHandling();
      await this.testPerformance();
      await this.testIntegration();

      this.testResults.duration = Date.now() - startTime;
      this.testResults.total = this.testResults.passed + this.testResults.failed;

      logger.info('✅ Production Redis Streams Tests completed', {
        passed: this.testResults.passed,
        failed: this.testResults.failed,
        total: this.testResults.total,
        duration: this.testResults.duration,
      });

      return this.testResults;

    } catch (error) {
      logger.error('❌ Test suite failed:', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      // Cleanup
      await this.manager.shutdown();
    }
  }

  /**
   * Test basic Redis Streams functionality
   */
  private async testBasicFunctionality(): Promise<void> {
    const testName = 'Basic Functionality';
    const startTime = Date.now();

    try {
      // Test connection
      const connectionStatus = await this.streamsService.getConnectionStatus();
      this.assert(connectionStatus.connected, 'Redis connection should be established');

      // Test health check
      const healthCheck = await this.streamsService.healthCheck();
      this.assert(healthCheck.status === 'healthy', 'Health check should return healthy status');

      // Test adding messages
      const eventId = await this.streamsService.addOrchestrationEvent('goal_started', {
        goalId: 'test-goal-123',
        stepId: 'step-1',
        data: { message: 'Test goal started' },
      });
      this.assert(!!eventId, 'Should be able to add orchestration event');

      const messageId = await this.streamsService.addAgentMessage(
        'agent-1',
        'agent-2',
        'test_message',
        { content: 'Test message' },
        'test-correlation-123'
      );
      this.assert(!!messageId, 'Should be able to add agent message');

      const reasoningId = await this.streamsService.addReasoningEvent(
        'test-goal-123',
        'Test reasoning process',
        0.8,
        'step-1',
        { context: 'test' }
      );
      this.assert(!!reasoningId, 'Should be able to add reasoning event');

      this.recordTest(testName, 'passed', Date.now() - startTime);

    } catch (error) {
      this.recordTest(testName, 'failed', Date.now() - startTime, error);
    }
  }

  /**
   * Test PEL Janitor functionality
   */
  private async testPelJanitor(): Promise<void> {
    const testName = 'PEL Janitor';
    const startTime = Date.now();

    try {
      // Get PEL Janitor health
      const pelHealth = this.streamsService.getPelJanitorHealth();
      this.assert(!!pelHealth, 'PEL Janitor health should be available');
      this.assert(pelHealth?.isRunning, 'PEL Janitor should be running');

      // Get PEL Janitor metrics
      const pelMetrics = this.streamsService.getPelJanitorMetrics();
      this.assert(!!pelMetrics, 'PEL Janitor metrics should be available');

      // Force PEL cleanup
      const cleanupResult = await this.streamsService.forcePelCleanup();
      this.assert(!!cleanupResult, 'Force PEL cleanup should return results');

      this.recordTest(testName, 'passed', Date.now() - startTime);

    } catch (error) {
      this.recordTest(testName, 'failed', Date.now() - startTime, error);
    }
  }

  /**
   * Test Stream Cleanup functionality
   */
  private async testStreamCleanup(): Promise<void> {
    const testName = 'Stream Cleanup';
    const startTime = Date.now();

    try {
      // Get cleanup health
      const cleanupHealth = await this.streamsService.getCleanupHealth();
      this.assert(!!cleanupHealth, 'Cleanup health should be available');
      this.assert(cleanupHealth?.isRunning, 'Cleanup service should be running');

      // Get cleanup metrics
      const cleanupMetrics = this.streamsService.getCleanupMetrics();
      this.assert(!!cleanupMetrics, 'Cleanup metrics should be available');

      // Force stream cleanup
      const cleanupResult = await this.streamsService.forceStreamCleanup();
      this.assert(!!cleanupResult, 'Force stream cleanup should return results');

      this.recordTest(testName, 'passed', Date.now() - startTime);

    } catch (error) {
      this.recordTest(testName, 'failed', Date.now() - startTime, error);
    }
  }

  /**
   * Test Monitoring functionality
   */
  private async testMonitoring(): Promise<void> {
    const testName = 'Monitoring';
    const startTime = Date.now();

    try {
      // Get monitoring health
      const monitoringHealth = this.streamsService.getMonitoringHealth();
      this.assert(!!monitoringHealth, 'Monitoring health should be available');
      this.assert(monitoringHealth?.isRunning, 'Monitoring service should be running');

      // Get alerts
      const alerts = this.streamsService.getAlerts();
      this.assert(Array.isArray(alerts), 'Alerts should be an array');

      const activeAlerts = this.streamsService.getActiveAlerts();
      this.assert(Array.isArray(activeAlerts), 'Active alerts should be an array');

      // Test alert resolution
      if (activeAlerts.length > 0) {
        const alertId = activeAlerts[0].id;
        const resolved = this.streamsService.resolveAlert(alertId);
        this.assert(resolved, 'Should be able to resolve alerts');
      }

      this.recordTest(testName, 'passed', Date.now() - startTime);

    } catch (error) {
      this.recordTest(testName, 'failed', Date.now() - startTime, error);
    }
  }

  /**
   * Test error handling
   */
  private async testErrorHandling(): Promise<void> {
    const testName = 'Error Handling';
    const startTime = Date.now();

    try {
      // Test invalid stream operations
      try {
        await this.streamsService.addOrchestrationEvent('invalid_event' as any, {
          goalId: '', // Empty goal ID should be handled gracefully
          stepId: 'step-1',
          data: {},
        });
      } catch (error) {
        // Expected to fail gracefully
      }

      // Test invalid message operations
      try {
        await this.streamsService.addAgentMessage('', '', '', {});
      } catch (error) {
        // Expected to fail gracefully
      }

      // Test system health under error conditions
      const systemHealth = await this.manager.getSystemHealth();
      this.assert(!!systemHealth, 'System health should be available even with errors');

      this.recordTest(testName, 'passed', Date.now() - startTime);

    } catch (error) {
      this.recordTest(testName, 'failed', Date.now() - startTime, error);
    }
  }

  /**
   * Test performance characteristics
   */
  private async testPerformance(): Promise<void> {
    const testName = 'Performance';
    const startTime = Date.now();

    try {
      const messageCount = 100;
      const startTime = Date.now();

      // Add multiple messages rapidly
      const promises = Array.from({ length: messageCount }, (_, i) =>
        this.streamsService.addOrchestrationEvent('performance_test', {
          goalId: `perf-goal-${i}`,
          stepId: `step-${i}`,
          data: { index: i, timestamp: Date.now() },
        })
      );

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      this.assert(results.length === messageCount, 'All messages should be added');
      this.assert(duration < 5000, 'Performance should be acceptable (< 5 seconds for 100 messages');

      // Test cleanup performance
      const cleanupStart = Date.now();
      const cleanupResult = await this.manager.forceCleanup();
      const cleanupDuration = Date.now() - cleanupStart;

      this.assert(!!cleanupResult, 'Cleanup should complete successfully');
      this.assert(cleanupDuration < 10000, 'Cleanup should be reasonably fast (< 10 seconds)');

      this.recordTest(testName, 'passed', Date.now() - startTime);

    } catch (error) {
      this.recordTest(testName, 'failed', Date.now() - startTime, error);
    }
  }

  /**
   * Test integration between all services
   */
  private async testIntegration(): Promise<void> {
    const testName = 'Integration';
    const startTime = Date.now();

    try {
      // Test complete system health
      const systemHealth = await this.manager.getSystemHealth();
      this.assert(!!systemHealth, 'System health should be available');
      this.assert(systemHealth.status !== 'critical', 'System should not be in critical state');

      // Test production metrics
      const productionMetrics = await this.manager.getProductionMetrics();
      this.assert(!!productionMetrics, 'Production metrics should be available');

      // Test all services are running
      this.assert(!!systemHealth.streams, 'Streams health should be available');
      this.assert(!!systemHealth.pel, 'PEL health should be available');
      this.assert(!!systemHealth.cleanup, 'Cleanup health should be available');
      this.assert(!!systemHealth.monitoring, 'Monitoring health should be available');

      this.recordTest(testName, 'passed', Date.now() - startTime);

    } catch (error) {
      this.recordTest(testName, 'failed', Date.now() - startTime, error);
    }
  }

  /**
   * Assert a condition and throw if false
   */
  private assert(condition: boolean, message: string): void {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  /**
   * Record a test result
   */
  private recordTest(testName: string, status: 'passed' | 'failed', duration: number, error?: any): void {
    this.testResults.details.push({
      test: testName,
      status,
      duration,
      error: error instanceof Error ? error.message : String(error),
    });

    if (status === 'passed') {
      this.testResults.passed++;
      logger.info(`✅ ${testName} passed (${duration}ms)`);
    } else {
      this.testResults.failed++;
      this.testResults.errors.push(`${testName}: ${error instanceof Error ? error.message : String(error)}`);
      logger.error(`❌ ${testName} failed (${duration}ms):`, error);
    }
  }
}

/**
 * Run production tests
 */
export async function runProductionTests(redisConfig: {
  host: string;
  port: number;
  password?: string;
  db?: number;
}): Promise<TestResults> {
  const tester = new StreamsProductionTester(redisConfig);
  return await tester.runAllTests();
}

/**
 * Quick validation test
 */
export async function quickValidation(redisConfig: {
  host: string;
  port: number;
  password?: string;
  db?: number;
}): Promise<boolean> {
  try {
    const manager = new ProductionRedisStreamsManager(redisConfig);
    await manager.initialize();

    const health = await manager.getSystemHealth();
    const isHealthy = health.status === 'healthy' || health.status === 'warning';

    await manager.shutdown();
    return isHealthy;

  } catch (error) {
    logger.error('Quick validation failed:', error);
    return false;
  }
}
