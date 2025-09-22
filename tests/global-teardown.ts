// tests/global-teardown.ts
/**
 * Global Jest Teardown
 * Runs once after all tests
 */

export default async function globalTeardown() {
  console.log('🧹 Starting global test teardown...');
  
  // Clean up any global resources
  if (global.gc) {
    global.gc();
  }
  
  // Clear all timers
  if (typeof globalThis !== 'undefined' && (globalThis as any).jest) {
    (globalThis as any).jest.clearAllTimers();
  }
  
  // Reset environment variables (skip read-only properties)
  try {
    delete (process.env as any).REDIS_URL;
    delete (process.env as any).WEBHOOK_SECRET_KEY;
    delete (process.env as any).ALLOWED_DOMAINS;
    delete (process.env as any).MAX_REQUEST_SIZE;
    delete (process.env as any).RATE_LIMIT_WINDOW_MS;
    delete (process.env as any).RATE_LIMIT_MAX_REQUESTS;
    delete (process.env as any).CORS_ORIGINS;
  } catch (error) {
    // Ignore errors when deleting environment variables
  }
  
  console.log('✅ Global test teardown completed');
}
