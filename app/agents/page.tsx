"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { AdminLayout } from "@/components/admin-layout"
import { aiConfigService } from "@/lib/ai-config-service"
import {
  Brain,
  Database,
  Wrench,
  Workflow,
  MemoryStick as Memory,
  Eye,
  FileText,
  Shield,
  MessageSquare,
} from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"

const agentIcons = {
  intent: Brain,
  retriever: Database,
  tool: Wrench,
  workflow: Workflow,
  memory: Memory,
  follow: Eye,
  formatter: FileText,
  guardrail: Shield,
  llm: MessageSquare,
}

export default function AgentsPage() {
  const agentMappings = aiConfigService.getAgentMappings()
  const [agentInfos, setAgentInfos] = useState<Record<string, any>>({})

  useEffect(() => {
    const loadAgentInfos = async () => {
      const infos: Record<string, any> = {}
      for (const agentType of Object.keys(agentMappings)) {
        try {
          infos[agentType] = await aiConfigService.getAgentAIInfo(agentType)
        } catch (error) {
          infos[agentType] = { isConfigured: false, status: "error" }
        }
      }
      setAgentInfos(infos)
    }
    loadAgentInfos()
  }, [agentMappings])

  return (
    <AdminLayout>
      <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Agents Management</h1>
          <p className="text-muted-foreground">Manage and monitor your 9 specialized AI agents</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(agentMappings).map(([agentType, mapping]) => {
          const Icon = agentIcons[agentType as keyof typeof agentIcons]
          const agentInfo = agentInfos[agentType] || { isConfigured: false, status: "loading" }

          return (
            <Card key={agentType} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="capitalize">{agentType} Agent</CardTitle>
                    <CardDescription className="text-sm">{mapping.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status</span>
                  <Badge variant={agentInfo.isConfigured ? "default" : "secondary"}>{agentInfo.status}</Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>AI Provider</span>
                    <Badge variant="outline">{mapping.provider.toUpperCase()}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Model</span>
                    <span className="font-mono text-xs">{mapping.model}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Performance</span>
                    <span>{agentInfo.isConfigured ? "95%" : "0%"}</span>
                  </div>
                  <Progress value={agentInfo.isConfigured ? 95 : 0} className="h-2" />
                </div>

                <Link href={`/agents/${agentType}`}>
                  <Button className="w-full" variant={agentInfo.isConfigured ? "default" : "outline"}>
                    {agentInfo.isConfigured ? "Manage Agent" : "Configure Agent"}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )
        })}
      </div>
      </div>
    </AdminLayout>
  )
}
