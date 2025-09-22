# Production-Grade Redis Streams Implementation

A complete, production-ready Redis Streams system with automatic cleanup, PEL management, and comprehensive monitoring for AI agent architectures.

## 🚀 Features

### ✅ **Automatic Stream Cleanup**

- **Memory Management**: Prevents unlimited stream growth
- **Configurable Limits**: Per-stream maximum lengths
- **Aggressive Cleanup**: Automatic memory threshold detection
- **Background Processing**: Non-blocking cleanup operations

### ✅ **PEL (Pending Entries List) Management**

- **Abandoned Message Recovery**: Auto-claims stuck messages from crashed workers
- **Worker Crash Recovery**: Automatic recovery from worker failures
- **Message Reprocessing**: Optional reprocessing of abandoned messages
- **Redis Version Compatibility**: Supports Redis 6.2+ with fallback for older versions

### ✅ **Comprehensive Monitoring**

- **Real-time Metrics**: Stream health, PEL counts, memory usage
- **Alert System**: Configurable thresholds with warning/critical alerts
- **Analytics**: Stream growth rates, message throughput
- **Health Dashboards**: Complete system health visibility

### ✅ **Production-Grade Features**

- **Error Handling**: Comprehensive error handling and recovery
- **Retry Logic**: Exponential backoff with configurable limits
- **Circuit Breakers**: Automatic failure detection and recovery
- **Graceful Shutdown**: Clean resource cleanup
- **Performance Optimization**: Efficient memory and CPU usage

## 📁 File Structure

```
lib/redis/
├── streams-service.ts              # Main Redis Streams service
├── streams-pel-janitor.ts         # PEL management service
├── streams-cleanup-service.ts     # Automatic stream cleanup
├── streams-monitoring-service.ts  # Comprehensive monitoring
├── streams-production-example.ts  # Production usage example
├── streams-production-test.ts     # Complete test suite
└── README.md                      # This documentation
```

## 🛠️ Quick Start

### 1. Basic Setup

```typescript
import { ProductionRedisStreamsManager } from "./lib/redis/streams-production-example";

// Create manager with Redis configuration
const manager = new ProductionRedisStreamsManager({
  host: "localhost",
  port: 6379,
  password: "your-password", // optional
  db: 0, // optional
});

// Initialize with all services
await manager.initialize();

// Get streams service for your application
const streamsService = manager.getStreamsService();
```

### 2. Using Streams Service

```typescript
// Add orchestration events
await streamsService.addOrchestrationEvent("goal_started", {
  goalId: "goal-123",
  stepId: "step-1",
  data: { message: "Goal started" },
});

// Add agent communication
await streamsService.addAgentMessage(
  "agent-1",
  "agent-2",
  "task_assignment",
  { task: "Process data" },
  "correlation-123"
);

// Add collaboration reasoning
await streamsService.addReasoningEvent(
  "goal-123",
  "I need to analyze the user input",
  0.8,
  "step-1",
  { context: "user-request" }
);
```

### 3. Monitoring and Health

```typescript
// Get system health
const health = await manager.getSystemHealth();
console.log("System Status:", health.status);
console.log("Active Alerts:", health.alerts.length);

// Get production metrics
const metrics = await manager.getProductionMetrics();
console.log("Memory Usage:", metrics.streams.memory);
console.log("PEL Count:", metrics.pel.totalPending);

// Force cleanup (for testing)
const cleanupResult = await manager.forceCleanup();
console.log("Cleanup Results:", cleanupResult);
```

## 🔧 Configuration

### PEL Janitor Configuration

```typescript
await manager.initialize({
  pelJanitor: {
    minIdleMs: 30000, // 30 seconds before claiming
    batchSize: 50, // Process 50 messages at a time
    intervalMs: 2000, // Check every 2 seconds
    processor: async (msg) => {
      // Custom processing for abandoned messages
      console.log("Processing abandoned message:", msg.id);
    },
  },
});
```

### Stream Cleanup Configuration

```typescript
await manager.initialize({
  cleanup: {
    intervalMs: 300000, // 5 minutes between cleanups
    minAgeMs: 60000, // 1 minute minimum age
    aggressiveCleanup: true,
    memoryThresholdBytes: 100 * 1024 * 1024, // 100MB
  },
});
```

### Monitoring Configuration

```typescript
await manager.initialize({
  monitoring: {
    collectionIntervalMs: 30000, // 30 seconds
    enableAnalytics: true,
    thresholds: {
      streamLengthWarning: 70, // 70% of max length
      streamLengthCritical: 90, // 90% of max length
      pelWarning: 100, // 100 pending messages
      pelCritical: 500, // 500 pending messages
      memoryWarning: 50 * 1024 * 1024, // 50MB
      memoryCritical: 100 * 1024 * 1024, // 100MB
    },
    onAlert: (alert) => {
      console.log("Alert triggered:", alert.message);
    },
  },
});
```

## 📊 Monitoring and Alerts

### Health Status

```typescript
const health = await manager.getSystemHealth();

// Overall system status
console.log("Status:", health.status); // 'healthy' | 'warning' | 'critical'

// Individual service health
console.log("Streams:", health.streams.status);
console.log("PEL Janitor:", health.pel.isRunning);
console.log("Cleanup:", health.cleanup.isRunning);
console.log("Monitoring:", health.monitoring.isRunning);

// Active alerts
health.alerts.forEach((alert) => {
  console.log(`${alert.type.toUpperCase()}: ${alert.message}`);
});
```

### Metrics Collection

```typescript
const metrics = await manager.getProductionMetrics();

// Stream analytics
metrics.streams.forEach((stream) => {
  console.log(
    `${stream.name}: ${stream.length}/${stream.maxLength} (${stream.usagePercent}%)`
  );
});

// PEL metrics
console.log("Total Pending:", metrics.pel.totalPending);
console.log("Janitor Health:", metrics.pel.janitorHealth.isRunning);

// Cleanup metrics
console.log("Total Trims:", metrics.cleanup.totalTrims);
console.log("Bytes Freed:", metrics.cleanup.bytesFreed);
```

## 🧪 Testing

### Run Complete Test Suite

```typescript
import { runProductionTests } from "./lib/redis/streams-production-test";

const results = await runProductionTests({
  host: "localhost",
  port: 6379,
});

console.log(`Tests: ${results.passed}/${results.total} passed`);
console.log(`Duration: ${results.duration}ms`);
```

### Quick Validation

```typescript
import { quickValidation } from "./lib/redis/streams-production-test";

const isValid = await quickValidation({
  host: "localhost",
  port: 6379,
});

console.log("System is healthy:", isValid);
```

## 🔄 Graceful Shutdown

```typescript
import { setupGracefulShutdown } from "./lib/redis/streams-production-example";

// Setup graceful shutdown handlers
setupGracefulShutdown(manager);

// Or manual shutdown
await manager.shutdown();
```

## 📈 Performance Characteristics

### Memory Usage

- **Stream Limits**: 10,000 messages per stream (configurable)
- **Automatic Cleanup**: Prevents memory growth
- **Memory Monitoring**: Real-time memory usage tracking

### Throughput

- **Message Processing**: 100+ messages/second
- **Cleanup Operations**: Non-blocking background processing
- **PEL Recovery**: Automatic abandoned message recovery

### Reliability

- **Error Handling**: Comprehensive error recovery
- **Retry Logic**: Exponential backoff with circuit breakers
- **Health Monitoring**: Real-time system health tracking

## 🚨 Alert Types

### Stream Alerts

- **Length Warning**: Stream approaching capacity (70%)
- **Length Critical**: Stream at capacity (90%)
- **Memory Warning**: High memory usage (50MB)
- **Memory Critical**: Critical memory usage (100MB)

### PEL Alerts

- **PEL Warning**: High pending message count (100)
- **PEL Critical**: Critical pending message count (500)

### Performance Alerts

- **Response Time**: Slow Redis operations
- **Error Rate**: High error rates
- **Throughput**: Low message throughput

## 🔧 Troubleshooting

### Common Issues

1. **High Memory Usage**
   - Check stream lengths: `manager.getSystemHealth()`
   - Force cleanup: `manager.forceCleanup()`
   - Adjust cleanup thresholds

2. **Stuck Messages**
   - Check PEL counts: `streamsService.getPelJanitorMetrics()`
   - Force PEL cleanup: `streamsService.forcePelCleanup()`
   - Check worker health

3. **Performance Issues**
   - Monitor metrics: `manager.getProductionMetrics()`
   - Check Redis connection: `streamsService.getConnectionStatus()`
   - Review alert thresholds

### Debug Mode

```typescript
// Enable detailed logging
process.env.LOG_LEVEL = "debug";

// Check individual service health
const pelHealth = streamsService.getPelJanitorHealth();
const cleanupHealth = await streamsService.getCleanupHealth();
const monitoringHealth = streamsService.getMonitoringHealth();
```

## 📚 API Reference

### RedisStreamsService

#### Core Methods

- `initialize()`: Initialize streams and consumer groups
- `startCleanupServices()`: Start all cleanup services
- `stopCleanupServices()`: Stop all cleanup services
- `cleanup()`: Graceful shutdown

#### Message Operations

- `addOrchestrationEvent()`: Add orchestration events
- `addAgentMessage()`: Add agent communication
- `addReasoningEvent()`: Add collaboration reasoning
- `addStatusEvent()`: Add status updates
- `addSuggestionEvent()`: Add suggestions

#### Monitoring

- `getPelJanitorHealth()`: PEL janitor health
- `getCleanupHealth()`: Cleanup service health
- `getMonitoringHealth()`: Monitoring service health
- `getAlerts()`: All alerts
- `getActiveAlerts()`: Active alerts only

### ProductionRedisStreamsManager

#### Management

- `initialize()`: Initialize complete system
- `getSystemHealth()`: Overall system health
- `getProductionMetrics()`: Production metrics
- `forceCleanup()`: Manual cleanup trigger
- `shutdown()`: Graceful shutdown

## 🎯 Best Practices

### 1. **Configuration**

- Set appropriate stream limits based on your use case
- Configure cleanup intervals based on message volume
- Set alert thresholds based on your requirements

### 2. **Monitoring**

- Monitor system health regularly
- Set up alert notifications
- Review metrics and adjust thresholds

### 3. **Error Handling**

- Implement proper error handling in your application
- Use retry logic for transient failures
- Monitor error rates and patterns

### 4. **Performance**

- Test with your expected message volume
- Monitor memory usage and adjust limits
- Use appropriate batch sizes for processing

### 5. **Maintenance**

- Regular health checks
- Monitor cleanup effectiveness
- Review and adjust configurations

## 🔒 Security Considerations

- **Redis Authentication**: Use strong passwords
- **Network Security**: Secure Redis connections
- **Access Control**: Limit Redis access
- **Monitoring**: Monitor for suspicious activity

## 📝 License

This implementation is part of the AI Agent Architecture project and follows the same licensing terms.

---

**🎉 You now have a complete, production-grade Redis Streams system with automatic cleanup, PEL management, and comprehensive monitoring!**
