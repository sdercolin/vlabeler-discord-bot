import { query } from "@anthropic-ai/claude-agent-sdk";
import { config } from "./config.js";
import { SYSTEM_PROMPT } from "./system-prompt.js";

export interface AgentAnswer {
  text: string;
  sessionId?: string;
  costUsd?: number;
}

/**
 * Ask the Claude agent a question against the vLabeler repo checkout.
 * Pass `resumeSessionId` to continue a previous conversation (e.g. a Discord thread).
 */
export async function askAgent(prompt: string, resumeSessionId?: string): Promise<AgentAnswer> {
  let text = "";
  let sessionId: string | undefined;
  let costUsd: number | undefined;
  let errorSubtype: string | undefined;

  for await (const message of query({
    prompt,
    options: {
      cwd: config.repoPath,
      allowedTools: ["Read", "Glob", "Grep"],
      systemPrompt: SYSTEM_PROMPT,
      model: config.model,
      maxTurns: config.maxTurns,
      maxBudgetUsd: config.maxBudgetUsdPerQuery,
      permissionMode: "bypassPermissions",
      stderr: (data: string) => console.error(`[claude stderr] ${data.trimEnd()}`),
      ...(resumeSessionId ? { resume: resumeSessionId } : {}),
    },
  })) {
    if (message.type === "result") {
      sessionId = message.session_id;
      costUsd = message.total_cost_usd;
      if (message.subtype === "success") {
        text = message.result;
      } else {
        errorSubtype = message.subtype;
      }
    }
  }

  if (!text) {
    throw new Error(`Agent query did not succeed (${errorSubtype ?? "no result message"})`);
  }
  return { text, sessionId, costUsd };
}
