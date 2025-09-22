"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Activity, TrendingUp, Zap, Clock, CheckCircle, AlertTriangle } from "lucide-react"

interface PerformanceMetrics {
  agentId: string
  agentName: string
  status: "active" | "idle" | "error"
  tasksCompleted: number
  successRate: number
  averageResponseTime: number
  throughput: number
  lastActivity: string
  errorCount: number
}

export function PerformanceMonitoringDashboard() {
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([])
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    const eventSource = new EventSource("/api/websocket?agentId=performance_monitor")

    eventSource.onopen = () => {
      setIsConnected(true)
      console.log("[v0] Connected to performance monitoring stream")
    }

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        if (data.type === "performance_update") {
          setMetrics(data.metrics || [])
        }
      } catch (error) {
        console.error("[v0] Error parsing performance data:", error)
      }
    }

    eventSource.onerror = () => {
      setIsConnected(false)
      console.log("[v0] Performance monitoring connection lost")
    }

    // Initialize with empty data
    setMetrics([])

    return () => {
      eventSource.close()
    }
  }, [])


  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500"
      case "idle":
        return "bg-yellow-500"
      case "error":
        return "bg-red-500"
      default:
        return "bg-gray-500"
    }
  }

  const overallMetrics = {
    totalTasks: metrics.reduce((sum, m) => sum + m.tasksCompleted, 0),
    averageSuccessRate: metrics.reduce((sum, m) => sum + m.successRate, 0) / metrics.length || 0,
    averageResponseTime: metrics.reduce((sum, m) => sum + m.averageResponseTime, 0) / metrics.length || 0,
    activeAgents: metrics.filter((m) => m.status === "active").length,
    totalErrors: metrics.reduce((sum, m) => sum + m.errorCount, 0),
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Performance Monitoring</h2>
        <Badge variant={isConnected ? "default" : "destructive"} className="flex items-center gap-2">
          <Activity className="w-4 h-4" />
          {isConnected ? "Live Monitoring" : "Disconnected"}
        </Badge>
      </div>

      {/* Overall Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Total Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallMetrics.totalTasks}</div>
            <p className="text-xs text-muted-foreground">Completed across all agents</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallMetrics.averageSuccessRate.toFixed(1)}%</div>
            <Progress value={overallMetrics.averageSuccessRate} className="mt-2 h-1" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Avg Response
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallMetrics.averageResponseTime.toFixed(0)}ms</div>
            <p className="text-xs text-muted-foreground">Processing time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Active Agents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallMetrics.activeAgents}</div>
            <p className="text-xs text-muted-foreground">of {metrics.length} total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Total Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallMetrics.totalErrors}</div>
            <p className="text-xs text-muted-foreground">Across all agents</p>
          </CardContent>
        </Card>
      </div>

      {/* Individual Agent Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Individual Agent Performance</CardTitle>
          <CardDescription>Real-time metrics for each specialized agent</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {metrics.map((metric) => (
              <div key={metric.agentId} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(metric.status)}`} />
                  <div>
                    <h4 className="font-medium">{metric.agentName}</h4>
                    <p className="text-sm text-muted-foreground">
                      Last active: {new Date(metric.lastActivity).toLocaleTimeString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-sm font-medium">{metric.tasksCompleted}</div>
                    <div className="text-xs text-muted-foreground">Tasks</div>
                  </div>

                  <div className="text-center">
                    <div className="text-sm font-medium">{metric.successRate.toFixed(1)}%</div>
                    <div className="text-xs text-muted-foreground">Success</div>
                  </div>

                  <div className="text-center">
                    <div className="text-sm font-medium">{metric.averageResponseTime.toFixed(0)}ms</div>
                    <div className="text-xs text-muted-foreground">Response</div>
                  </div>

                  <div className="text-center">
                    <div className="text-sm font-medium">{metric.throughput}/min</div>
                    <div className="text-xs text-muted-foreground">Throughput</div>
                  </div>

                  <Badge variant={metric.status === "active" ? "default" : "secondary"}>{metric.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
