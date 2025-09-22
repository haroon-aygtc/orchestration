// Real Business Analysis API - Actual AI-powered business analysis
import { NextRequest, NextResponse } from 'next/server';
import { RealManagerAgent } from '@/lib/real-manager-agent';
import { createErrorResponse, createSuccessResponse, logError, logInfo } from '@/lib/utils/error-handler';

// POST /api/agents/analyze - Real business analysis with AI
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { responses } = body;
    
    if (!responses || typeof responses !== 'object') {
      return createErrorResponse(new Error('Business responses are required'), 'POST /api/agents/analyze');
    }
      
    const manager = new RealManagerAgent();
    
    // Execute REAL business analysis using AI agents
    const profile = await manager.conductRealBusinessInterview(responses);
    
    logInfo('✅ Real business analysis completed:', profile.id);
    
      return createSuccessResponse(profile, '✅ Real business analysis completed:');
    
  } catch (error: any) {
    logError(error, '❌ Real business analysis failed:');
    return createErrorResponse(error, '❌ Real business analysis failed:');
  }
}
