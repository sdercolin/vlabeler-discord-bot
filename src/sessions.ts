/** In-memory map from Discord thread ID to Claude Agent SDK session ID, with TTL. */

const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 1000;

interface SessionEntry {
  sessionId: string;
  lastUsedAt: number;
}

const sessions = new Map<string, SessionEntry>();

export function getSession(threadId: string): string | undefined {
  const entry = sessions.get(threadId);
  if (!entry) return undefined;
  if (Date.now() - entry.lastUsedAt > TTL_MS) {
    sessions.delete(threadId);
    return undefined;
  }
  return entry.sessionId;
}

export function setSession(threadId: string, sessionId: string): void {
  sessions.set(threadId, { sessionId, lastUsedAt: Date.now() });
  if (sessions.size > MAX_ENTRIES) {
    const oldest = [...sessions.entries()].sort((a, b) => a[1].lastUsedAt - b[1].lastUsedAt)[0];
    if (oldest) sessions.delete(oldest[0]);
  }
}

export function hasSession(threadId: string): boolean {
  return getSession(threadId) !== undefined;
}
