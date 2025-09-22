"use client"

import { AgentPageTemplate } from "@/components/agent-page-template"
import { AdminLayout } from "@/components/admin-layout"
import { IntentAgent } from "@/lib/agents/intent/intent-agent"
import { bootstrapAgents } from "@/lib/agents/bootstrap"
import { useState, useEffect } from "react"

let intentAgent: IntentAgent | null = null

export default function IntentAgentPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const initializeAgent = async () => {
      try {
        const agents = await bootstrapAgents()
        intentAgent = agents.intent as IntentAgent
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to initialize intent agent")
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
            <p>Loading intent agent...</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  if (error || !intentAgent) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center text-red-600">
            <p>Error: {error || "Failed to load intent agent"}</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

const testExamples = [
  {
    name: "Customer Support Intent",
    input: "I'm having trouble with my order and need help tracking it",
    expectedOutput: "Intent: customer_support, Entities: [order, tracking], Action Required: true",
  },
  {
    name: "Sales Inquiry",
    input: "I want to know more about your premium subscription plans",
    expectedOutput: "Intent: sales_inquiry, Entities: [premium, subscription], Action Required: true",
  },
  {
    name: "Feature Request",
    input: "It would be great if you could add dark mode to the dashboard",
    expectedOutput: "Intent: feature_request, Entities: [dark mode, dashboard], Action Required: false",
  },
]

const capabilities = [
  "Natural language understanding and intent classification",
  "Named entity recognition and extraction",
  "Confidence scoring for intent predictions",
  "Context-aware analysis with business domain knowledge",
  "Multi-intent detection for complex user requests",
  "Sentiment analysis and emotional context detection",
  "Action requirement determination for workflow triggers",
  "Suggested response generation based on intent analysis",
]

  const handleTest = async (input: string) => {
    if (!intentAgent) throw new Error("Intent agent not initialized")

    const result = await intentAgent.processIntent({
      text: input,
      context: { taskId: "test-task", agentType: "intent" } as any,
    })
    return result
  }

  return (
    <AdminLayout>
      <AgentPageTemplate
        agentName="Intent Agent"
        agentDescription="Analyzes user input to understand intentions, extract entities, and determine required actions using advanced natural language processing."
        agentCapabilities={capabilities}
        testExamples={testExamples}
        onTest={handleTest}
      />
    </AdminLayout>
  )
}
