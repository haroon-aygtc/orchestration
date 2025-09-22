import { OrchestrationDashboard } from "@/components/orchestration-dashboard"
import { AdminLayout } from "@/components/admin-layout"

export default function OrchestrationPage() {
  return (
    <AdminLayout>
      <OrchestrationDashboard />
    </AdminLayout>
  )
}
