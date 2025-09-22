// Test setup file
import { jest } from '@jest/globals';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock environment variables
Object.defineProperty(process.env, 'NODE_ENV', { value: 'test', writable: true });
process.env.LLM_MAX_TOKENS_PER_CORRELATION = '1000';
process.env.LLM_MAX_COST_PER_CORRELATION = '1.0';