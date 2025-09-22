"use client"

import { AgentPageTemplate } from "@/components/agent-page-template"
import { AdminLayout } from "@/components/admin-layout"
import { MemoryAgent } from "@/lib/agents/memory/memory-agent"
import { bootstrapAgents } from "@/lib/agents/bootstrap"
import { useState, useEffect } from "react"

let memoryAgent: MemoryAgent | null = null

export default function MemoryAgentPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const initializeAgent = async () => {
      try {
        const agents = await bootstrapAgents()
        memoryAgent = agents.memory as MemoryAgent
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to initialize memory agent")
      } finally {
        setIsLoading(false)
      }
    }

    initializeAgent()
  }, [])

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Loading memory agent...</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  if (error || !memoryAgent) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center text-red-600">
            <p>Error: {error || "Failed to load memory agent"}</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

const testExamples = [
  {
    name: "Business Context Storage",
    input: "Store customer preferences and interaction history for personalization",
    expectedOutput: "Context data stored with TTL and access tracking for future retrieval",
  },
  {
    name: "Workflow State Management",
    input: "Save current workflow progress and intermediate results",
    expectedOutput: "Workflow state persisted with checkpoint data and recovery information",
  },
  {
    name: "User Session Context",
    input: "Maintain conversation context and user intent across multiple interactions",
    expectedOutput: "Session data stored with contextual information and interaction timeline",
  },
]

const capabilities = [
  "Persistent context storage and retrieval across sessions",
  "Intelligent memory management with TTL and cleanup policies",
  "Contextual data organization and relationship mapping",
  "Access pattern tracking and usage analytics",
  "Memory optimization and compression for large datasets",
  "Cross-agent context sharing and synchronization",
  "Temporal memory with time-based data expiration",
  "Secure memory isolation and access control mechanisms",
]



  const handleTest = async (input: string) => {
    if (!memoryAgent) throw new Error("Memory agent not initialized")

    const key = `test_${Date.now()}`
    const contextData = {
      input: input,
      timestamp: new Date().toISOString(),
      type: input.toLowerCase().includes("business")
        ? "business_context"
        : input.toLowerCase().includes("workflow")
          ? "workflow_state"
          : "user_session",
    }

    const result = await memoryAgent.storeMemory({
      key: key,
      value: contextData,
      context: JSON.stringify({ taskId: "test-task", agentType: "memory" }),
      ttl: 3600, // 1 hour
    })
    return result
  }

  return (
    <AdminLayout>
      <AgentPageTemplate
        agentName="Memory Agent"
        agentDescription="Manages persistent context storage, state management, and knowledge retention across agent interactions and workflows."
        agentCapabilities={capabilities}
        testExamples={testExamples}
        onTest={handleTest}
      />
    </AdminLayout>
  )
}
