"""Seed data + tests for the personal memory store.

All data here is generic, fictional sample data — it is not about any real
person. Two things live in this file:

* **Seed helpers** (`seed_memories`, `seed_into_db`) — reusable sample memories.
  They run against whatever `store.DB_PATH` currently points at, so you can also
  use them to populate a database with demo content::

      import personal_mem_test as t
      t.seed_into_db()          # seeds the active DB (idempotent by title)

* **Tests** — each runs against a throwaway copy of `memory.db`, so the real
  store is never touched.

Run directly:   .venv/Scripts/python.exe personal_mem_test.py
Or with pytest: .venv/Scripts/python.exe -m pytest personal_mem_test.py
"""

import shutil
import tempfile
from pathlib import Path

from pydantic import ValidationError

import personal_mem_store as store
from personal_mem_store import Decision, MemoryFilter, MemoryInput, StoreError

_REAL_DB = Path(__file__).parent / "memory.db"
_TMP_DIRS: list[Path] = []


# --------------------------------------------------------------------------- #
# Seed data (generic, fictional — not about any real person)
# --------------------------------------------------------------------------- #
def seed_memories() -> list[MemoryInput]:
    """A neutral sample set, one per category, for demos and tests."""
    return [
        MemoryInput(title="Display name", type="fact", category="identity",
                    body="The sample user's display name is 'Sample User'."),
        MemoryInput(title="Chat language", type="preference", category="communication",
                    body="Prefers responses in English."),
        MemoryInput(title="Answer style", type="preference", category="preferences",
                    body="Prefers concise explanations with short code examples."),
        MemoryInput(title="Role", type="fact", category="work",
                    body="Works as a backend software developer."),
        MemoryInput(title="Tech stack", type="fact", category="tech_stack",
                    tags="python sqlite fastapi",
                    body="Builds services with Python, SQLite and FastAPI."),
        MemoryInput(title="Hardware", type="environment", category="hardware",
                    tags="laptop ram",
                    body="Develops on a laptop with 16 GB RAM."),
        MemoryInput(title="Dependencies", type="constraint", category="constraints",
                    body="Prefers to keep third-party dependencies minimal."),
        MemoryInput(title="Editor", type="fact", category="tools",
                    body="Uses a generic code editor as the main tool."),
        MemoryInput(title="Learning", type="fact", category="education",
                    body="Is taking an online course on databases."),
    ]


def seed_into_db() -> list[dict]:
    """Insert the seed memories as ACTIVE rows (suggest -> approve).

    Idempotent by title: memories whose title already exists are skipped, so it
    is safe to call repeatedly. Returns all currently active memories.
    """
    existing = {m["title"] for m in store.list_memories(MemoryFilter(limit=500))}
    fresh = [m for m in seed_memories() if m.title not in existing]
    if fresh:
        rows = store.suggest_mem(fresh)
        store.review_mem([Decision(id=r["id"], approve=True) for r in rows])
    return store.list_memories(MemoryFilter(choices={"status": ["active"]}, limit=500))


# --------------------------------------------------------------------------- #
# Test harness — isolate each test on a clean copy of the real DB
# --------------------------------------------------------------------------- #
def _fresh_db() -> Path:
    """Point the store at an empty copy of memory.db (schema + triggers, no rows)."""
    d = Path(tempfile.mkdtemp(prefix="memtest_"))
    _TMP_DIRS.append(d)
    tmp = d / "memory.db"
    shutil.copy(_REAL_DB, tmp)
    store.DB_PATH = tmp
    with store._session(write=True) as conn:
        conn.execute("DELETE FROM memories")  # triggers keep the FTS index in sync
    return tmp


def _suggest_active(item: MemoryInput) -> dict:
    """Helper: suggest one memory and immediately approve it -> active row."""
    cand = store.suggest_mem([item])[0]
    return store.review_mem([Decision(id=cand["id"], approve=True)])[0]


# --------------------------------------------------------------------------- #
# Tests — units
# --------------------------------------------------------------------------- #
def test_seed_loads_and_is_idempotent():
    _fresh_db()
    rows = seed_into_db()
    assert len(rows) == len(seed_memories())
    assert len(seed_into_db()) == len(rows)  # second run adds nothing


def test_suggest_is_candidate_and_hidden_from_search():
    _fresh_db()
    c = store.suggest_mem([MemoryInput(title="Widget", body="alpha bravo")])[0]
    assert c["status"] == "candidate"
    assert store.search_mem("alpha") == []  # candidates never surface in search


def test_approve_activates_and_makes_searchable():
    _fresh_db()
    a = _suggest_active(MemoryInput(title="Widget", body="alpha bravo charlie"))
    assert a["status"] == "active" and a["valid_from"]
    assert any(h["id"] == a["id"] for h in store.search_mem("alpha"))


def test_reject_sets_rejected_with_reason():
    _fresh_db()
    c = store.suggest_mem([MemoryInput(title="Junk", body="noise")])[0]
    r = store.review_mem([Decision(id=c["id"], approve=False, reason="not durable")])[0]
    assert r["status"] == "rejected" and r["reason"] == "not durable"


def test_supersede_swap_via_candidate_path():
    _fresh_db()
    old = _suggest_active(MemoryInput(title="Widget", body="gizmo version one"))
    cand = store.suggest_mem([MemoryInput(title="Widget", body="gizmo version two",
                                          supersedes=old["id"])])[0]
    new = store.review_mem([Decision(id=cand["id"], approve=True)])[0]
    assert new["status"] == "active" and new["supersedes"] == old["id"]
    assert store.get_mem([old["id"]]) == []          # old is superseded -> hidden
    assert any(h["id"] == new["id"] for h in store.search_mem("gizmo"))


def test_supersede_target_must_be_active():
    _fresh_db()
    cand = store.suggest_mem([MemoryInput(title="X", body="y", supersedes=999999)])[0]
    try:
        store.review_mem([Decision(id=cand["id"], approve=True)])
        assert False, "expected StoreError"
    except StoreError:
        pass


def test_update_changes_fields_and_rejects_unknown():
    _fresh_db()
    a = _suggest_active(MemoryInput(title="T", body="b"))
    u = store.update_mem(a["id"], {"body": "new", "tags": "x"})
    assert u["body"] == "new" and u["tags"] == "x"
    try:
        store.update_mem(a["id"], {"status": "active"})  # status not updatable
        assert False, "expected StoreError"
    except StoreError:
        pass


def test_update_missing_id_raises():
    _fresh_db()
    try:
        store.update_mem(999999, {"body": "x"})
        assert False, "expected StoreError"
    except StoreError:
        pass


def test_reads_hide_candidates_and_secrets():
    _fresh_db()
    cand = store.suggest_mem([MemoryInput(title="C", body="candidate body")])[0]
    assert store.get_mem([cand["id"]]) == []  # candidate -> not returned
    sec = _suggest_active(MemoryInput(title="S", body="topsecret", sensitivity="secret"))
    assert store.get_mem([sec["id"]]) == []   # active but secret -> hidden
    assert store.search_mem("topsecret") == []


def test_secret_visible_in_list_not_in_search():
    _fresh_db()
    sec = _suggest_active(MemoryInput(title="S", body="topsecret", sensitivity="secret"))
    listed = store.list_memories(MemoryFilter(choices={"sensitivity": ["secret"]}))
    assert any(m["id"] == sec["id"] for m in listed)  # web-UI / admin sees it
    assert store.search_mem("topsecret") == []        # model cannot


def test_list_filters_search_and_order():
    _fresh_db()
    seed_into_db()
    hw = store.list_memories(MemoryFilter(choices={"category": ["hardware"]}))
    assert hw and all(m["category"] == "hardware" for m in hw)
    assert any("Python" in m["body"] for m in store.list_memories(MemoryFilter(search="Python")))
    titles = [m["title"] for m in store.list_memories(MemoryFilter(order_by="title", descending=False))]
    assert titles == sorted(titles)                   # real ordering, not a constant


def test_get_one_returns_any_status_and_raises_on_missing():
    _fresh_db()
    cand = store.suggest_mem([MemoryInput(title="C", body="x", sensitivity="secret")])[0]
    got = store.get_one_mem(cand["id"])               # candidate + secret -> still returned
    assert got["id"] == cand["id"] and got["status"] == "candidate"
    try:
        store.get_one_mem(999999)
        assert False, "expected StoreError"
    except StoreError:
        pass


def test_commit_active_inserts_active_and_searchable():
    _fresh_db()
    row = store.commit_active(MemoryInput(title="Widget", body="alpha bravo", category="tools"))
    assert row["status"] == "active"
    assert any(h["id"] == row["id"] for h in store.search_mem("alpha"))


def test_distinct_values_and_facets():
    _fresh_db()
    seed_into_db()
    cats = store.distinct_values("category")
    assert "hardware" in cats and "tech_stack" in cats
    try:
        store.distinct_values("body")                 # not allow-listed
        assert False, "expected StoreError"
    except StoreError:
        pass
    f = store.facets()
    assert set(f) == {"status", "sensitivity", "category", "type", "source"}
    assert "secret" in f["sensitivity"]               # from the Literal, not the DB
    assert set(f["status"]) == {"candidate", "active", "superseded", "rejected"}
    assert "hardware" in f["category"]


def test_list_timestamp_filter_and_bad_operator():
    _fresh_db()
    seed_into_db()
    assert store.list_memories(MemoryFilter(timestamps={"created_at": ">=2000-01-01 00:00:00"}))
    assert store.list_memories(MemoryFilter(timestamps={"created_at": "<2000-01-01 00:00:00"})) == []
    try:
        store.list_memories(MemoryFilter(timestamps={"created_at": "~~bad"}))
        assert False, "expected StoreError"
    except StoreError:
        pass


def test_input_validation_sensitivity_and_confidence():
    MemoryInput(title="t", body="b", sensitivity="secret", confidence=0.5)  # valid
    for bad in (dict(sensitivity="Secret"), dict(confidence=5.0), dict(confidence=-0.1)):
        try:
            MemoryInput(title="t", body="b", **bad)
            assert False, f"expected ValidationError for {bad}"
        except ValidationError:
            pass


# --------------------------------------------------------------------------- #
# Test — full end-to-end flow
# --------------------------------------------------------------------------- #
def test_full_lifecycle_flow():
    """Walk the whole pipeline in one run: seed → suggest → approve → supersede
    → update → reject, then assert the final state."""
    _fresh_db()

    # 1. seed baseline
    active = seed_into_db()
    assert len(active) == len(seed_memories())

    # 2. suggest a candidate — hidden from search
    cand = store.suggest_mem([MemoryInput(title="Widget", body="gizmo one", category="tools")])[0]
    assert cand["status"] == "candidate"
    assert store.search_mem("gizmo") == []

    # 3. approve — now searchable
    live = store.review_mem([Decision(id=cand["id"], approve=True)])[0]
    assert live["status"] == "active"
    assert any(h["id"] == live["id"] for h in store.search_mem("gizmo"))

    # 4. supersede it via a new candidate
    repl = store.suggest_mem([MemoryInput(title="Widget", body="gizmo two",
                                          category="tools", supersedes=live["id"])])[0]
    new = store.review_mem([Decision(id=repl["id"], approve=True)])[0]
    assert store.get_mem([live["id"]]) == []                       # old superseded
    assert any(h["id"] == new["id"] for h in store.search_mem("gizmo"))

    # 5. update in place
    upd = store.update_mem(new["id"], {"tags": "demo"})
    assert upd["tags"] == "demo"

    # 6. suggest + reject
    junk = store.suggest_mem([MemoryInput(title="Junk", body="noise")])[0]
    assert store.review_mem([Decision(id=junk["id"], approve=False, reason="noise")])[0]["status"] == "rejected"

    # 7. final state: no open candidates; active = seeds + the one superseding row
    assert store.list_memories(MemoryFilter(choices={"status": ["candidate"]})) == []
    active_now = store.list_memories(MemoryFilter(choices={"status": ["active"]}, limit=500))
    assert len(active_now) == len(seed_memories()) + 1


# --------------------------------------------------------------------------- #
# Standalone runner (no pytest required)
# --------------------------------------------------------------------------- #
def _run_all() -> int:
    tests = sorted(n for n, v in globals().items() if n.startswith("test_") and callable(v))
    failed = 0
    for name in tests:
        try:
            globals()[name]()
            print(f"PASS  {name}")
        except Exception as e:
            failed += 1
            print(f"FAIL  {name}: {type(e).__name__}: {e}")
    for d in _TMP_DIRS:
        shutil.rmtree(d, ignore_errors=True)
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    return failed


if __name__ == "__main__":
    import sys

    sys.exit(1 if _run_all() else 0)
