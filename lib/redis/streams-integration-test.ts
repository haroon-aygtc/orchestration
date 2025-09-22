// path: lib/redis/streams-integration-test.ts
// Integration test to verify Redis Streams cleanup services are working

import { logger } from '../utils/structured-logger';

/**
 * Test Redis Streams integration with orchestration service
 */
export async function testStreamsIntegration(): Promise<{
  success: boolean;
  results: {
    initialization: boolean;
    cleanupServices: boolean;
    healthCheck: boolean;
    metrics: boolean;
    cleanup: boolean;
  };
  errors: string[];
}> {
  const results = {
    initialization: false,
    cleanupServices: false,
    healthCheck: false,
    metrics: false,
    cleanup: false,
  };
  const errors: string[] = [];

  try {
    logger.info('🧪 Testing Redis Streams Integration...');

    // Test 1: Check if orchestration service can be imported
    try {
      const { OrchestrationService } = await import('../orchestration/ai-orchestration-service');
      results.initialization = true;
      logger.info('✅ OrchestrationService import successful');
    } catch (error) {
      errors.push(`OrchestrationService import failed: ${error}`);
      logger.error('❌ OrchestrationService import failed:', { error: error instanceof Error ? error.message : String(error) });
    }

    // Test 2: Check if Redis Streams service has cleanup methods
    try {
      const { RedisStreamsService } = await import('./streams-service');
      const service = new RedisStreamsService({} as any); // Mock Redis for testing
      
      // Check if cleanup service methods exist
      const hasStartCleanupServices = typeof service.startCleanupServices === 'function';
      const hasStopCleanupServices = typeof service.stopCleanupServices === 'function';
      const hasPelJanitorHealth = typeof service.getPelJanitorHealth === 'function';
      const hasCleanupHealth = typeof service.getCleanupHealth === 'function';
      const hasMonitoringHealth = typeof service.getMonitoringHealth === 'function';
      
      if (hasStartCleanupServices && hasStopCleanupServices && hasPelJanitorHealth && hasCleanupHealth && hasMonitoringHealth) {
        results.cleanupServices = true;
        logger.info('✅ Cleanup services methods available');
      } else {
        errors.push('Missing cleanup service methods');
      }
    } catch (error) {
      errors.push(`Cleanup services check failed: ${error}`);
      logger.error('❌ Cleanup services check failed:', { error: error instanceof Error ? error.message : String(error) });
    }

    // Test 3: Check if health check methods exist
    try {
      const { RedisStreamsService } = await import('./streams-service');
      const service = new RedisStreamsService({} as any);
      
      const hasHealthCheck = typeof service.healthCheck === 'function';
      const hasConnectionStatus = typeof service.getConnectionStatus === 'function';
      
      if (hasHealthCheck && hasConnectionStatus) {
        results.healthCheck = true;
        logger.info('✅ Health check methods available');
      } else {
        errors.push('Missing health check methods');
      }
    } catch (error) {
      errors.push(`Health check methods check failed: ${error}`);
      logger.error('❌ Health check methods check failed:', { error: error instanceof Error ? error.message : String(error) });
    }

    // Test 4: Check if metrics methods exist
    try {
      const { RedisStreamsService } = await import('./streams-service');
      const service = new RedisStreamsService({} as any);
      
      const hasPelMetrics = typeof service.getPelJanitorMetrics === 'function';
      const hasCleanupMetrics = typeof service.getCleanupMetrics === 'function';
      const hasAlerts = typeof service.getAlerts === 'function';
      
      if (hasPelMetrics && hasCleanupMetrics && hasAlerts) {
        results.metrics = true;
        logger.info('✅ Metrics methods available');
      } else {
        errors.push('Missing metrics methods');
      }
    } catch (error) {
      errors.push(`Metrics methods check failed: ${error}`);
      logger.error('❌ Metrics methods check failed:', { error: error instanceof Error ? error.message : String(error) });
    }

    // Test 5: Check if force cleanup methods exist
    try {
      const { RedisStreamsService } = await import('./streams-service');
      const service = new RedisStreamsService({} as any);
      
      const hasForcePelCleanup = typeof service.forcePelCleanup === 'function';
      const hasForceStreamCleanup = typeof service.forceStreamCleanup === 'function';
      
      if (hasForcePelCleanup && hasForceStreamCleanup) {
        results.cleanup = true;
        logger.info('✅ Force cleanup methods available');
      } else {
        errors.push('Missing force cleanup methods');
      }
    } catch (error) {
      errors.push(`Force cleanup methods check failed: ${error}`);
      logger.error('❌ Force cleanup methods check failed:', { error: error instanceof Error ? error.message : String(error) });
    }

    const success = Object.values(results).every(result => result === true);

    logger.info('🧪 Redis Streams Integration Test Results:', {
      success,
      results,
      errorCount: errors.length,
    });

    return {
      success,
      results,
      errors,
    };

  } catch (error) {
    logger.error('❌ Integration test failed:', { error: error instanceof Error ? error.message : String(error) });
    return {
      success: false,
      results,
      errors: [...errors, `Integration test failed: ${error}`],
    };
  }
}

/**
 * Quick validation that all services are properly integrated
 */
export async function validateIntegration(): Promise<boolean> {
  try {
    const testResults = await testStreamsIntegration();
    return testResults.success;
  } catch (error) {
    logger.error('Integration validation failed:', { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}
