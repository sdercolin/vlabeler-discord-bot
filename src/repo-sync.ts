import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

const RELEASES_API_URL = "https://api.github.com/repos/sdercolin/vlabeler/releases?per_page=50";

function gitPull(repoPath: string, label: string): void {
  execFile(
    "git",
    ["pull", "--ff-only"],
    { cwd: repoPath, timeout: 60_000 },
    (error, stdout) => {
      if (error) {
        console.error(`[repo-sync] git pull (${label}) failed: ${error.message}`);
      } else if (!stdout.includes("Already up to date")) {
        console.log(`[repo-sync] ${label}: ${stdout.trim()}`);
      }
    },
  );
}

interface GithubRelease {
  tag_name: string;
  name: string | null;
  published_at: string | null;
  prerelease: boolean;
  body: string | null;
}

/** Fetch GitHub release notes and write them to a markdown file the agent can read. */
async function syncReleases(releasesDir: string): Promise<void> {
  try {
    const response = await fetch(RELEASES_API_URL, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "vlabeler-discord-bot" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const releases = (await response.json()) as GithubRelease[];
    const markdown =
      "# vLabeler releases (synced from GitHub, newest first)\n\n" +
      releases
        .map((release) => {
          const title = release.name || release.tag_name;
          const flags = release.prerelease ? " (pre-release)" : "";
          const date = release.published_at?.slice(0, 10) ?? "unpublished";
          return `## ${title} — tag ${release.tag_name}${flags}, published ${date}\n\n${release.body ?? ""}\n`;
        })
        .join("\n");
    await fs.promises.mkdir(releasesDir, { recursive: true });
    await fs.promises.writeFile(path.join(releasesDir, "releases.md"), markdown);
    console.log(`[repo-sync] releases.md updated (${releases.length} releases)`);
  } catch (error) {
    // Keep the previous file on failure; unauthenticated GitHub API rate limits can 403.
    console.error(`[repo-sync] releases sync failed: ${error}`);
  }
}

export function startRepoSync(): void {
  const syncAll = () => {
    gitPull(config.repoPath, "main");
    if (config.devRepoPath && fs.existsSync(config.devRepoPath)) {
      gitPull(config.devRepoPath, "dev");
    }
    if (config.releasesDir) {
      void syncReleases(config.releasesDir);
    }
  };
  if (config.repoSyncMinutes <= 0) {
    console.log("[repo-sync] periodic sync disabled (REPO_SYNC_MINUTES=0); syncing once at startup");
    syncAll();
    return;
  }
  syncAll();
  setInterval(syncAll, config.repoSyncMinutes * 60 * 1000);
  console.log(`[repo-sync] syncing repos and releases every ${config.repoSyncMinutes} min`);
}
