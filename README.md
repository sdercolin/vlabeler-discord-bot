# vlabeler-discord-bot

A Discord support bot for [vLabeler](https://github.com/sdercolin/vlabeler), powered by the
[Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview). When mentioned, it reads the actual
vLabeler source code and docs (read-only) to answer community questions about features, implementation details,
and bug diagnosis, replying in a thread. Follow-up messages in that thread continue the same conversation.

Runs on your own machine/server with your own Anthropic **API key** (pay-per-token). Do **not** run it on Claude
subscription credentials — Anthropic's terms don't allow routing third-party users' requests through a
subscription plan.

## Prerequisites

- Node.js 18+
- A local clone of the vLabeler repository (kept fresh automatically via `git pull`)
- An Anthropic API key from [platform.claude.com](https://platform.claude.com) (personal account recommended)
- A Discord bot token (below)

## 1. Create the Discord bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**.
2. **Bot** section → **Reset Token** → copy the token.
3. Still in **Bot** → *Privileged Gateway Intents* → enable **Message Content Intent**.
4. **OAuth2 → URL Generator**: select the `bot` scope with permissions:
   - View Channels, Send Messages, Send Messages in Threads, Create Public Threads,
     Read Message History, Add Reactions
5. Open the generated URL and invite the bot to your server.

## 2. Configure & run

```bash
npm install
cp .env.example .env   # then fill in DISCORD_BOT_TOKEN, ANTHROPIC_API_KEY, VLABELER_REPO_PATH
npm run build
npm start
```

Test the agent without Discord first (only needs `ANTHROPIC_API_KEY` and the repo path):

```bash
npm run ask "How do I create a project with the UTAU oto labeler?"
```

## Usage in Discord

- **@mention the bot** with a question in an allowed channel → it opens a thread and answers there.
- **Reply inside the thread** (no mention needed) → the conversation continues with full context.
- Users can ask in English, Chinese, Japanese, or Korean; the bot answers in the same language.

## Cost & abuse controls

Configured in `.env` (see `.env.example` for all options):

- `CLAUDE_MODEL` — `claude-sonnet-5` by default; use `claude-haiku-4-5` to cut costs.
- `MAX_BUDGET_USD_PER_QUERY` / `MAX_TURNS` — hard per-question caps.
- `USER_COOLDOWN_SECONDS`, `MAX_CONCURRENT_QUERIES` — rate limiting.
- `ALLOWED_CHANNEL_IDS` — restrict the bot to specific channels (recommended: one `#ask-vlabeler` channel).

Each answered question logs its actual cost to the console.

## Security notes

- The agent only gets read-only tools (`Read`, `Glob`, `Grep`) inside the vLabeler checkout — it cannot run
  commands, write files, or access the network, so hostile prompts from Discord users can't do damage beyond
  a weird answer.
- Keep `.env` out of git (already in `.gitignore`).

## Hosting on a VPS (systemd)

Any always-on Linux box works. Example setup on a VPS:

```bash
# 1. Install Node.js 20+ (Debian/Ubuntu example)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git

# 2. Get the code and the vLabeler repo it reads from
sudo git clone https://github.com/sdercolin/vlabeler-discord-bot /opt/vlabeler-discord-bot
sudo git clone https://github.com/sdercolin/vlabeler /opt/vlabeler
sudo chown -R $USER /opt/vlabeler-discord-bot /opt/vlabeler

# 3. Build and configure
cd /opt/vlabeler-discord-bot
npm ci && npm run build
cp .env.example .env
nano .env   # set tokens; set VLABELER_REPO_PATH=/opt/vlabeler

# 4. Install as a service (edit User= in the file first)
sudo cp deploy/vlabeler-bot.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now vlabeler-bot

# Logs
journalctl -u vlabeler-bot -f
```

To update the bot later: `git pull && npm ci && npm run build && sudo systemctl restart vlabeler-bot`.
(The vLabeler repo clone updates itself via `REPO_SYNC_MINUTES`.)

Alternatively, pm2 works anywhere without root: `pm2 start dist/index.js --name vlabeler-bot && pm2 save`.
