# Pre-built Nodes System

A production-grade, standalone pre-built nodes system that provides intelligent node selection, composition, and execution capabilities for AI workflows.

## 🚀 Features

### Core Capabilities

- **Node Registry**: Centralized management of pre-built nodes with rich metadata
- **AI-Powered Selection**: Intelligent node selection based on goals and context
- **Node Composition**: Create complex workflows by connecting multiple nodes
- **Performance Tracking**: Real-time performance metrics and monitoring
- **Input Validation**: Comprehensive parameter validation with detailed error reporting
- **Backward Compatibility**: Seamless integration with existing tool registry

### Production Features

- **Zero Breaking Changes**: Fully backward compatible with existing orchestration system
- **Error Handling**: Comprehensive error handling and graceful fallbacks
- **Performance Monitoring**: Real-time execution metrics and success rate tracking
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **API Integration**: RESTful API endpoints for external integration

## 📁 Architecture

```
lib/nodes/
├── types.ts              # TypeScript type definitions
├── registry.ts           # Node registry and management
├── selection-service.ts  # AI-powered node selection
└── README.md            # This documentation

app/api/nodes/
├── route.ts             # Main nodes API endpoint
└── [nodeId]/route.ts    # Individual node operations

components/nodes/
└── node-explorer.tsx    # React component for node exploration
```

## 🔧 Usage

### Basic Node Operations

```typescript
import { nodeRegistry } from "@/lib/nodes/registry";
import { nodeSelectionService } from "@/lib/nodes/selection-service";

// Get all available nodes
const allNodes = nodeRegistry.getAllNodes();

// Search nodes by criteria
const dataNodes = nodeRegistry.searchNodes({
  category: "data",
  complexity: "simple",
  tags: ["csv", "parsing"],
});

// Execute a node
const result = await nodeRegistry.executeNode("node_csv_parse", {
  filePath: "/path/to/file.csv",
  delimiter: ",",
  hasHeader: true,
});

// Validate node inputs
const validation = await nodeRegistry.validateNode("node_csv_parse", {
  filePath: "/path/to/file.csv",
});
```

### AI-Powered Node Selection

```typescript
// Select nodes for a specific goal
const selectedNodes = await nodeSelectionService.selectNodesForGoal(
  "Parse CSV data and send email notification",
  { filePath: "/data/sales.csv", recipient: "manager@company.com" }
);

// Suggest node composition
const composition = await nodeSelectionService.suggestNodeComposition(
  "Data processing pipeline",
  { inputFormat: "csv", outputFormat: "json" }
);
```

### Node Composition

```typescript
// Create a node composition
const compositionId = await orchestrationService.createNodeComposition({
  name: "Data Processing Pipeline",
  description: "Parse CSV, validate data, and send results",
  nodes: [
    {
      nodeId: "node_csv_parse",
      position: { x: 0, y: 0 },
      parameters: { delimiter: "," },
      enabled: true,
    },
    {
      nodeId: "node_json_validate",
      position: { x: 200, y: 0 },
      parameters: {},
      enabled: true,
    },
    {
      nodeId: "node_email_sender",
      position: { x: 400, y: 0 },
      parameters: { to: "admin@company.com" },
      enabled: true,
    },
  ],
  connections: [
    {
      from: { stepId: "step_0", output: "data" },
      to: { stepId: "step_1", input: "jsonString" },
    },
    {
      from: { stepId: "step_1", output: "valid" },
      to: { stepId: "step_2", input: "body" },
    },
  ],
});

// Execute the composition
const result = await orchestrationService.executeNodeComposition(
  compositionId,
  { filePath: "/data/input.csv" }
);
```

## 🔌 API Endpoints

### GET /api/nodes

Fetch all available nodes with optional filtering.

**Query Parameters:**

- `category`: Filter by node category
- `tags`: Comma-separated list of tags
- `complexity`: Filter by complexity level
- `text`: Search in name, description, and tags

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "node_csv_parse",
      "name": "CSV Parse",
      "category": "data",
      "description": "Parse CSV files into structured data",
      "inputs": [...],
      "outputs": [...],
      "metadata": {...}
    }
  ],
  "count": 11
}
```

### POST /api/nodes

Execute various node operations.

**Actions:**

- `execute`: Execute a node with parameters
- `validate`: Validate node input parameters
- `suggest-composition`: Get AI-suggested node composition
- `select-for-goal`: Get AI-selected nodes for a goal

### GET /api/nodes/[nodeId]

Get detailed information about a specific node.

### POST /api/nodes/[nodeId]

Execute operations on a specific node.

## 🎯 Node Categories

### Data Processing

- **CSV Parse**: Parse CSV files into structured data
- **PDF Parse**: Extract text and metadata from PDF files
- **JSON Validate**: Validate JSON data against schemas
- **Data Analyzer**: Analyze and summarize datasets

### Integration

- **HTTP Request**: Make HTTP requests to external APIs
- **Webhook Trigger**: Trigger webhooks with custom payloads
- **Database Query**: Execute database queries
- **File Operations**: Read and write files

### Communication

- **Email Sender**: Send emails with attachments
- **Slack Notify**: Send notifications to Slack channels

### Workflow

- **Custom Nodes**: Extensible node system for custom functionality

## 📊 Performance Metrics

Each node tracks comprehensive performance metrics:

```typescript
interface PerformanceMetrics {
  averageExecutionTime: number; // Average execution time in ms
  memoryUsage: number; // Memory usage in bytes
  successRate: number; // Success rate (0-1)
  errorRate: number; // Error rate (0-1)
  lastExecuted: Date; // Last execution timestamp
  executionCount: number; // Total execution count
}
```

## 🔒 Security & Validation

### Input Validation

- **Type Checking**: Automatic type validation for all inputs
- **Required Fields**: Validation of required parameters
- **Range Validation**: Min/max value validation
- **Pattern Matching**: Regex pattern validation
- **Enum Validation**: Value must be from allowed list

### Security Features

- **Parameter Sanitization**: Automatic sanitization of user inputs
- **Error Handling**: Comprehensive error handling without data leakage
- **Rate Limiting**: Built-in rate limiting for API endpoints
- **Authentication**: Integration with existing authentication system

## 🚀 Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the Development Server

```bash
npm run dev
```

### 3. Access the Node Explorer

Navigate to `http://localhost:3000/nodes` to explore the node system.

### 4. Test the System

```bash
node scripts/test-node-system.js
```

## 🔧 Configuration

### Environment Variables

```env
# AI Configuration
OPENAI_API_KEY=your_openai_key
GROQ_API_KEY=your_groq_key

# Database
DATABASE_URL=your_database_url

# Redis
REDIS_URL=redis://localhost:6379
```

### Node Registry Configuration

The node registry automatically initializes from existing tools. To add custom nodes:

```typescript
import { nodeRegistry } from '@/lib/nodes/registry';

const customNode = {
  id: 'node_custom',
  name: 'Custom Node',
  category: 'workflow',
  version: '1.0.0',
  description: 'Custom functionality',
  inputs: [...],
  outputs: [...],
  implementation: {
    execute: async (params) => {
      // Custom implementation
      return { success: true, data: result };
    }
  },
  metadata: {...}
};

nodeRegistry.register(customNode);
```

## 📈 Monitoring & Analytics

### Real-time Metrics

- **Execution Count**: Track how many times each node is executed
- **Success Rate**: Monitor node reliability
- **Performance**: Track execution times and memory usage
- **Error Tracking**: Monitor and categorize errors

### Integration with Orchestration Service

The node system integrates seamlessly with the existing orchestration service:

- **Enhanced Planning**: AI-powered node selection in workflow planning
- **Improved Execution**: Enhanced tool execution with validation and monitoring
- **Better Error Handling**: Comprehensive error reporting and recovery
- **Performance Optimization**: Automatic performance-based node selection

## 🤝 Contributing

### Adding New Nodes

1. Define the node structure in `types.ts`
2. Implement the node in `registry.ts`
3. Add input/output definitions
4. Include comprehensive tests
5. Update documentation

### Testing

```bash
# Run all tests
npm test

# Run node system tests
npm run test:nodes

# Run integration tests
npm run test:integration
```

## 📚 Examples

### Example 1: Data Processing Pipeline

```typescript
// Select nodes for data processing
const nodes = await nodeSelectionService.selectNodesForGoal(
  'Process sales data and generate report',
  { filePath: '/data/sales.csv', format: 'pdf' }
);

// Create composition
const composition = await orchestrationService.createNodeComposition({
  name: 'Sales Report Generator',
  description: 'Process sales data and generate PDF report',
  nodes: [
    { nodeId: 'node_csv_parse', parameters: { delimiter: ',' } },
    { nodeId: 'node_data_analyzer', parameters: { analysisType: 'summary' } },
    { nodeId: 'node_pdf_parse', parameters: { extractText: true } }
  ],
  connections: [...]
});

// Execute pipeline
const result = await orchestrationService.executeNodeComposition(
  composition,
  { filePath: '/data/sales.csv' }
);
```

### Example 2: API Integration

```typescript
// Make HTTP request and process response
const httpResult = await nodeRegistry.executeNode('node_http_request', {
  url: 'https://api.example.com/data',
  method: 'GET',
  headers: { 'Authorization': 'Bearer token' }
});

// Process the response
const processedData = await nodeRegistry.executeNode('node_json_validate', {
  jsonString: JSON.stringify(httpResult.data),
  schema: { type: 'object', properties: {...} }
});
```

## 🎉 Conclusion

The pre-built nodes system provides a powerful, production-ready foundation for building complex AI workflows. With intelligent node selection, comprehensive validation, and seamless integration with existing systems, it enables rapid development of sophisticated automation solutions.

For more information, see the [API Documentation](./API.md) and [Examples](./examples/).
