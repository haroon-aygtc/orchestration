"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { NoSSR } from "@/components/no-ssr"
import {
  Brain,
  Settings,
  Activity,
  BarChart3,
  TestTube,
  Search,
  Wrench,
  GitBranch,
  Archive,
  UserCheck,
  FileText,
  Shield,
  MessageSquare,
  ExternalLink,
  Menu,
  X,
  Code,
} from "lucide-react"

const navigationItems = [
  {
    label: "Overview",
    href: "/",
    icon: BarChart3,
    description: "Main dashboard and system overview",
  },
  {
    label: "Solution Creator",
    href: "/solutions",
    icon: Code,
    description: "Create deployable automation solutions",
  },
  {
    label: "Business Intelligence",
    href: "/business-intelligence",
    icon: Brain,
    description: "AI-powered business analysis",
  },
  {
    label: "Task Ledger",
    href: "/task-ledger",
    icon: FileText,
    description: "Task management and orchestration",
  },
  {
    label: "Orchestration",
    href: "/orchestration",
    icon: GitBranch,
    description: "Multi-agent workflow orchestration",
  },
  {
    label: "AI Configuration",
    href: "/ai-configuration",
    icon: Settings,
    description: "Configure AI providers and models",
  },
  {
    label: "Agent Testing",
    href: "/agent-testing",
    icon: TestTube,
    description: "Test and validate agent functionality",
  },
  {
    label: "Real-time Monitor",
    href: "/monitoring",
    icon: Activity,
    description: "Live system monitoring and metrics",
  },
]

const agentPages = [
  { name: "Intent Agent", href: "/agents/intent", icon: Brain, description: "Natural language understanding" },
  { name: "Retriever Agent", href: "/agents/retriever", icon: Search, description: "Information retrieval and search" },
  { name: "Tool Agent", href: "/agents/tool", icon: Wrench, description: "External tool integration" },
  { name: "Workflow Agent", href: "/agents/workflow", icon: GitBranch, description: "Process orchestration" },
  { name: "Memory Agent", href: "/agents/memory", icon: Archive, description: "Context and data storage" },
  { name: "Follow Agent", href: "/agents/follow", icon: UserCheck, description: "Task tracking and follow-up" },
  {
    name: "Formatter Agent",
    href: "/agents/formatter",
    icon: FileText,
    description: "Data formatting and transformation",
  },
  { name: "Guardrail Agent", href: "/agents/guardrail", icon: Shield, description: "Safety and compliance validation" },
  { name: "LLM Agent", href: "/agents/llm", icon: MessageSquare, description: "Direct language model interaction" },
]

interface AdminLayoutProps {
  children: React.ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setMounted(true)
  }, [])

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/"
    }
    return pathname.startsWith(href)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="flex h-16 items-center px-6">
          <NoSSR fallback={<Button variant="ghost" size="icon" className="mr-4"><Menu className="h-4 w-4" /></Button>}>
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="mr-4">
              {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </NoSSR>

          <div className="flex items-center gap-2">
            <Brain className="h-8 w-8 text-accent" />
            <div>
              <h1 className="text-xl font-bold">AxientOS Manager Agent</h1>
              <p className="text-sm text-muted-foreground">Magentic Orchestration Platform</p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-4">
            <Badge variant="default">System Online</Badge>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={cn(
            "border-r bg-sidebar transition-all duration-300 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto",
            sidebarOpen ? "w-80" : "w-0",
          )}
        >
          {sidebarOpen && (
            <nav className="p-4 space-y-6">
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Main Dashboard
                </h3>
                <div className="space-y-1">
                  {navigationItems.map((item) => (
                    <Link key={item.href} href={item.href}>
                      <Button
                        variant={isActive(item.href) ? "default" : "ghost"}
                        className="w-full justify-start gap-3 h-auto p-3"
                      >
                        <item.icon className="h-4 w-4 flex-shrink-0" />
                        <div className="text-left">
                          <div className="font-medium">{item.label}</div>
                          <div className="text-xs text-muted-foreground">{item.description}</div>
                        </div>
                      </Button>
                    </Link>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Individual Agents
                </h3>
                <div className="space-y-1">
                  {agentPages.map((agent) => (
                    <Link key={agent.href} href={agent.href}>
                      <Button
                        variant={isActive(agent.href) ? "default" : "ghost"}
                        className="w-full justify-start gap-3 h-auto p-3"
                      >
                        <agent.icon className="h-4 w-4 flex-shrink-0" />
                        <div className="text-left flex-1">
                          <div className="font-medium">{agent.name}</div>
                          <div className="text-xs text-muted-foreground">{agent.description}</div>
                        </div>
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="bg-sidebar-primary rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-sidebar-accent rounded-full flex items-center justify-center">
                      <Activity className="h-5 w-5 text-sidebar-accent-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-sidebar-primary-foreground">System Status</p>
                      <p className="text-xs text-muted-foreground">All agents operational</p>
                    </div>
                  </div>
                </div>
              </div>
            </nav>
          )}
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-h-[calc(100vh-4rem)]">{children}</main>
      </div>
    </div>
  )
}
