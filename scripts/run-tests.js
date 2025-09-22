#!/usr/bin/env node
/**
 * Test Runner Script
 * Comprehensive test execution with coverage and reporting
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Test configuration
const testConfig = {
  unit: {
    pattern: 'tests/unit',
    timeout: 30000,
    coverage: true
  },
  integration: {
    pattern: 'tests/integration',
    timeout: 60000,
    coverage: true
  },
  all: {
    pattern: 'tests',
    timeout: 60000,
    coverage: true
  }
};

// Parse command line arguments
const args = process.argv.slice(2);
const testType = args[0] || 'all';
const watchMode = args.includes('--watch');
const verbose = args.includes('--verbose');
const coverage = args.includes('--coverage') || !args.includes('--no-coverage');

// Validate test type
if (!testConfig[testType]) {
  console.error(`${colors.red}Error: Invalid test type '${testType}'${colors.reset}`);
  console.error(`Available types: ${Object.keys(testConfig).join(', ')}`);
  process.exit(1);
}

// Check if Jest is installed
const isWindows = process.platform === 'win32';
const jestBinaryName = isWindows ? 'jest.CMD' : 'jest';
const jestPath = path.join(process.cwd(), 'node_modules', '.bin', jestBinaryName);
if (!fs.existsSync(jestPath)) {
  console.error(`${colors.red}Error: Jest not found. Please install dependencies first.${colors.reset}`);
  console.error('Run: npm install');
  process.exit(1);
}

// Build Jest command
const jestArgs = [
  '--config', 'jest.config.js',
  '--testPathPatterns', testConfig[testType].pattern,
  '--testTimeout', testConfig[testType].timeout.toString()
];

if (watchMode) {
  jestArgs.push('--watch');
}

if (verbose) {
  jestArgs.push('--verbose');
}

if (coverage) {
  jestArgs.push('--coverage');
  jestArgs.push('--coverageReporters', 'text', 'lcov', 'html');
}

// Add additional Jest arguments
const additionalArgs = args.filter(arg => 
  !['--watch', '--verbose', '--coverage', '--no-coverage'].includes(arg) && 
  arg !== testType
);

jestArgs.push(...additionalArgs);

// Display test information
console.log(`${colors.cyan}${colors.bright}🧪 AI Agent Architecture Test Runner${colors.reset}`);
console.log(`${colors.blue}Test Type:${colors.reset} ${testType}`);
console.log(`${colors.blue}Pattern:${colors.reset} ${testConfig[testType].pattern}`);
console.log(`${colors.blue}Timeout:${colors.reset} ${testConfig[testType].timeout}ms`);
console.log(`${colors.blue}Watch Mode:${colors.reset} ${watchMode ? 'Yes' : 'No'}`);
console.log(`${colors.blue}Coverage:${colors.reset} ${coverage ? 'Yes' : 'No'}`);
console.log(`${colors.blue}Verbose:${colors.reset} ${verbose ? 'Yes' : 'No'}`);
console.log('');

// Run Jest
let jestProcess;
if (isWindows) {
  // Use exec for Windows to handle CMD files properly
  const { exec } = require('child_process');
  const command = `${JSON.stringify(jestPath)} ${jestArgs.join(' ')}`;
  jestProcess = exec(command, {
    stdio: 'inherit',
    cwd: process.cwd()
  });
} else {
  // Use spawn for Unix systems
  jestProcess = spawn(jestPath, jestArgs, {
    stdio: 'inherit',
    cwd: process.cwd()
  });
}

// Handle process events
jestProcess.on('close', (code) => {
  if (code === 0) {
    console.log(`${colors.green}${colors.bright}✅ Tests completed successfully!${colors.reset}`);
    
    if (coverage) {
      console.log(`${colors.cyan}📊 Coverage report generated in coverage/ directory${colors.reset}`);
    }
  } else {
    console.log(`${colors.red}${colors.bright}❌ Tests failed with exit code ${code}${colors.reset}`);
    process.exit(code);
  }
});

jestProcess.on('error', (error) => {
  console.error(`${colors.red}Error running tests:${colors.reset}`, error);
  process.exit(1);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log(`${colors.yellow}${colors.bright}⏹️  Stopping tests...${colors.reset}`);
  jestProcess.kill('SIGINT');
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error(`${colors.red}Uncaught Exception:${colors.reset}`, error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`${colors.red}Unhandled Rejection at:${colors.reset}`, promise, 'reason:', reason);
  process.exit(1);
});
