import { Plus, Settings, Workflow, FileText } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

const templates = [
  { name: "Customer Support", type: "Conversational", status: "Active" },
  { name: "Data Analyst", type: "Processing", status: "Draft" },
  { name: "Content Writer", type: "Creative", status: "Active" },
]

const workflows = [
  { name: "Lead Qualification", steps: 5, completion: 80 },
  { name: "Document Processing", steps: 3, completion: 100 },
  { name: "Email Automation", steps: 7, completion: 45 },
]

export function AgentCreationLayer() {
  return (
    <Card className="bg-card text-card-foreground">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold">Agent Creation Layer</CardTitle>
            <CardDescription>Build and configure AI agents with templates and workflows</CardDescription>
          </div>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" />
            New Agent
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Builder UI Section */}
        <div>
          <div className="flex items-center space-x-2 mb-3">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold">Builder UI</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="h-20 flex-col bg-transparent">
              <FileText className="h-6 w-6 mb-2 text-accent" />
              <span className="text-sm">Visual Builder</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col bg-transparent">
              <Settings className="h-6 w-6 mb-2 text-accent" />
              <span className="text-sm">Configuration</span>
            </Button>
          </div>
        </div>

        {/* Templates Section */}
        <div>
          <div className="flex items-center space-x-2 mb-3">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold">Templates</h3>
          </div>
          <div className="space-y-2">
            {templates.map((template) => (
              <div key={template.name} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-medium text-sm">{template.name}</p>
                  <p className="text-xs text-muted-foreground">{template.type}</p>
                </div>
                <Badge variant={template.status === "Active" ? "default" : "secondary"}>{template.status}</Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Workflow Designer Section */}
        <div>
          <div className="flex items-center space-x-2 mb-3">
            <Workflow className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold">Workflow Designer</h3>
          </div>
          <div className="space-y-3">
            {workflows.map((workflow) => (
              <div key={workflow.name} className="p-3 bg-muted rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-sm">{workflow.name}</p>
                  <span className="text-xs text-muted-foreground">{workflow.steps} steps</span>
                </div>
                <Progress value={workflow.completion} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">{workflow.completion}% complete</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
