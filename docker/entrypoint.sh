#!/bin/sh
set -e

REPO_URL="${VLABELER_REPO_URL:-https://github.com/sdercolin/vlabeler}"

clone_if_missing() {
  # $1 = target path, $2 = branch
  if [ -n "$1" ] && [ ! -d "$1/.git" ]; then
    echo "[entrypoint] Cloning $REPO_URL ($2) into $1 ..."
    git clone --depth 1 --single-branch --branch "$2" "$REPO_URL" "$1"
  fi
}

clone_if_missing "${VLABELER_REPO_PATH:-/data/vlabeler}" main
clone_if_missing "$VLABELER_DEV_REPO_PATH" dev

exec node dist/index.js
