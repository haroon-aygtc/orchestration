import { NextRequest } from "next/server";
import { aiConfigService } from "@/lib/ai-config-service";
import { createErrorResponse, createSuccessResponse, logError } from "@/lib/utils/error-handler";

export async function GET(request: NextRequest) {
  try {
    await aiConfigService.initialize();
    const configs = await aiConfigService.getProviderConfigs();
    
    return createSuccessResponse({ providers: configs }, "AI providers loaded successfully");
  } catch (error: any) {
    logError(error, 'GET /api/ai-config/providers');
    return createErrorResponse(error, 'GET /api/ai-config/providers');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider, apiKey, model, maxTokens, temperature, baseUrl, timeoutMs, isActive } = body;
    
    await aiConfigService.initialize();
    await aiConfigService.setProviderConfig(provider, {
      provider,
      apiKey,
      model,
      maxTokens,
      temperature,
      baseUrl,
      timeoutMs,
      isActive
    });
    
    return createSuccessResponse(null, "Provider configuration saved successfully");
  } catch (error: any) {
    logError(error, 'POST /api/ai-config/providers');
    return createErrorResponse(error, 'POST /api/ai-config/providers');
  }
}
