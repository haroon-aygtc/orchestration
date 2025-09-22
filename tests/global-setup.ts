/**
 * Global Jest Setup
 * Runs once before all tests
 */

// Jest globals are available in test environment

export default async function globalSetup() {
  console.log('🚀 Starting global test setup...');

  // Set up test environment variables using simple assignment
  // This works better with newer Jest versions
  if (!process.env.NODE_ENV) {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'test', writable: true });
  }
  if (!process.env.REDIS_URL) {
    process.env.REDIS_URL = 'redis://localhost:6379';
  }
  if (!process.env.WEBHOOK_SECRET_KEY) {
    process.env.WEBHOOK_SECRET_KEY = 'test-secret-key';
  }
  if (!process.env.ALLOWED_DOMAINS) {
    process.env.ALLOWED_DOMAINS = 'localhost,127.0.0.1,test.example.com';
  }

  // Set other test environment variables
  process.env.MAX_REQUEST_SIZE = '10485760';
  process.env.RATE_LIMIT_WINDOW_MS = '900000';
  process.env.RATE_LIMIT_MAX_REQUESTS = '100';
  process.env.CORS_ORIGINS = 'http://localhost:3000,http://localhost:3001';

  // Additional test environment variables
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/testdb';
  process.env.SMTP_HOST = 'localhost';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_USER = 'test@example.com';
  process.env.SMTP_PASS = 'testpass';
  process.env.SLACK_BOT_TOKEN = 'test-slack-token';
  process.env.TOOL_CACHE_MAX_SIZE = '100';
  process.env.TOOL_CACHE_DEFAULT_TTL = '300000';
  process.env.TOOL_DEFAULT_TIMEOUT = '30000';

  // Mocks should be in individual test files, not global setup
  console.log('✅ Global test setup completed');
}