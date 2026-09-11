# Keeping the web UI running

The review queue is only useful if it's *there* when you want it. This directory
has what you need to keep the UI running in the background.

Rather start it only when you need it? The Raycast commands in
[`../raycast/`](../raycast/) do that. Use one or the other — while this agent is
loaded, those commands tell you so instead of fighting it.

## Prerequisite: build the frontend

In always-on mode the API serves the built SPA itself — one process, one port, no
Vite server and no proxy:

```bash
npm --prefix frontend run build
```

`api/app.py` mounts `frontend/dist` if it exists, so this is what makes
`http://127.0.0.1:8000` show the UI instead of just the JSON API. Re-run it after
any frontend change.

## macOS — launchd

`local.personal-memory.plist` is a ready-made agent. Fill in the
`__PLACEHOLDER__` values, then:

```bash
cp deploy/local.personal-memory.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/local.personal-memory.plist
launchctl list | grep personal-memory
```

It starts at login, restarts on crash, and logs to `~/Library/Logs/`
(not `/tmp`, which every local account on the machine can read).
After editing the plist, `launchctl unload` then `load` again.

## Why not Docker?

Docker would be a reasonable instinct here, but it doesn't fit this app:

- **The MCP server can't live in a container anyway.** Claude Code starts
  `personal_mem_mcp.py` as a local stdio subprocess. Containerising the web UI
  would only cover half the system.
- **That leaves two worlds sharing one SQLite file** — the MCP on the host, the
  API in the container via a bind mount. SQLite handles multi-process access
  fine on a normal filesystem, but Docker Desktop's macOS mounts (VirtioFS /
  gRPC-FUSE) don't implement file-locking semantics completely. Low probability,
  miserable to debug.
- **launchd already does the one thing we wanted**: start at login, stay up,
  restart on failure — with no extra runtime.

Docker would start making sense if the UI had to run on a *different* machine
than the assistants. At that point SQLite-over-a-network-mount becomes the real
problem, and the answer would be a proper client/server database, not a
container.

## Windows / Linux

Same idea, different supervisor: a **Scheduled Task** ("At log on") on Windows,
or a **systemd user unit** (`~/.config/systemd/user/`) with `Restart=always` on
Linux. Same command as in the plist:

```
uv run fastapi run api/app.py --host 127.0.0.1 --port 8000
```
