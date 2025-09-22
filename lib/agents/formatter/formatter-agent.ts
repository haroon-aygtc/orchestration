// Formatter Agent - Data presentation and output formatting
import { AGENT_CONSTANTS } from "../shared/constants";
import type { AgentTask, AgentTaskStore, FormatterInput, FormatterOutput } from "../shared/types";
import { TaskStatus } from "../shared/task-types";
import { generatePrefixedUUID } from "../../utils/uuid";

export class FormatterAgent {
  private tasksCompleted = 0;
  private status: "idle" | "busy" | "error" = "idle";

  constructor(private taskStore?: AgentTaskStore) {}

  async formatOutput(input: FormatterInput): Promise<AgentTask<FormatterInput, FormatterOutput>> {
    const task: AgentTask<FormatterInput, FormatterOutput> = {
      id: generatePrefixedUUID("formatter"),
      type: "content_formatting",
      input,
      status: AGENT_CONSTANTS.TASK_STATUSES.RUNNING as TaskStatus,
      startedAt: new Date(),
    };
    this.status = AGENT_CONSTANTS.AGENT_STATUSES.BUSY;
    await this.taskStore?.create(task);

    try {
      const formattedOutput = await this.formatContent(input);

      task.output = formattedOutput;
      task.status = AGENT_CONSTANTS.TASK_STATUSES.COMPLETED as TaskStatus;
      task.completedAt = new Date();
      this.tasksCompleted++;
      this.status = AGENT_CONSTANTS.AGENT_STATUSES.IDLE;
      await this.taskStore?.update(task.id, task);
      return task;
    } catch (error: any) {
      task.error = error?.message || "Content formatting failed";
      task.status = AGENT_CONSTANTS.TASK_STATUSES.FAILED as TaskStatus;
      task.completedAt = new Date();
      this.status = AGENT_CONSTANTS.AGENT_STATUSES.ERROR;
      await this.taskStore?.update(task.id, task);
      return task;
    }
  }

  private async formatContent(input: FormatterInput): Promise<FormatterOutput> {
    const { content, format, options = {} } = input as FormatterInput;
    let formattedContent = content;
    const metadata: Record<string, any> = {
      originalLength: content.length,
      formattedAt: new Date().toISOString(),
      format,
      options
    };

    switch (format.toLowerCase()) {
      case 'json':
        try {
          const parsed = JSON.parse(content);
          formattedContent = JSON.stringify(parsed, null, 2);
          metadata.beautified = true;
        } catch (error) {
          formattedContent = content;
          metadata.parseError = true;
        }
        break;

      case 'markdown':
        formattedContent = this.formatAsMarkdown(content);
        metadata.markdown = true;
        break;

      case 'html':
        formattedContent = this.formatAsHTML(content);
        metadata.html = true;
        break;

      case 'csv':
        formattedContent = this.formatAsCSV(content);
        metadata.csv = true;
        break;

      case 'summary':
        formattedContent = this.formatAsSummary(content);
        metadata.summary = true;
        break;

      case 'bullet':
      case 'bullets':
        formattedContent = this.formatAsBullets(content);
        metadata.bullets = true;
        break;

      default:
        formattedContent = content;
        metadata.passthrough = true;
    }

    metadata.finalLength = formattedContent.length;
    metadata.compression = ((content.length - formattedContent.length) / content.length * 100).toFixed(1);

    return {
      formattedContent,
      format,
      metadata
    };
  }

  private formatAsMarkdown(content: string): string {
    return content
      .split('\n')
        .map((line: string) => {
        if (line.trim().startsWith('-') || line.trim().startsWith('*')) {
          return line; // Already formatted
        }
        return `<p>${line.trim()}</p>`;
      })
      .map((line: string) => {
        if (line.trim().length > 0 && !line.startsWith('#')) {
          return `- ${line.trim()}`;
        }
        return line;
      })
      .join('\n');
  }

  private formatAsHTML(content: string): string {
    const lines = content.split('\n');
    const htmlLines = lines.map((line: string) => {
      if (line.trim().startsWith('-') || line.trim().startsWith('*')) {
        return `<li>${line.trim().substring(1).trim()}</li>`;
      }
      if (line.trim().length > 0) {
        return `<p>${line.trim()}</p>`;
      }
      return '';
    });

    return `<div>\n${htmlLines.join('\n')}\n</div>`;
  }

  private formatAsCSV(content: string): string {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length === 0) return '';

    const headers = lines[0].split(',').map((h: string) => h.trim());
    const rows = lines.slice(1).map(line => line.split(',').map(cell => cell.trim()));

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  private formatAsSummary(content: string): string {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const summary = sentences.slice(0, Math.min(3, Math.ceil(sentences.length * 0.3)));

    return summary.map(s => `- ${s.trim()}`).join('\n');
  }

  private formatAsBullets(content: string): string {
    return content
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => `- ${line.trim()}`)
      .join('\n');
  }

  getStatus() {
    return {
      type: "formatter",
      name: "Formatter Agent",
      status: this.status,
      tasksCompleted: this.tasksCompleted,
      capabilities: AGENT_CONSTANTS.AGENT_CAPABILITIES.FORMATTER,
    };
  }
}
