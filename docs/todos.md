# ToDos

<!-- Tags: #webui #store #mcp #test #docs #infra -->

## Active

- [ ] Build FastAPI backend over the store (list / review / update endpoints) #webui #store
- [ ] Build htmx + Jinja2 frontend: candidate review queue + browse/filter view #webui
- [ ] Bind web UI to 127.0.0.1 only; web UI may display sensitive/secret #webui
- [ ] Decide on `commit_active` (direct active write after user confirmation) vs suggest→approve #store #mcp

## Backlog

- [ ] Add `count_mem(filter)` for paginated "page N of M" in the web UI #store #webui
- [ ] Seed real `memory.db` with the owner's actual memories (via MCP, after web UI) #infra
- [ ] Optional: validate `sensitivity` on the raw-dict `update_mem` path (defense in depth) #store
- [ ] Move the assert-based suite to proper pytest structure #test
- [ ] Optional Markdown export (low priority — web UI replaces it as review surface) #webui

## Done

<!-- keep ~2 weeks -->
- [x] Store/MCP split; store has no transport deps (ADR-002) #store
- [x] Locked approval flow incl. supersede-at-approval (ADR-001) #mcp
- [x] Secrets: writable, never readable by model (ADR-003) #store
- [x] `list_memories` + `MemoryFilter` (filters, search, timestamps, sort, paging) #store
- [x] Input validation: `sensitivity` Literal, `confidence` ∈ [0,1] #store
- [x] Error chain sqlite3.Error → StoreError → ToolError #store #mcp
- [x] Anonymous seeds + 14-test suite on throwaway DB copies #test
- [x] Register MCP server with Claude Code (`personal-mem`, connected) #infra
