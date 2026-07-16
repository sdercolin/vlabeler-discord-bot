import "dotenv/config";
import path from "node:path";
import fs from "node:fs";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (Number.isNaN(value)) {
    throw new Error(`Environment variable ${name} must be a number, got: ${raw}`);
  }
  return value;
}

const repoPath = path.resolve(process.env.VLABELER_REPO_PATH || "../vlabeler");
if (!fs.existsSync(path.join(repoPath, "build.gradle.kts"))) {
  throw new Error(
    `VLABELER_REPO_PATH (${repoPath}) does not look like a vlabeler checkout. ` +
      "Clone https://github.com/sdercolin/vlabeler and point VLABELER_REPO_PATH at it.",
  );
}

function optionalPath(name: string): string | undefined {
  const raw = process.env[name];
  return raw ? path.resolve(raw) : undefined;
}

export const config = {
  discordBotToken: required("DISCORD_BOT_TOKEN"),
  anthropicApiKey: required("ANTHROPIC_API_KEY"),
  repoPath,
  // Optional second checkout of the dev branch and a directory for synced release notes;
  // when unset, the bot only knows the main checkout.
  devRepoPath: optionalPath("VLABELER_DEV_REPO_PATH"),
  releasesDir: optionalPath("RELEASES_DIR"),
  repoSyncMinutes: num("REPO_SYNC_MINUTES", 30),
  // `||` (not `??`): compose interpolation passes empty strings for undefined vars
  model: process.env.CLAUDE_MODEL || "claude-sonnet-5",
  maxTurns: num("MAX_TURNS", 25),
  maxBudgetUsdPerQuery: num("MAX_BUDGET_USD_PER_QUERY", 0.5),
  allowedChannelIds: (process.env.ALLOWED_CHANNEL_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0),
  userCooldownSeconds: num("USER_COOLDOWN_SECONDS", 30),
  maxConcurrentQueries: num("MAX_CONCURRENT_QUERIES", 2),
};

/** Config for `npm run ask`, which needs the API key and repo but no Discord token. */
export function cliConfig() {
  required("ANTHROPIC_API_KEY");
  return config;
}
