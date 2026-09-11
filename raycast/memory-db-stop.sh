#!/bin/bash
#
# Stops the local memory.db server and frees its port.
#
# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Memory DB Stop
# @raycast.mode compact
#
# Optional parameters:
# @raycast.icon 🛑
# @raycast.packageName Memory DB
# @raycast.description Stops the Memory DB server and frees its port.

set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO="$(cd "$HERE/.." && pwd -P)"
# shellcheck source=/dev/null
[ -f "$HERE/config.sh" ] && . "$HERE/config.sh"

PORT="${PERSONAL_MEM_PORT:-8000}"
AGENT="local.personal-memory"

# With the launchd agent from ../deploy/ loaded, KeepAlive restarts the server
# the moment it's killed — say so instead of pretending to stop it.
if launchctl list "$AGENT" >/dev/null 2>&1; then
    echo "Managed by launchd — run: launchctl unload ~/Library/LaunchAgents/${AGENT}.plist"
    exit 1
fi

PIDS="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null)"
if [ -z "$PIDS" ]; then
    echo "Memory DB is not running"
    exit 0
fi

# Only stop our own server. Its command line just says "api/app.py" (it runs
# from the repo root), a name plenty of FastAPI projects share — so compare the
# process's working directory with this repo instead.
cwd_of() { lsof -a -p "$1" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p'; }

for pid in $PIDS; do
    if [ "$(cwd_of "$pid")" != "$REPO" ]; then
        echo "Port ${PORT} belongs to another program (PID ${pid}) — left alone"
        exit 1
    fi
done

# shellcheck disable=SC2086  # PIDS is a whitespace-separated list of numbers
kill $PIDS

# Let it shut down cleanly before claiming success.
for _ in $(seq 20); do              # up to ~5s
    if ! lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
        echo "Memory DB stopped"
        exit 0
    fi
    sleep 0.25
done
echo "Still shutting down — check with: lsof -iTCP:${PORT}"
exit 1
