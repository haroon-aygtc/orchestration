import { RealTimeMonitor } from "@/components/real-time-monitor"
import { AdminLayout } from "@/components/admin-layout"

export default function MonitoringPage() {
  return (
    <AdminLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Real-time Monitoring</h1>
          <p className="text-muted-foreground">Live system performance and agent monitoring</p>
        </div>
        <RealTimeMonitor />
      </div>
    </AdminLayout>
  )
}
