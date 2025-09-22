#!/usr/bin/env node

/**
 * Environment Validation Script for AI Agent Architecture System
 * This script validates all environment variables and configuration
 */

require('dotenv').config();

function validateEnvironment() {
  console.log('🔍 Validating Environment Configuration\n');

  const results = {
    valid: true,
    errors: [],
    warnings: [],
    info: []
  };

  // Required variables
  const required = [
    { name: 'DATABASE_URL', description: 'Database connection string' },
    { name: 'NODE_ENV', description: 'Node environment' }
  ];

  // Optional but recommended variables
  const optional = [
    { name: 'OPENAI_API_KEY', description: 'OpenAI API key for AI functionality' },
    { name: 'ANTHROPIC_API_KEY', description: 'Anthropic API key for AI functionality' },
    { name: 'GROQ_API_KEY', description: 'Groq API key for AI functionality' },
    { name: 'SMTP_HOST', description: 'SMTP server hostname' },
    { name: 'SMTP_USER', description: 'SMTP username/email' },
    { name: 'SMTP_PASS', description: 'SMTP password' },
    { name: 'SLACK_WEBHOOK_URL', description: 'Slack webhook URL' },
    { name: 'WEBHOOK_SECRET', description: 'Webhook security secret' }
  ];

  // Check required variables
  console.log('📋 Required Variables:');
  required.forEach(({ name, description }) => {
    if (process.env[name]) {
      console.log(`   ✅ ${name}: ${maskValue(process.env[name])}`);
      results.info.push(`${name}: Configured`);
    } else {
      console.log(`   ❌ ${name}: Missing - ${description}`);
      results.errors.push(`${name}: Required but missing`);
      results.valid = false;
    }
  });

  // Check optional variables
  console.log('\n📋 Optional Variables:');
  optional.forEach(({ name, description }) => {
    if (process.env[name]) {
      console.log(`   ✅ ${name}: ${maskValue(process.env[name])}`);
      results.info.push(`${name}: Configured`);
    } else {
      console.log(`   ⚠️  ${name}: Not set - ${description}`);
      results.warnings.push(`${name}: Not configured`);
    }
  });

  // Validate specific configurations
  console.log('\n🔧 Configuration Validation:');

  // Database URL validation
  if (process.env.DATABASE_URL) {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('file:')) {
      console.log('   ✅ DATABASE_URL: Valid format');
    } else {
      console.log('   ❌ DATABASE_URL: Invalid format (should start with postgresql:// or file:)');
      results.errors.push('DATABASE_URL: Invalid format');
      results.valid = false;
    }
  }

  // AI Provider validation
  const aiProviders = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GROQ_API_KEY'];
  const configuredProviders = aiProviders.filter(key => process.env[key]);
  
  if (configuredProviders.length === 0) {
    console.log('   ⚠️  No AI providers configured - AI features will not work');
    results.warnings.push('No AI providers configured');
  } else {
    console.log(`   ✅ AI Providers: ${configuredProviders.length} configured`);
  }

  // SMTP validation
  const smtpVars = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];
  const smtpConfigured = smtpVars.filter(key => process.env[key]);
  
  if (smtpConfigured.length === 0) {
    console.log('   ⚠️  SMTP not configured - Email features will not work');
    results.warnings.push('SMTP not configured');
  } else if (smtpConfigured.length < 3) {
    console.log('   ❌ SMTP partially configured - Email features will not work');
    results.errors.push('SMTP partially configured');
    results.valid = false;
  } else {
    console.log('   ✅ SMTP: Fully configured');
  }

  // Port validation
  const port = parseInt(process.env.PORT || '3000');
  if (port > 0 && port < 65536) {
    console.log(`   ✅ PORT: ${port} (valid)`);
  } else {
    console.log(`   ❌ PORT: ${port} (invalid - should be 1-65535)`);
    results.errors.push('PORT: Invalid port number');
    results.valid = false;
  }

  // Log level validation
  const validLogLevels = ['error', 'warn', 'info', 'debug'];
  const logLevel = process.env.LOG_LEVEL || 'info';
  if (validLogLevels.includes(logLevel)) {
    console.log(`   ✅ LOG_LEVEL: ${logLevel} (valid)`);
  } else {
    console.log(`   ❌ LOG_LEVEL: ${logLevel} (invalid - should be one of: ${validLogLevels.join(', ')})`);
    results.errors.push('LOG_LEVEL: Invalid log level');
    results.valid = false;
  }

  // Summary
  console.log('\n📊 Validation Summary:');
  console.log(`   Errors: ${results.errors.length}`);
  console.log(`   Warnings: ${results.warnings.length}`);
  console.log(`   Info: ${results.info.length}`);
  
  if (results.valid) {
    console.log('\n🎉 Environment validation passed!');
    if (results.warnings.length > 0) {
      console.log('⚠️  Some optional features may not be available due to missing configuration.');
    }
  } else {
    console.log('\n❌ Environment validation failed!');
    console.log('Please fix the errors above before running the application.');
  }

  // Recommendations
  console.log('\n💡 Recommendations:');
  
  if (configuredProviders.length === 0) {
    console.log('   - Configure at least one AI provider (OpenAI, Anthropic, or Groq)');
  }
  
  if (smtpConfigured.length < 3) {
    console.log('   - Configure SMTP settings for email functionality');
  }
  
  if (!process.env.SLACK_WEBHOOK_URL) {
    console.log('   - Configure Slack webhook for notifications');
  }
  
  if (!process.env.WEBHOOK_SECRET) {
    console.log('   - Set a webhook secret for security');
  }

  return results;
}

function maskValue(value) {
  if (!value) return 'Not set';
  if (value.length <= 8) return '***';
  return value.substring(0, 4) + '***' + value.substring(value.length - 4);
}

// Run validation
const results = validateEnvironment();
process.exit(results.valid ? 0 : 1);
