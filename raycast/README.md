# Opening the web UI from Raycast

An alternative to the always-on launchd agent in [`../deploy/`](../deploy/): the
server starts **on demand** when you open the UI, and stops when you tell it to.
No port is held while you aren't using it. Use one or the other — while the
launchd agent is loaded, these commands say so instead of fighting it.

Both are [Raycast Script Commands](https://github.com/raycast/script-commands) —
plain shell, no build step, no dependencies. macOS only.

| Command | What it does |
|---|---|
| **Memory DB** (`memory-db.sh`) | Starts the server if it isn't running, waits for it, opens the UI. Builds the frontend first if there's no build yet or its sources changed since (e.g. after a `git pull`). |
| **Memory DB Stop** (`memory-db-stop.sh`) | Stops the server and frees the port. |

## Setup

1. Finish the main [setup](../README.md#setup) — at least `uv sync` and a database.
2. In Raycast: **Settings → Extensions → "+" → Add Script Directory**, and pick
   this `raycast/` folder.

   This is *not* "Create Extension" — that generates a TypeScript project and is
   a different mechanism entirely.
3. Run **Memory DB** from the Raycast root search. The first run also builds the
   frontend, so it takes a little longer.

The scripts are marked executable in git. If Raycast still reports
`permission denied` — say, because you copied the files instead of cloning —
run `chmod +x raycast/*.sh`.

## Settings (optional)

Raycast doesn't read your shell profile, so `export`s in `.zshrc` never reach
these scripts. Put settings in a local `config.sh` instead:

```bash
cp raycast/config.example.sh raycast/config.sh
```

| Variable | Default | What for |
|---|---|---|
| `PERSONAL_MEM_PORT` | `8000` | The port the server listens on — change it if 8000 clashes with something else you run |
| `PERSONAL_MEM_DB` | `memory.db` in the repo | Which database to serve, e.g. a separate `work.db` |

`config.sh` is git-ignored, so your settings never end up in a commit.

## Notes

- The scripts find the repo from their own location, so they work in any clone
  without editing.
- Raycast runs scripts in a non-login shell, where Homebrew's bin isn't on
  `PATH`, and version managers' shell hooks never run. The scripts add the usual
  locations — Homebrew on Apple Silicon and Intel, `~/.local/bin`,
  `~/.cargo/bin`, and the default versions of fnm, nvm, volta, mise and asdf —
  so `uv`, `npm` and `node` are found. Anything else can go on `PATH` in
  `config.sh`.
- `--host 127.0.0.1` is passed explicitly — the API has no auth and returns
  secrets.
- The stop command only stops a server whose working directory is this repo, so
  another project that happens to use the same port is left alone.
- Logs go to `~/Library/Logs/personal-memory.log`.
