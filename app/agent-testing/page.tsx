import { AgentTestingPanel } from "@/components/agent-testing-panel"
import { AdminLayout } from "@/components/admin-layout"

export default function AgentTestingPage() {
  return (
    <AdminLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Agent Testing</h1>
          <p className="text-muted-foreground">Test and validate individual agent functionality</p>
        </div>
        <AgentTestingPanel />
      </div>
    </AdminLayout>
  )
}
