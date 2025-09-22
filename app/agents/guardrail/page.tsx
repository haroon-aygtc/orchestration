"use client"

import { AgentPageTemplate } from "@/components/agent-page-template"
import { AdminLayout } from "@/components/admin-layout"
import { GuardrailAgent } from "@/lib/agents/guardrail/guardrail-agent"
import { bootstrapAgents } from "@/lib/agents/bootstrap"
import { useState, useEffect } from "react"

let guardrailAgent: GuardrailAgent | null = null

export default function GuardrailAgentPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const initializeAgent = async () => {
      try {
        const agents = await bootstrapAgents()
        guardrailAgent = agents.guardrail as GuardrailAgent
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to initialize guardrail agent")
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
            <p>Loading guardrail agent...</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  if (error || !guardrailAgent) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center text-red-600">
            <p>Error: {error || "Failed to load guardrail agent"}</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

const testExamples = [
  {
    name: "Content Safety Validation",
    input: "Validate customer communication for inappropriate content and compliance",
    expectedOutput: "Safety assessment with risk level, violations, and approved content version",
  },
  {
    name: "Data Privacy Check",
    input: "Ensure customer data handling complies with GDPR and privacy regulations",
    expectedOutput: "Compliance report with privacy assessment and data handling recommendations",
  },
  {
    name: "Business Rule Validation",
    input: "Check automated workflow against company policies and business rules",
    expectedOutput: "Rule compliance analysis with policy violations and corrective actions",
  },
]

const capabilities = [
  "Content safety and appropriateness validation",
  "Data privacy and regulatory compliance checking",
  "Business rule and policy enforcement",
  "Risk assessment and threat detection",
  "Automated content sanitization and approval",
  "Violation tracking and audit trail generation",
  "Real-time compliance monitoring and alerts",
  "Customizable rule sets and policy configuration",
]

  const handleTest = async (input: string) => {
    if (!guardrailAgent) throw new Error("Guardrail agent not initialized")

    const testContent = {
      message: input,
      userEmail: "test@example.com",
      timestamp: new Date().toISOString(),
      source: "agent_testing",
    }

    const rules = input.toLowerCase().includes("safety")
      ? ["content_safety", "harassment_prevention", "spam_detection"]
      : input.toLowerCase().includes("privacy")
        ? ["data_privacy", "gdpr_compliance", "pii_protection"]
        : ["business_compliance", "policy_adherence", "operational_rules"]

    const result = await guardrailAgent.validateContent({
      content: JSON.stringify(testContent),
      rules,
      context: { taskId: "test-task", agentType: "guardrail" },
    })
    return result
  }

  return (
    <AdminLayout>
      <AgentPageTemplate
        agentName="Guardrail Agent"
        agentDescription="Ensures safety, compliance, and policy adherence through intelligent validation and risk assessment mechanisms."
        agentCapabilities={capabilities}
        testExamples={testExamples}
        onTest={handleTest}
      />
    </AdminLayout>
  )
}
