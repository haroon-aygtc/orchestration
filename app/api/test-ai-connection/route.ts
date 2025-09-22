import { type NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import { anthropic } from "@ai-sdk/anthropic"
import { groq } from "@ai-sdk/groq"
import { createErrorResponse, createSuccessResponse, logError, logInfo } from "@/lib/utils/error-handler"
import { validateApiRequest } from "@/lib/middleware/security-middleware"

export async function POST(request: NextRequest) {
  try {
    // Security validation
    const securityResult = await validateApiRequest(request);
    if (!securityResult.isValid) {
      return createErrorResponse(securityResult.error as Error, 'POST /api/test-ai-connection');
    }

    const { provider, model } = await request.json()

    logInfo("Testing AI connection", JSON.stringify({ 
      provider, 
      model, 
      context: "test-ai-connection" 
    }))

    const startTime = Date.now()

    let aiModel
    switch (provider) {
      case "openai":
        logInfo("Configuring OpenAI model", JSON.stringify({ model }))
        aiModel = openai(model)
        break
      case "anthropic":
        logInfo("Configuring Anthropic model", JSON.stringify({ model, context: "test-ai-connection" }))
        aiModel = anthropic(model)
        break
      case "groq":
        logInfo("Configuring Groq model", JSON.stringify({ model, context: "test-ai-connection" }))
        aiModel = groq(model)
        break
      default:
        logError(new Error(`Unknown provider: ${provider}`), 'POST /api/test-ai-connection')
        throw new Error(`Unknown provider: ${provider}`)
    }

    logInfo("Making AI SDK call", JSON.stringify({ provider, model, context: "test-ai-connection" }))
    const { text } = await generateText({
      model: aiModel,
      prompt: 'Respond with "AI connection test successful" to confirm the connection is working.'
    })

    const latency = Date.now() - startTime

    // Production logging - AI connection test successful

    return createSuccessResponse({
      response: text,
      latency,
      provider,
      model,
    }, "AI connection test successful")
  } catch (error) {
    logError(error as Error, 'POST /api/test-ai-connection')
    return createErrorResponse(error as Error, 'POST /api/test-ai-connection')
  }
}
