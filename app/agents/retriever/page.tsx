"use client"

import { AgentPageTemplate } from "@/components/agent-page-template"
import { AdminLayout } from "@/components/admin-layout"
import { RetrieverAgent } from "@/lib/agents/retriever/retriever-agent"
import { bootstrapAgents } from "@/lib/agents/bootstrap"
import { useState, useEffect } from "react"

let retrieverAgent: RetrieverAgent | null = null

export default function RetrieverAgentPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const initializeAgent = async () => {
      try {
        const agents = await bootstrapAgents()
        retrieverAgent = agents.retriever as RetrieverAgent
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to initialize retriever agent")
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
            <p>Loading retriever agent...</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  if (error || !retrieverAgent) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center text-red-600">
            <p>Error: {error || "Failed to load retriever agent"}</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

const testExamples = [
  {
    name: "Knowledge Base Search",
    input: "Find information about API rate limits and authentication methods",
    expectedOutput: "Relevant documentation, code examples, and best practices for API usage",
  },
  {
    name: "Customer Data Retrieval",
    input: "Get customer purchase history and preferences for user ID 12345",
    expectedOutput: "Customer profile, transaction history, and behavioral insights",
  },
  {
    name: "Market Research Query",
    input: "Research competitors in the e-commerce automation space",
    expectedOutput: "Competitor analysis, market trends, and positioning insights",
  },
]

const capabilities = [
  "Intelligent data search across multiple sources and databases",
  "Contextual information retrieval with relevance scoring",
  "Knowledge base integration and semantic search capabilities",
  "Real-time data aggregation from APIs and external services",
  "Content summarization and key insight extraction",
  "Multi-source data correlation and relationship mapping",
  "Filtered search with custom parameters and constraints",
  "Confidence-based result ranking and recommendation generation",
]



  const handleTest = async (input: string) => {
    if (!retrieverAgent) throw new Error("Retriever agent not initialized")

    const result = await retrieverAgent.retrieveInformation({
      query: input,
      sources: ["knowledge_base", "api_docs", "customer_data"],
      filters: { relevance_threshold: 0.7 },
    })
    return result
  }

  return (
    <AdminLayout>
      <AgentPageTemplate
        agentName="Retriever Agent"
        agentDescription="Searches and retrieves relevant information from multiple data sources using intelligent query processing and semantic understanding."
        agentCapabilities={capabilities}
        testExamples={testExamples}
        onTest={handleTest}
      />
    </AdminLayout>
  )
}
