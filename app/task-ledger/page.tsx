import { TaskLedgerView } from "@/components/task-ledger-view"
import { AdminLayout } from "@/components/admin-layout"

export default function TaskLedgerPage() {
  return (
    <AdminLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Task Ledger</h1>
          <p className="text-muted-foreground">Manage and track orchestration tasks and dependencies</p>
        </div>
        <TaskLedgerView />
      </div>
    </AdminLayout>
  )
}
