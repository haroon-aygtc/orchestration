// API Routes for Orchestration - Uses PostgreSQL backend directly
import { NextRequest } from "next/server";
import { postgresqlTaskStore, postgresMemoryBackend, postgresPool } from "@/lib/database/postgresql-client";
import { generateGoalId } from "@/lib/utils/uuid";
import { createErrorResponse, createSuccessResponse, logError, logInfo } from "@/lib/utils/error-handler";
import { validateApiRequest } from "@/lib/middleware/security-middleware";

// POST /api/orchestration - Create new orchestration goal in PostgreSQL
export async function POST(request: NextRequest) {
  try {
    // Security validation
    const securityResult = await validateApiRequest(request);
    if (!securityResult.isValid) {
      return createErrorResponse(securityResult.error as Error, 'POST /api/orchestration');
    }

    const body = await request.json();
    const { title, description, context } = body;

    if (!title) {
      return createErrorResponse(new Error('Title is required'), 'POST /api/orchestration');
    }

    logInfo('🎯 Creating REAL orchestration goal in PostgreSQL:', title);

    // Create orchestration goal directly in PostgreSQL
    const goalId = generateGoalId();
    const client = await postgresPool.connect();

    try {
      // Insert into workflows table (using it for orchestration goals)
      await client.query(
        `INSERT INTO workflows (id, name, description, goal, status, steps, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [
          goalId,
          title,
          description || "",
          title, // goal field
          "pending",
          JSON.stringify([]) // empty steps initially
        ]
      );

      // Store context in memory if provided
      if (context) {
        await postgresMemoryBackend.set(`goal_context_${goalId}`, context, 'orchestration');
      }

      const goal = {
        id: goalId,
        title,
        description: description || "",
        status: "pending",
        context,
        createdAt: new Date(),
        updatedAt: new Date(),
        steps: []
      };

      logInfo('✅ Real orchestration goal created in PostgreSQL:', goalId);

      return createSuccessResponse(goal, "Orchestration goal created successfully");
    } finally {
      client.release();
    }
  } catch (error: any) {
    logError(error, 'POST /api/orchestration');
    return createErrorResponse(error, 'POST /api/orchestration');
  }
}

// GET /api/orchestration - List all orchestration goals from PostgreSQL
export async function GET(request: NextRequest) {
  try {
    // Security validation
    const securityResult = await validateApiRequest(request);
    if (!securityResult.isValid) {
      return createErrorResponse(securityResult.error as Error, 'GET /api/orchestration');
    }

    logInfo('📋 Listing REAL orchestration goals from PostgreSQL...');

    const client = await postgresPool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM workflows ORDER BY "createdAt" DESC'
      );

      const goals = result.rows.map(row => ({
        id: row.id,
        title: row.name,
        description: row.description,
        status: row.status,
        goal: row.goal,
        steps: row.steps,
        result: row.result,
        error: row.error,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        completedAt: row.completedAt
      }));

      logInfo('✅ Real orchestration goals retrieved:', goals.length.toString());

      return createSuccessResponse({ goals, count: goals.length }, "Orchestration goals retrieved successfully");
    } finally {
      client.release();
    }
  } catch (error: any) {
    logError(error, 'GET /api/orchestration');
    return createErrorResponse(error, 'GET /api/orchestration');
  }
}
