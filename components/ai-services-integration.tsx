import { Zap, Brain, MessageSquare, ImageIcon, Code } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"

const aiProviders = [
  { name: "OpenAI", model: "GPT-4", status: "Connected", latency: "120ms", usage: 85 },
  { name: "Anthropic", model: "Claude-3", status: "Connected", latency: "95ms", usage: 62 },
  { name: "Google", model: "Gemini Pro", status: "Disconnected", latency: "N/A", usage: 0 },
  { name: "Cohere", model: "Command-R", status: "Connected", latency: "140ms", usage: 34 },
]

const serviceTypes = [
  { icon: MessageSquare, name: "Text Generation", active: true, requests: "2.4K" },
  { icon: ImageIcon, name: "Image Generation", active: true, requests: "856" },
  { icon: Code, name: "Code Generation", active: false, requests: "0" },
  { icon: Brain, name: "Embeddings", active: true, requests: "1.2K" },
]

export function AIServicesIntegration() {
  return (
    <Card className="bg-card text-card-foreground">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold">AI Services Layer</CardTitle>
            <CardDescription>LLM router and provider management</CardDescription>
          </div>
          <Button variant="outline" size="sm">
            <Zap className="mr-2 h-4 w-4" />
            Configure
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* LLM Router Status */}
        <div>
          <div className="flex items-center space-x-2 mb-3">
            <Zap className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold">LLM Router</h3>
            <Badge variant="outline" className="bg-chart-4/10 text-chart-4 border-chart-4">
              Active
            </Badge>
          </div>
          <div className="p-3 bg-muted rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Load Balancing</span>
              <span className="text-xs text-muted-foreground">Round Robin</span>
            </div>
            <Progress value={78} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">4.2K requests/hour</p>
          </div>
        </div>

        {/* AI Providers */}
        <div>
          <div className="flex items-center space-x-2 mb-3">
            <Brain className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold">Providers</h3>
          </div>
          <div className="space-y-2">
            {aiProviders.map((provider) => (
              <div key={provider.name} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-2 h-2 rounded-full ${provider.status === "Connected" ? "bg-chart-4" : "bg-chart-5"}`}
                  ></div>
                  <div>
                    <p className="font-medium text-sm">{provider.name}</p>
                    <p className="text-xs text-muted-foreground">{provider.model}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{provider.latency}</p>
                  <p className="text-xs font-medium">{provider.usage}% usage</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Service Types */}
        <div>
          <div className="flex items-center space-x-2 mb-3">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold">Services</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {serviceTypes.map((service) => (
              <div
                key={service.name}
                className={`p-3 rounded-lg border ${service.active ? "bg-accent/10 border-accent" : "bg-muted border-border"}`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <service.icon className={`h-4 w-4 ${service.active ? "text-accent" : "text-muted-foreground"}`} />
                  <Badge variant={service.active ? "default" : "secondary"} className="text-xs">
                    {service.active ? "ON" : "OFF"}
                  </Badge>
                </div>
                <p className="text-xs font-medium">{service.name}</p>
                <p className="text-xs text-muted-foreground">{service.requests} today</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
