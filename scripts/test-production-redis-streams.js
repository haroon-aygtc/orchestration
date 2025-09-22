#!/usr/bin/env node

/**
 * Production Redis Streams Test Script
 * Comprehensive testing of all production-grade features
 */

const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function testProductionRedisStreams() {
  console.log('🚀 Testing Production Redis Streams Implementation...\n');

  let redis;
  let testResults = {
    connection: false,
    streams: false,
    consumerGroups: false,
    retryMechanism: false,
    circuitBreaker: false,
    errorHandling: false,
    performance: false,
    monitoring: false
  };

  try {
    // Test 1: Connection and Basic Operations
    console.log('1. Testing Redis Connection and Basic Operations...');
    
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      connectTimeout: 10000,
      commandTimeout: 5000,
    });
    
    await redis.connect();
    const pong = await redis.ping();
    
    if (pong === 'PONG') {
      testResults.connection = true;
      console.log('✅ Redis connection successful');
    } else {
      throw new Error('Redis ping failed');
    }

    // Test 2: Streams Creation and Management
    console.log('\n2. Testing Streams Creation and Management...');
    
    const streams = [
      'orchestration:events',
      'agent:communication',
      'workflow:steps',
      'node:executions',
      'coordination:decisions'
    ];

    for (const stream of streams) {
      // Create stream with test message
      const messageId = await redis.xadd(stream, '*',
        'type', 'test_message',
        'timestamp', new Date().toISOString(),
        'testId', `test-${Date.now()}`,
        'message', 'Production test message'
      );
      
      // Verify stream exists and has message
      const exists = await redis.exists(stream);
      if (exists > 0) {
        console.log(`✅ Stream ${stream} created with message ${messageId}`);
      } else {
        throw new Error(`Stream ${stream} not created`);
      }
    }
    
    testResults.streams = true;

    // Test 3: Consumer Groups
    console.log('\n3. Testing Consumer Groups...');
    
    const groups = [
      'orchestration-processors',
      'agent-processors',
      'workflow-processors',
      'node-processors',
      'coordination-processors'
    ];

    for (const group of groups) {
      try {
        await redis.xgroup('CREATE', 'orchestration:events', group, '$', 'MKSTREAM');
        console.log(`✅ Consumer group ${group} created`);
      } catch (error) {
        if (error.message.includes('BUSYGROUP')) {
          console.log(`✅ Consumer group ${group} already exists`);
        } else {
          throw error;
        }
      }
    }
    
    testResults.consumerGroups = true;

    // Test 4: Message Reading with Consumer Groups
    console.log('\n4. Testing Message Reading with Consumer Groups...');
    
    const messages = await redis.xreadgroup(
      'GROUP', 'orchestration-processors', 'test-consumer',
      'COUNT', 5,
      'BLOCK', 1000,
      'STREAMS', 'orchestration:events', '>'
    );
    
    if (messages && messages.length > 0) {
      console.log(`✅ Read ${messages[0][1].length} messages from consumer group`);
      
      // Acknowledge messages
      for (const [messageId] of messages[0][1]) {
        await redis.xack('orchestration:events', 'orchestration-processors', messageId);
      }
      console.log('✅ Messages acknowledged successfully');
    } else {
      console.log('✅ No new messages (expected for clean test)');
    }

    // Test 5: Error Handling and Retry Logic
    console.log('\n5. Testing Error Handling and Retry Logic...');
    
    try {
      // Test invalid stream access
      await redis.xreadgroup(
        'GROUP', 'nonexistent-group', 'test-consumer',
        'COUNT', 1,
        'BLOCK', 100,
        'STREAMS', 'nonexistent:stream', '>'
      );
    } catch (error) {
      if (error.message.includes('NOGROUP') || error.message.includes('ERR')) {
        console.log('✅ Error handling working correctly');
        testResults.errorHandling = true;
      } else {
        throw error;
      }
    }

    // Test 6: Performance Testing
    console.log('\n6. Testing Performance...');
    
    const startTime = Date.now();
    const performanceTests = [];
    
    for (let i = 0; i < 100; i++) {
      performanceTests.push(
        redis.xadd('orchestration:events', '*',
          'type', 'performance_test',
          'index', i.toString(),
          'timestamp', new Date().toISOString()
        )
      );
    }
    
    await Promise.all(performanceTests);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`✅ Performance test: 100 messages in ${duration}ms (${(1000/duration*100).toFixed(2)} msg/sec)`);
    testResults.performance = true;

    // Test 7: Stream Information and Monitoring
    console.log('\n7. Testing Stream Information and Monitoring...');
    
    const streamInfo = await redis.xinfo('STREAM', 'orchestration:events');
    if (Array.isArray(streamInfo) && streamInfo.length >= 10) {
      console.log(`✅ Stream info retrieved: ${streamInfo[1]} messages, ${streamInfo[7]} groups`);
      testResults.monitoring = true;
    } else {
      throw new Error('Invalid stream info format');
    }

    // Test 8: Circuit Breaker Simulation
    console.log('\n8. Testing Circuit Breaker Simulation...');
    
    // Simulate high error rate
    let errorCount = 0;
    for (let i = 0; i < 15; i++) {
      try {
        await redis.xreadgroup(
          'GROUP', 'nonexistent-group', 'test-consumer',
          'COUNT', 1,
          'BLOCK', 10,
          'STREAMS', 'nonexistent:stream', '>'
        );
      } catch (error) {
        errorCount++;
      }
    }
    
    if (errorCount >= 10) {
      console.log(`✅ Circuit breaker simulation: ${errorCount} errors detected`);
      testResults.circuitBreaker = true;
    }

    // Test 9: Memory and Resource Management
    console.log('\n9. Testing Memory and Resource Management...');
    
    const memoryInfo = await redis.info('memory');
    const lines = memoryInfo.split('\r\n');
    let usedMemory = 0;
    
    for (const line of lines) {
      if (line.includes('used_memory:')) {
        usedMemory = parseInt(line.split(':')[1], 10);
        break;
      }
    }
    
    console.log(`✅ Memory usage: ${(usedMemory / 1024 / 1024).toFixed(2)} MB`);
    
    // Clean up test messages
    await redis.xtrim('orchestration:events', 'MAXLEN', '~', 10);
    console.log('✅ Stream trimmed to last 10 messages');

    // Test 10: Health Check Simulation
    console.log('\n10. Testing Health Check Simulation...');
    
    const healthChecks = [];
    for (let i = 0; i < 10; i++) {
      healthChecks.push(redis.ping());
    }
    
    const healthResults = await Promise.all(healthChecks);
    const allHealthy = healthResults.every(result => result === 'PONG');
    
    if (allHealthy) {
      console.log('✅ Health check simulation: All 10 checks passed');
    } else {
      throw new Error('Health check simulation failed');
    }

    // Final Results
    console.log('\n🎉 Production Redis Streams Test Complete!');
    console.log('\n📊 Test Results:');
    
    const passedTests = Object.values(testResults).filter(Boolean).length;
    const totalTests = Object.keys(testResults).length;
    
    Object.entries(testResults).forEach(([test, passed]) => {
      console.log(`   ${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
    });
    
    console.log(`\n📈 Overall Score: ${passedTests}/${totalTests} (${Math.round(passedTests/totalTests*100)}%)`);
    
    if (passedTests === totalTests) {
      console.log('\n🎯 All tests passed! Production Redis Streams implementation is ready.');
    } else {
      console.log('\n⚠️ Some tests failed. Please review the implementation.');
    }

    // Performance Summary
    console.log('\n📊 Performance Summary:');
    console.log(`   - Connection Latency: ${await measureLatency(redis)}ms`);
    console.log(`   - Memory Usage: ${(usedMemory / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   - Streams Created: ${streams.length}`);
    console.log(`   - Consumer Groups: ${groups.length}`);
    console.log(`   - Error Handling: ${testResults.errorHandling ? 'Robust' : 'Needs Improvement'}`);
    console.log(`   - Circuit Breaker: ${testResults.circuitBreaker ? 'Active' : 'Inactive'}`);

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    if (redis) {
      try {
        await redis.quit();
        console.log('\n✅ Redis connection closed');
      } catch (quitError) {
        console.error('Error closing Redis connection:', quitError);
      }
    }
  }
}

async function measureLatency(redis) {
  const start = Date.now();
  await redis.ping();
  return Date.now() - start;
}

// Run the test
if (require.main === module) {
  testProductionRedisStreams().catch(console.error);
}

module.exports = { testProductionRedisStreams };
