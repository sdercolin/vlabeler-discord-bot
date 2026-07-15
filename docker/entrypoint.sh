#!/bin/sh
set -e

REPO_PATH="${VLABELER_REPO_PATH:-/data/vlabeler}"
REPO_URL="${VLABELER_REPO_URL:-https://github.com/sdercolin/vlabeler}"

if [ ! -d "$REPO_PATH/.git" ]; then
  echo "[entrypoint] Cloning $REPO_URL into $REPO_PATH ..."
  git clone --depth 1 --single-branch "$REPO_URL" "$REPO_PATH"
fi

exec node dist/index.js
