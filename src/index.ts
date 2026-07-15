import {
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  Message,
  ThreadAutoArchiveDuration,
} from "discord.js";
import { askAgent } from "./agent.js";
import { config } from "./config.js";
import { splitMessage } from "./format.js";
import { startRepoSync } from "./repo-sync.js";
import { getSession, setSession } from "./sessions.js";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const cooldowns = new Map<string, number>();
let activeQueries = 0;

function isChannelAllowed(channelId: string, parentId: string | null): boolean {
  if (config.allowedChannelIds.length === 0) return true;
  return config.allowedChannelIds.includes(channelId) || (parentId !== null && config.allowedChannelIds.includes(parentId));
}

function checkCooldown(userId: string): number {
  const last = cooldowns.get(userId) ?? 0;
  const remaining = config.userCooldownSeconds * 1000 - (Date.now() - last);
  return Math.max(0, Math.ceil(remaining / 1000));
}

function stripBotMention(message: Message): string {
  const botId = client.user?.id;
  return message.content
    .replace(new RegExp(`<@!?${botId}>`, "g"), "")
    .trim();
}

/** Keep the typing indicator alive while the agent works (it expires after ~10s). */
function keepTyping(channel: { sendTyping: () => Promise<void> }): () => void {
  void channel.sendTyping().catch(() => {});
  const interval = setInterval(() => void channel.sendTyping().catch(() => {}), 8000);
  return () => clearInterval(interval);
}

async function answer(message: Message, question: string, replyChannelId: string, resumeSessionId?: string) {
  const channel = await client.channels.fetch(replyChannelId);
  if (!channel || !channel.isSendable()) return;

  cooldowns.set(message.author.id, Date.now());
  activeQueries++;
  const stopTyping = keepTyping(channel);
  try {
    const started = Date.now();
    const result = await askAgent(question, resumeSessionId);
    if (result.sessionId) setSession(replyChannelId, result.sessionId);
    console.log(
      `[query] user=${message.author.tag} thread=${replyChannelId} ` +
        `cost=$${result.costUsd?.toFixed(4) ?? "?"} time=${((Date.now() - started) / 1000).toFixed(1)}s`,
    );
    for (const chunk of splitMessage(result.text)) {
      await channel.send(chunk);
    }
  } catch (error) {
    console.error(`[query] failed for ${message.author.tag}:`, error);
    await channel
      .send("Sorry, something went wrong while looking that up. Please try again later.")
      .catch(() => {});
  } finally {
    stopTyping();
    activeQueries--;
  }
}

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.inGuild()) return;

  const inThread = message.channel.isThread();
  const threadSession = inThread ? getSession(message.channelId) : undefined;
  const mentioned = client.user !== null && message.mentions.users.has(client.user.id);

  // Respond to: follow-ups in threads the bot answered in, or new @-mentions.
  if (!threadSession && !mentioned) return;
  if (!isChannelAllowed(message.channelId, inThread ? message.channel.parentId : null)) return;

  const question = stripBotMention(message);
  if (!question) {
    await message.reply("Hi! Mention me with a question about vLabeler and I'll look it up in the source code.");
    return;
  }

  const waitSeconds = checkCooldown(message.author.id);
  if (waitSeconds > 0) {
    await message.reply(`Please wait ${waitSeconds}s before asking again.`);
    return;
  }
  if (activeQueries >= config.maxConcurrentQueries) {
    await message.reply("I'm answering other questions right now — please try again in a minute.");
    return;
  }

  if (threadSession || inThread) {
    // Continue (or start) a conversation inside an existing thread.
    await answer(message, question, message.channelId, threadSession);
  } else if (message.channel.type === ChannelType.GuildText) {
    // New question in a text channel: answer in a thread to keep channels tidy.
    const thread = await message.startThread({
      name: question.slice(0, 90) || "vLabeler question",
      autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
    });
    await answer(message, question, thread.id);
  } else {
    await answer(message, question, message.channelId);
  }
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  console.log(`Repo: ${config.repoPath}`);
  console.log(`Model: ${config.model}, maxTurns=${config.maxTurns}, budget=$${config.maxBudgetUsdPerQuery}/query`);
  if (config.allowedChannelIds.length > 0) {
    console.log(`Listening in channels: ${config.allowedChannelIds.join(", ")}`);
  } else {
    console.log("Listening for mentions in all channels (set ALLOWED_CHANNEL_IDS to restrict)");
  }
  startRepoSync();
});

client.login(config.discordBotToken);
