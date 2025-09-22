"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Activity, Play, Square, BarChart3, Settings, TestTube, Bot } from "lucide-react"
import { IndividualAgentAIConfig } from "@/components/individual-agent-ai-config"

interface AgentEvent {
  type: string
  timestamp: string
  event: {
    action: string
    status: string
    performance: {
      responseTime: number
      successRate: number
      throughput: number
    }
  }
}

interface AgentPageProps {
  agentName: string
  agentDescription: string
  agentCapabilities: string[]
  testExamples: Array<{
    name: string
    input: string
    expectedOutput: string
  }>
  onTest: (input: string) => Promise<any>
}

export function AgentPageTemplate({
  agentName,
  agentDescription,
  agentCapabilities,
  testExamples,
  onTest,
}: AgentPageProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [events, setEvents] = useState<AgentEvent[]>([])
  const [performance, setPerformance] = useState({
    responseTime: 0,
    successRate: 0,
    throughput: 0,
  })
  const [testInput, setTestInput] = useState("")
  const [testResult, setTestResult] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const eventSource = new EventSource(`/api/websocket?agentId=${agentName.toLowerCase()}`)

    eventSource.onopen = () => {
      setIsConnected(true)
      console.log("[v0] Connected to agent monitoring stream")
    }

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        if (data.type === "agent_event") {
          setEvents((prev) => [data, ...prev.slice(0, 49)]) // Keep last 50 events
          setPerformance(data.event.performance)
        }
      } catch (error) {
        console.error("[v0] Error parsing event data:", error)
      }
    }

    eventSource.onerror = () => {
      setIsConnected(false)
      console.log("[v0] Connection lost to agent monitoring")
    }

    return () => {
      eventSource.close()
    }
  }, [agentName])

  const handleTest = async () => {
    if (!testInput.trim()) return

    setIsLoading(true)
    try {
      const result = await onTest(testInput)
      setTestResult(result)
      console.log("[v0] Agent test completed:", result)
    } catch (error) {
      console.error("[v0] Agent test failed:", error)
      setTestResult({ error: error instanceof Error ? error.message : 'Unknown error occurred' })
    } finally {
      setIsLoading(false)
    }
  }

  const loadExample = (example: any) => {
    setTestInput(example.input)
    setTestResult(null)
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Agent Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{agentName}</h1>
            <p className="text-muted-foreground mt-2">{agentDescription}</p>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant={isConnected ? "default" : "destructive"} className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              {isConnected ? "Connected" : "Disconnected"}
            </Badge>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Response Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{performance.responseTime.toFixed(0)}ms</div>
              <Progress value={Math.min(performance.responseTime / 10, 100)} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{performance.successRate.toFixed(1)}%</div>
              <Progress value={performance.successRate} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Throughput</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{performance.throughput}/min</div>
              <Progress value={Math.min(performance.throughput, 100)} className="mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="testing" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="testing" className="flex items-center gap-2">
              <TestTube className="w-4 h-4" />
              Testing
            </TabsTrigger>
            <TabsTrigger value="monitoring" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Monitoring
            </TabsTrigger>
            <TabsTrigger value="capabilities" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Capabilities
            </TabsTrigger>
            <TabsTrigger value="ai-config" className="flex items-center gap-2">
              <Bot className="w-4 h-4" />
              AI Config
            </TabsTrigger>
            <TabsTrigger value="events" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Live Events
            </TabsTrigger>
          </TabsList>

          {/* Testing Tab */}
          <TabsContent value="testing" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Test Input */}
              <Card>
                <CardHeader>
                  <CardTitle>Test Agent</CardTitle>
                  <CardDescription>Enter input to test the {agentName} functionality</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="test-input">Input</Label>
                    <Textarea
                      id="test-input"
                      placeholder="Enter test input..."
                      value={testInput}
                      onChange={(e) => setTestInput(e.target.value)}
                      className="mt-2"
                      rows={4}
                    />
                  </div>
                  <Button onClick={handleTest} disabled={isLoading || !testInput.trim()} className="w-full">
                    {isLoading ? (
                      <>
                        <Square className="w-4 h-4 mr-2" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Run Test
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Test Result */}
              <Card>
                <CardHeader>
                  <CardTitle>Test Result</CardTitle>
                  <CardDescription>Real-time output from the agent</CardDescription>
                </CardHeader>
                <CardContent>
                  {testResult ? (
                    <div className="bg-muted p-4 rounded-lg">
                      <pre className="text-sm whitespace-pre-wrap">{JSON.stringify(testResult, null, 2)}</pre>
                    </div>
                  ) : (
                    <div className="text-muted-foreground text-center py-8">Run a test to see results</div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Test Examples */}
            <Card>
              <CardHeader>
                <CardTitle>Example Tests</CardTitle>
                <CardDescription>Pre-configured examples to test agent capabilities</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {testExamples.map((example, index) => (
                    <Card
                      key={index}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => loadExample(example)}
                    >
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">{example.name}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-muted-foreground mb-2">Input:</p>
                        <p className="text-sm mb-3">{example.input}</p>
                        <p className="text-xs text-muted-foreground mb-2">Expected:</p>
                        <p className="text-sm">{example.expectedOutput}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Monitoring Tab */}
          <TabsContent value="monitoring" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Performance Monitoring</CardTitle>
                <CardDescription>Real-time performance metrics and system health</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  Real-time performance charts would be rendered here
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Capabilities Tab */}
          <TabsContent value="capabilities" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Agent Capabilities</CardTitle>
                <CardDescription>Detailed information about what this agent can do</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {agentCapabilities.map((capability, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                      <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                      <p className="text-sm">{capability}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Configuration Tab */}
          <TabsContent value="ai-config" className="space-y-6">
            <IndividualAgentAIConfig agentName={agentName} agentDescription={agentDescription} />
          </TabsContent>

          {/* Live Events Tab */}
          <TabsContent value="events" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Live Event Stream</CardTitle>
                <CardDescription>Real-time events from the agent execution</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {events.length > 0 ? (
                    events.map((event, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <p className="text-sm font-medium">{event.event.action}</p>
                          <p className="text-xs text-muted-foreground">{event.timestamp}</p>
                        </div>
                        <Badge variant={event.event.status === "active" ? "default" : "secondary"}>
                          {event.event.status}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      No events yet. Events will appear here in real-time.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
