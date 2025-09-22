// Guardrail Agent - Safety validation and compliance checking
import { AGENT_CONSTANTS } from "../shared/constants";
import type { AgentTask, AgentTaskStore, GuardrailInput, GuardrailOutput } from "../shared/types";
import { TaskStatus } from "../shared/task-types";
import { generatePrefixedUUID } from "../../utils/uuid";

export class GuardrailAgent {
  private tasksCompleted = 0;
  private status: "idle" | "busy" | "error" = "idle";
  private violations: Array<{
    type: string;
    message: string;
    severity: "low" | "medium" | "high";
    suggestion?: string;
  }> = [];

  constructor(private taskStore?: AgentTaskStore) {}

  async validateContent(input: GuardrailInput): Promise<AgentTask<GuardrailInput, GuardrailOutput>> {
    const task: AgentTask<GuardrailInput, GuardrailOutput> = {
      id: generatePrefixedUUID("guardrail"),
      type: "content_validation",
      input,
      status: AGENT_CONSTANTS.TASK_STATUSES.RUNNING as TaskStatus,
      startedAt: new Date(),
    };
    this.status = AGENT_CONSTANTS.AGENT_STATUSES.BUSY;
    await this.taskStore?.create(task);

    try {
      const validationResult = await this.validate(input);

      if (!validationResult.approved) {
        this.violations.push(...validationResult.violations);
      }

      task.output = validationResult;
      task.status = AGENT_CONSTANTS.TASK_STATUSES.COMPLETED as TaskStatus;
      task.completedAt = new Date();
      this.tasksCompleted++;
      this.status = AGENT_CONSTANTS.AGENT_STATUSES.IDLE;
      await this.taskStore?.update(task.id, task);
      return task;
    } catch (error: any) {
      task.error = error?.message || "Content validation failed";
      task.status = AGENT_CONSTANTS.TASK_STATUSES.FAILED as TaskStatus;
      task.completedAt = new Date();
      this.status = AGENT_CONSTANTS.AGENT_STATUSES.ERROR;
      await this.taskStore?.update(task.id, task);
      return task;
    }
  }

  private async validate(input: GuardrailInput): Promise<GuardrailOutput> {
    const violations: Array<{
      type: string;
      message: string;
      severity: "low" | "medium" | "high";
      suggestion?: string;
    }> = [];

    const content = input.content.toLowerCase();
    const rules = input.rules || this.getDefaultRules() as string[];
    if (rules.length === 0) {
      violations.push({
        type: "default_rules",
        message: "No default rules provided",
        severity: "low",
        suggestion: "Provide default rules"
      });
    }

    // Check for sensitive content
    if (content.includes('password') && !content.includes('change') && !content.includes('reset')) {
      violations.push({
        type: "sensitive_information",
        message: "Potential password exposure detected",
        severity: "high",
        suggestion: "Remove or encrypt password information"
      });
    }

    // Check for personal information
    if (content.includes('ssn') || content.includes('social security')) {
      violations.push({
        type: "personal_information",
        message: "Social Security Number reference detected",
        severity: "high",
        suggestion: "Remove or anonymize personal identifiers"
      });
    }

    // Check for API keys or tokens
    if (content.includes('api_key') || content.includes('bearer') || content.includes('token')) {
      violations.push({
        type: "api_security",
        message: "API key or token exposure detected",
        severity: "high",
        suggestion: "Remove API credentials from content"
      });
    }

    // Check for harmful content
    const harmfulTerms = ['harm', 'damage', 'exploit', 'attack', 'malicious'];
    const hasHarmful = harmfulTerms.some(term => content.includes(term));
    if (hasHarmful) {
      violations.push({
        type: "harmful_content",
        message: "Potentially harmful content detected",
        severity: "medium",
        suggestion: "Review content for harmful intent"
      });
    }

    // Check for inappropriate language
    const inappropriateTerms = ['offensive', 'derogatory', 'inappropriate'];
    const hasInappropriate = inappropriateTerms.some(term => content.includes(term));
    if (hasInappropriate) {
      violations.push({
        type: "inappropriate_content",
        message: "Inappropriate language detected",
        severity: "medium",
        suggestion: "Remove inappropriate language"
      });
    }

    // Check for spam patterns
    if (this.isSpamLike(content)) {
      violations.push({
        type: "spam_content",
        message: "Content appears to be spam",
        severity: "low",
        suggestion: "Review for spam characteristics"
      });
    }

    // Check for excessive length
    if (content.length > 50000) {
      violations.push({
        type: "content_length",
        message: "Content is unusually long",
        severity: "low",
        suggestion: "Consider breaking into smaller chunks"
      });
    }

    const approved = violations.length === 0;
    const confidence = approved ? 0.95 : 0.75;

    return {
      approved,
      violations,
      sanitizedContent: approved ? input.content : this.sanitizeContent(input.content, violations as Array<{
        type: string;
        message: string;
        severity: "low" | "medium" | "high";
        suggestion?: string;
      }>),
      confidence
    };
  }

  private getDefaultRules(): string[] {
    return [
      "No sensitive information (passwords, API keys)",
      "No personal identifiers (SSN, etc.)",
      "No harmful or malicious content",
      "No inappropriate language",
      "No spam-like content",
      "Reasonable content length"
    ];
  }

  private isSpamLike(content: string): boolean {
    const words = content.split(/\s+/);
    if (words.length < 10) return false;

    // Check for excessive repetition
    const wordCount: Record<string, number> = {};
    for (const word of words) {
      if (word.length > 3) {
        wordCount[word] = (wordCount[word] || 0) + 1;
      }
    }

    const maxCount = Math.max(...Object.values(wordCount));
    return maxCount > words.length * 0.3; // More than 30% repetition
  }

  private sanitizeContent(content: string, violations: Array<{
    type: string;
    message: string;
    severity: "low" | "medium" | "high";
    suggestion?: string;
  }>): string {
    // Simple sanitization - replace sensitive terms
    let sanitized = content;

    for (const violation of violations) {
      if (violation.type === 'sensitive_information' && violation.message.includes('password')) {
        sanitized = sanitized.replace(/password[\s:=]+[\w!@#$%^&*()]+/gi, 'password: [REDACTED]');
      }

      if (violation.type === 'api_security') {
        sanitized = sanitized.replace(/api_key[\s:=]+[\w\-]+/gi, 'api_key: [REDACTED]');
        sanitized = sanitized.replace(/bearer[\s]+[\w\-\.]+/gi, 'bearer: [REDACTED]');
        sanitized = sanitized.replace(/token[\s:=]+[\w\-\.]+/gi, 'token: [REDACTED]');
      }
    }

    return sanitized;
  }

  getStatus() {
    return {
      type: "guardrail",
      name: "Guardrail Agent",
      status: this.status,
      tasksCompleted: this.tasksCompleted,
      capabilities: AGENT_CONSTANTS.AGENT_CAPABILITIES.GUARDRAIL,
    };
  }

  getViolations(): Array<{
    type: string;
    message: string;
    severity: "low" | "medium" | "high";
    suggestion?: string;
  }> {
    return [...this.violations];
  }
}
