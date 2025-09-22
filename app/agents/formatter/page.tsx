"use client"

import { AgentPageTemplate } from "@/components/agent-page-template"
import { AdminLayout } from "@/components/admin-layout"
import { FormatterAgent } from "@/lib/agents/formatter/formatter-agent"
import { bootstrapAgents } from "@/lib/agents/bootstrap"
import { useState, useEffect } from "react"

let formatterAgent: FormatterAgent | null = null

export default function FormatterAgentPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const initializeAgent = async () => {
      try {
        const agents = await bootstrapAgents()
        formatterAgent = agents.formatter as FormatterAgent
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to initialize formatter agent")
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
            <p>Loading formatter agent...</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  if (error || !formatterAgent) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center text-red-600">
            <p>Error: {error || "Failed to load formatter agent"}</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

const testExamples = [
  {
    name: "Business Report Formatting",
    input: "Format quarterly sales data into executive presentation format",
    expectedOutput: "Professional report with charts, summaries, and executive insights",
  },
  {
    name: "API Response Transformation",
    input: "Convert raw customer data into user-friendly dashboard format",
    expectedOutput: "Structured data with proper formatting, validation, and presentation layer",
  },
  {
    name: "Email Template Generation",
    input: "Transform customer information into personalized email content",
    expectedOutput: "Formatted email with proper styling, personalization, and call-to-action",
  },
]

const capabilities = [
  "Multi-format data transformation and conversion",
  "Template-based output generation with customization",
  "Data validation and integrity checking during formatting",
  "Audience-specific content adaptation and presentation",
  "Compression and optimization for different output formats",
  "Real-time formatting with performance optimization",
  "Error handling and fallback formatting options",
  "Metadata generation and format documentation",
]

  const handleTest = async (input: string) => {
    if (!formatterAgent) throw new Error("Formatter agent not initialized")

    const sampleData = {
      sales: 150000,
      customers: 1250,
      growth: 0.23,
      regions: ["North", "South", "East", "West"],
    } as any;

    const format = input.toLowerCase().includes("report")
      ? "json"
      : input.toLowerCase().includes("api")
        ? "json"
        : input.toLowerCase().includes("email")
          ? "markdown"
          : "json"

    const result = await formatterAgent.formatOutput({  
      content: JSON.stringify(sampleData),
      format: format,
      options: {
        audience: "business_users",
        template: "professional",
      }
    })
    return result
  }

  return (
    <AdminLayout>
      <AgentPageTemplate
        agentName="Formatter Agent"
        agentDescription="Transforms and formats data into various output formats with validation, optimization, and audience-specific presentation."
        agentCapabilities={capabilities}
        testExamples={testExamples}
        onTest={handleTest}
      />
    </AdminLayout>
  )
}
