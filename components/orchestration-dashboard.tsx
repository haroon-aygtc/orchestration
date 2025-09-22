"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { OrchestrationService, CreateGoalRequest } from "@/lib/api"
import {
  Brain,
  Zap,
  GitBranch,
  Activity,
  Play,
  CheckCircle,
  Clock,
  AlertTriangle,
} from "lucide-react"

// Real API interfaces - aligned with orchestration service
interface OrchestrationGoal {
  id: string
  title: string
  description: string
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED"
  context?: any
  createdAt: string
  updatedAt: string
  steps: OrchestrationStep[]
  artifacts: any[]
  suggestions: any[]
}

interface OrchestrationStep {
  id: string
  goalId: string
  agent: string
  tool?: string
  input: any
  successCriteria: string
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED"
  startedAt?: string
  completedAt?: string
  result?: any
  error?: string
}

export function OrchestrationDashboard() {
  const [goals, setGoals] = useState<OrchestrationGoal[]>([])
  const [selectedGoal, setSelectedGoal] = useState<OrchestrationGoal | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [newGoal, setNewGoal] = useState({
    title: "",
    description: "",
    context: ""
  })

  // Load real goals from API
  useEffect(() => {
    loadGoals()
    const interval = setInterval(loadGoals, 3000) // Refresh every 3 seconds
    return () => clearInterval(interval)
  }, [])

  const loadGoals = async () => {
    try {
      const response = await fetch('/api/orchestration/goals')
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.goals) {
          setGoals(data.goals)
        }
      }
    } catch (error) {
      console.error("Failed to load goals:", error)
    }
  }

  const createGoal = async () => {
    if (!newGoal.title.trim()) return

    setIsCreating(true)
    try {
      const goalRequest: CreateGoalRequest = {
        name: newGoal.title,
        description: newGoal.description,
        steps: [],
        priority: 2 // Medium priority (1=low, 2=medium, 3=high)
      }

      const response = await fetch('/api/orchestration/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(goalRequest)
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.goal) {
          setGoals([...goals, data.goal])
          setNewGoal({ title: "", description: "", context: "" })
          setSelectedGoal(data.goal)
        }
      }
    } catch (error) {
      console.error("Failed to create goal:", error)
    } finally {
      setIsCreating(false)
    }
  }

  const generatePlan = async (goalId: string) => {
    try {
      const response = await fetch(`/api/orchestration/goals/${goalId}/generate-plan`, {
        method: 'POST'
      })
      if (response.ok) {
        await loadGoals() // Refresh to show updated steps
      }
    } catch (error) {
      console.error("Failed to generate plan:", error)
    }
  }

  const executeStep = async (goalId: string) => {
    setIsExecuting(true)
    try {
      const response = await fetch(`/api/orchestration/goals/${goalId}/execute-step`, {
        method: 'POST'
      })
      if (response.ok) {
        await loadGoals() // Refresh to show updated status
      }
    } catch (error) {
      console.error("Failed to execute step:", error)
    } finally {
      setIsExecuting(false)
    }
  }

  const runWorkflow = async (goalId: string) => {
    setIsExecuting(true)
    try {
      const response = await fetch(`/api/orchestration/goals/${goalId}/run-workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxSteps: 10 })
      })
      if (response.ok) {
        const data = await response.json()
        await loadGoals() // Refresh to show final status
        console.log("Workflow completed:", data)
      }
    } catch (error) {
      console.error("Failed to run workflow:", error)
    } finally {
      setIsExecuting(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED": return <CheckCircle className="h-4 w-4 text-green-500" />
      case "RUNNING": return <Activity className="h-4 w-4 text-blue-500 animate-pulse" />
      case "FAILED": return <AlertTriangle className="h-4 w-4 text-red-500" />
      default: return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED": return "bg-green-500"
      case "RUNNING": return "bg-blue-500"
      case "FAILED": return "bg-red-500"
      default: return "bg-gray-500"
    }
  }

  const calculateProgress = (goal: OrchestrationGoal) => {
    if (goal.steps.length === 0) return 0
    const completed = goal.steps.filter(s => s.status === "COMPLETED").length
    return (completed / goal.steps.length) * 100
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">AI Orchestration</h2>
          <p className="text-muted-foreground">
            Multi-agent workflow orchestration with real AI automation
          </p>
        </div>
        <Badge variant="outline" className="px-3 py-1">
          <Brain className="h-4 w-4 mr-2" />
          {goals.length} Active Goals
        </Badge>
      </div>

      <Tabs defaultValue="goals" className="space-y-4">
        <TabsList>
          <TabsTrigger value="goals">Goals</TabsTrigger>
          <TabsTrigger value="create">Create Goal</TabsTrigger>
          <TabsTrigger value="monitor">Monitor</TabsTrigger>
        </TabsList>

        <TabsContent value="goals" className="space-y-4">
          <div className="grid gap-4">
            {goals.map((goal) => (
              <Card key={goal.id} className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setSelectedGoal(goal)}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{goal.title}</CardTitle>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(goal.status)}
                      <Badge variant="outline">{goal.status}</Badge>
                    </div>
                  </div>
                  <CardDescription>{goal.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span>Progress</span>
                      <span>{Math.round(calculateProgress(goal))}%</span>
                    </div>
                    <Progress value={calculateProgress(goal)} className="h-2" />
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{goal.steps.length} steps</span>
                        <span>{goal.artifacts.length} artifacts</span>
                        <span>{goal.suggestions.length} suggestions</span>
                      </div>
                      <div className="flex gap-2">
                        {goal.steps.length === 0 && (
                          <Button size="sm" variant="outline" onClick={(e) => {
                            e.stopPropagation()
                            generatePlan(goal.id)
                          }}>
                            <GitBranch className="h-4 w-4 mr-1" />
                            Plan
                          </Button>
                        )}
                        {goal.status === "PENDING" && goal.steps.length > 0 && (
                          <Button size="sm" onClick={(e) => {
                            e.stopPropagation()
                            executeStep(goal.id)
                          }} disabled={isExecuting}>
                            <Play className="h-4 w-4 mr-1" />
                            Step
                          </Button>
                        )}
                        {goal.status === "RUNNING" && (
                          <Button size="sm" onClick={(e) => {
                            e.stopPropagation()
                            runWorkflow(goal.id)
                          }} disabled={isExecuting}>
                            <Zap className="h-4 w-4 mr-1" />
                            Run All
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="create" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Create Orchestration Goal</CardTitle>
              <CardDescription>
                Define a high-level goal for AI agents to accomplish
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Goal Title</Label>
                <Input
                  id="title"
                  placeholder="e.g., Automate customer onboarding process"
                  value={newGoal.title}
                  onChange={(e) => setNewGoal({...newGoal, title: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe what you want to achieve..."
                  value={newGoal.description}
                  onChange={(e) => setNewGoal({...newGoal, description: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="context">Context (JSON)</Label>
                <Textarea
                  id="context"
                  placeholder='{"customer": "john@example.com", "priority": "high"}'
                  value={newGoal.context}
                  onChange={(e) => setNewGoal({...newGoal, context: e.target.value})}
                />
              </div>
              
              <Button onClick={createGoal} disabled={isCreating || !newGoal.title.trim()}>
                {isCreating ? (
                  <>
                    <Activity className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4 mr-2" />
                    Create Goal
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitor" className="space-y-4">
          {selectedGoal && (
            <Card>
              <CardHeader>
                <CardTitle>{selectedGoal.title}</CardTitle>
                <CardDescription>{selectedGoal.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">Execution Steps</h4>
                    <Badge variant="outline">{selectedGoal.steps.length} steps</Badge>
                  </div>
                  
                  <div className="space-y-2">
                    {selectedGoal.steps.map((step, index) => (
                      <div key={step.id} className="flex items-center gap-3 p-3 border rounded-lg">
                        <div className={`w-2 h-2 rounded-full ${getStatusColor(step.status)}`} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{step.agent}</span>
                            {step.tool && <Badge variant="secondary">{step.tool}</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground">{step.successCriteria}</p>
                        </div>
                        {getStatusIcon(step.status)}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
