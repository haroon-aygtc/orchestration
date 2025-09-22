"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { agentConfigs } from "@/lib/ai-config-service"
// Removed direct import - using API instead
import {
  Brain,
  Search,
  Wrench,
  GitBranch,
  Database,
  Eye,
  FileText,
  Shield,
  MessageSquare,
  CheckCircle,
  XCircle,
  Loader2,
  Activity,
  Clock,
  TrendingUp,
} from "lucide-react"

interface TestMetrics {
  totalTests: number
  passedTests: number
  failedTests: number
  averageResponseTime: number
  lastTestTime: Date | null
}

export function AgentTestingPanel() {
  const [testResults, setTestResults] = useState<Record<string, any>>({})
  const [isTestingAll, setIsTestingAll] = useState(false)
  const [customInput, setCustomInput] = useState("")
  const [selectedAgent, setSelectedAgent] = useState<string>("intent")
  const [testMetrics, setTestMetrics] = useState<TestMetrics>({
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    averageResponseTime: 0,
    lastTestTime: null,
  })
  const [isConnected, setIsConnected] = useState(false)

  // Icon mapping for agent configurations
  const iconMap = {
    Brain,
    Search,
    Wrench,
    GitBranch,
    Database,
    Eye,
    FileText,
    Shield,
    MessageSquare,
  }



  useEffect(() => {
    const eventSource = new EventSource("/api/websocket?agentId=test_monitor")

    eventSource.onopen = () => {
      setIsConnected(true)
      console.log("[v0] Connected to test monitoring stream")
    }

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === "test_event") {
          console.log("[v0] Received test event:", data.event)
        }
      } catch (error) {
        console.error("[v0] Error parsing test event:", error)
      }
    }

    eventSource.onerror = () => {
      setIsConnected(false)
      console.log("[v0] Test monitoring connection lost")
    }

    return () => {
      eventSource.close()
    }
  }, [])

  const updateTestMetrics = (success: boolean, responseTime: number) => {
    setTestMetrics((prev) => ({
      totalTests: prev.totalTests + 1,
      passedTests: prev.passedTests + (success ? 1 : 0),
      failedTests: prev.failedTests + (success ? 0 : 1),
      averageResponseTime: (prev.averageResponseTime * prev.totalTests + responseTime) / (prev.totalTests + 1),
      lastTestTime: new Date(),
    }))
  }

  const getTestInputForAgent = (agentKey: string) => {
    switch (agentKey) {
      case "intent":
        return { text: "I want to analyze customer feedback", context: "customer service" }
      case "retriever":
        return { query: "customer feedback analysis", sources: ["tasks"] }
      case "tool":
        return { toolName: "hash_sha256", parameters: { input: "test-data" } }
      case "workflow":
        return { name: "Customer Feedback Workflow", description: "Process customer feedback", triggers: ["new_feedback"], goals: ["analyze", "categorize"] }
      case "memory":
        return { key: "test-key", value: { message: "Test memory storage" }, context: "testing", ttl: 60000 }
      case "follow":
        return { taskId: "test-task", checkpoints: ["start", "process", "complete"] }
      case "formatter":
        return { data: [{ name: "Test", value: "Data" }], format: "json" as const }
      case "guardrail":
        return { content: "This is safe content for testing", rules: ["no_secrets", "data_privacy"] }
      case "llm":
        return { prompt: "Generate a test response", context: "testing" }
      default:
        return {}
    }
  }

  const getCustomInputForAgent = (agentKey: string, customInput: string) => {
    switch (agentKey) {
      case "intent":
        return { text: customInput, context: "custom test" }
      case "retriever":
        return { query: customInput, sources: ["tasks"] }
      case "tool":
        return { toolName: "hash_sha256", parameters: { input: customInput } }
      case "workflow":
        return { name: "Custom Workflow", description: customInput, triggers: ["manual"], goals: ["execute_custom_task"] }
      case "memory":
        return { key: "custom_test", value: customInput, context: "Custom test input" }
      case "follow":
        return { taskId: "custom-task", checkpoints: ["start", "process", "complete"] }
      case "formatter":
        return { data: customInput, format: "json" as const }
      case "guardrail":
        return { content: customInput, rules: ["no_secrets", "data_privacy"] }
      case "llm":
        return { prompt: customInput, context: "Custom user request" }
      default:
        return { input: customInput }
    }
  }

  const testSingleAgent = async (agentKey: string) => {
    const startTime = Date.now()
    setTestResults((prev) => ({ ...prev, [agentKey]: { testing: true } }))

    try {
      // Get test input for the agent
      const testInput = getTestInputForAgent(agentKey)
      
      // Call the API
      const response = await fetch('/api/agents/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentType: agentKey,
          input: testInput
        })
      })

      const data = await response.json()
      const responseTime = Date.now() - startTime

      setTestResults((prev) => ({
        ...prev,
        [agentKey]: {
          testing: false,
          success: data.success,
          result: data.result,
          error: data.error,
          timestamp: new Date(),
          responseTime: data.responseTime || responseTime,
        },
      }))

      updateTestMetrics(data.success, responseTime)
      console.log(`[v0] ${agentKey} test completed in ${responseTime}ms`)
    } catch (error) {
      const responseTime = Date.now() - startTime
      setTestResults((prev) => ({
        ...prev,
        [agentKey]: {
          testing: false,
          success: false,
          error: error instanceof Error ? error.message : "Test failed",
          timestamp: new Date(),
          responseTime,
        },
      }))

      updateTestMetrics(false, responseTime)
      console.error(`[v0] ${agentKey} test failed:`, error)
    }
  }

  const testAllAgents = async () => {
    setIsTestingAll(true)
    setTestResults({})
    console.log("[v0] Starting comprehensive test of all 9 agents")

    for (const config of agentConfigs) {
      await testSingleAgent(config.key)
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    setIsTestingAll(false)
    console.log("[v0] Completed testing all agents")
  }

  const runCustomTest = async () => {
    if (!customInput.trim()) return

    const startTime = Date.now()
    setTestResults((prev) => ({ ...prev, [selectedAgent]: { testing: true } }))

    try {
      // Get custom input for the selected agent
      const customInputData = getCustomInputForAgent(selectedAgent, customInput)
      
      // Call the API
      const response = await fetch('/api/agents/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentType: selectedAgent,
          input: customInputData
        })
      })

      const data = await response.json()
      const responseTime = Date.now() - startTime

      setTestResults((prev) => ({
        ...prev,
        [selectedAgent]: {
          testing: false,
          success: data.success,
          result: data.result,
          error: data.error,
          timestamp: new Date(),
          custom: true,
          responseTime: data.responseTime || responseTime,
        },
      }))

      updateTestMetrics(data.success, responseTime)
      console.log(`[v0] Custom test for ${selectedAgent} completed in ${responseTime}ms`)
    } catch (error) {
      const responseTime = Date.now() - startTime
      setTestResults((prev) => ({
        ...prev,
        [selectedAgent]: {
          testing: false,
          success: false,
          error: error instanceof Error ? error.message : "Test failed",
          timestamp: new Date(),
          custom: true,
          responseTime,
        },
      }))

      updateTestMetrics(false, responseTime)
      console.error(`[v0] Custom test for ${selectedAgent} failed:`, error)
    }
  }

  const successRate = testMetrics.totalTests > 0 ? (testMetrics.passedTests / testMetrics.totalTests) * 100 : 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Connection Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={isConnected ? "default" : "destructive"} className="flex items-center gap-2 w-fit">
              <Activity className="w-3 h-3" />
              {isConnected ? "Live Monitoring" : "Disconnected"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{successRate.toFixed(1)}%</div>
            <Progress value={successRate} className="mt-2 h-1" />
            <p className="text-xs text-muted-foreground mt-1">
              {testMetrics.passedTests}/{testMetrics.totalTests} tests passed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Avg Response Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{testMetrics.averageResponseTime.toFixed(0)}ms</div>
            <p className="text-xs text-muted-foreground">AI processing time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Total Tests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{testMetrics.totalTests}</div>
            <p className="text-xs text-muted-foreground">
              {testMetrics.lastTestTime ? `Last: ${testMetrics.lastTestTime.toLocaleTimeString()}` : "No tests yet"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Real AI Agent Testing - All 9 Specialized Agents</CardTitle>
          <CardDescription>
            Test all 9 specialized agents with real AI functionality to verify they work correctly with live performance
            monitoring
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={testAllAgents} disabled={isTestingAll} className="w-full gap-2">
            {isTestingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            {isTestingAll ? "Testing All 9 Agents..." : "Test All 9 Agents"}
          </Button>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {agentConfigs.map((config) => {
              const IconComponent = iconMap[config.icon as keyof typeof iconMap] || Brain
              const testResult = testResults[config.key]

              return (
                <Button
                  key={config.key}
                  variant="outline"
                  onClick={() => testSingleAgent(config.key)}
                  disabled={testResult?.testing}
                  className="flex flex-col gap-1 h-16"
                >
                  {testResult?.testing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <IconComponent className={`h-4 w-4 ${config.color || "text-blue-500"}`} />
                  )}
                  <span className="text-xs">{config.name}</span>
                  {testResult?.responseTime && (
                    <span className="text-xs text-muted-foreground">{testResult.responseTime}ms</span>
                  )}
                </Button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Custom Agent Testing</CardTitle>
          <CardDescription>Test specific agents with your own input</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="agent-select">Select Agent</Label>
              <select
                id="agent-select"
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="w-full p-2 border rounded-md"
              >
                {agentConfigs.map((config) => (
                  <option key={config.key} value={config.key}>
                    {config.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="custom-input">Test Input</Label>
              <Textarea
                id="custom-input"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="Enter your test input..."
                rows={3}
              />
            </div>
          </div>
          <Button onClick={runCustomTest} disabled={!customInput.trim()}>
            Run Custom Test
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agentConfigs.map((config) => {
          const IconComponent = iconMap[config.icon as keyof typeof iconMap] || Brain
          const testResult = testResults[config.key]

          return (
            <Card key={config.key}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <IconComponent className={`h-5 w-5 ${config.color}`} />
                    <CardTitle className="text-base">{config.name}</CardTitle>
                  </div>
                  {testResult && (
                    <div className="flex items-center gap-2">
                      <Badge variant={testResult.success ? "default" : "destructive"}>
                        {testResult.testing ? "Testing..." : testResult.success ? "Pass" : "Fail"}
                      </Badge>
                      {testResult.responseTime && (
                        <Badge variant="outline" className="text-xs">
                          {testResult.responseTime}ms
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <div className="text-xs font-medium">Status</div>
                  <Badge variant="secondary">Ready</Badge>
                  <div className="text-xs text-muted-foreground">Status: Ready</div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-medium">Capabilities</div>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-xs">
                      AI Agent
                    </Badge>
                  </div>
                </div>

                {testResult && !testResult.testing && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium">Test Result</div>
                    {testResult.success ? (
                      <div className="text-xs text-green-600">
                        <CheckCircle className="h-3 w-3 inline mr-1" />
                        Test passed successfully
                        {testResult.custom && <span className="ml-1">(Custom Test)</span>}
                      </div>
                    ) : (
                      <div className="text-xs text-red-600">
                        <XCircle className="h-3 w-3 inline mr-1" />
                        {testResult.error}
                      </div>
                    )}

                    {testResult.result && (
                      <div className="text-xs bg-muted p-2 rounded">
                        <div className="font-medium mb-1">Output:</div>
                        <pre className="whitespace-pre-wrap text-xs">
                          {JSON.stringify(testResult.result, null, 2).substring(0, 200)}...
                        </pre>
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground">
                      Tested: {testResult.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
