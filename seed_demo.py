"""Demo seed — load fictional sample memories to show off the web UI.

This is NOT test data and NOT about any real person. It exists purely to make a
nice live demo of the review queue, browse/filter and the supersede flow. It
builds a SEPARATE database (``demo.db`` by default) so your real ``memory.db`` is
never touched, and fills it with memories in every lifecycle state:

* active            — the settled knowledge base (many categories, varied confidence)
* candidate         — waiting in the review queue (incl. one that *supersedes* an
                      active memory, so you can demo the approve-swap with a diff)
* superseded        — an old memory already replaced by a newer one
* rejected          — a candidate that was reviewed and declined (with a reason)
* sensitive/secret  — only ever visible in this UI (lock-badge demo)

Build it (from the project root, since `python` is not on PATH):

    uv run python seed_demo.py                  # build ./demo.db fresh
    uv run python seed_demo.py --db demo.db     # explicit path
    uv run python seed_demo.py --append         # add to it, don't wipe

Then point the API at it and start the web UI:

    PERSONAL_MEM_DB=demo.db uv run fastapi dev api/app.py      # macOS/Linux
    $env:PERSONAL_MEM_DB = "demo.db"; uv run fastapi dev api/app.py   # PowerShell

The persona ("Robin", a fictional indie game developer) is invented for the demo.
"""

import argparse
import sqlite3
import sys
from pathlib import Path

import memory_init
import personal_mem_store as store
from personal_mem_store import Decision, MemoryFilter, MemoryInput

_PROJECT = Path(__file__).parent
_REAL_DB = _PROJECT / "memory.db"


def _ensure_db(target: Path, append: bool) -> None:
    """Create ``target`` as a fresh, schema-only demo DB (unless appending).

    The schema (table + FTS index + triggers) is built from ``memory_init`` so
    the demo is self-contained and never reads or writes the real ``memory.db``.
    A rebuild deletes any existing rows in the target first.
    """
    if target.resolve() == _REAL_DB.resolve():
        sys.exit("Refusing to use the real memory.db as the demo target — pick another --db path.")

    memory_init.init_db(target)  # idempotent: creates the schema if missing
    if append:
        return

    conn = sqlite3.connect(target)
    conn.execute("DELETE FROM memories")  # triggers clear the FTS index too
    conn.commit()
    conn.close()


def build(target: Path, append: bool) -> None:
    """Build the demo database at ``target`` and fill it with sample memories."""
    _ensure_db(target, append)
    store.DB_PATH = target  # every store call below now targets the demo DB

    # --- active: the settled knowledge base -------------------------------- #
    active = [
        MemoryInput(title="Chat language", type="preference", category="communication",
                    tags="language german english",
                    body="Prefers German for conversation but English for code and comments.",
                    confidence=0.9),
        MemoryInput(title="Answer style", type="preference", category="preferences",
                    body="Likes concise answers with a short, runnable code example.",
                    confidence=0.8),
        MemoryInput(title="Theme", type="preference", category="preferences",
                    body="Prefers dark mode in every tool and editor.", confidence=0.7),
        MemoryInput(title="Role", type="fact", category="work",
                    body="Works as a freelance indie game developer."),
        MemoryInput(title="Tech stack", type="fact", category="tech_stack",
                    tags="godot gdscript",
                    body="Builds 2D games with the Godot engine and GDScript."),
        MemoryInput(title="Editor", type="fact", category="tools",
                    tags="neovim",
                    body="Uses Neovim with a deliberately minimal configuration."),
        MemoryInput(title="Timezone", type="environment", category="environment",
                    body="Is based in the Europe/Berlin timezone."),
        MemoryInput(title="Current project", type="project", category="projects",
                    tags="stardust roguelike",
                    body="Main project is a 2D roguelike codenamed 'Stardust'."),
        MemoryInput(title="Milestone", type="goal", category="projects",
                    body="Wants to ship a playable demo build of 'Stardust' by the end of Q3.",
                    confidence=0.6),
        MemoryInput(title="Background", type="fact", category="background",
                    body="Studied computer science and is self-taught in pixel art.",
                    confidence=0.8),
        MemoryInput(title="Diet", type="fact", category="general",
                    body="Is vegetarian and dislikes mushrooms.", confidence=0.7),
    ]
    for m in active:
        store.commit_active(m)

    # An active memory we will leave a *pending* supersede candidate against,
    # so the review queue can demo the old-vs-new swap diff.
    hardware = store.commit_active(MemoryInput(
        title="Workstation", type="environment", category="hardware",
        tags="desktop gpu ram",
        body="Develops on a desktop PC with an RTX 4070 GPU and 32 GB of RAM."))

    # --- sensitivity demos (active, UI-only visibility) -------------------- #
    store.commit_active(MemoryInput(
        title="Contact email", type="fact", category="identity",
        body="Demo contact email is robin.demo@example.com.",
        sensitivity="private"))
    store.commit_active(MemoryInput(
        title="Deploy token", type="fact", category="secrets",
        tags="api key deploy",
        body="Demo deploy token (fake): sk-demo-0000-1111-2222-3333.",
        sensitivity="secret"))
    store.commit_active(MemoryInput(
        title="Rate expectation", type="fact", category="work",
        body="Target day rate for the next freelance contract is around 600 EUR.",
        sensitivity="sensitive", confidence=0.7))

    # --- superseded: an old memory already replaced by a newer one --------- #
    old = store.commit_active(MemoryInput(
        title="Task tracking", type="fact", category="tools",
        body="Tracks tasks in a shared Trello board."))
    swapped = store.suggest_mem([MemoryInput(
        title="Task tracking", type="fact", category="tools",
        body="Switched task tracking to a self-hosted Kanban board.",
        supersedes=old["id"])])[0]
    store.review_mem([Decision(id=swapped["id"], approve=True)])

    # --- candidates: waiting in the review queue --------------------------- #
    store.suggest_mem([
        MemoryInput(title="Indentation", type="preference", category="preferences",
                    body="Leans towards tabs over spaces for indentation.", confidence=0.6),
        MemoryInput(title="Engine version", type="fact", category="tech_stack",
                    tags="godot migration",
                    body="Is migrating projects from Godot 3 to Godot 4."),
        MemoryInput(title="Music", type="preference", category="general",
                    body="Listens to lo-fi while coding.", confidence=0.5),
    ])
    # A candidate that supersedes the active 'Workstation' memory -> the queue
    # should show this as an old-vs-new replacement, not a brand-new entry.
    store.suggest_mem([MemoryInput(
        title="Workstation", type="environment", category="hardware",
        tags="desktop gpu ram upgrade",
        body="Upgraded the workstation to an RTX 4080 GPU and 64 GB of RAM.",
        supersedes=hardware["id"])])

    # --- rejected: reviewed and declined, with a reason -------------------- #
    junk = store.suggest_mem([MemoryInput(
        title="Favourite colour", type="fact", category="general",
        body="Mentioned once that blue is a nice colour.")])[0]
    store.review_mem([Decision(id=junk["id"], approve=False,
                               reason="Too trivial and not durable to keep.")])

    _print_summary(target)


def _print_summary(target: Path) -> None:
    counts: dict[str, int] = {}
    for m in store.list_memories(MemoryFilter()):
        counts[m["status"]] = counts.get(m["status"], 0) + 1
    total = sum(counts.values())
    print(f"Demo DB ready: {target}")
    print(f"  {total} memories total")
    for status in ("candidate", "active", "superseded", "rejected"):
        print(f"    {status:<11} {counts.get(status, 0)}")
    print("\nServe it with the web UI:")
    print(f"    PERSONAL_MEM_DB={target.name} uv run fastapi dev api/app.py")
    print(f'    $env:PERSONAL_MEM_DB = "{target.name}"; uv run fastapi dev api/app.py'
          "   # PowerShell")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Seed a demo database to show off the web UI.")
    p.add_argument("--db", default="demo.db",
                   help="Target database file (default: demo.db, next to the project).")
    p.add_argument("--append", action="store_true",
                   help="Add to an existing demo DB instead of rebuilding it from scratch.")
    args = p.parse_args()

    target = Path(args.db)
    if not target.is_absolute():
        target = _PROJECT / target
    build(target, args.append)
