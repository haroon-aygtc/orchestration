"use client"

import { AgentPageTemplate } from "@/components/agent-page-template"
import { AdminLayout } from "@/components/admin-layout"
import { WorkflowAgent } from "@/lib/agents/workflow/workflow-agent"
import { bootstrapAgents } from "@/lib/agents/bootstrap"
import { useState, useEffect } from "react"

let workflowAgent: WorkflowAgent | null = null

export default function WorkflowAgentPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const initializeAgent = async () => {
      try {
        const agents = await bootstrapAgents()
        workflowAgent = agents.workflow as WorkflowAgent
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to initialize workflow agent")
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
            <p>Loading workflow agent...</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  if (error || !workflowAgent) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center text-red-600">
            <p>Error: {error || "Failed to load workflow agent"}</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

const testExamples = [
  {
    name: "Customer Onboarding Workflow",
    input: "Create workflow for new customer registration and welcome process",
    expectedOutput: "Multi-step workflow with email verification, profile setup, and welcome sequence",
  },
  {
    name: "Order Processing Automation",
    input: "Design workflow for order fulfillment from payment to shipping",
    expectedOutput: "Automated process including payment verification, inventory check, and shipping coordination",
  },
  {
    name: "Support Ticket Resolution",
    input: "Build workflow for customer support ticket routing and escalation",
    expectedOutput: "Intelligent routing system with priority handling and escalation triggers",
  },
]

const capabilities = [
  "Multi-step workflow design and orchestration",
  "Dependency management and sequential task execution",
  "Conditional logic and branching workflow paths",
  "Parallel processing and concurrent task handling",
  "Error handling and automatic rollback mechanisms",
  "Progress tracking and milestone monitoring",
  "Dynamic workflow modification based on real-time conditions",
  "Integration with external systems and service coordination",
]

  const handleTest = async (input: string) => {
    if (!workflowAgent) throw new Error("Workflow agent not initialized")

    const workflowName = input.toLowerCase().includes("onboarding")
      ? "Customer Onboarding"
      : input.toLowerCase().includes("order")
        ? "Order Processing"
        : input.toLowerCase().includes("support")
          ? "Support Ticket Resolution"
          : "Custom Workflow"

    const result = await workflowAgent.createWorkflow({
      name: workflowName,
      description: input,
      triggers: ["user_action", "system_event"],
      goals: ["automation", "efficiency", "user_satisfaction"],
    })
    return result
  }

  return (
    <AdminLayout>
      <AgentPageTemplate
        agentName="Workflow Agent"
        agentDescription="Creates and manages complex multi-step workflows with dependency handling, error recovery, and real-time orchestration."
        agentCapabilities={capabilities}
        testExamples={testExamples}
        onTest={handleTest}
      />
    </AdminLayout>
  )
}
