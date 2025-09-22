// jest.config.js
const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './', // path to your Next.js app root
});

const customJestConfig = {
  testEnvironment: 'node',

  testMatch: ['**/tests/**/*.test.(ts|tsx|js|jsx)'],

  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@/lib/(.*)$': '<rootDir>/lib/$1',
    '^@/components/(.*)$': '<rootDir>/components/$1',
    '^@/app/(.*)$': '<rootDir>/app/$1',
  },

  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

  // IMPORTANT: allowlist ESM deps that need transforming (uuid is the one failing)
  transformIgnorePatterns: [
    '/node_modules/(?!(uuid|@ai-sdk|ai|ajv|async-retry|axios|dotenv|ioredis|nodemailer|pg|pino|socket\\.io|yaml|zod)/)',
  ],

  // Let Jest resolve proper exports for ESM packages
  testEnvironmentOptions: {
    customExportConditions: ['node', 'require', 'default'],
  },

  testTimeout: 60000,
  verbose: true,
  clearMocks: true,
  restoreMocks: true,
  errorOnDeprecated: true,
  maxWorkers: 1,
  cache: false,

};

module.exports = createJestConfig(customJestConfig);
