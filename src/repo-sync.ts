import { execFile } from "node:child_process";
import { config } from "./config.js";

function gitPull(): void {
  execFile(
    "git",
    ["pull", "--ff-only"],
    { cwd: config.repoPath, timeout: 60_000 },
    (error, stdout) => {
      if (error) {
        console.error(`[repo-sync] git pull failed: ${error.message}`);
      } else if (!stdout.includes("Already up to date")) {
        console.log(`[repo-sync] ${stdout.trim()}`);
      }
    },
  );
}

export function startRepoSync(): void {
  if (config.repoSyncMinutes <= 0) {
    console.log("[repo-sync] disabled (REPO_SYNC_MINUTES=0)");
    return;
  }
  gitPull();
  setInterval(gitPull, config.repoSyncMinutes * 60 * 1000);
  console.log(`[repo-sync] pulling ${config.repoPath} every ${config.repoSyncMinutes} min`);
}
