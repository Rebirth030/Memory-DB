"""Personal memory store — the domain layer.

Pure SQLite logic plus the shared data models. Knows nothing about MCP or
HTTP, so both the MCP server (`personal_mem_mcp.py`) and a future web UI can
import and reuse it. Transports translate `StoreError` into their own error
type (the MCP server raises `ToolError`).
"""

import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal, get_args

from pydantic import BaseModel, Field

# Defaults to the real store next to this file; set PERSONAL_MEM_DB to point a
# transport (e.g. the web API) at another database, such as the demo seed DB.
DB_PATH = Path(os.environ.get("PERSONAL_MEM_DB", Path(__file__).parent / "memory.db"))

# Content fields update_mem may change. Status transitions
# (candidate->active, ->superseded, ->rejected) go through review_mem alone,
# so the lifecycle stays auditable.
_UPDATABLE = {
    "title", "body", "tags", "category", "type",
    "confidence", "sensitivity", "valid_from", "valid_to",
}

# Comparison operators allowed in MemoryFilter.timestamps. Ordered longest-first
# so a leading ">=" is matched before ">".
_TIMESTAMP_OPS = (">=", "<=", "=", ">", "<")

# FTS5 keyword operators — used to detect a query we should not broaden.
_FTS_OPERATORS = {"OR", "AND", "NOT", "NEAR"}

# Allowed privacy levels. 'sensitive'/'secret' are stored but never returned by
# the read tools — viewable only in the web UI.
Sensitivity = Literal["public", "normal", "private", "sensitive", "secret"]

_DISTINCTABLE = {"category", "type", "source"}


class StoreError(Exception):
    """A domain-level problem (bad id, illegal state transition, …).

    Transport-agnostic on purpose: the MCP server catches it and re-raises a
    ``ToolError`` so the message reaches the client.
    """


@contextmanager
def _session(*, write: bool = False):
    # reads open read-only so they can never mutate the store
    try:
        conn = sqlite3.connect(f"file:{DB_PATH}" + ("" if write else "?mode=ro"), uri=True)
    except sqlite3.Error as e:
        raise StoreError(f"could not open database: {e}") from e
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        if write:
            conn.commit()
    except sqlite3.Error as e:
        # surface low-level DB failures as a domain error the transport can show
        if write:
            conn.rollback()
        raise StoreError(str(e)) from e
    except Exception:
        if write:
            conn.rollback()
        raise
    finally:
        conn.close()


def _row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {k: row[k] for k in row.keys()}


class MemoryInput(BaseModel):
    """One memory to propose. Only ``title`` and ``body`` are required.

    Set ``supersedes`` to the id of an existing active memory when this one is
    meant to replace it; the actual swap happens at approval time, not on
    suggestion.
    """

    title: str = Field(description="Short, descriptive title. Write in English.")
    body: str = Field(
        description="The actual memory content. Always write it in English, "
                    "regardless of the conversation language, so it stays "
                    "consistently searchable."
    )
    type: str = Field("note", description="preference | fact | goal | project | environment")
    category: str = Field("general", description="communication | work | tech_stack | hardware | …")
    tags: str = Field("", description="Free-text extra search terms, in English.")
    confidence: float = Field(
        1.0, ge=0.0, le=1.0, description="How confident are you in this fact? 0.0–1.0 (1.0 = 100%)."
    )
    sensitivity: Sensitivity = Field(
        "normal",
        description="public | normal | private | sensitive | secret. "
                    "'sensitive'/'secret' are stored but never returned by the read "
                    "tools — they are viewable only in the web UI.",
    )
    source: str = Field("chat", description="Where the information came from")
    valid_from: str | None = Field(
        None, description="YYYY-MM-DD HH:MM:SS, from when this memory is valid. Defaults to now."
    )
    valid_to: str | None = Field(
        None, description="YYYY-MM-DD HH:MM:SS, until when this memory is valid. Defaults to always."
    )
    supersedes: int | None = Field(None, description="Replace this memory by the one with this id.")


class Decision(BaseModel):
    """One review decision for a candidate memory."""

    id: int = Field(description="The id of the candidate memory.")
    approve: bool = Field(description="Whether to approve this memory.")
    reason: str | None = Field(None, description="If rejected, why?")

class MemoryFilter(BaseModel):
    """Filter, sort and paginate memories for the web-UI / admin read path.

    Consumed by ``list_memories``. Every SQL identifier (the ``choices`` keys,
    the ``timestamps`` keys and ``order_by``) comes from a ``Literal`` allowlist
    so it can be inlined into the query safely; all actual values are passed as
    bound parameters.
    """

    choices: dict[
        Literal["status", "category", "type", "sensitivity", "source"],
        list[str],
    ] = Field(
        default_factory=dict,
        description=(
            "Per-column allowlist filters, each applied as `<col> IN (...)`. "
            "Empty value lists are ignored. "
            "Example: {'status': ['candidate'], 'category': ['work', 'hardware']}."
        ),
    )

    search: str | None = Field(
        None,
        description="Free text; matched as LIKE '%…%' over title, body and tags.",
    )

    timestamps: dict[
        Literal["created_at", "updated_at", "valid_from", "valid_to"], str
    ] = Field(
        default_factory=dict,
        description=(
            "Timestamp comparisons. Each value is an operator directly followed "
            "by 'YYYY-MM-DD HH:MM:SS'; operator is one of >=, <=, =, >, <. "
            "Example: {'created_at': '>=2023-01-01 00:00:00'}."
        ),
    )

    order_by: Literal[
        "created_at", "updated_at", "title", "confidence", "type", "sensitivity",
        "status", "source", "valid_from", "valid_to", "supersedes", "tags",
    ] = Field("created_at", description="Column to sort by.")
    descending: bool = Field(True, description="Sort descending (newest / highest first).")

    #limit: int = Field(50, ge=1, le=500, description="Max number of rows to return.")
    #offset: int = Field(0, ge=0, description="Rows to skip, for pagination.")


# --------------------------------------------------------------------------- #
# Reads
# --------------------------------------------------------------------------- #
def _run_fts(conn: sqlite3.Connection, sql: str, match: str, limit: int) -> list[sqlite3.Row]:
    """Run one FTS query; retry a malformed expression as a quoted phrase."""
    try:
        return conn.execute(sql, (match, limit)).fetchall()
    except sqlite3.OperationalError:
        safe = '"' + match.replace('"', '""') + '"'
        return conn.execute(sql, (safe, limit)).fetchall()


def search_mem(query: str, limit: int = 10) -> list[dict[str, Any]]:
    sql = """
          SELECT m.id,
                 m.title,
                 m.category,
                 m.type,
                 snippet(memories_fts, 1, '[', ']', ' … ', 24) AS snippet,
                 length(m.body)                                AS body_len,
                 length(m.body) > 180                          AS body_truncated,
                 bm25(memories_fts)                            AS rank
          FROM memories_fts
                   JOIN memories m ON m.id = memories_fts.rowid
          WHERE memories_fts MATCH ?
            AND m.status = 'active'
            AND m.sensitivity IN ('public', 'normal', 'private')
          ORDER BY rank
          LIMIT ?
          """
    with _session() as conn:
        rows = _run_fts(conn, sql, query, limit)
        # A plain multi-word query is ANDed by FTS5 and often matches nothing.
        # If so, broaden it to OR across the terms so naive queries still recall.
        if not rows:
            terms = query.split()
            broadenable = (
                len(terms) > 1
                and not any(t.upper() in _FTS_OPERATORS for t in terms)
                and not any(c in query for c in '"*()')
            )
            if broadenable:
                or_query = " OR ".join(f'"{t}"' for t in terms)
                rows = _run_fts(conn, sql, or_query, limit)
    return [_row_to_dict(r) for r in rows]


def get_mem(ids: list[int]) -> list[dict[str, Any]]:
    if not ids:
        return []
    placeholders = ",".join("?" * len(ids))
    sql = f"""
        SELECT * FROM memories
        WHERE id IN ({placeholders})
          AND status = 'active'
          AND sensitivity IN ('public', 'normal', 'private')
    """
    with _session() as conn:
        rows = conn.execute(sql, ids).fetchall()
    return [_row_to_dict(r) for r in rows]

def get_one_mem(id: int) -> dict[str, Any]:
    """Fetch a single memory by id, in ANY status and ANY sensitivity.

    The admin / web-UI getter — unlike `get_mem`, which hides non-active and
    secret rows. Raises ``StoreError`` if no memory has that id.
    """
    with _session() as conn:
        row = conn.execute("SELECT * FROM memories WHERE id = ?", (id,)).fetchone()
    if row is None:
        raise StoreError(f"get_one: no memory with id {id}.")
    return _row_to_dict(row)


# --------------------------------------------------------------------------- #
# Writes
# --------------------------------------------------------------------------- #
def _insert_memories(
    conn: sqlite3.Connection, items: list[MemoryInput], status: str
) -> list[dict[str, Any]]:
    """Insert memories with the given lifecycle status; return the created rows.

    Shared by `suggest_mem` (status='candidate') and `commit_active`
    (status='active') — the status value is the only difference between them.
    """
    insert = """
             INSERT INTO memories
             (type, category, title, body, tags, confidence,
              sensitivity, source, status, valid_from, valid_to, supersedes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             """
    ids = []
    for m in items:
        cur = conn.execute(
            insert,
            (m.type, m.category, m.title, m.body, m.tags, m.confidence,
             m.sensitivity, m.source, status, m.valid_from, m.valid_to, m.supersedes),
        )
        ids.append(cur.lastrowid)
    placeholders = ",".join("?" * len(ids))
    rows = conn.execute(
        f"SELECT * FROM memories WHERE id IN ({placeholders})", ids
    ).fetchall()
    return [_row_to_dict(r) for r in rows]


def suggest_mem(items: list[MemoryInput]) -> list[dict[str, Any]]:
    """Propose memories as 'candidate' (indexed, but invisible to search until approved)."""
    if not items:
        return []
    with _session(write=True) as conn:
        return _insert_memories(conn, items, "candidate")


def update_mem(id: int, fields: dict[str, Any]) -> dict[str, Any]:
    """Update content fields of one memory in place (no status change).

    ``fields`` may carry ``None`` values (ignored). Raises ``StoreError`` if
    nothing is left to update, an unknown field is given, or the id is missing.
    """
    fields = {k: v for k, v in fields.items() if v is not None}
    if not fields:
        raise StoreError("update: no fields to update were provided.")
    unknown = set(fields) - _UPDATABLE
    if unknown:
        raise StoreError(f"update: fields not updatable: {sorted(unknown)}.")

    set_clause = ", ".join(f"{col} = ?" for col in fields)
    params = [*fields.values(), id]
    with _session(write=True) as conn:
        cur = conn.execute(f"UPDATE memories SET {set_clause} WHERE id = ?", params)
        if cur.rowcount == 0:
            raise StoreError(f"update: no memory with id {id}.")
        row = conn.execute("SELECT * FROM memories WHERE id = ?", (id,)).fetchone()
    return _row_to_dict(row)


def review_mem(decisions: list[Decision]) -> list[dict[str, Any]]:
    """Approve or reject candidates in one transaction.

    Approving a candidate that carries ``supersedes`` swaps atomically: the old
    memory becomes 'superseded' (``valid_to`` closed) and the candidate becomes
    'active' (``valid_from`` opened) at the same instant. Any invalid id rolls
    the whole batch back via a ``StoreError``.
    """
    if not decisions:
        return []
    # one timestamp for the whole batch so old.valid_to == new.valid_from exactly
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    ids = [d.id for d in decisions]
    with _session(write=True) as conn:
        for d in decisions:
            cand = conn.execute(
                "SELECT id, status, supersedes FROM memories WHERE id = ?",
                (d.id,),
            ).fetchone()
            if cand is None:
                raise StoreError(f"review: no memory with id {d.id}.")
            if cand["status"] != "candidate":
                raise StoreError(
                    f"review: memory {d.id} is '{cand['status']}', not a candidate."
                )
            if d.approve:
                old_id = cand["supersedes"]
                if old_id is not None:
                    old = conn.execute(
                        "SELECT id, status FROM memories WHERE id = ?", (old_id,)
                    ).fetchone()
                    if old is None:
                        raise StoreError(
                            f"approve: candidate {d.id} supersedes {old_id}, "
                            "which does not exist."
                        )
                    if old["status"] != "active":
                        raise StoreError(
                            f"approve: candidate {d.id} supersedes {old_id}, "
                            f"but {old_id} is '{old['status']}', not active. "
                            "Re-suggest against the current active memory."
                        )
                    conn.execute(
                        "UPDATE memories SET status = 'superseded', valid_to = ? "
                        "WHERE id = ?",
                        (now, old_id),
                    )
                conn.execute(
                    "UPDATE memories SET status = 'active', valid_from = ?, supersedes = ? "
                    "WHERE id = ?",
                    (now, old_id, d.id),
                )
            else:
                conn.execute(
                    "UPDATE memories SET status = 'rejected', reason = ? WHERE id = ?",
                    (d.reason, d.id),
                )

        placeholders = ",".join("?" * len(ids))
        rows = conn.execute(
            f"SELECT * FROM memories WHERE id IN ({placeholders})", ids
        ).fetchall()
    return [_row_to_dict(r) for r in rows]

def list_memories(f: MemoryFilter) -> list[dict[str, Any]]:
    """Filtered, sorted, paginated read over memories (web-UI / admin path).

    Unlike ``search_mem``/``get_mem`` this returns rows of ANY status and ANY
    sensitivity — including ``sensitive``/``secret``. It must therefore NEVER be
    exposed as an MCP tool; it is for the local web UI only.

    SQL is built safely: column names and the sort column come from the
    ``Literal`` allowlists in :class:`MemoryFilter` and are inlined; every value
    (and the timestamp operands) is a bound parameter. Raises ``StoreError`` on
    a bad timestamp operator.
    """
    cond = "WHERE 1=1"
    params: list[Any] = []

    # `<col> IN (...)` filters — keys are Literal-restricted to real columns.
    for field, values in f.choices.items():
        if not values:
            continue  # empty list would produce an invalid `IN ()`
        placeholders = ",".join("?" * len(values))
        cond += f" AND {field} IN ({placeholders})"
        params += values

    # Free-text over the human-readable columns.
    if f.search:
        cond += " AND (title LIKE ? OR body LIKE ? OR tags LIKE ?)"
        params += [f"%{f.search}%"] * 3

    # Timestamp comparisons: operator from the allowlist (inlined), value bound.
    for field, raw in f.timestamps.items():
        raw = raw.strip()
        op = next((o for o in _TIMESTAMP_OPS if raw.startswith(o)), None)
        if op is None:
            raise StoreError(
                f"list: '{field}' filter must start with one of "
                f"{list(_TIMESTAMP_OPS)}, got {raw!r}."
            )
        cond += f" AND {field} {op} ?"
        params.append(raw[len(op):].strip())

    # order_by is Literal-restricted -> safe to inline; direction is fixed text.
    direction = "DESC" if f.descending else "ASC"
    cond += f" ORDER BY {f.order_by} {direction}"
    # Paging is disabled for now (small store). To re-enable, restore `limit`/
    # `offset` on MemoryFilter and append here:
    #   cond += " LIMIT ? OFFSET ?"
    #   params += [f.limit, f.offset]

    sql = f"SELECT * FROM memories {cond}"
    with _session() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [_row_to_dict(r) for r in rows]

def distinct_values(column: str) -> list[str]:
    """Distinct values present in an allow-listed open column (category/type/source).

    Used to build the web-UI filter dropdowns. The column name is validated
    against `_DISTINCTABLE` before being inlined into the query.
    """
    if column not in _DISTINCTABLE:
        raise StoreError(f"distinct: column '{column}' not allowed.")
    with _session() as conn:
        rows = conn.execute(
            f"SELECT DISTINCT {column} FROM memories ORDER BY {column}"
        ).fetchall()
    return [r[0] for r in rows]


def facets() -> dict[str, list[str]]:
    """Filter options for the web-UI, keyed by column.

    Closed sets come from the schema: ``status`` from the lifecycle, ``sensitivity``
    from the ``Sensitivity`` Literal. Open sets (``category``, ``type``, ``source``)
    are the distinct values currently present in the DB.
    """
    return {
        "status": ["candidate", "active", "superseded", "rejected"],
        "sensitivity": list(get_args(Sensitivity)),
        "category": distinct_values("category"),
        "type": distinct_values("type"),
        "source": distinct_values("source"),
    }


def commit_active(item: MemoryInput) -> dict[str, Any]:
    """Insert a single memory directly as 'active' (immediately searchable).

    The admin / web-UI path for adding a memory without the candidate→approve
    step. Does NOT perform a supersede swap — to replace an existing memory use
    the candidate path (suggest with ``supersedes``, then approve).
    """
    with _session(write=True) as conn:
        return _insert_memories(conn, [item], "active")[0]


