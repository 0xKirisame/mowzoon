"""
Mowzoon - Character registry (battle layer).

A tiny SQLite-backed store so players can publish their battle character and
resolve a friend's by a short code — the data layer behind "challenge a friend",
ghost mode, and the leaderboard. Uses the stdlib `sqlite3` only (no new deps).

The client owns all the inputs to `rank_score` (live metrics, streak, quests,
battle record); the server just stores what it is given and orders by it.
Anti-cheat (recompute / clamp server-side) is future work.
"""

import os
import random
import sqlite3
import string
from datetime import datetime, timezone

DB_PATH = os.path.join("data", "characters.db")

# Crockford-ish base32 without ambiguous chars, for readable share codes.
_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def _now():
    return datetime.now(timezone.utc).isoformat()


def _conn():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with _conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS characters (
                code        TEXT PRIMARY KEY,
                name        TEXT,
                archetype   INTEGER,
                level       INTEGER,
                accent      TEXT,
                rank_score  REAL DEFAULT 0,
                wins        INTEGER DEFAULT 0,
                losses      INTEGER DEFAULT 0,
                created_at  TEXT,
                updated_at  TEXT
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_rank ON characters(rank_score DESC)")


def _row_to_card(row):
    if row is None:
        return None
    return {
        "code": row["code"],
        "name": row["name"],
        "archetype": row["archetype"],
        "level": row["level"],
        "accent": row["accent"],
        "rankScore": row["rank_score"],
        "wins": row["wins"],
        "losses": row["losses"],
    }


def _new_code(conn):
    for _ in range(20):
        code = "".join(random.choice(_CODE_ALPHABET) for _ in range(6))
        exists = conn.execute("SELECT 1 FROM characters WHERE code = ?", (code,)).fetchone()
        if not exists:
            return code
    raise RuntimeError("could not allocate a unique character code")


def upsert_character(name, archetype, level, accent=None, rank_score=0.0, code=None):
    """Insert a new card (fresh code) or update an existing one by code."""
    with _conn() as conn:
        now = _now()
        if code:
            existing = conn.execute("SELECT 1 FROM characters WHERE code = ?", (code,)).fetchone()
        else:
            existing = None

        if existing:
            conn.execute(
                """
                UPDATE characters
                   SET name = ?, archetype = ?, level = ?, accent = ?,
                       rank_score = ?, updated_at = ?
                 WHERE code = ?
                """,
                (name, archetype, level, accent, rank_score, now, code),
            )
        else:
            code = code or _new_code(conn)
            conn.execute(
                """
                INSERT INTO characters
                    (code, name, archetype, level, accent, rank_score, wins, losses, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
                """,
                (code, name, archetype, level, accent, rank_score, now, now),
            )
        row = conn.execute("SELECT * FROM characters WHERE code = ?", (code,)).fetchone()
        return _row_to_card(row)


def get_character(code):
    with _conn() as conn:
        row = conn.execute("SELECT * FROM characters WHERE code = ?", (code,)).fetchone()
        return _row_to_card(row)


def get_many(codes):
    if not codes:
        return []
    placeholders = ",".join("?" for _ in codes)
    with _conn() as conn:
        rows = conn.execute(
            f"SELECT * FROM characters WHERE code IN ({placeholders})", list(codes)
        ).fetchall()
        return [_row_to_card(r) for r in rows]


def list_top(n=20):
    with _conn() as conn:
        rows = conn.execute(
            "SELECT * FROM characters ORDER BY rank_score DESC, updated_at ASC LIMIT ?",
            (n,),
        ).fetchall()
    out = []
    for i, r in enumerate(rows):
        card = _row_to_card(r)
        card["rank"] = i + 1
        out.append(card)
    return out


def record_result(code, won):
    with _conn() as conn:
        col = "wins" if won else "losses"
        cur = conn.execute(
            f"UPDATE characters SET {col} = {col} + 1, updated_at = ? WHERE code = ?",
            (_now(), code),
        )
        if cur.rowcount == 0:
            return None
        row = conn.execute("SELECT * FROM characters WHERE code = ?", (code,)).fetchone()
        return _row_to_card(row)
