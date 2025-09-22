// lib/tools/runtime.ts
import type { ToolResult } from "../agents/shared/types";
import { ToolFn } from "../tools/run-tool";
// Import centralized registry functions
import {
  createRealTools,
  getToolDescriptions as getRegistryDescriptions,
  getToolCategories as getRegistryCategories,
} from "../tools/registry";

import { AppError } from "../utils/error-handler";

export type Tool = { execute: (params: any) => Promise<any> } | ((params: any) => Promise<any>);
export type ToolRegistry = Record<string, ToolFn>;

// Centralized registry - single source of truth
let toolRegistry: Record<string, ToolFn> | null = null;

async function getToolRegistry(): Promise<Record<string, ToolFn>> {
  if (!toolRegistry) {
    toolRegistry = await createRealTools();
  }
  return toolRegistry;
}

export async function getAvailableTools(): Promise<string[]> {
  const registry = await getToolRegistry();
  return Object.keys(registry);
}

export async function getTool(name: string): Promise<Tool | undefined> {
  const registry = await getToolRegistry();
  const fn = registry[name];
  if (!fn) return undefined;
  return { execute: (params: any) => fn(params) } as Tool;
}

export async function requireTool(name: string): Promise<Tool> {
  const tool = await getTool(name);
  if (!tool) {
    throw new AppError(`Tool not registered: ${name}`, 'TOOL_NOT_FOUND', 404);
  }
  return tool;
}

export async function executeTool(tool: any, params: any): Promise<any> {
  if (!tool) {
    throw new AppError("Tool not found", 'TOOL_NOT_FOUND', 404);
  }
  if (typeof tool === "function") {
    return tool(params);
  }
  if (typeof tool.execute === "function") {
    return tool.execute(params);
  }
  throw new AppError("Invalid tool interface", 'INVALID_TOOL_INTERFACE', 400);
}

// Metadata functions that return ToolResult format
export async function getToolDescriptions(): Promise<ToolResult> {
  try {
    const descriptions = getRegistryDescriptions();
    return {
      success: true,
      statusCode: 200,
      message: "Tool descriptions retrieved",
      data: descriptions
    };
  } catch (error) {
    return {
      success: false,
      statusCode: 500,
      message: "Failed to get tool descriptions",
      data: { error: error instanceof Error ? error.message : String(error) }
    };
  }
}

export async function getToolCategories(): Promise<ToolResult> {
  try {
    const categories = getRegistryCategories();
    return {
      success: true,
      statusCode: 200,
      message: "Tool categories retrieved",
      data: categories
    };
  } catch (error) {
    return {
      success: false,
      statusCode: 500,
      message: "Failed to get tool categories",
      data: { error: error instanceof Error ? error.message : String(error) }
    };
  }
}

// Registry function that returns ToolResult format
export async function getRegistry(): Promise<ToolResult> {
  try {
    const registry = await getToolRegistry();
    return {
      success: true,
      statusCode: 200,
      message: "Tool registry retrieved",
      data: registry
    };
  } catch (error) {
    return {
      success: false,
      statusCode: 500,
      message: "Failed to get tool registry",
      data: { error: error instanceof Error ? error.message : String(error) }
    };
  }
} 

export const runtimeToolFn: ToolFn = async (params) => {
  return {
    success: true,
    statusCode: 200,
    message: "Runtime tool retrieved",
    data: params
  };
};