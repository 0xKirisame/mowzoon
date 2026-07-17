"""
Mowzoon - Arena service

Characters and battle results for the Arena's ghost battles. Handle-based
identity, no auth (hackathon scope; last write wins on a handle). SQLite on
disk - on Render's free tier the disk is ephemeral, so the table reseeds
with the demo roster after every redeploy, which is fine for a demo.

Battles are resolved client-side by the shared engine; this service only
stores character snapshots and results.
"""

import json
import os
import sqlite3
import threading
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

DB_PATH = os.path.join("data", "arena.db")

router = APIRouter(prefix="/arena")

_lock = threading.Lock()
os.makedirs("data", exist_ok=True)
_db = sqlite3.connect(DB_PATH, check_same_thread=False)
_db.row_factory = sqlite3.Row

_db.executescript(
    """
    CREATE TABLE IF NOT EXISTS characters (
      handle      TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      archetype   INTEGER NOT NULL,
      efficiency  REAL NOT NULL,
      resilience  REAL NOT NULL,
      eq          REAL NOT NULL,
      level       INTEGER NOT NULL DEFAULT 1,
      loadout     TEXT NOT NULL DEFAULT '{}',
      accent      TEXT,
      avatar_kind TEXT,
      bot         INTEGER NOT NULL DEFAULT 0,
      wins        INTEGER NOT NULL DEFAULT 0,
      losses      INTEGER NOT NULL DEFAULT 0,
      rank_score  INTEGER NOT NULL DEFAULT 0,
      updated_at  TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS battles (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      challenger        TEXT NOT NULL,
      defender          TEXT NOT NULL,
      winner            TEXT NOT NULL,
      rounds            INTEGER NOT NULL,
      challenger_hp_left INTEGER NOT NULL DEFAULT 0,
      defender_hp_left   INTEGER NOT NULL DEFAULT 0,
      created_at        TEXT NOT NULL,
      seen              INTEGER NOT NULL DEFAULT 0
    );
    """
)

# same six demo characters as the UI's offline roster (arena/bots.js), so
# the arena reads the same whether or not the API is reachable. Seed rank
# scores keep the global ladder alive on a fresh (or redeployed) database.
SEED = [
    ("noura", "Noura", 0, 82, 28, 45, 3, 74, {"effects": ["compound"], "ability": "splurge"}),
    ("salem", "Salem", 3, 40, 90, 55, 4, 121, {"effects": ["cashback", "compound"], "ability": "rationing"}),
    ("rakan", "Rakan", 2, 60, 45, 88, 5, 158, {"effects": ["highyield", "compound"], "ability": "allin"}),
    ("layla", "Layla", 1, 55, 70, 62, 3, 63, {"effects": ["cashback"], "ability": "contingency"}),
    ("dana", "Dana", 1, 68, 50, 75, 4, 97, {"effects": ["highyield", "cashback"], "ability": "overplan"}),
    ("faisal", "Faisal", 3, 50, 60, 50, 2, 28, {"effects": ["cashback"], "ability": "reserve"}),
]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


with _lock:
    # dev databases created before the ladder landed lack the column;
    # backfill the demo bots' ranks so the ladder isn't a wall of zeros
    cols = {r[1] for r in _db.execute("PRAGMA table_info(characters)").fetchall()}
    if "rank_score" not in cols:
        _db.execute("ALTER TABLE characters ADD COLUMN rank_score INTEGER NOT NULL DEFAULT 0")
        _db.executemany(
            "UPDATE characters SET rank_score = ? WHERE handle = ? AND bot = 1",
            [(rs, h) for h, _n, _a, _e, _r, _q, _lv, rs, _lo in SEED],
        )
        _db.commit()
    if _db.execute("SELECT COUNT(*) FROM characters").fetchone()[0] == 0:
        _db.executemany(
            "INSERT INTO characters (handle, name, archetype, efficiency, resilience, eq,"
            " level, rank_score, loadout, bot, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)",
            [(h, n, a, e, r, q, lv, rs, json.dumps(lo), _now()) for h, n, a, e, r, q, lv, rs, lo in SEED],
        )
        _db.commit()


def _character(row: sqlite3.Row) -> dict:
    return {
        "handle": row["handle"],
        "name": row["name"],
        "archetype": row["archetype"],
        "metrics": {
            "efficiency": row["efficiency"],
            "resilience": row["resilience"],
            "eq": row["eq"],
        },
        "level": row["level"],
        "loadout": json.loads(row["loadout"] or "{}"),
        "accent": row["accent"],
        "avatarKind": row["avatar_kind"],
        "bot": bool(row["bot"]),
        "wins": row["wins"],
        "losses": row["losses"],
        "rankScore": row["rank_score"],
        "updatedAt": row["updated_at"],
    }


class Loadout(BaseModel):
    effects: list[str] = Field(default_factory=list, max_length=2)
    ability: Optional[str] = None


class CharacterMetrics(BaseModel):
    efficiency: float = Field(ge=0, le=100)
    resilience: float = Field(ge=0, le=100)
    eq: float = Field(ge=0, le=100)


class Character(BaseModel):
    handle: str = Field(min_length=1, max_length=24, pattern=r"^[a-zA-Z0-9_.-]+$")
    name: str = Field(min_length=1, max_length=32)
    archetype: int = Field(ge=0, le=3)
    metrics: CharacterMetrics
    level: int = Field(ge=1, le=5)
    loadout: Loadout = Field(default_factory=Loadout)
    accent: Optional[str] = Field(default=None, max_length=9)
    avatarKind: Optional[str] = Field(default=None, max_length=12)
    # client-computed (see arena/rank.js); the server stores and orders only
    rankScore: int = Field(default=0, ge=0, le=1_000_000)


class BattleResult(BaseModel):
    challenger: str = Field(min_length=1, max_length=24)
    defender: str = Field(min_length=1, max_length=24)
    winner: str = Field(min_length=1, max_length=24)
    rounds: int = Field(ge=1, le=200)
    challengerHpLeft: int = Field(ge=0, default=0)
    defenderHpLeft: int = Field(ge=0, default=0)


@router.post("/register")
def register(character: Character):
    """Upsert a character snapshot. Called whenever the Arena tab opens."""
    with _lock:
        _db.execute(
            """
            INSERT INTO characters (handle, name, archetype, efficiency, resilience, eq,
                                    level, loadout, accent, avatar_kind, rank_score, bot, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
            ON CONFLICT(handle) DO UPDATE SET
              name=excluded.name, archetype=excluded.archetype,
              efficiency=excluded.efficiency, resilience=excluded.resilience,
              eq=excluded.eq, level=excluded.level, loadout=excluded.loadout,
              accent=excluded.accent, avatar_kind=excluded.avatar_kind,
              rank_score=excluded.rank_score, bot=0,
              updated_at=excluded.updated_at
            """,
            (
                character.handle.lower(), character.name, character.archetype,
                character.metrics.efficiency, character.metrics.resilience,
                character.metrics.eq, character.level,
                json.dumps(character.loadout.model_dump()),
                character.accent, character.avatarKind, character.rankScore, _now(),
            ),
        )
        _db.commit()
        row = _db.execute(
            "SELECT * FROM characters WHERE handle = ?", (character.handle.lower(),)
        ).fetchone()
    return _character(row)


@router.get("/roster")
def roster(exclude: str = "", limit: int = 20):
    """Latest characters, freshest first, optionally excluding the caller."""
    with _lock:
        rows = _db.execute(
            "SELECT * FROM characters WHERE handle != ? ORDER BY bot ASC, updated_at DESC LIMIT ?",
            (exclude.lower(), max(1, min(limit, 50))),
        ).fetchall()
    return {"characters": [_character(r) for r in rows]}


@router.get("/leaderboard")
def leaderboard(top: int = 20):
    """Global ladder, best rank first. Ties break on freshness."""
    with _lock:
        rows = _db.execute(
            "SELECT * FROM characters ORDER BY rank_score DESC, updated_at DESC LIMIT ?",
            (max(1, min(top, 100)),),
        ).fetchall()
    return {
        "leaderboard": [
            {
                "rank": i + 1,
                "handle": r["handle"],
                "name": r["name"],
                "archetype": r["archetype"],
                "level": r["level"],
                "rankScore": r["rank_score"],
                "bot": bool(r["bot"]),
            }
            for i, r in enumerate(rows)
        ]
    }


@router.get("/character/{handle}")
def character(handle: str):
    with _lock:
        row = _db.execute(
            "SELECT * FROM characters WHERE handle = ?", (handle.lower(),)
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="No such character")
    return _character(row)


@router.post("/battle")
def record_battle(result: BattleResult):
    """Store a finished ghost battle and bump both records."""
    if result.winner not in (result.challenger, result.defender):
        raise HTTPException(status_code=422, detail="Winner must be a participant")
    loser = result.defender if result.winner == result.challenger else result.challenger
    with _lock:
        cur = _db.execute(
            """
            INSERT INTO battles (challenger, defender, winner, rounds,
                                 challenger_hp_left, defender_hp_left, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                result.challenger.lower(), result.defender.lower(), result.winner.lower(),
                result.rounds, result.challengerHpLeft, result.defenderHpLeft, _now(),
            ),
        )
        _db.execute("UPDATE characters SET wins = wins + 1 WHERE handle = ?", (result.winner.lower(),))
        _db.execute("UPDATE characters SET losses = losses + 1 WHERE handle = ?", (loser.lower(),))
        _db.commit()
    return {"ok": True, "id": cur.lastrowid}


@router.get("/inbox/{handle}")
def inbox(handle: str, markSeen: int = 0):
    """Battles involving a handle, newest first. Unseen = challenges you
    didn't initiate and haven't looked at yet (revenge fuel)."""
    h = handle.lower()
    with _lock:
        rows = _db.execute(
            "SELECT * FROM battles WHERE challenger = ? OR defender = ?"
            " ORDER BY id DESC LIMIT 20",
            (h, h),
        ).fetchall()
        if markSeen:
            _db.execute("UPDATE battles SET seen = 1 WHERE defender = ?", (h,))
            _db.commit()
    return {
        "battles": [
            {
                "id": r["id"],
                "challenger": r["challenger"],
                "defender": r["defender"],
                "winner": r["winner"],
                "rounds": r["rounds"],
                "unseen": bool(not r["seen"] and r["defender"] == h),
                "createdAt": r["created_at"],
            }
            for r in rows
        ]
    }
