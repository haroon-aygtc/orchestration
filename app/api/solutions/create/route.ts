import { NextRequest } from 'next/server';
import { SolutionCreatorService } from '../../../../lib/solution-creator-service';
import { z } from 'zod';
import path from 'path';
import { createSuccessResponse } from '@/lib/utils/error-handler';
import { logError } from '@/lib/utils/error-handler';
import { createErrorResponse } from '@/lib/utils/error-handler';
import { validateApiRequest } from '@/lib/middleware/security-middleware';

// Input validation schema
const CreateSolutionSchema = z.object({
  problem: z.string().min(10, "Problem description must be at least 10 characters"),
  outputPath: z.string().optional(),
  includeUI: z.boolean().optional().default(false)
});

// Response types
interface CreateSolutionResponse {
  success: boolean;
  data?: {
    solutionId: string;
    path: string;
    agents: string[];
    workflows: string[];
    runInstructions: string;
    packageInfo: {
      name: string;
      version: string;
      dependencies: Record<string, string>;
    };
  };
  error?: string;
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    // Security validation
    const securityResult = await validateApiRequest(request);
    if (!securityResult.isValid) {
      return createErrorResponse(securityResult.error as Error, 'POST /api/solutions/create');
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedInput = CreateSolutionSchema.parse(body);

    // Set default output path if not provided
    const outputPath = validatedInput.outputPath || path.join(process.cwd(), 'generated-solutions');

    // Create solution creator service
    const solutionCreator = new SolutionCreatorService();

    // Generate the solution
    const result = await solutionCreator.createStandaloneSolution(
      validatedInput.problem,
      outputPath,
      {
        includeUI: validatedInput.includeUI,
        includeMonitoring: body.includeMonitoring,
        businessContext: body.businessContext
      }
    );

    return createSuccessResponse({
      success: true,
      data: result
    });

  } catch (error: any) {
    logError(new Error(`Solution creation failed: ${error.message}`), 'POST /api/solutions/create');

    // Handle validation errors
    if (error.name === 'ZodError') {
      return createErrorResponse(new Error(`Validation error: ${error.errors.map((e: any) => e.message).join(', ')}`), 'POST /api/solutions/create');
    }

    // Handle other errors
    return createErrorResponse(new Error(`Failed to create solution: ${error.message}`), 'POST /api/solutions/create');
  }
}

// GET endpoint to list existing solutions
export async function GET(request: NextRequest): Promise<Response> {
  try {
    // Security validation
    const securityResult = await validateApiRequest(request);
    if (!securityResult.isValid) {
      return createErrorResponse(securityResult.error as Error, 'GET /api/solutions/create');
    }

    const { searchParams } = new URL(request.url);
    const outputPath = searchParams.get('path') || path.join(process.cwd(), 'generated-solutions');

    // Check if solutions directory exists
    const fs = await import('fs');
    if (!fs.existsSync(outputPath)) {
      return createSuccessResponse({
        success: true,
        data: {
          solutions: [],
          path: outputPath
        }
      });
    }

    // Read solution directories
    const entries = fs.readdirSync(outputPath, { withFileTypes: true });
    const solutions = entries
      .filter(entry => entry.isDirectory() && entry.name.startsWith('solution_'))
      .map(entry => {
        const solutionPath = path.join(outputPath, entry.name);
        let packageInfo = null;
        let readme = null;

        try {
          // Read package.json if exists
          const packagePath = path.join(solutionPath, 'package.json');
          if (fs.existsSync(packagePath)) {
            packageInfo = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
          }

          // Read README.md if exists
          const readmePath = path.join(solutionPath, 'README.md');
          if (fs.existsSync(readmePath)) {
            readme = fs.readFileSync(readmePath, 'utf8').split('\n').slice(0, 5).join('\n');
          }
        } catch (err) {
          logError(err as Error, `Failed to read solution info for ${entry.name}`);
        }

        return {
          id: entry.name,
          name: packageInfo?.name || entry.name,
          description: packageInfo?.description || 'No description available',
          version: packageInfo?.version || '1.0.0',
          path: solutionPath,
          created: entry.name.split('_')[1] ? new Date(parseInt(entry.name.split('_')[1])) : null,
          readme: readme
        };
      })
      .sort((a, b) => (b.created?.getTime() || 0) - (a.created?.getTime() || 0));

    return createSuccessResponse({
      success: true,
      data: {
        solutions,
        path: outputPath,
        count: solutions.length
      }
    });

  } catch (error: any) {
    logError(new Error(`Failed to list solutions: ${error.message}`), 'GET /api/solutions/create');
    return createErrorResponse(new Error(`Failed to list solutions: ${error.message}`), 'GET /api/solutions/create');
  }
}

// DELETE endpoint to remove a solution
export async function DELETE(request: NextRequest): Promise<Response> {
  try {
    // Security validation
    const securityResult = await validateApiRequest(request);
    if (!securityResult.isValid) {
      return createErrorResponse(securityResult.error as Error, 'DELETE /api/solutions/create');
    }

    const { searchParams } = new URL(request.url);
    const solutionId = searchParams.get('id');
    const outputPath = searchParams.get('path') || path.join(process.cwd(), 'generated-solutions');

    if (!solutionId) {
      return createErrorResponse(new Error('Solution ID is required'), 'DELETE /api/solutions/create');
    }

    const solutionPath = path.join(outputPath, solutionId);
    
    // Check if solution exists
    const fs = await import('fs');
    if (!fs.existsSync(solutionPath)) {
      return createErrorResponse(new Error('Solution not found'), 'DELETE /api/solutions/create');
    }

    // Remove solution directory
    fs.rmSync(solutionPath, { recursive: true, force: true });

      return createSuccessResponse({
      success: true,
      data: {
        message: `Solution ${solutionId} deleted successfully`
      }
    });

  } catch (error: any) {
    logError(new Error(`Failed to delete solution: ${error.message}`), 'DELETE /api/solutions/create');
    return createErrorResponse(new Error(`Failed to delete solution: ${error.message}`), 'DELETE /api/solutions/create');
  }
}
