import { AIConfigurationPanel } from "@/components/ai-configuration-panel"
import { AdminLayout } from "@/components/admin-layout"

export default function AIConfigurationPage() {
  return (
    <AdminLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">AI Configuration</h1>
          <p className="text-muted-foreground">Configure AI providers, models, and API keys</p>
        </div>
        <AIConfigurationPanel />
      </div>
    </AdminLayout>
  )
}
