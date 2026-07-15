const DISCORD_MESSAGE_LIMIT = 2000;

/**
 * Split a long answer into chunks that fit Discord's message length limit,
 * preferring paragraph breaks, then line breaks, then a hard cut.
 */
export function splitMessage(text: string, limit: number = DISCORD_MESSAGE_LIMIT): string[] {
  const chunks: string[] = [];
  let rest = text.trim();
  while (rest.length > limit) {
    let cut = rest.lastIndexOf("\n\n", limit);
    if (cut < limit / 2) cut = rest.lastIndexOf("\n", limit);
    if (cut < limit / 2) cut = limit;
    chunks.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  if (rest.length > 0) chunks.push(rest);
  return chunks;
}
