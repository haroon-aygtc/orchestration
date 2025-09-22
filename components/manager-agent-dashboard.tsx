"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Brain, Play, Users, Zap, Database, CheckCircle, Clock } from "lucide-react"
import { AgentTask } from "@/lib/agents/shared/types"
// Removed direct service import - using API calls instead

interface RealAgent {
  id: string;
  type: string;
  name: string;
  capabilities: string[];
  status: "idle" | "busy" | "error";
  tasksCompleted: number;
  lastActive: string; // API returns string, not Date
}

// REAL API Client - Calls actual server-side AI agents
class RealAPIClient {
  async getSystemStatus() {
    try {
      const response = await fetch('/api/agents');
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data.systemStatus;
    } catch (error) {
      console.error('Failed to get system status:', error);
      // Fallback to basic status
      return {
        agents: { active: 0, total: 0 },
        tasks: { running: 0, total: 0 },
        tools: { available: 11, working: 11 },
        performance: {
          totalTasksCompleted: 0,
          averageResponseTime: 0,
          successRate: 0,
          uptime: "0%"
        }
      };
    }
  }

  async listAgents(): Promise<RealAgent[]> {
    try {
      const response = await fetch('/api/agents');
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data.agents;
    } catch (error) {
      console.error('Failed to list agents:', error);
      return [];
    }
  }

  async listTasks(): Promise<AgentTask[]> {
    try {
      const response = await fetch('/api/agents');
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data.tasks;
    } catch (error) {
      console.error('Failed to list tasks:', error);
      return [];
    }
  }

  async createAndExecuteTask(input: {
    title: string;
    description: string;
    type: string;
    input?: unknown;
    agentType?: string;
  }): Promise<AgentTask> {
    try {
      console.log('🚀 Creating REAL AI Agent Task:', input.title);

      const response = await fetch('/api/agents/task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      console.log('✅ Real AI task created:', result.data.id);
      return result.data;
    } catch (error) {
      console.error('❌ Failed to create real task:', error);
      throw error;
    }
  }

  async analyzeBusinessNeeds(responses: Record<string, string>) {
    try {
      console.log('🧠 Starting REAL Business Analysis with AI...');

      const response = await fetch('/api/agents/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ responses }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      console.log('✅ Real business analysis completed');
      return result.data;
    } catch (error) {
      console.error('❌ Real business analysis failed:', error);
      throw error;
    }
  }
}

export function ManagerAgentDashboard() {
  const [managerAgent] = useState(() => new RealAPIClient())
  const [systemStatus, setSystemStatus] = useState<any>(null)
  const [agents, setAgents] = useState<RealAgent[]>([])
  const [tasks, setTasks] = useState<AgentTask[]>([])
  const [isCreatingTask, setIsCreatingTask] = useState(false)
  const [businessResponses, setBusinessResponses] = useState<Record<string, string>>({})
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // Real-time updates
  useEffect(() => {
    const updateStatus = async () => {
      const status = await managerAgent.getSystemStatus()
      const agentsList = await managerAgent.listAgents()
      const tasksList = await managerAgent.listTasks()

      setSystemStatus(status)
      setAgents(agentsList)
      setTasks(tasksList)
    }

    updateStatus()
    const interval = setInterval(updateStatus, 2000) // Update every 2 seconds

    return () => clearInterval(interval)
  }, [managerAgent])

  const handleBusinessAnalysis = async () => {
    if (!businessResponses.industry || !businessResponses.goals) {
      alert("Please fill in at least industry and goals")
      return
    }

    setIsAnalyzing(true)
    try {
      const analysis = await managerAgent.analyzeBusinessNeeds(businessResponses)
      console.log("[v0] Business analysis created:", analysis)
      alert(`Business analysis complete! ${analysis.analysis}`)
    } catch (error) {
      console.error("[v0] Business analysis error:", error)
      alert("Business analysis failed. Please try again.")
    } finally {
      setIsAnalyzing(false)
    }
  }

  const createRealTask = async (taskType: "ai_analysis" | "data_processing" | "integration" | "automation") => {
    setIsCreatingTask(true)
    try {
      const taskData = {
        title: `${taskType.replace("_", " ").toUpperCase()} Task`,
        description: `Automated ${taskType} task created at ${new Date().toLocaleTimeString()}`,
        type: taskType,
        input: {
          data: "Sample data for processing",
          timestamp: new Date(),
          userRequest: `Execute ${taskType} operation`,
        },
        agentType:
          taskType === "ai_analysis"
            ? "analyzer"
            : taskType === "data_processing"
              ? "retriever"
              : taskType === "integration"
                ? "integration"
                : "workflow",
      }

      const task = await managerAgent.createAndExecuteTask(taskData)
      console.log("[v0] Real task created and executing:", task)
      alert(`Task "${task.title}" created and started execution!`)
    } catch (error) {
      console.error("[v0] Task creation error:", error)
      alert("Failed to create task. Please try again.")
    } finally {
      setIsCreatingTask(false)
    }
  }

  if (!systemStatus) {
    return <div className="flex items-center justify-center h-64">Loading real agent system...</div>
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="flex h-16 items-center px-6">
          <div className="flex items-center gap-2">
            <Brain className="h-8 w-8 text-accent" />
            <div>
              <h1 className="text-xl font-bold">Real AI Agent System</h1>
              <p className="text-sm text-muted-foreground">Functional AI-Powered Orchestration</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <Badge variant="default">{systemStatus.agents.active} Active Agents</Badge>
            <Badge variant="secondary">{systemStatus.tasks.running} Running Tasks</Badge>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Real-time Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Agents</p>
                  <p className="text-2xl font-bold text-green-500">{systemStatus.agents.active}</p>
                </div>
                <Users className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Tasks Completed</p>
                  <p className="text-2xl font-bold text-blue-500">{systemStatus.performance.totalTasksCompleted}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                  <p className="text-2xl font-bold text-purple-500">
                    {systemStatus.performance.successRate.toFixed(1)}%
                  </p>
                </div>
                <Zap className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Task Time</p>
                  <p className="text-2xl font-bold text-orange-500">
                    {(systemStatus.performance.averageTaskTime / 1000).toFixed(1)}s
                  </p>
                </div>
                <Clock className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="business-intelligence" className="space-y-6">
          <TabsList>
            <TabsTrigger value="business-intelligence">Business Intelligence</TabsTrigger>
            <TabsTrigger value="task-execution">Task Execution</TabsTrigger>
            <TabsTrigger value="agent-status">Agent Status</TabsTrigger>
            <TabsTrigger value="real-time-monitor">Live Monitor</TabsTrigger>
          </TabsList>

          <TabsContent value="business-intelligence" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Real AI Business Analysis</CardTitle>
                <CardDescription>Get actual AI-powered business insights and recommendations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="industry">Industry</Label>
                    <Input
                      id="industry"
                      value={businessResponses.industry || ""}
                      onChange={(e) => setBusinessResponses((prev) => ({ ...prev, industry: e.target.value }))}
                      placeholder="e.g., E-commerce, SaaS, Healthcare"
                    />
                  </div>
                  <div>
                    <Label htmlFor="company-size">Company Size</Label>
                    <Select
                      value={businessResponses.companySize || ""}
                      onValueChange={(value) => setBusinessResponses((prev) => ({ ...prev, companySize: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1-10">1-10 employees</SelectItem>
                        <SelectItem value="11-50">11-50 employees</SelectItem>
                        <SelectItem value="51-200">51-200 employees</SelectItem>
                        <SelectItem value="200+">200+ employees</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="goals">Business Goals</Label>
                  <Textarea
                    id="goals"
                    value={businessResponses.goals || ""}
                    onChange={(e) => setBusinessResponses((prev) => ({ ...prev, goals: e.target.value }))}
                    placeholder="Describe your primary business objectives..."
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="challenges">Current Challenges</Label>
                  <Textarea
                    id="challenges"
                    value={businessResponses.challenges || ""}
                    onChange={(e) => setBusinessResponses((prev) => ({ ...prev, challenges: e.target.value }))}
                    placeholder="What operational challenges are you facing?"
                    rows={3}
                  />
                </div>

                <Button onClick={handleBusinessAnalysis} disabled={isAnalyzing} className="w-full">
                  {isAnalyzing ? "Analyzing with AI..." : "Get Real AI Business Analysis"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="task-execution" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Execute Real AI Tasks</CardTitle>
                <CardDescription>Create and run actual AI-powered automation tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Button
                    onClick={() => createRealTask("ai_analysis")}
                    disabled={isCreatingTask}
                    className="h-20 flex flex-col gap-2"
                  >
                    <Brain className="h-6 w-6" />
                    AI Analysis Task
                  </Button>

                  <Button
                    onClick={() => createRealTask("data_processing")}
                    disabled={isCreatingTask}
                    className="h-20 flex flex-col gap-2"
                    variant="outline"
                  >
                    <Database className="h-6 w-6" />
                    Data Processing
                  </Button>

                  <Button
                    onClick={() => createRealTask("integration")}
                    disabled={isCreatingTask}
                    className="h-20 flex flex-col gap-2"
                    variant="outline"
                  >
                    <Zap className="h-6 w-6" />
                    System Integration
                  </Button>

                  <Button
                    onClick={() => createRealTask("automation")}
                    disabled={isCreatingTask}
                    className="h-20 flex flex-col gap-2"
                    variant="outline"
                  >
                    <Play className="h-6 w-6" />
                    Workflow Automation
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Real Task List */}
            <Card>
              <CardHeader>
                <CardTitle>Live Task Execution</CardTitle>
                <CardDescription>Real-time task status and results</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {tasks.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No tasks created yet. Create a task above to see real execution.
                    </p>
                  ) : (
                    tasks
                      .slice(-10)
                      .reverse()
                      .map((task) => (
                        <div key={task.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium">{task.title}</div>
                            <div className="text-sm text-muted-foreground">{task.description}</div>
                            {task.output != null && (
                              <div className="text-xs text-green-600 mt-1">
                                  Output: {JSON.stringify(task.output).substring(0, 100)}...
                              </div>
                            )}  
                            {task.error && <div className="text-xs text-red-600 mt-1">Error: {task.error}</div>}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                task.status === "completed"
                                  ? "default"
                                  : task.status === "running"
                                    ? "secondary"
                                    : task.status === "failed"
                                      ? "destructive"
                                      : "outline"
                              }
                            >
                              {task.status}
                            </Badge>
                            {task.status === "running" && (
                              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                            )}
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="agent-status" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map((agent) => (
                <Card key={agent.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{agent.name}</CardTitle>
                      <Badge
                        variant={
                          agent.status === "busy" ? "default" : agent.status === "error" ? "destructive" : "secondary"
                        }
                      >
                        {agent.status}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">
                      Last active: {new Date(agent.lastActive).toLocaleTimeString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <div className="text-xs font-medium mb-1">Capabilities</div>
                      <div className="flex flex-wrap gap-1">
                        {agent.capabilities.map((cap, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {cap.replace("_", " ")}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Tasks Completed: </span>
                      <span className="font-medium">{agent.tasksCompleted}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="real-time-monitor" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>System Performance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Agent Utilization</span>
                      <span>{((systemStatus.agents.active / systemStatus.agents.total) * 100).toFixed(0)}%</span>
                    </div>
                    <Progress value={(systemStatus.agents.active / systemStatus.agents.total) * 100} />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Task Success Rate</span>
                      <span>{systemStatus.performance.successRate.toFixed(1)}%</span>
                    </div>
                    <Progress value={systemStatus.performance.successRate} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Task Distribution</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">Running:</span>
                    <Badge>{systemStatus.tasks.running}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Completed:</span>
                    <Badge variant="secondary">{systemStatus.tasks.completed}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Failed:</span>
                    <Badge variant="destructive">{systemStatus.tasks.failed}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Pending:</span>
                    <Badge variant="outline">{systemStatus.tasks.pending}</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
