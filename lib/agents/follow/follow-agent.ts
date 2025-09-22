// Follow Agent - Progress tracking and milestone monitoring
import { AGENT_CONSTANTS } from "../shared/constants";
import type { AgentTask, AgentTaskStore, FollowInput, FollowOutput } from "../shared/types";
import { TaskStatus } from "../shared/task-types";
import { generatePrefixedUUID } from "../../utils/uuid";




export class FollowAgent {
  private tasksCompleted = 0;
  private status: "idle" | "busy" | "error" = "idle";
  private activeTasks: Map<string, FollowOutput> = new Map();

  constructor(private taskStore?: AgentTaskStore) {}

  async trackProgress(input: FollowInput): Promise<AgentTask<FollowInput, FollowOutput>> {
    const task: AgentTask<FollowInput, FollowOutput> = {
      id: generatePrefixedUUID("follow"),
      type: "progress_tracking",
      input,
      status: AGENT_CONSTANTS.TASK_STATUSES.RUNNING as TaskStatus,
      startedAt: new Date(),
    };
    this.status = AGENT_CONSTANTS.AGENT_STATUSES.BUSY;
    await this.taskStore?.create(task);

    try {
      // Analyze progress and generate tracking data
      const progressOutput = await this.analyzeProgress(input);

      // Store active task
      this.activeTasks.set(input.taskId, progressOutput);

      task.output = progressOutput;
      task.status = AGENT_CONSTANTS.TASK_STATUSES.COMPLETED as TaskStatus;
      task.completedAt = new Date();
      this.tasksCompleted++;
      this.status = AGENT_CONSTANTS.AGENT_STATUSES.IDLE;
      await this.taskStore?.update(task.id, task);
      return task;
    } catch (error: any) {
      task.error = error?.message || "Progress tracking failed";
      task.status = AGENT_CONSTANTS.TASK_STATUSES.FAILED as TaskStatus;
      task.completedAt = new Date();
      this.status = AGENT_CONSTANTS.AGENT_STATUSES.ERROR;
      await this.taskStore?.update(task.id, task);
      return task;
    }
  }

  async getProgress(taskId: string): Promise<FollowOutput | null> {
    return this.activeTasks.get(taskId) || null;
  }

  async updateProgress(taskId: string, completedCheckpoints: string[]): Promise<boolean> {
    const task = this.activeTasks.get(taskId);
    if (!task) return false;

    task.completedCheckpoints = completedCheckpoints;
    task.currentStatus = completedCheckpoints.length === task.completedCheckpoints.length
      ? "completed"
      : "in_progress";

    // Recalculate next milestone
    const remaining = task.completedCheckpoints.filter((cp: string) => !completedCheckpoints.includes(cp));
    task.nextMilestone = remaining.length > 0 ? remaining[0] : "All milestones completed";

    return true;
  }

  private async analyzeProgress(input: FollowInput): Promise<FollowOutput> {
    const completedCount = Math.floor(input.checkpoints.length * 0.3); // 30% complete for demo
    const completedCheckpoints = input.checkpoints.slice(0, completedCount);
    const remainingCheckpoints = input.checkpoints.slice(completedCount);

    return {
      taskId: input.taskId,
      currentStatus: completedCount === input.checkpoints.length ? "completed" : "in_progress",
      completedCheckpoints,
      nextMilestone: remainingCheckpoints.length > 0 ? remainingCheckpoints[0] : "All milestones completed",
      estimatedCompletion: this.estimateCompletion(input.checkpoints.length, completedCount),
      riskFactors: this.assessRisks(input),
      recommendations: this.generateRecommendations(input, completedCount)
    };
  }

  private estimateCompletion(total: number, completed: number): string {
    const progress = (completed / total) * 100;
    const remainingDays = Math.ceil((total - completed) * 0.5); // Estimate 0.5 days per checkpoint
    return `${progress.toFixed(1)}% complete - Est. ${remainingDays} days remaining`;
  }

  private assessRisks(input: FollowInput): Array<{ risk: string; severity: "low" | "medium" | "high"; mitigation: string }> {
    const risks = [];

    if (input.checkpoints.length > 10) {
      risks.push({
        risk: "Complex task with many checkpoints",
        severity: "medium",
        mitigation: "Break down into smaller subtasks"
      });
    }

    if (input.notifications?.length === 0) {
      risks.push({
        risk: "No notification channels configured",
        severity: "low",
        mitigation: "Set up email or Slack notifications"
      });
    }

    return risks as Array<{ risk: string; severity: "low" | "medium" | "high"; mitigation: string }>;
  }

  private generateRecommendations(input: FollowInput, completed: number): string[] {
    const recommendations = [];

    if (completed === 0) {
      recommendations.push("Start with the first checkpoint to establish momentum");
    }

    if (input.checkpoints.length - completed > 5) {
      recommendations.push("Consider prioritizing high-impact checkpoints");
    }

    recommendations.push("Regular status updates help maintain visibility");

    return recommendations;
  }

  getStatus() {
    return {
      type: "follow",
      name: "Follow Agent",
      status: this.status,
      tasksCompleted: this.tasksCompleted,
      capabilities: AGENT_CONSTANTS.AGENT_CAPABILITIES.FOLLOW,
    };
  }
}
