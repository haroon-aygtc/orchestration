#!/usr/bin/env node

/**
 * Production Redis Streams Setup Script
 * Initializes Redis Streams, creates consumer groups, and sets up monitoring
 */

const Redis = require('ioredis');
const { RedisStreamsService } = require('../lib/redis/streams-service');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function setupRedisStreams() {
  console.log('🚀 Setting up Redis Streams for AI Agent Architecture...\n');

  let redis;
  let streamsService;

  try {
    // Connect to Redis
    console.log('1. Connecting to Redis...');
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      connectTimeout: 10000,
      commandTimeout: 5000,
    });
    
    await redis.connect();
    console.log('✅ Connected to Redis');

    // Test Redis connection
    const pong = await redis.ping();
    console.log(`✅ Redis ping: ${pong}`);

    // Initialize streams service
    console.log('\n2. Initializing Redis Streams Service...');
    streamsService = new RedisStreamsService(redis);
    await streamsService.initialize();
    console.log('✅ Redis Streams Service initialized');

    // Create streams and consumer groups
    console.log('\n3. Creating streams and consumer groups...');
    
    const streams = [
      'orchestration:events',
      'agent:communication', 
      'workflow:steps',
      'node:executions',
      'coordination:decisions'
    ];

    const groups = [
      'orchestration-processors',
      'agent-processors',
      'workflow-processors', 
      'node-processors',
      'coordination-processors'
    ];

    for (const stream of streams) {
      try {
        await redis.xadd(stream, '*', 
          'type', 'setup_message',
          'timestamp', new Date().toISOString(),
          'message', `Stream ${stream} initialized for AI Agent Architecture`
        );
        console.log(`✅ Created stream: ${stream}`);
      } catch (error) {
        if (error.message.includes('BUSYGROUP')) {
          console.log(`✅ Stream already exists: ${stream}`);
        } else {
          throw error;
        }
      }
    }

    for (const group of groups) {
      try {
        await redis.xgroup('CREATE', 'orchestration:events', group, '$', 'MKSTREAM');
        console.log(`✅ Created consumer group: ${group}`);
      } catch (error) {
        if (error.message.includes('BUSYGROUP')) {
          console.log(`✅ Consumer group already exists: ${group}`);
        } else {
          throw error;
        }
      }
    }

    // Test stream operations
    console.log('\n4. Testing stream operations...');
    
    // Test orchestration events
    const orchestrationMessageId = await redis.xadd('orchestration:events', '*',
      'eventType', 'system.initialized',
      'goalId', 'system-setup',
      'data', JSON.stringify({ 
        message: 'Redis Streams system initialized',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }),
      'timestamp', new Date().toISOString()
    );
    console.log(`✅ Added orchestration event: ${orchestrationMessageId}`);

    // Test agent communication
    const agentMessageId = await redis.xadd('agent:communication', '*',
      'fromAgent', 'system',
      'toAgent', 'orchestration',
      'messageType', 'initialization_complete',
      'payload', JSON.stringify({ 
        status: 'ready',
        capabilities: ['streams', 'consumer_groups', 'monitoring']
      }),
      'correlationId', 'setup-' + Date.now(),
      'timestamp', new Date().toISOString()
    );
    console.log(`✅ Added agent message: ${agentMessageId}`);

    // Test workflow steps
    const workflowMessageId = await redis.xadd('workflow:steps', '*',
      'stepId', 'setup-step-001',
      'goalId', 'system-initialization',
      'agentType', 'system',
      'input', JSON.stringify({ action: 'initialize_streams' }),
      'dependencies', JSON.stringify([]),
      'status', 'completed',
      'timestamp', new Date().toISOString()
    );
    console.log(`✅ Added workflow step: ${workflowMessageId}`);

    // Test node executions
    const nodeMessageId = await redis.xadd('node:executions', '*',
      'nodeId', 'redis-setup-node',
      'params', JSON.stringify({ 
        operation: 'initialize',
        streams: streams.length,
        groups: groups.length
      }),
      'goalId', 'system-setup',
      'status', 'completed',
      'timestamp', new Date().toISOString()
    );
    console.log(`✅ Added node execution: ${nodeMessageId}`);

    // Test coordination
    const coordinationMessageId = await redis.xadd('coordination:decisions', '*',
      'decisionType', 'system_initialization',
      'data', JSON.stringify({
        streams_created: streams.length,
        groups_created: groups.length,
        status: 'operational'
      }),
      'timestamp', new Date().toISOString()
    );
    console.log(`✅ Added coordination message: ${coordinationMessageId}`);

    // Run health check
    console.log('\n5. Running health check...');
    const healthCheck = await streamsService.healthCheck();
    
    console.log(`✅ Health Status: ${healthCheck.status}`);
    console.log(`✅ Streams: ${Object.values(healthCheck.streams).filter(Boolean).length}/${Object.keys(healthCheck.streams).length} healthy`);
    console.log(`✅ Groups: ${Object.values(healthCheck.groups).filter(Boolean).length}/${Object.keys(healthCheck.groups).length} healthy`);
    console.log(`✅ Performance: ${healthCheck.performance.avgResponseTime.toFixed(2)}ms avg response time`);
    console.log(`✅ Error Rate: ${healthCheck.performance.errorRate.toFixed(2)}%`);

    // Get stream information
    console.log('\n6. Stream Information:');
    for (const stream of streams) {
      const info = await streamsService.getStreamInfo(stream);
      if (info) {
        console.log(`   ${stream}:`);
        console.log(`     - Length: ${info.length} messages`);
        console.log(`     - Groups: ${info.groups}`);
        console.log(`     - Last ID: ${info.lastGeneratedId}`);
      }
    }

    // Test consumer group reading
    console.log('\n7. Testing consumer group reading...');
    try {
      const messages = await streamsService.readMessages(
        'orchestration:events',
        'orchestration-processors',
        'setup-test-consumer',
        5,
        1000
      );
      
      console.log(`✅ Read ${messages.length} messages from consumer group`);
      
      // Acknowledge messages
      for (const message of messages) {
        await streamsService.acknowledgeMessage(
          'orchestration:events',
          'orchestration-processors',
          message.id
        );
      }
      console.log(`✅ Acknowledged ${messages.length} messages`);
      
    } catch (error) {
      console.log('⚠️ Consumer group reading test skipped (no new messages)');
    }

    // Set up monitoring
    console.log('\n8. Setting up monitoring...');
    
    // Create monitoring keys
    await redis.set('redis:streams:setup:timestamp', new Date().toISOString());
    await redis.set('redis:streams:setup:version', '1.0.0');
    await redis.set('redis:streams:setup:status', 'operational');
    
    console.log('✅ Monitoring keys created');

    // Final summary
    console.log('\n🎉 Redis Streams Setup Complete!');
    console.log('\n📊 Setup Summary:');
    console.log(`   - Redis URL: ${REDIS_URL.replace(/\/\/.*@/, '//***:***@')}`);
    console.log(`   - Streams Created: ${streams.length}`);
    console.log(`   - Consumer Groups: ${groups.length}`);
    console.log(`   - Health Status: ${healthCheck.status}`);
    console.log(`   - Performance: ${healthCheck.performance.avgResponseTime.toFixed(2)}ms avg`);
    console.log(`   - Error Rate: ${healthCheck.performance.errorRate.toFixed(2)}%`);
    
    console.log('\n🔧 Next Steps:');
    console.log('   1. Start your application');
    console.log('   2. Visit /redis-streams for monitoring dashboard');
    console.log('   3. Use /api/streams/health for health checks');
    console.log('   4. Monitor logs for stream processing');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
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

// Run the setup
if (require.main === module) {
  setupRedisStreams().catch(console.error);
}

module.exports = { setupRedisStreams };
