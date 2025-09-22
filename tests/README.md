# AI Agent Architecture - Test Suite

This directory contains comprehensive unit and integration tests for the AI Agent Architecture system.

## Test Structure

```
tests/
├── unit/                    # Unit tests for individual components
│   ├── code-generator.test.ts
│   ├── workflow-builder.test.ts
│   └── runtime-execution.test.ts
├── integration/             # Integration tests for system components
│   ├── redis-streams.test.ts
│   └── prebuilt-nodes.test.ts
├── setup.ts                 # Jest setup configuration
├── global-setup.ts          # Global test setup
├── global-teardown.ts       # Global test teardown
├── integration-setup.ts     # Integration test setup
└── README.md               # This file
```

## Test Categories

### Unit Tests

- **Code Generator Tests** (`code-generator.test.ts`)
  - YAML workflow configuration generation
  - Agent code generation
  - Error handling and validation
  - Special character handling

- **Workflow Builder Tests** (`workflow-builder.test.ts`)
  - YAML definition generation
  - Execution plan building
  - Workflow validation
  - Dependency resolution

- **Runtime Execution Tests** (`runtime-execution.test.ts`)
  - Tool registry operations
  - Runtime detection
  - Structured logging
  - Error handling and recovery

### Integration Tests

- **Redis Streams Tests** (`redis-streams.test.ts`)
  - Redis Streams service operations
  - Worker management
  - Message processing
  - Error recovery and circuit breakers

- **Pre-built Nodes Tests** (`prebuilt-nodes.test.ts`)
  - Node registry operations
  - AI-powered node selection
  - Node composition
  - API endpoint integration

## Running Tests

### Prerequisites

```bash
# Install dependencies
npm install

# Install Jest and testing dependencies
npm install --save-dev jest @jest/globals ts-jest babel-jest
```

### Test Commands

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npx jest tests/unit/code-generator.test.ts

# Run tests with verbose output
npx jest --verbose
```

### Test Configuration

The test suite uses Jest with the following configuration:

- **Test Environment**: Node.js
- **TypeScript Support**: ts-jest
- **Coverage Thresholds**: 80% for branches, functions, lines, and statements
- **Timeout**: 30 seconds for unit tests, 60 seconds for integration tests
- **Mocking**: Comprehensive mocking of external dependencies

## Test Features

### Custom Jest Matchers

- `toBeValidYAML()` - Validates YAML structure
- `toBeValidJSON()` - Validates JSON structure
- `toHaveValidStructure()` - Validates object structure

### Mocking Strategy

- **External Services**: Redis, AI services, databases
- **Next.js APIs**: Request/Response objects
- **File System**: File operations
- **Network**: HTTP requests

### Error Testing

- Network failures
- Invalid inputs
- Timeout scenarios
- Resource exhaustion
- Malformed data

### Performance Testing

- Execution time validation
- Concurrent operation handling
- Memory usage monitoring
- Resource cleanup verification

## Test Data

### Mock Data

- Sample workflow definitions
- Test agent configurations
- Mock Redis responses
- Simulated API responses

### Test Fixtures

- Valid workflow steps
- Invalid input scenarios
- Error conditions
- Edge cases

## Coverage Reports

Coverage reports are generated in the `coverage/` directory:

- **HTML Report**: `coverage/lcov-report/index.html`
- **LCOV Report**: `coverage/lcov.info`
- **Text Report**: Console output

## Continuous Integration

The test suite is designed to run in CI/CD environments:

```yaml
# Example GitHub Actions workflow
- name: Run Tests
  run: |
    npm install
    npm run test:coverage
```

## Debugging Tests

### Debug Mode

```bash
# Run tests with debug output
npx jest --verbose --no-cache

# Run specific test with debug
npx jest tests/unit/code-generator.test.ts --verbose
```

### Common Issues

1. **Timeout Errors**: Increase timeout in Jest config
2. **Mock Issues**: Check mock implementations
3. **Environment Variables**: Ensure test env vars are set
4. **Dependencies**: Verify all dependencies are installed

## Test Maintenance

### Adding New Tests

1. Create test file in appropriate directory
2. Follow naming convention: `*.test.ts`
3. Import required dependencies
4. Write comprehensive test cases
5. Update this documentation

### Updating Mocks

1. Update mock implementations in setup files
2. Ensure mocks match actual interfaces
3. Test mock behavior
4. Update documentation

### Performance Considerations

- Use `beforeEach` and `afterEach` for cleanup
- Mock expensive operations
- Use `jest.useFakeTimers()` for time-dependent tests
- Clean up resources after tests

## Best Practices

1. **Test Isolation**: Each test should be independent
2. **Clear Naming**: Use descriptive test names
3. **Comprehensive Coverage**: Test happy path, error cases, and edge cases
4. **Mock Appropriately**: Mock external dependencies, not internal logic
5. **Assertions**: Use specific assertions, not generic ones
6. **Cleanup**: Always clean up resources after tests
7. **Documentation**: Document complex test scenarios

## Troubleshooting

### Common Error Messages

- **"Cannot find module"**: Check import paths and dependencies
- **"Timeout exceeded"**: Increase timeout or optimize test
- **"Mock not working"**: Check mock setup and implementation
- **"Coverage below threshold"**: Add more test cases

### Getting Help

1. Check Jest documentation
2. Review test setup files
3. Check mock implementations
4. Verify environment configuration
5. Review error logs and stack traces
