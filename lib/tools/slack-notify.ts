import { ToolFn } from "../tools/run-tool";
import { createEnhancedTool } from "../tools/registry/index";

export const slackNotifyFn: ToolFn = async (params) => {
  const { webhookUrl = process.env.SLACK_WEBHOOK_URL, message, channel, username = "AI Agent" } = params;
  if (!webhookUrl) throw new Error("slack_notify: 'webhookUrl' (or SLACK_WEBHOOK_URL env) is required");
  if (!message) throw new Error("slack_notify: 'message' is required");

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: message, channel, username }),
  });

  return { success: res.ok, statusCode: res.status, message: res.statusText };
};

export const slackNotifyTool = createEnhancedTool("slack_notify", slackNotifyFn);