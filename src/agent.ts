import fs from "node:fs";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { config } from "./config.js";
import { buildSystemPrompt } from "./system-prompt.js";

export interface AgentAnswer {
  text: string;
  sessionId?: string;
  costUsd?: number;
}

/** Extra read-only sources beyond the main checkout, if they exist. */
function availableSources() {
  const devRepoPath =
    config.devRepoPath && fs.existsSync(config.devRepoPath) ? config.devRepoPath : undefined;
  const releasesDir =
    config.releasesDir && fs.existsSync(config.releasesDir) ? config.releasesDir : undefined;
  return { devRepoPath, releasesDir };
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

  const sources = availableSources();
  const additionalDirectories = [sources.devRepoPath, sources.releasesDir].filter(
    (p): p is string => p !== undefined,
  );

  for await (const message of query({
    prompt,
    options: {
      cwd: config.repoPath,
      additionalDirectories,
      allowedTools: ["Read", "Glob", "Grep"],
      systemPrompt: buildSystemPrompt(sources),
      model: config.model,
      maxTurns: config.maxTurns,
      maxBudgetUsd: config.maxBudgetUsdPerQuery,
      // Not "bypassPermissions": its --dangerously-skip-permissions flag is refused under
      // root (containers). allowedTools already pre-approves everything the agent may use.
      permissionMode: "default",
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
