"use client"

import { AgentPageTemplate } from "@/components/agent-page-template"
import { AdminLayout } from "@/components/admin-layout"
import { LLMAgent } from "@/lib/agents/llm/llm-agent"
import { bootstrapAgents } from "@/lib/agents/bootstrap"
import { useState, useEffect } from "react"

let llmAgent: LLMAgent | null = null

export default function LLMAgentPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const initializeAgent = async () => {
      try {
        const agents = await bootstrapAgents()
        llmAgent = agents.llm as LLMAgent
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to initialize LLM agent")
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
            <p>Loading LLM agent...</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  if (error || !llmAgent) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center text-red-600">
            <p>Error: {error || "Failed to load LLM agent"}</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

const testExamples = [
  {
    name: "Business Content Generation",
    input: "Generate a professional email template for customer retention campaign",
    expectedOutput: "Personalized email content with compelling messaging and clear call-to-action",
  },
  {
    name: "Technical Documentation",
    input: "Create API documentation for customer onboarding endpoints",
    expectedOutput: "Comprehensive technical documentation with examples and best practices",
  },
  {
    name: "Strategic Analysis",
    input: "Analyze market trends and provide strategic recommendations for business growth",
    expectedOutput: "Detailed analysis with actionable insights and strategic recommendations",
  },
]

const capabilities = [
  "Advanced text generation with contextual understanding",
  "Multi-domain content creation and adaptation",
  "Reasoning and analytical response generation",
  "Creative and technical writing capabilities",
  "Context-aware conversation and dialogue management",
  "Structured output generation with custom formatting",
  "Temperature and creativity control for varied outputs",
  "Confidence assessment and alternative suggestion generation",
]

  const handleTest = async (input: string) => {
    if (!llmAgent) throw new Error("LLM agent not initialized")

    const result = await llmAgent.generateResponse({
      prompt: input,
      context: { taskId: "test-task", agentType: "llm" },
      options: {
        temperature: 0.7,
        maxTokens: 1000,
      }
    })
    return result
  }

  return (
    <AdminLayout>
      <AgentPageTemplate
        agentName="LLM Agent"
        agentDescription="Provides direct language model interactions for text generation, reasoning, and intelligent content creation across multiple domains."
        agentCapabilities={capabilities}
        testExamples={testExamples}
        onTest={handleTest}
      />
    </AdminLayout>
  )
}
