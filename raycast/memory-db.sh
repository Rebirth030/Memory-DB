#!/bin/bash
#
# Opens the memory.db web UI, starting the local server first if it isn't up.
#
# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Memory DB
# @raycast.mode compact
#
# Optional parameters:
# @raycast.icon 🧠
# @raycast.packageName Memory DB
# @raycast.description Opens the personal memory store, starting the local server on demand.

set -uo pipefail

# This script lives in <repo>/raycast/, so the repo root is one level up.
# -P resolves symlinks, so it matches what lsof reports in the stop command.
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO="$(cd "$HERE/.." && pwd -P)"

# Raycast doesn't read your shell profile, so settings live in an optional,
# untracked config.sh next to this script (see config.example.sh).
# shellcheck source=/dev/null
[ -f "$HERE/config.sh" ] && . "$HERE/config.sh"

PORT="${PERSONAL_MEM_PORT:-8000}"
URL="http://127.0.0.1:${PORT}"
PROBE="${URL}/memories/facets"      # a real API route, not the SPA catch-all
LOG="${HOME}/Library/Logs/personal-memory.log"
AGENT="local.personal-memory"       # label of the launchd agent in ../deploy/

# The server reads PERSONAL_MEM_DB, so a value from config.sh must be exported.
[ -n "${PERSONAL_MEM_DB:-}" ] && export PERSONAL_MEM_DB

# Raycast runs scripts in a non-login shell, where Homebrew's bin and
# ~/.local/bin (the uv installer's default) aren't on PATH. Adding the dirs —
# rather than just locating uv — also lets npm's `#!/usr/bin/env node` find node.
export PATH="/opt/homebrew/bin:/usr/local/bin:${HOME}/.local/bin:${HOME}/.cargo/bin:${PATH}"

up() { curl -sf -o /dev/null -m 1 "$PROBE"; }

if up; then
    open "$URL"
    echo "Memory DB opened"
    exit 0
fi

# The launchd agent keeps its own server alive. If it's loaded but not
# answering, it is restarting or failing — a second server would only fight
# it for the port.
if launchctl list "$AGENT" >/dev/null 2>&1; then
    echo "Managed by launchd but not responding — see ${LOG}"
    exit 1
fi

# Port taken by something else — don't start on top of it.
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port ${PORT} is in use — set PERSONAL_MEM_PORT in raycast/config.sh"
    exit 1
fi

command -v uv >/dev/null || { echo "uv not found — see https://docs.astral.sh/uv/"; exit 1; }
cd "$REPO" || { echo "Repo not found: ${REPO}"; exit 1; }
mkdir -p "$(dirname "$LOG")"

# Without a built frontend the server only has the JSON API, and / would 404.
if [ ! -f frontend/dist/index.html ]; then
    command -v npm >/dev/null ||
        { echo "Frontend not built — run: npm --prefix frontend run build"; exit 1; }
    if [ ! -d frontend/node_modules ]; then
        npm --prefix frontend ci --no-audit --no-fund >> "$LOG" 2>&1 ||
            { echo "npm ci failed — see ${LOG}"; exit 1; }
    fi
    npm --prefix frontend run build >> "$LOG" 2>&1 ||
        { echo "Frontend build failed — see ${LOG}"; exit 1; }
fi

# --host 127.0.0.1 is mandatory: this API has no auth and returns secrets.
nohup uv run fastapi run api/app.py --host 127.0.0.1 --port "$PORT" \
      >> "$LOG" 2>&1 < /dev/null &
disown

# The very first run may still be installing Python dependencies, so be patient.
for _ in $(seq 120); do             # up to ~30s
    up && break
    sleep 0.25
done

if ! up; then
    echo "Not reachable yet — it may still be starting; see ${LOG}"
    exit 1
fi

open "$URL"
echo "Memory DB opened"
