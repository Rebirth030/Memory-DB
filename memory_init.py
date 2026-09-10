"""Schema setup for the personal memory store.

Run directly to (re)create ``memory.db`` next to this file::

    uv run python memory_init.py

Or import ``SCHEMA_SQL`` / ``init_db(path)`` to build the same schema elsewhere
(e.g. the demo seed builds a throwaway ``demo.db`` this way).
"""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "memory.db"

SCHEMA_SQL = """
    CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY,
        type TEXT NOT NULL,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        confidence REAL DEFAULT 1.0,
        sensitivity Text DEFAULT 'normal',
        status TEXT DEFAULT 'candidate',
        source TEXT DEFAULT 'chat',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        valid_to TIMESTAMP,
        supersedes INTEGER,
        tags TEXT,
        reason TEXT
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
        title,
        body,
        category,
        type,
        tags,
        content='memories',
        content_rowid='id',
        tokenize='unicode61'
    );


    CREATE TRIGGER IF NOT EXISTS update_memories_updated_at
    AFTER UPDATE ON memories
    FOR EACH ROW
    BEGIN
    UPDATE memories
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = OLD.id;
    END;

    CREATE TRIGGER IF NOT EXISTS memories_ai
    AFTER INSERT ON memories
    BEGIN
        INSERT INTO memories_fts(rowid, title, body, category, type, tags)
        VALUES (new.id, new.title, new.body, new.category, new.type, new.tags);
    END;

    CREATE TRIGGER IF NOT EXISTS memories_ad
    AFTER DELETE ON memories
    BEGIN
        INSERT INTO memories_fts(memories_fts, rowid, title, body, category, type, tags)
        VALUES ('delete', old.id, old.title, old.body, old.category, old.type, old.tags);
    END;

    CREATE TRIGGER IF NOT EXISTS memories_au
    AFTER UPDATE ON memories
    BEGIN
        INSERT INTO memories_fts(memories_fts, rowid, title, body, category, type, tags)
        VALUES ('delete', old.id, old.title, old.body, old.category, old.type, old.tags);

        INSERT INTO memories_fts(rowid, title, body, category, type, tags)
        VALUES (new.id, new.title, new.body, new.category, new.type, new.tags);
    END;
    """


def init_db(db_path: Path = DB_PATH) -> Path:
    """Create the schema (table + FTS index + triggers) in ``db_path``.

    Idempotent: every statement uses ``IF NOT EXISTS``, so re-running it on an
    existing database is a no-op. Returns the path it acted on.
    """
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        conn.executescript(SCHEMA_SQL)
        conn.commit()
    finally:
        conn.close()
    return db_path


if __name__ == '__main__':
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    print(f"Database created/opened at {DB_PATH.resolve()}")
    print(f"SQLite version: {sqlite3.sqlite_version}")

    init_db(DB_PATH)

    tables = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).fetchall()
    print("Tables:", [t["name"] for t in tables])
    conn.close()
