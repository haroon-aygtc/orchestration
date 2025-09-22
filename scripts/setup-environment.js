#!/usr/bin/env node

/**
 * Environment Setup Script for AI Agent Architecture System
 * This script helps set up the environment configuration and test SMTP
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function setupEnvironment() {
  console.log('🚀 AI Agent Architecture - Environment Setup\n');
  
  // Check if .env already exists
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const overwrite = await question('⚠️  .env file already exists. Overwrite? (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('❌ Setup cancelled.');
      process.exit(0);
    }
  }

  console.log('📋 Let\'s set up your environment configuration:\n');

  // Database configuration
  console.log('🗄️  DATABASE CONFIGURATION');
  const dbType = await question('Database type (postgresql/sqlite) [postgresql]: ') || 'postgresql';
  
  let databaseUrl;
  if (dbType === 'sqlite') {
    databaseUrl = 'file:./dev.db';
  } else {
    const dbHost = await question('PostgreSQL host [localhost]: ') || 'localhost';
    const dbPort = await question('PostgreSQL port [5432]: ') || '5432';
    const dbName = await question('Database name [ai_agent_orchestration]: ') || 'ai_agent_orchestration';
    const dbUser = await question('Database username [postgres]: ') || 'postgres';
    const dbPass = await question('Database password: ');
    databaseUrl = `postgresql://${dbUser}:${dbPass}@${dbHost}:${dbPort}/${dbName}`;
  }

  // AI Provider configuration
  console.log('\n🤖 AI PROVIDER CONFIGURATION');
  const openaiKey = await question('OpenAI API Key (optional): ');
  const anthropicKey = await question('Anthropic API Key (optional): ');
  const groqKey = await question('Groq API Key (optional): ');
  
  const defaultProvider = await question('Default AI Provider (openai/anthropic/groq) [groq]: ') || 'groq';

  // Email configuration
  console.log('\n📧 EMAIL CONFIGURATION');
  const smtpHost = await question('SMTP Host [smtp.gmail.com]: ') || 'smtp.gmail.com';
  const smtpPort = await question('SMTP Port [587]: ') || '587';
  const smtpUser = await question('SMTP Username/Email: ');
  const smtpPass = await question('SMTP Password/App Password: ');

  // Webhook configuration
  console.log('\n🔗 WEBHOOK CONFIGURATION');
  const slackWebhook = await question('Slack Webhook URL (optional): ');
  const webhookSecret = await question('Webhook Secret [auto-generated]: ') || generateSecret();

  // Generate .env file
  const envContent = generateEnvFile({
    databaseUrl,
    openaiKey,
    anthropicKey,
    groqKey,
    defaultProvider,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    slackWebhook,
    webhookSecret
  });

  fs.writeFileSync(envPath, envContent);
  console.log('\n✅ Environment configuration saved to .env');

  // Test SMTP if configured
  if (smtpUser && smtpPass) {
    const testEmail = await question('\n📧 Test email configuration? (y/N): ');
    if (testEmail.toLowerCase() === 'y') {
      await testSMTP(smtpHost, smtpPort, smtpUser, smtpPass);
    }
  }

  console.log('\n🎉 Environment setup complete!');
  console.log('\n📋 Next steps:');
  console.log('1. Run: npm run dev');
  console.log('2. Visit: http://localhost:3000');
  console.log('3. Test the system with: npm run test:system');
  
  rl.close();
}

function generateEnvFile(config) {
  return `# ===========================================
# AI Agent Architecture System - Environment Configuration
# Generated on ${new Date().toISOString()}
# ===========================================

# Application Settings
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Database Configuration
DATABASE_URL=${config.databaseUrl}

# AI Provider Configuration
${config.openaiKey ? `OPENAI_API_KEY=${config.openaiKey}` : '# OPENAI_API_KEY=sk-your-openai-api-key-here'}
OPENAI_MODEL=gpt-4o-mini
${config.anthropicKey ? `ANTHROPIC_API_KEY=${config.anthropicKey}` : '# ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key-here'}
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
${config.groqKey ? `GROQ_API_KEY=${config.groqKey}` : '# GROQ_API_KEY=gsk_your-groq-api-key-here'}
GROQ_MODEL=llama-3.1-8b-instant
AI_PROVIDER=${config.defaultProvider}

# Email Configuration
SMTP_HOST=${config.smtpHost}
SMTP_PORT=${config.smtpPort}
SMTP_USER=${config.smtpUser}
SMTP_PASS=${config.smtpPass}

# Webhook Configuration
${config.slackWebhook ? `SLACK_WEBHOOK_URL=${config.slackWebhook}` : '# SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'}
WEBHOOK_SECRET=${config.webhookSecret}

# Security Configuration
JWT_SECRET=${generateSecret()}
ENCRYPTION_KEY=${generateSecret()}

# Development Settings
DEBUG=ai-agent:*
CACHE_ENABLED=false
`;
}

function generateSecret() {
  return require('crypto').randomBytes(32).toString('base64');
}

async function testSMTP(host, port, user, pass) {
  console.log('\n🧪 Testing SMTP configuration...');
  
  try {
    const nodemailer = require('nodemailer');
    
    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(port),
      secure: port === '465',
      auth: { user, pass },
      tls: { rejectUnauthorized: false }
    });

    // Verify connection
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully');

    // Send test email
    const testEmail = await question('Test email recipient: ');
    if (testEmail) {
      const info = await transporter.sendMail({
        from: user,
        to: testEmail,
        subject: 'AI Agent System - Test Email',
        text: 'This is a test email from the AI Agent Architecture System.',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333;">🧪 Test Email</h1>
            <p>This is a test email from the <strong>AI Agent Architecture System</strong>.</p>
            <p>If you received this email, your SMTP configuration is working correctly!</p>
            <div style="background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h3>System Information:</h3>
              <ul>
                <li><strong>SMTP Host:</strong> ${host}</li>
                <li><strong>SMTP Port:</strong> ${port}</li>
                <li><strong>From:</strong> ${user}</li>
                <li><strong>Timestamp:</strong> ${new Date().toISOString()}</li>
              </ul>
            </div>
            <p>Best regards,<br>AI Agent System</p>
          </div>
        `
      });

      console.log('✅ Test email sent successfully!');
      console.log(`   Message ID: ${info.messageId}`);
    }
  } catch (error) {
    console.error('❌ SMTP test failed:', error.message);
    console.log('\n💡 Common SMTP issues:');
    console.log('   - Gmail: Use App Password instead of regular password');
    console.log('   - Check if 2FA is enabled and use App Password');
    console.log('   - Verify SMTP settings with your email provider');
    console.log('   - Check firewall/network restrictions');
  }
}

// Run the setup
setupEnvironment().catch(console.error);
