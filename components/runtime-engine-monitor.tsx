import { Activity, Clock, Cpu } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

const engineStats = [
  { label: "Active Agents", value: "12", change: "+2", trend: "up" },
  { label: "Tasks Queued", value: "47", change: "-5", trend: "down" },
  { label: "CPU Usage", value: "68%", change: "+12%", trend: "up" },
  { label: "Memory Usage", value: "4.2GB", change: "+0.3GB", trend: "up" },
]

const runningTasks = [
  { id: "task-001", agent: "Customer Support", status: "Running", progress: 75 },
  { id: "task-002", agent: "Data Analyst", status: "Queued", progress: 0 },
  { id: "task-003", agent: "Content Writer", status: "Running", progress: 45 },
  { id: "task-004", agent: "Lead Qualifier", status: "Completed", progress: 100 },
]

export function RuntimeEngineMonitor() {
  return (
    <Card className="bg-card text-card-foreground">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold">Runtime Engine Monitor</CardTitle>
            <CardDescription>Real-time orchestration and execution monitoring</CardDescription>
          </div>
          <Badge variant="outline" className="bg-chart-4/10 text-chart-4 border-chart-4">
            <Activity className="mr-1 h-3 w-3" />
            Healthy
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Engine Statistics */}
        <div className="grid grid-cols-2 gap-4">
          {engineStats.map((stat) => (
            <div key={stat.label} className="p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors cursor-pointer metric-card">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <span className={`text-xs ${stat.trend === "up" ? "text-chart-5" : "text-chart-4"}`}>
                  {stat.change}
                </span>
              </div>
              <p className="text-lg font-bold mt-1">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Orchestrator Status */}
        <div>
          <div className="flex items-center space-x-2 mb-3">
            <Cpu className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold">Orchestrator</h3>
          </div>
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors cursor-pointer">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-chart-4 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">Load Balancer Active</span>
            </div>
            <Badge variant="secondary">v2.1.0</Badge>
          </div>
        </div>

        {/* Running Tasks */}
        <div>
          <div className="flex items-center space-x-2 mb-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold">Executor Tasks</h3>
          </div>
          <div className="space-y-2">
            {runningTasks.map((task) => (
              <div key={task.id} className="p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors cursor-pointer task-item">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium text-sm">{task.agent}</p>
                    <p className="text-xs text-muted-foreground">{task.id}</p>
                  </div>
                  <Badge
                    variant={
                      task.status === "Running" ? "default" : task.status === "Completed" ? "secondary" : "outline"
                    }
                  >
                    {task.status}
                  </Badge>
                </div>
                {task.status !== "Queued" && <Progress value={task.progress} className="h-1" />}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
