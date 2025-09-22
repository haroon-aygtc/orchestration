#!/usr/bin/env node

/**
 * SMTP Testing Script for AI Agent Architecture System
 * This script tests the email configuration and sends test emails
 */

require('dotenv').config();
const nodemailer = require('nodemailer');

async function testSMTP() {
  console.log('🧪 Testing SMTP Configuration\n');

  // Check environment variables
  const requiredVars = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(varName => console.error(`   - ${varName}`));
    console.log('\n💡 Please set these variables in your .env file');
    process.exit(1);
  }

  const config = {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  };

  console.log('📧 SMTP Configuration:');
  console.log(`   Host: ${config.host}`);
  console.log(`   Port: ${config.port}`);
  console.log(`   User: ${config.auth.user}`);
  console.log(`   Secure: ${config.secure}\n`);

  try {
    // Create transporter
    const transporter = nodemailer.createTransport(config);
    
    // Test connection
    console.log('🔌 Testing SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully!\n');

    // Send test email
    const testRecipient = process.argv[2];
    if (!testRecipient) {
      console.log('❌ No recipient email provided. Usage: npm run test:smtp your-email@example.com');
      process.exit(1);
    }
    console.log(`📤 Sending test email to: ${testRecipient}`);

    const info = await transporter.sendMail({
      from: `"AI Agent System" <${process.env.SMTP_USER}>`,
      to: testRecipient,
      subject: '🧪 AI Agent System - SMTP Test',
      text: `
AI Agent Architecture System - SMTP Test

This is a test email to verify your SMTP configuration is working correctly.

System Information:
- SMTP Host: ${config.host}
- SMTP Port: ${config.port}
- Test Time: ${new Date().toISOString()}
- Environment: ${process.env.NODE_ENV || 'development'}

If you received this email, your SMTP setup is working perfectly!

Best regards,
AI Agent System
      `,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 28px;">🧪 SMTP Test</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">AI Agent Architecture System</p>
          </div>
          
          <div style="background: white; padding: 30px; border: 1px solid #e1e5e9; border-top: none; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-top: 0;">✅ SMTP Configuration Working!</h2>
            <p style="color: #666; line-height: 1.6;">
              This is a test email to verify your SMTP configuration is working correctly. 
              If you received this email, your email setup is functioning perfectly!
            </p>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #333; margin-top: 0;">📊 System Information</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e9ecef; font-weight: bold; color: #495057;">SMTP Host:</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e9ecef; color: #6c757d;">${config.host}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e9ecef; font-weight: bold; color: #495057;">SMTP Port:</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e9ecef; color: #6c757d;">${config.port}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e9ecef; font-weight: bold; color: #495057;">From Email:</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e9ecef; color: #6c757d;">${process.env.SMTP_USER}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e9ecef; font-weight: bold; color: #495057;">Test Time:</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e9ecef; color: #6c757d;">${new Date().toISOString()}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #495057;">Environment:</td>
                  <td style="padding: 8px 0; color: #6c757d;">${process.env.NODE_ENV || 'development'}</td>
                </tr>
              </table>
            </div>
            
            <div style="background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <strong>🎉 Success!</strong> Your SMTP configuration is working correctly. 
              You can now use the email tools in your AI agent workflows.
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef;">
              <p style="color: #6c757d; margin: 0;">
                Best regards,<br>
                <strong>AI Agent Architecture System</strong>
              </p>
            </div>
          </div>
        </div>
      `
    });

    console.log('✅ Test email sent successfully!');
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   Response: ${info.response}`);
    console.log(`   Accepted: ${info.accepted.join(', ')}`);
    
    if (info.rejected && info.rejected.length > 0) {
      console.log(`   Rejected: ${info.rejected.join(', ')}`);
    }

  } catch (error) {
    console.error('❌ SMTP test failed:', error.message);
    console.log('\n🔧 Troubleshooting tips:');
    console.log('1. Check your SMTP credentials');
    console.log('2. For Gmail, use App Password instead of regular password');
    console.log('3. Enable 2FA and generate App Password');
    console.log('4. Check firewall/network restrictions');
    console.log('5. Verify SMTP settings with your email provider');
    console.log('\n📚 Common SMTP settings:');
    console.log('   Gmail: smtp.gmail.com:587 (TLS)');
    console.log('   Outlook: smtp-mail.outlook.com:587 (TLS)');
    console.log('   Yahoo: smtp.mail.yahoo.com:587 (TLS)');
    process.exit(1);
  }
}

// Run the test
testSMTP().catch(console.error);
