import { BusinessIntelligencePanel } from "@/components/business-intelligence-panel"
import { AdminLayout } from "@/components/admin-layout"

export default function BusinessIntelligencePage() {
  return (
    <AdminLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Business Intelligence</h1>
          <p className="text-muted-foreground">AI-powered business analysis and automation strategy generation</p>
        </div>
        <BusinessIntelligencePanel />
      </div>
    </AdminLayout>
  )
}
