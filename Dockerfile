FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-slim
LABEL org.opencontainers.image.source=https://github.com/sdercolin/vlabeler-discord-bot
# git is needed at runtime to clone/sync the vLabeler repo the bot reads
RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Mount a volume at /data (compose does; on Railway attach one) to persist the
# vLabeler checkouts across restarts; without one they just re-clone on start.
ENV VLABELER_REPO_PATH=/data/vlabeler \
    VLABELER_DEV_REPO_PATH=/data/vlabeler-dev \
    RELEASES_DIR=/data/releases

ENTRYPOINT ["/entrypoint.sh"]
