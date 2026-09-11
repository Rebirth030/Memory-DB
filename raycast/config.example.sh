# Local settings for the Raycast commands. Copy this file to config.sh (which is
# git-ignored) and uncomment what you need. Raycast doesn't read your shell
# profile, so exports in .zshrc never reach these scripts — this file does.

# Port the server listens on. 8000 is the default; pick another one if it clashes
# with something else you run (Django, python -m http.server, docker-compose…).
# PERSONAL_MEM_PORT=8765

# Which database to serve. Defaults to memory.db in the repo root; point it
# somewhere else to keep, say, a work store apart from your personal one.
# PERSONAL_MEM_DB="$HOME/Memory-DB/work.db"

# Using a Node version manager the scripts don't find on their own (they look
# for fnm, nvm, volta, mise and asdf)? Add the directory that holds node and npm.
# Only needed for the automatic frontend build.
# PATH="$HOME/path/to/node/bin:$PATH"
