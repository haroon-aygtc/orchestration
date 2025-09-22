// path: lib/tools/email-sender.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { ToolResult } from "../agents/shared/types";
import { ConfigurationError } from "../utils/error-handler";
import { createEnhancedTool } from "../tools/registry/index"; // <-- single consistent import (index.ts should re-export)
import { ToolFn } from "../tools/run-tool";
// Local ToolFn type so we don't depend on the registry exporting it

// Dynamic import for server-side only
const getNodemailer = async () => {
  if (typeof window !== "undefined") {
    throw new ConfigurationError("Email sending is only available on the server side", {
      runtime: "browser",
      feature: "email-sending",
    });
  }
  const nodemailer = await import("nodemailer");
  return (nodemailer as any).default || nodemailer;
};

/**
 * Real Email Sender Tool
 * Sends actual emails via SMTP using Nodemailer
 *
 * Required Environment Variables:
 * - SMTP_HOST: SMTP server hostname
 * - SMTP_PORT: SMTP server port (default: 587)
 * - SMTP_USER: SMTP username/email
 * - SMTP_PASS: SMTP password/app password
 *
 * Parameters:
 * - recipient: Email address to send to (required)
 * - subject: Email subject line
 * - text: Plain text email body
 * - html: HTML email body
 * - fromEmail: Sender email (optional, defaults to SMTP_USER)
 * - cc: CC recipients (optional)
 * - bcc: BCC recipients (optional)
 * - attachments: File attachments (optional)
 */
export const emailSenderFn: ToolFn = async (params): Promise<ToolResult> => {
  try {
    const {
      recipient,
      subject = "Message",
      text,
      html,
      fromEmail,
      cc,
      bcc,
      attachments,
    } = params ?? {};

    // Enhanced input validation
    if (!recipient) {
      return {
        success: false,
        statusCode: 400,
        message: "email_sender: 'recipient' parameter is required",
        data: { error: "Missing required parameter: recipient" },
      };
    }

    if (!text && !html) {
      return {
        success: false,
        statusCode: 400,
        message: "email_sender: Either 'text' or 'html' content is required",
        data: { error: "Missing required parameter: text or html content" },
      };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipient)) {
      return {
        success: false,
        statusCode: 400,
        message: "email_sender: Invalid recipient email format",
        data: { error: "Invalid email format for recipient" },
      };
    }

    // Environment validation with detailed error messages
    const requiredEnvVars = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"];
    const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

    if (missingEnvVars.length > 0) {
      return {
        success: false,
        statusCode: 500,
        message: `email_sender: Missing required environment variables: ${missingEnvVars.join(", ")}`,
        data: {
          error: "SMTP configuration incomplete",
          missingVariables: missingEnvVars,
        },
      };
    }

    // Get nodemailer dynamically
    const nodemailer = await getNodemailer();

    // Create transporter with enhanced configuration
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST!,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_PORT === "465", // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER!,
        pass: process.env.SMTP_PASS!,
      },
      // Additional security options
      tls: {
        rejectUnauthorized: false, // Allow self-signed certificates (flip to true in prod if you can)
      },
      // Connection timeouts
      connectionTimeout: 60_000,
      greetingTimeout: 30_000,
      socketTimeout: 60_000,
    });

    // Verify connection with timeout
    try {
      await Promise.race([
        transporter.verify(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("SMTP connection timeout")), 30_000)),
      ]);
    } catch (verifyError: any) {
      return {
        success: false,
        statusCode: 503,
        message: "email_sender: SMTP connection verification failed",
        data: {
          error: verifyError?.message ?? String(verifyError),
          smtpHost: process.env.SMTP_HOST,
        },
      };
    }

    // Prepare email options with validation
    const mailOptions: Record<string, any> = {
      from: fromEmail || process.env.SMTP_USER!,
      to: recipient,
      subject: String(subject).substring(0, 998), // RFC 5322 limit
      text: text ? String(text).substring(0, 1_000_000) : undefined,
      html: html ? String(html).substring(0, 1_000_000) : undefined,
      cc: cc ? (Array.isArray(cc) ? cc : [cc]) : undefined,
      bcc: bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : undefined,
      attachments: attachments || undefined,
    };

    // Validate CC and BCC emails if provided
    const allEmails = [recipient, ...(mailOptions.cc || []), ...(mailOptions.bcc || [])];
    const invalidEmails = allEmails.filter((e) => !emailRegex.test(e));

    if (invalidEmails.length > 0) {
      return {
        success: false,
        statusCode: 400,
        message: "email_sender: Invalid email format in CC/BCC",
        data: {
          error: "Invalid email format",
          invalidEmails,
        },
      };
    }

    // Send email with timeout
    const sendPromise = transporter.sendMail(mailOptions);
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Email send timeout")), 60_000));

    const info = (await Promise.race([sendPromise, timeoutPromise])) as any;

    return {
      success: true,
      statusCode: 200,
      message: "Email sent successfully",
      data: {
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
        response: info.response,
        envelope: info.envelope,
        recipientCount: allEmails.length,
      },
    };
  } catch (error: any) {
    // Enhanced error handling with specific error types
    let statusCode = 500;
    let errorMessage = "Email sending failed";
    const msg = String(error?.message ?? error);

    if (msg.includes("SMTP connection timeout")) {
      statusCode = 503;
      errorMessage = "SMTP server connection timeout";
    } else if (msg.includes("Email send timeout")) {
      statusCode = 408;
      errorMessage = "Email sending timeout";
    } else if (msg.includes("Invalid recipient")) {
      statusCode = 400;
      errorMessage = "Invalid recipient email address";
    } else if (msg.includes("Authentication failed")) {
      statusCode = 401;
      errorMessage = "SMTP authentication failed";
    } else if (msg.includes("Connection refused")) {
      statusCode = 503;
      errorMessage = "SMTP server connection refused";
    } else if (msg.includes("TLS")) {
      statusCode = 495; // non-standard but expressive (SSL cert error)
      errorMessage = "TLS/SSL connection error";
    } else if (msg.includes("Invalid email format")) {
      statusCode = 400;
      errorMessage = "Invalid email format";
    } else if (msg.includes("Missing required")) {
      statusCode = 400;
      errorMessage = "Missing required parameters";
    } else if (msg.includes("SMTP configuration")) {
      statusCode = 500;
      errorMessage = "SMTP configuration error";
    }

    return {
      success: false,
      statusCode,
      message: errorMessage,
      data: { error: msg },
    };
  }
};

/**
 * Email Template Helper
 * Creates common email templates
 */
export const createEmailTemplate = (type: "welcome" | "notification" | "alert", data: any) => {
  const templates = {
    welcome: {
      subject: `Welcome ${data?.name || "to our platform"}!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Welcome ${data?.name || "User"}!</h1>
          <p>Thank you for joining our platform. We're excited to have you on board.</p>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3>Next Steps:</h3>
            <ul>
              <li>Complete your profile setup</li>
              <li>Explore our features</li>
              <li>Contact support if you need help</li>
            </ul>
          </div>
          <p>Best regards,<br>The Team</p>
        </div>
      `,
    },
    notification: {
      subject: data?.subject || "Notification",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">${data?.title || "Notification"}</h2>
          <p>${data?.message || "You have a new notification."}</p>
          ${data?.actionUrl ? `<a href="${data.actionUrl}" style="background: #007cba; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Take Action</a>` : ""}
        </div>
      `,
    },
    alert: {
      subject: `Alert: ${data?.alertType || "System Alert"}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #ff4444; color: white; padding: 15px; border-radius: 5px;">
            <h2>⚠️ Alert: ${data?.alertType || "System Alert"}</h2>
          </div>
          <div style="padding: 20px;">
            <p><strong>Message:</strong> ${data?.message ?? ""}</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            ${data?.details ? `<p><strong>Details:</strong> ${data.details}</p>` : ""}
          </div>
        </div>
      `,
    },
  };

  return templates[type];
};

export const emailSenderTool = createEnhancedTool("email_sender", emailSenderFn);
