"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { AgentsService, CreateTaskRequest } from "@/lib/api"
import { Plus, Search, MoreHorizontal, Clock, CheckCircle, AlertCircle, XCircle, Play, Users } from "lucide-react"

interface TaskLedgerEntry {
  id: string
  title: string
  description: string
  priority: "low" | "medium" | "high" | "critical"
  status: "pending" | "in-progress" | "completed" | "failed" | "blocked"
  assignedAgent: string
  dependencies: string[]
  estimatedDuration: number
  actualDuration?: number
  progress: number
  createdAt: Date | string // Can be Date for local tasks or string from API
  updatedAt: Date | string // Can be Date for local tasks or string from API
  dueDate?: Date | string // Can be Date for local tasks or string from API
}

export function TaskLedgerView() {
  const [tasks, setTasks] = useState<TaskLedgerEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreatingTask, setIsCreatingTask] = useState(false)

  // Load real tasks from API
  useEffect(() => {
    loadTasks()
  }, [])

  const loadTasks = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await AgentsService.getSystemStatus()

      if (response.success && response.data.tasks) {
        // Transform API tasks to TaskLedgerEntry format
        const transformedTasks: TaskLedgerEntry[] = response.data.tasks.map(task => ({
          id: task.id,
          title: task.description, // Use description as title for now
          description: task.description,
          priority: "medium" as const, // Default priority
          status: task.status as TaskLedgerEntry['status'],
          assignedAgent: task.type || "system-agent",
          dependencies: [],
          estimatedDuration: 3600, // Default 1 hour
          progress: task.status === 'completed' ? 100 : task.status === 'in-progress' ? 50 : 0,
          createdAt: new Date(task.createdAt),
          updatedAt: new Date(task.createdAt),
          ...(task.completedAt && { actualDuration: Math.floor((new Date(task.completedAt).getTime() - new Date(task.createdAt).getTime()) / 1000) })
        }))

        setTasks(transformedTasks)
      } else {
        // No tasks available - empty state
        setTasks([])
      }
    } catch (error) {
      console.error('Error loading tasks:', error)
      setError(error instanceof Error ? error.message : 'Failed to load tasks')
      // Fallback to empty array on error
      setTasks([])
    } finally {
      setIsLoading(false)
    }
  }

  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium" as const,
    assignedAgent: "",
    estimatedDuration: 3600,
  })

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || task.status === statusFilter
    const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter
    return matchesSearch && matchesStatus && matchesPriority
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />
      case "in-progress":
        return <Play className="h-4 w-4 text-blue-500" />
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />
      case "blocked":
        return <AlertCircle className="h-4 w-4 text-orange-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "secondary"
      case "in-progress":
        return "default"
      case "completed":
        return "default"
      case "failed":
        return "destructive"
      case "blocked":
        return "secondary"
      default:
        return "outline"
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "destructive"
      case "high":
        return "default"
      case "medium":
        return "secondary"
      case "low":
        return "outline"
      default:
        return "outline"
    }
  }

  const updateTaskStatus = (taskId: string, newStatus: TaskLedgerEntry["status"]) => {
    setTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, status: newStatus, updatedAt: new Date().toISOString() } : task)),
    )
  }

  const createTask = async () => {
    if (!newTask.title.trim() || !newTask.description.trim()) {
      return
    }

    try {
      setIsCreatingTask(true)

      // Create task via API
      const taskRequest: CreateTaskRequest = {
        type: newTask.assignedAgent || 'general',
        description: newTask.description,
        priority: newTask.priority
      }

      const response = await AgentsService.createTask(taskRequest)

      if (response.success && response.taskId) {
        // Create local task entry for immediate UI update
        const task: TaskLedgerEntry = {
          id: response.taskId,
          title: newTask.title,
          description: newTask.description,
          priority: newTask.priority,
          status: "pending",
          assignedAgent: newTask.assignedAgent,
          dependencies: [],
          estimatedDuration: newTask.estimatedDuration,
          progress: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        setTasks((prev) => [task, ...prev])

        // Reset form
        setNewTask({
          title: "",
          description: "",
          priority: "medium",
          assignedAgent: "",
          estimatedDuration: 3600,
        })
        setIsCreateDialogOpen(false)

        // Reload tasks to get updated data from server
        setTimeout(() => loadTasks(), 1000)
      } else {
        throw new Error(response.error || 'Failed to create task')
      }
    } catch (error) {
      console.error('Error creating task:', error)
      setError(error instanceof Error ? error.message : 'Failed to create task')
    } finally {
      setIsCreatingTask(false)
    }
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  const getTaskStats = () => {
    const total = tasks.length
    const completed = tasks.filter((t) => t.status === "completed").length
    const inProgress = tasks.filter((t) => t.status === "in-progress").length
    const failed = tasks.filter((t) => t.status === "failed").length
    const blocked = tasks.filter((t) => t.status === "blocked").length

    return { total, completed, inProgress, failed, blocked }
  }

  const stats = getTaskStats()

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-8 text-center">
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              <span>Loading tasks...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Error Alert */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-red-800">{error}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setError(null)
                  loadTasks()
                }}
                className="ml-auto"
              >
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Tasks</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-green-500">{stats.completed}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold text-blue-500">{stats.inProgress}</p>
              </div>
              <Play className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-red-500">{stats.failed}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Blocked</p>
                <p className="text-2xl font-bold text-orange-500">{stats.blocked}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Task Ledger Management</CardTitle>
              <CardDescription>Manage and monitor all automation tasks</CardDescription>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Task
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Task</DialogTitle>
                  <DialogDescription>Add a new task to the automation ledger</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">Task Title</Label>
                    <Input
                      id="title"
                      value={newTask.title}
                      onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                      placeholder="Enter task title..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={newTask.description}
                      onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                      placeholder="Describe the task..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="priority">Priority</Label>
                      <Select
                        value={newTask.priority}
                        onValueChange={(value: any) => setNewTask({ ...newTask, priority: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="agent">Assigned Agent</Label>
                      <Select
                        value={newTask.assignedAgent}
                        onValueChange={(value) => setNewTask({ ...newTask, assignedAgent: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select agent..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="intent-agent">Intent Agent</SelectItem>
                          <SelectItem value="retriever-agent">Retriever Agent</SelectItem>
                          <SelectItem value="tool-agent">Tool Agent</SelectItem>
                          <SelectItem value="workflow-agent">Workflow Agent</SelectItem>
                          <SelectItem value="memory-agent">Memory Agent</SelectItem>
                          <SelectItem value="llm-agent">LLM Agent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button
                    onClick={createTask}
                    className="w-full"
                    disabled={isCreatingTask || !newTask.title.trim() || !newTask.description.trim()}
                  >
                    {isCreatingTask ? (
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Creating...</span>
                      </div>
                    ) : (
                      'Create Task'
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Task Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.map((task) => (
                <TableRow key={task.id} className="hover:bg-muted/50 cursor-pointer task-item">
                  <TableCell>
                    <div>
                      <div className="font-medium">{task.title}</div>
                      <div className="text-sm text-muted-foreground">{task.description}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(task.status)}
                      <Badge variant={getStatusColor(task.status) as any}>{task.status.replace("-", " ")}</Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getPriorityColor(task.priority) as any}>{task.priority}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{task.assignedAgent}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Progress value={task.progress} className="w-20 h-2" />
                      <div className="text-xs text-muted-foreground">{task.progress}%</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{formatDuration(task.estimatedDuration)}</div>
                      {task.actualDuration && (
                        <div className="text-xs text-muted-foreground">
                          Actual: {formatDuration(task.actualDuration)}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {task.dueDate && <div className="text-sm">{new Date(task.dueDate).toLocaleDateString()}</div>}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => updateTaskStatus(task.id, "in-progress")}>
                          Start Task
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateTaskStatus(task.id, "completed")}>
                          Mark Complete
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateTaskStatus(task.id, "blocked")}>
                          Mark Blocked
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateTaskStatus(task.id, "failed")}>
                          Mark Failed
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
