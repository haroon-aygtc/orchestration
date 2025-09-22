import { groq } from "@ai-sdk/groq"
import { generateText } from "ai"
import { logInfo, logError, createErrorResponse, createSuccessResponse } from "@/lib/utils/error-handler"
import { validateApiRequest } from "@/lib/middleware/security-middleware"
import { NextRequest } from "next/server"

export async function POST(request: Request) {
  try {
    // Security validation
    const securityResult = await validateApiRequest(request as NextRequest);
    if (!securityResult.isValid) {
      return createErrorResponse(securityResult.error as Error, 'POST /api/simple-ai-test');
    }

     const { apiKey } = await request.json()

    // Production logging - Simple AI test initiated
    logInfo("Simple AI test initiated", "simple-ai-test")
    logInfo("Simple AI test initiated", JSON.stringify({   
      apiKey: apiKey
    }))
    const result = await generateText({
      model: groq("llama-3.1-70b-versatile"),
      prompt: 'Say "Hello, AI is working!" in exactly those words.',
    })

    logInfo("AI response received", "simple-ai-test")
    logInfo("AI response received", JSON.stringify({   
      apiKey: apiKey,
      responseLength: result.text.length,   
      usage: result.usage
    }))
   

    return createSuccessResponse({
      success: true,
      response: result.text,
      usage: result.usage,
    }, "AI test completed successfully")
  } catch (error) {
    // Production logging - AI test error occurred
    logError(error as Error, 'POST /api/simple-ai-test')
    return createErrorResponse(error as Error, 'POST /api/simple-ai-test')
  }
}
