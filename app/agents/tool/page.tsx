"use client"

import { AgentPageTemplate } from "@/components/agent-page-template"
import { AdminLayout } from "@/components/admin-layout"
import { ToolAgent } from "@/lib/agents/tool/tool-agent"
import { bootstrapAgents } from "@/lib/agents/bootstrap"
import { useState, useEffect } from "react"

let toolAgent: ToolAgent | null = null

export default function ToolAgentPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const initializeAgent = async () => {
      try {
        const agents = await bootstrapAgents()
        toolAgent = agents.tool as ToolAgent
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to initialize tool agent")
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
            <p>Loading tool agent...</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  if (error || !toolAgent) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center text-red-600">
            <p>Error: {error || "Failed to load tool agent"}</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

const testExamples = [
  {
    name: "Email Service Integration",
    input: "Send welcome email to new customer using Mailchimp API",
    expectedOutput: "Email sent successfully with tracking ID and delivery status",
  },
  {
    name: "CRM Data Update",
    input: "Update customer profile in Salesforce with new contact information",
    expectedOutput: "Customer record updated with confirmation and audit trail",
  },
  {
    name: "Payment Processing",
    input: "Process refund for order #12345 using Stripe API",
    expectedOutput: "Refund processed successfully with transaction details",
  },
]

const capabilities = [
  "API integration and external service communication",
  "Real-time tool execution with error handling and retries",
  "Multi-platform integration support (CRM, email, payments, etc.)",
  "Secure credential management and authentication handling",
  "Batch operation processing for bulk data operations",
  "Transaction logging and audit trail generation",
  "Rate limiting and quota management for API calls",
  "Rollback and recovery mechanisms for failed operations",
]

  const handleTest = async (input: string) => {
    if (!toolAgent) throw new Error("Tool agent not initialized")

    // Use dynamic tool selection - let the agent choose the best tool
    const result = await toolAgent.executeTool({
      parameters: { input, test_mode: true }
    })
    return result
  }

  return (
    <AdminLayout>
      <AgentPageTemplate
        agentName="Tool Agent"
        agentDescription="Executes integrations with external tools and services, handling API calls, data synchronization, and system interactions."
        agentCapabilities={capabilities}
        testExamples={testExamples}
        onTest={handleTest}
      />
    </AdminLayout>
  )
}
