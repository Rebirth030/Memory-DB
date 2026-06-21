"""Personal memory MCP server.

A local, controllable long-term memory store for AI assistants, backed by
SQLite + FTS5. `memory.db` is the single source of truth.

Memory lifecycle (the `status` column)::

    candidate ──approve──▶ active ──(superseded by a newer memory)──▶ superseded
        └──────reject──────▶ rejected

New facts enter as ``candidate`` and are invisible to retrieval until a human
approves them. ``search_memories`` and ``get_memories`` only ever return
``active`` memories.

Governance — assistants may use the read tools and ``suggest_memories`` freely,
and may store memories at any sensitivity (including ``sensitive``/``secret``).
But the read tools NEVER return ``sensitive`` or ``secret`` memories — those are
viewable only in the local web UI. And assistants MUST NOT approve, reject, or
edit existing memories on their own: always ask the user to decide, then act on
their explicit choice.

Keep ONE consolidated memory per topic. Always search first: if the topic
already exists, supersede it to fold in new detail rather than adding a
duplicate. Create a new memory only for a genuinely new topic, or to split a
memory that mixes several topics.

Always store memory content (title, body, tags) in English, regardless of the
conversation language, so it stays consistently searchable.

This module is a thin transport layer: every tool just calls
``personal_mem_store`` and translates ``StoreError`` into ``ToolError``.
"""

from typing import Any

from fastmcp import FastMCP
from fastmcp.exceptions import ToolError

import personal_mem_store as store
from personal_mem_store import Decision, MemoryInput, Sensitivity, StoreError

mcp = FastMCP("personal_mem")


@mcp.tool
def search_memories(query: str, limit: int = 10) -> list[dict[str, Any]]:
    """Full-text search over stored memories using FTS5 (memories_fts).

    IMPORTANT — space-separated terms are combined with AND: `editor config vim`
    only matches a memory containing ALL three words, so long keyword lists
    usually return nothing. For good recall, start BROAD:
      * a single keyword (`editor`), then narrow if needed;
      * `OR` between alternatives (`editor OR ide`, `birthdate OR born OR age`);
      * a prefix (`serv*`), or an `"exact phrase"`.
    Run a few broad queries rather than one long AND query.

    Returns active memories ranked best-first. Each hit includes a `snippet` and
    `body_truncated`: when true the snippet is not the full text, so fetch it with
    `get_memories([id])` if the hit looks relevant.
    """
    try:
        return store.search_mem(query, limit=limit)
    except StoreError as e:
        raise ToolError(str(e))


@mcp.tool
def get_memories(ids: list[int]) -> list[dict[str, Any]]:
    """Fetch the full memories for the given ids, including the complete body.

    Use this after `search_memories` when a hit's snippet is truncated
    (`body_truncated` is true) and the memory looks relevant.

    Only currently active, non-secret memories are returned. Ids that are
    candidates, superseded, or marked `sensitive`/`secret` come back empty —
    secrets are viewable only in the web UI, not here.
    """
    try:
        return store.get_mem(ids)
    except StoreError as e:
        raise ToolError(str(e))


@mcp.tool
def suggest_memories(items: list[MemoryInput]) -> list[dict[str, Any]]:
    """Propose new memories for human review — does NOT store them as active.

    Goal: keep ONE consolidated memory per specific topic — avoid many small,
    overlapping, or duplicate entries.

    ALWAYS `search_memories` for the topic FIRST, then choose:
      * The topic already has a memory and you now have MORE DETAIL or CHANGED
        info → do NOT add a new memory. SUPERSEDE the existing one: suggest a
        candidate with `supersedes` set to its id, whose body folds the old
        content together with the new detail. (The old version is kept as
        history once approved.)
      * Only a trivial typo/wording fix, no new information → use
        `update_memory` (on the user's request).
      * A genuinely NEW topic that nothing existing covers → suggest a new memory.
      * An existing memory mixes SEVERAL topics → you may split it into separate
        per-topic memories (e.g. "uses Postgres at work and SQLite at home" → one
        "Work database" memory + one "Personal database" memory).

    Example of one evolving topic via supersedes (Editor):
      "Used VS Code until 2024."
      → "Switched to Neovim in 2024; still evaluating the plugin setup."
      → "Settled on Neovim with a minimal config."

    Write the content (title, body, tags) in English, even if the conversation
    is in another language — this keeps the store consistently searchable.

    Each item is written as a 'candidate': indexed internally but NOT returned
    by `search_memories` until the user decides via `approve_reject_memories`.
    This is the only write tool an assistant should call on its own, and only
    for stable facts. You may store anything: mark a memory you should not be
    able to read back later (e.g. a credential) as `sensitivity='secret'` — it
    is saved but never returned by the read tools (web-UI only).

    To propose replacing an existing memory, set `supersedes` to its id; the
    swap to 'superseded' happens at approval time, not here. Runs in one
    transaction and returns the created candidate rows.
    """
    try:
        return store.suggest_mem(items)
    except StoreError as e:
        raise ToolError(str(e))


@mcp.tool
def update_memory(
    id: int,
    title: str | None = None,
    body: str | None = None,
    tags: str | None = None,
    category: str | None = None,
    type: str | None = None,
    confidence: float | None = None,
    sensitivity: Sensitivity | None = None,
    valid_from: str | None = None,
    valid_to: str | None = None,
) -> dict[str, Any]:
    """Correct or refine an existing memory in place (same fact, no history).

    Editing changes an ACTIVE memory directly, with no candidate review. Treat
    it like approval: only call this when the user explicitly asks you to change
    a memory — never edit on your own initiative.

    Only the fields you pass are changed; omitted fields stay as they are.
    Use this ONLY for trivial fixes (typos, rewording) that add no new
    information. To add detail or evolve a topic, do NOT edit here — supersede
    the memory instead (suggest a candidate with `supersedes` set), which keeps
    the history and consolidates the topic.

    `updated_at` is bumped automatically; the FTS index is kept in sync by
    triggers. Returns the updated row.
    """
    fields = {
        "title": title, "body": body, "tags": tags, "category": category,
        "type": type, "confidence": confidence, "sensitivity": sensitivity,
        "valid_from": valid_from, "valid_to": valid_to,
    }
    try:
        return store.update_mem(id, fields)
    except StoreError as e:
        raise ToolError(str(e))


@mcp.tool
def approve_reject_memories(decisions: list[Decision]) -> list[dict[str, Any]]:
    """Approve or reject candidate memories — a human-reviewer action.

    Do NOT decide yourself. After suggesting, ASK the user which candidates to
    approve or reject, and only call this once they answer (e.g. "approve 3 and
    5, reject 4"). Never approve your own suggestions on your own initiative —
    the user is the reviewer.

    Pass one `Decision` per candidate: `approve=True` activates it (it becomes
    searchable), `approve=False` rejects it (with an optional `reason`). Every
    id must currently be a 'candidate'.

    Approving a candidate that carries a `supersedes` pointer performs the swap
    atomically: the old memory becomes 'superseded' (its `valid_to` closes) and
    the candidate becomes 'active' (its `valid_from` opens) at the same instant.
    If the supersede target is no longer active, the batch is rejected so you
    can re-suggest against the current memory.

    The whole batch runs in one transaction: any invalid id rolls everything
    back, nothing is applied, and an error is raised. Returns the affected rows
    (now active or rejected).
    """
    try:
        return store.review_mem(decisions)
    except StoreError as e:
        raise ToolError(str(e))


if __name__ == "__main__":
    mcp.run()  # stdio transport by default
