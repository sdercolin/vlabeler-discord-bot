/**
 * CLI smoke test that exercises the agent without Discord:
 *   npm run ask "How do I create a project with the UTAU oto labeler?"
 * Requires ANTHROPIC_API_KEY and VLABELER_REPO_PATH (DISCORD_BOT_TOKEN may be a dummy value).
 */
process.env.DISCORD_BOT_TOKEN ??= "cli-dummy";

const { askAgent } = await import("./agent.js");

const question = process.argv.slice(2).join(" ").trim();
if (!question) {
  console.error('Usage: npm run ask "your question about vLabeler"');
  process.exit(1);
}

console.log(`Asking: ${question}\n`);
const result = await askAgent(question);
console.log(result.text);
console.log(`\n---\ncost: $${result.costUsd?.toFixed(4) ?? "?"}  session: ${result.sessionId ?? "?"}`);
