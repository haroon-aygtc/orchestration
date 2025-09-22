"use client"

import { AgentPageTemplate } from "@/components/agent-page-template"
import { AdminLayout } from "@/components/admin-layout"
import { FollowAgent } from "@/lib/agents/follow/follow-agent"
import { bootstrapAgents } from "@/lib/agents/bootstrap"
import { useState, useEffect } from "react"

let followAgent: FollowAgent | null = null

export default function FollowAgentPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const initializeAgent = async () => {
      try {
        const agents = await bootstrapAgents()
        followAgent = agents.follow as FollowAgent
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to initialize follow agent")
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
            <p>Loading follow agent...</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  if (error || !followAgent) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center text-red-600">
            <p>Error: {error || "Failed to load follow agent"}</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

const testExamples = [
  {
    name: "Project Progress Tracking",
    input: "Monitor customer onboarding project with milestones and deadlines",
    expectedOutput: "Progress report with completed checkpoints, risks, and next steps",
  },
  {
    name: "Workflow Execution Monitoring",
    input: "Track automated email campaign workflow execution and performance",
    expectedOutput: "Real-time status updates with performance metrics and issue alerts",
  },
  {
    name: "Task Completion Follow-up",
    input: "Follow up on pending customer support tickets and escalation needs",
    expectedOutput: "Status assessment with escalation recommendations and timeline updates",
  },
]

const capabilities = [
  "Real-time task and workflow progress monitoring",
  "Milestone tracking and completion verification",
  "Risk assessment and early warning system",
  "Automated follow-up and reminder generation",
  "Performance metrics collection and analysis",
  "Escalation trigger detection and notification",
  "Progress visualization and reporting dashboard",
  "Predictive completion time estimation and planning",
]

  const handleTest = async (input: string) => {
    if (!followAgent) throw new Error("Follow agent not initialized")

    const taskId = `task_${Date.now()}`
    const checkpoints = input.toLowerCase().includes("project")
      ? ["planning", "execution", "review", "completion"]
      : input.toLowerCase().includes("workflow")
        ? ["initialization", "processing", "validation", "delivery"]
        : ["assessment", "action", "follow_up", "resolution"]

    const result = await followAgent.trackProgress({
      taskId,
      checkpoints,
      notifications: ["email", "dashboard", "slack"],
    })
    return result
  }

  return (
    <AdminLayout>
      <AgentPageTemplate
        agentName="Follow Agent"
        agentDescription="Tracks progress, monitors task completion, and provides intelligent follow-up recommendations with risk assessment."
        agentCapabilities={capabilities}
        testExamples={testExamples}
        onTest={handleTest}
      />
    </AdminLayout>
  )
}
