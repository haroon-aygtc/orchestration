import { logInfo, logError, createErrorResponse, createSuccessResponse } from "@/lib/utils/error-handler";
import { validateApiRequest } from "@/lib/middleware/security-middleware";
import { NextRequest } from "next/server";

export async function POST(request: Request) {
  let provider = "groq"; // Default provider
  try {
    // Security validation
    const securityResult = await validateApiRequest(request as NextRequest);
    if (!securityResult.isValid) {
      return createErrorResponse(securityResult.error as Error, 'POST /api/direct-groq-test');
    }

    const { apiKey, message, provider: requestProvider = "groq", model = "llama-3.1-70b-versatile" } = await request.json()
    provider = requestProvider;

    // Production logging - Direct API test starting
    logInfo(`[v0] Testing ${provider} connection with model ${model}`, JSON.stringify({ provider, model }))

    let apiUrl: string
    let requestBody: any
    let headers: Record<string, string>

    switch (provider) {
      case "groq":
        apiUrl = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        }
        requestBody = {
          model: model || "llama-3.1-70b-versatile",
          messages: [{ role: "user", content: message || "Hello, this is a test message. Please respond." }],
          max_tokens: parseInt(process.env.AI_MAX_TOKENS || "100"),
          temperature: parseFloat(process.env.AI_TEMPERATURE || "0.7"),
        }
        break

      case "openai":
        apiUrl = "https://api.openai.com/v1/chat/completions"
        headers = {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        }
        requestBody = {
          model: model || "gpt-4o-mini",
          messages: [{ role: "user", content: message || "Hello, this is a test message. Please respond." }],
          max_tokens: parseInt(process.env.AI_MAX_TOKENS || "100"),
          temperature: parseFloat(process.env.AI_TEMPERATURE || "0.7"),
        }
        break

      case "anthropic":
        apiUrl = "https://api.anthropic.com/v1/messages"
        headers = {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
        }
        requestBody = {
          model: model || "claude-3-5-sonnet-20241022",
          messages: [{ role: "user", content: message || "Hello, this is a test message. Please respond." }],
          max_tokens: parseInt(process.env.AI_MAX_TOKENS || "100"),
          temperature: parseFloat(process.env.AI_TEMPERATURE || "0.7"),
        }
        break

      case "openrouter":
        apiUrl = "https://openrouter.ai/api/v1/chat/completions"
        headers = {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        }
        requestBody = {
          model: model || "auto",
          messages: [{ role: "user", content: message || "Hello, this is a test message. Please respond." }],
          max_tokens: parseInt(process.env.AI_MAX_TOKENS || "100"),
          temperature: parseFloat(process.env.AI_TEMPERATURE || "0.7"),
        }
        break

      case "gemini":
        apiUrl = `https://generativelanguage.googleapis.com/v1/models/${model || "gemini-pro"}:generateContent`
        headers = {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        }
        requestBody = {
          contents: [{ parts: [{ text: message || "Hello, this is a test message. Please respond." }] }],
          generationConfig: {
            temperature: parseFloat(process.env.AI_TEMPERATURE || "0.7"),
            maxOutputTokens: parseInt(process.env.AI_MAX_TOKENS || "100"),
          },
        }
        break

      case "mistral":
        apiUrl = "https://api.mistral.ai/v1/chat/completions"
        headers = {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        }
        requestBody = {
          model: model || "mistral-large-latest",
          messages: [{ role: "user", content: message || "Hello, this is a test message. Please respond." }],
          max_tokens: parseInt(process.env.AI_MAX_TOKENS || "100"),
          temperature: parseFloat(process.env.AI_TEMPERATURE || "0.7"),
        }
        break

      case "deepseek":
        apiUrl = "https://api.deepseek.com/v1/chat/completions"
        headers = {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        }
        requestBody = {
          model: model || "deepseek-chat",
          messages: [{ role: "user", content: message || "Hello, this is a test message. Please respond." }],
          max_tokens: parseInt(process.env.AI_MAX_TOKENS || "100"),
          temperature: parseFloat(process.env.AI_TEMPERATURE || "0.7"),
        }
        break

      case "codestral":
        apiUrl = "https://codestral.mistral.ai/v1/chat/completions"
        headers = {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        }
        requestBody = {
          model: model || "codestral-mamba-latest",
          messages: [{ role: "user", content: message || "Hello, this is a test message. Please respond." }],
          max_tokens: parseInt(process.env.AI_MAX_TOKENS || "100"),
          temperature: parseFloat(process.env.AI_TEMPERATURE || "0.7"),
        }
        break

      default:
        throw new Error(`Unsupported provider: ${provider}`)
    }

    // Direct API call
    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    })

    logInfo(`[v0] ${provider} API response status:`, JSON.stringify({ provider, model, response: response.status.toString() }))

    if (!response.ok) {
      const errorText = await response.text()
      logError(new Error(`${provider} API error: ${response.status} - ${errorText}`), 'POST /api/direct-groq-test')
      return createErrorResponse(new Error(`${provider} API error: ${response.status} - ${errorText}`), 'POST /api/direct-groq-test')
    }

    const data = await response.json()
    logInfo(`[v0] ${provider} API success:`, JSON.stringify({ provider, model, response: data.choices?.[0]?.message?.content?.substring(0, 50) + "..." }))

    // Normalize response format for different providers
    let responseText: string
    let usage: any

    if (provider === "gemini") {
      responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response"
      usage = {
        prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
        completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
        total_tokens: data.usageMetadata?.totalTokenCount || 0,
      }
    } else if (provider === "anthropic") {
      responseText = data.content?.[0]?.text || "No response"
      usage = {
        prompt_tokens: data.usage?.input_tokens || 0,
        completion_tokens: data.usage?.output_tokens || 0,
        total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      }
    } else {
      responseText = data.choices?.[0]?.message?.content || "No response"
      usage = data.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      }
    }

    return createSuccessResponse({
      success: true,
      response: responseText,
      usage,
      provider,
      model,
    }, "Direct API test completed successfully")
  } catch (error) {
    logError(error as Error, 'POST /api/direct-groq-test')
    return createErrorResponse(error as Error, 'POST /api/direct-groq-test')
  }
}
