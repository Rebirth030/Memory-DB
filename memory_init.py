import sqlite3
from pathlib import Path

if __name__ == '__main__':
    DB_PATH = Path("memory.db")

    conn = sqlite3.connect(DB_PATH)

    conn.execute("PRAGMA foreign_keys = ON")

    conn.row_factory = sqlite3.Row

    print(f"Database created/opened at {DB_PATH.resolve()}")
    print(f"SQLite version: {sqlite3.sqlite_version}")
    print(f"File size: {DB_PATH.stat().st_size} bytes")

    SCHEMA_SQL ="""
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

    conn.executescript(SCHEMA_SQL)
    conn.commit()

    # Verify tables
    tables = conn.execute(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).fetchall()
    print("Tables:", [t["name"] for t in tables])

    #conn.close()
