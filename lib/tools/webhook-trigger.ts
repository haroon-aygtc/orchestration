import type { ToolResult } from "../agents/shared/types";
import { createEnhancedTool } from "../tools/registry/index";
import { ToolFn } from "../tools/run-tool";
import { logger } from "../utils/structured-logger";
import { ValidationError, NetworkError, TimeoutError } from "../utils/error-handler";

/**
 * Real Webhook Trigger Tool
 * Sends HTTP requests to webhook endpoints for real-time integrations
 * 
 * Parameters:
 * - url: Webhook URL (required)
 * - payload: Data to send in the webhook (required)
 * - method: HTTP method (default: POST)
 * - headers: Additional headers
 * - secret: Webhook secret for signature verification
 * - timeout: Request timeout in milliseconds (default: 15000)
 * - retries: Number of retry attempts (default: 3)
 * - retryDelay: Delay between retries in ms (default: 1000)
 */
export const webhookTriggerFn: ToolFn = async (params): Promise<ToolResult> => {
  try {
    const { 
      url, 
      payload = {}, 
      method = "POST", 
      headers = {}, 
      secret,
      timeout = 15000,
      retries = 3,
      retryDelay = 1000
    } = params;

    // Validation
    if (!url) {
      throw new ValidationError("webhook_trigger: 'url' is required", {
        parameter: "url",
        received: typeof url
      });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      throw new ValidationError("webhook_trigger: Invalid webhook URL format", {
        parameter: "url",
        value: url
      });
    }

    // Prepare headers
    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "AI-Agent-Webhook/1.0",
      ...headers
    };

    // Add webhook signature if secret is provided
    if (secret) {
      const crypto = await import('crypto');
      const payloadString = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', secret)
        .update(payloadString)
        .digest('hex');
      
      requestHeaders['X-Webhook-Signature'] = `sha256=${signature}`;
      requestHeaders['X-Webhook-Timestamp'] = Date.now().toString();
    }

    let lastError: Error | null = null;
    
    // Retry logic for webhook delivery
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const startTime = Date.now();
        
        const response = await fetch(url, {
          method: method.toUpperCase(),
          headers: requestHeaders,
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        const endTime = Date.now();
        clearTimeout(timeoutId);

        // Get response data
        let responseData: any;
        const contentType = response.headers.get('content-type') || '';
        
        try {
          if (contentType.includes('application/json')) {
            responseData = await response.json();
          } else {
            responseData = await response.text();
          }
        } catch {
          responseData = null;
        }

        // Collect response headers
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        const result = {
          success: response.ok,
          statusCode: response.status,
          message: response.ok ? "Webhook delivered successfully" : `Webhook failed: ${response.statusText}`,
          data: {
            webhookUrl: url,
            method: method.toUpperCase(),
            responseBody: responseData,
            responseHeaders,
            responseTime: endTime - startTime,
            attempt: attempt + 1,
            timestamp: new Date().toISOString(),
            payloadSize: JSON.stringify(payload).length
          }
        };

        // Return successful result
        if (response.ok) {
          return result;
        }

        // If not successful but no retries left, return the result
        if (attempt === retries) {
          return result;
        }

        // Wait before retry (exponential backoff)
        if (attempt < retries) {
          const delay = retryDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

      } catch (error: any) {
        lastError = error;
        
        // If this is the last attempt, don't retry
        if (attempt === retries) {
          break;
        }

        // Wait before retry (exponential backoff)
        const delay = retryDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // If we get here, all attempts failed
    throw lastError || new Error('All webhook delivery attempts failed');

  } catch (error: any) {
    logger.error('Webhook trigger failed', {
      webhookUrl: params.url,
      method: params.method || 'POST',
      error: error.message
    }, error);

    let errorMessage = error.message;
    let statusCode = 500;

    // Handle specific error types
    if (error.name === 'AbortError') {
      errorMessage = `Webhook timeout after ${params.timeout || 15000}ms`;
      statusCode = 408;
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = 'Webhook endpoint not found';
      statusCode = 404;
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Webhook endpoint refused connection';
      statusCode = 503;
    }

    return {
      success: false,
      statusCode,
      message: `Webhook trigger failed: ${errorMessage}`,
      data: { 
        error: errorMessage,
        webhookUrl: params.url,
        method: params.method || 'POST',
        timestamp: new Date().toISOString()
      }
    };
  }
};

/**
 * Webhook Helper Functions
 */
export const webhookHelpers = {
  // Slack webhook
  slack: (webhookUrl: string, message: string, channel?: string, username?: string) =>
    webhookTriggerFn({
      url: webhookUrl,
      payload: {
        text: message,
        channel,
        username: username || 'AI Agent'
      }
    }),

  // Discord webhook
  discord: (webhookUrl: string, content: string, username?: string) =>
    webhookTriggerFn({
      url: webhookUrl,
      payload: {
        content,
        username: username || 'AI Agent'
      }
    }),

  // Microsoft Teams webhook
  teams: (webhookUrl: string, title: string, text: string) =>
    webhookTriggerFn({
      url: webhookUrl,
      payload: {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": "0076D7",
        "summary": title,
        "sections": [{
          "activityTitle": title,
          "activitySubtitle": new Date().toLocaleString(),
          "text": text
        }]
      }
    }),

  // Generic API webhook
  api: (webhookUrl: string, data: any, apiKey?: string) => {
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    
    return webhookTriggerFn({
      url: webhookUrl,
      payload: data,
      headers
    });
  },

  // Zapier webhook
  zapier: (webhookUrl: string, data: any) =>
    webhookTriggerFn({
      url: webhookUrl,
      payload: data
    }),

  // IFTTT webhook
  ifttt: (webhookUrl: string, value1?: string, value2?: string, value3?: string) =>
    webhookTriggerFn({
      url: webhookUrl,
      payload: {
        value1,
        value2,
        value3
      }
    })
};


export const webhookTriggerTool = createEnhancedTool("webhook_trigger", webhookTriggerFn);