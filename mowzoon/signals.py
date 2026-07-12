"""
Mowzoon - L1 Rational Signal Layer (Phase 1).

Pure, stateless, archetype-blind. Computes the 7 locked signals from the app's
ledger schema and grades each against thresholds derived in Phase 0
(mowzoon-analytic/berka-profiling.md) blended with normative anchors (CFPB
3-6 month buffer, 20% savings norm, calendar-neutral 2/7 weekend share).

    compute_signals(ledger, income, today) -> list[dict]

Ledger rows: {"type": "fixed"|"discretionary"|"savings"|"spike",
              "amount": float > 0, "date": "YYYY-MM-DD"}
Signals mature progressively: a signal whose maturity gate is not met is
ABSENT from the result (never faked, never null-banded).

Design doc: mowzoon-analytic/phase1-signals-design.md
"""

from datetime import date, datetime, timedelta

import config

# ---------------------------------------------------------------------------
# Phase-0 calibration constants (traceable to berka-profiling.md §2-3).
# Re-derive by re-running the Phase-0 script on new data; code stays unchanged.
# ---------------------------------------------------------------------------

# Saudi weekend (Fri, Sat) with Monday=0 indexing. Calibration used a 2/7
# calendar share, which is day-set independent.
WEEKEND_DAYS = (4, 5)
WEEKEND_EXPECTED_SHARE = 2 / 7

# Severity bands, ordered worst-first: (band, predicate-range).
# Each entry: value in [lo, hi) -> band.  +/-inf via None.
BANDS = {
    # healthy is HIGH for savings_rate / runway; healthy is LOW for the rest
    "savings_rate": [
        ("high", None, 0.04),
        ("elevated", 0.04, 0.11),
        ("note", 0.11, 0.20),
        ("calm", 0.20, None),
    ],
    "runway": [
        ("high", None, 1.8),
        ("elevated", 1.8, 3.0),
        ("note", 3.0, 6.0),
        ("calm", 6.0, None),
    ],
    "lifestyle_share": [
        ("calm", None, 0.38),
        ("note", 0.38, 0.63),
        ("elevated", 0.63, 0.80),
        ("high", 0.80, None),
    ],
    "weekend_ratio": [
        ("calm", None, 1.11),
        ("note", 1.11, 1.25),
        ("elevated", 1.25, 1.50),
        ("high", 1.50, None),
    ],
    "momentum": [
        ("calm", None, 1.5),
        ("note", 1.5, 2.5),
        ("elevated", 2.5, 5.0),
        ("high", 5.0, None),
    ],
    "landmark": [
        ("elevated", None, 15),
        ("note", 15, 31),
        ("calm", 31, None),
    ],
}

# Anchor zones: the "healthy" interval per signal -> direction field.
ANCHOR_ZONES = {
    "savings_rate": (0.20, 0.34),   # 20% norm .. P90
    "runway": (3.0, 6.0),           # CFPB band
    "lifestyle_share": (0.0, 0.38), # population calm quartile
    "weekend_ratio": (0.87, 1.11),  # population IQR band
    "momentum": (0.0, 1.5),
}

ANCHOR_LABELS = {
    "savings_rate": "20% savings norm (50/30/20; ~P70 of reference population)",
    "runway": "CFPB 3-6 month emergency buffer",
    "lifestyle_share": "reference-population quartiles (50/30/20 not directly applicable)",
    "weekend_ratio": "calendar-neutral weekend share (2/7)",
    "momentum": "own typical nonzero week (=1.0)",
    "anomaly": "own spending history (Tukey fences: Q3+1.5*IQR, 3*IQR extreme)",
    "landmark": "seasonal-spike & fresh-start calendar",
}

# Phase-0 percentile grids (P10, P25, P50, P75, P90) for percentile_context.
PERCENTILE_GRID = {
    "savings_rate": (-0.029, 0.042, 0.112, 0.248, 0.344),
    "lifestyle_share": (0.15, 0.377, 0.63, 0.804, 0.936),
    "runway": (1.344, 1.837, 2.822, 5.486, 8.278),
    "weekend_ratio": (0.739, 0.868, 0.989, 1.114, 1.271),
    "momentum": (0.004, 0.036, 1.0, 2.472, 5.132),
}
_GRID_PCTS = (10, 25, 50, 75, 90)

# Maturity gates (see design doc §3).
MIN_SPAN_DAYS_SHARES = 14      # savings_rate, lifestyle_share
MIN_SPAN_DAYS_RUNWAY = 56
MIN_DISC_TX_WEEKEND = 8
MIN_NONZERO_WEEKS_MOMENTUM = 4
MIN_DISC_TX_ANOMALY = 20

# Diagnostic: rows ignored by the last compute_signals call (never raises).
last_skipped_rows = []


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _parse_day(value):
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    return datetime.strptime(str(value)[:10], "%Y-%m-%d").date()


def _clean(ledger):
    """Validate rows; return (rows, skipped). Row: (day, type, amount)."""
    rows, skipped = [], []
    valid_types = {"fixed", "discretionary", "savings", "spike"}
    for r in ledger or []:
        try:
            t = r["type"]
            amt = float(r["amount"])
            day = _parse_day(r["date"])
            if t not in valid_types or amt <= 0:
                raise ValueError(f"type={t!r} amount={amt!r}")
            rows.append((day, t, amt))
        except Exception as exc:  # dirty row: count, never use, never raise
            skipped.append({"row": r, "reason": str(exc)})
    rows.sort(key=lambda x: x[0])
    return rows, skipped


def _band(name, value):
    for band, lo, hi in BANDS[name]:
        if (lo is None or value >= lo) and (hi is None or value < hi):
            return band
    return "calm"


def _direction(name, value):
    zone = ANCHOR_ZONES.get(name)
    if zone is None:
        return "at_anchor"
    lo, hi = zone
    if value < lo:
        return "below_anchor"
    if value > hi:
        return "above_anchor"
    return "at_anchor"


def _percentile_context(name, value):
    grid = PERCENTILE_GRID.get(name)
    if grid is None:
        return None
    if value <= grid[0]:
        return "<=P10 of reference population"
    if value >= grid[-1]:
        return ">=P90 of reference population"
    for i in range(len(grid) - 1):
        lo, hi = grid[i], grid[i + 1]
        if lo <= value < hi:
            p_lo, p_hi = _GRID_PCTS[i], _GRID_PCTS[i + 1]
            frac = (value - lo) / (hi - lo) if hi > lo else 0.0
            return f"~P{round(p_lo + frac * (p_hi - p_lo))} of reference population"
    return None


def _signal(name, value, unit, extra_evidence=None, band=None):
    evidence = {"anchor": ANCHOR_LABELS[name]}
    pc = _percentile_context(name, value)
    if pc:
        evidence["percentile_context"] = pc
    if extra_evidence:
        evidence.update(extra_evidence)
    return {
        "name": name,
        "value": round(float(value), 3),
        "unit": unit,
        "band": band if band is not None else _band(name, value),
        "direction": _direction(name, value),
        "evidence": evidence,
    }


def _sum(rows, types, since=None, until=None, days=None):
    total = 0.0
    for day, t, amt in rows:
        if t not in types:
            continue
        if since and day < since:
            continue
        if until and day > until:
            continue
        if days is not None and day.weekday() not in days:
            continue
        total += amt
    return total


# ---------------------------------------------------------------------------
# the seven signals
# ---------------------------------------------------------------------------

def _savings_rate(rows, income, today, span_days):
    if income <= 0 or span_days < MIN_SPAN_DAYS_SHARES:
        return None
    spend = _sum(rows, {"fixed", "discretionary", "spike"}, since=today - timedelta(days=30), until=today)
    return _signal("savings_rate", (income - spend) / income, "fraction_of_income",
                   {"window": "trailing 30d spend vs monthly income"})


def _runway(rows, today, span_days):
    if span_days < MIN_SPAN_DAYS_RUNWAY:
        return None
    window = min(span_days, 90)
    spend = _sum(rows, {"fixed", "discretionary", "spike"}, since=today - timedelta(days=window), until=today)
    monthly_spend = spend * 30.0 / window
    if monthly_spend <= 0:
        return None
    pot = _sum(rows, {"savings"})
    return _signal("runway", pot / monthly_spend, "months",
                   {"window": f"savings pot vs avg monthly spend (last {window}d, incl. spikes)",
                    "note": "pot = in-app savings only; buffer held elsewhere not visible"})


def _lifestyle_share(rows, income, today, span_days):
    if income <= 0 or span_days < MIN_SPAN_DAYS_SHARES:
        return None
    disc = _sum(rows, {"discretionary"}, since=today - timedelta(days=30), until=today)
    return _signal("lifestyle_share", disc / income, "fraction_of_income",
                   {"window": "trailing 30d discretionary vs monthly income"})


def _weekend_ratio(rows, today, span_days):
    since = today - timedelta(days=56)
    disc_rows = [(d, t, a) for d, t, a in rows if t == "discretionary" and since <= d <= today]
    if span_days < MIN_SPAN_DAYS_SHARES or len(disc_rows) < MIN_DISC_TX_WEEKEND:
        return None
    total = sum(a for _, _, a in disc_rows)
    weekend = sum(a for d, _, a in disc_rows if d.weekday() in WEEKEND_DAYS)
    if total <= 0:
        return None
    return _signal("weekend_ratio", (weekend / total) / WEEKEND_EXPECTED_SHARE, "ratio",
                   {"window": "trailing 56d", "weekend_days": "Fri-Sat"})


def _momentum(rows, today):
    week_sums = []
    for k in range(1, 13):  # prior weeks, most recent first
        hi = today - timedelta(days=7 * k)
        lo = hi - timedelta(days=6)
        week_sums.append(_sum(rows, {"discretionary"}, since=lo, until=hi))
    nonzero = sorted(s for s in week_sums if s > 0)
    if len(nonzero) < MIN_NONZERO_WEEKS_MOMENTUM:
        return None
    mid = len(nonzero) // 2
    baseline = nonzero[mid] if len(nonzero) % 2 else (nonzero[mid - 1] + nonzero[mid]) / 2
    this_week = _sum(rows, {"discretionary"}, since=today - timedelta(days=6), until=today)
    return _signal("momentum", this_week / baseline, "ratio_to_typical_week",
                   {"window": "last 7d vs median of own nonzero weeks (prior 12w)",
                    "baseline_week": round(baseline, 2)})


def _anomaly(rows, today):
    amounts = sorted(a for _, t, a in rows if t == "discretionary")
    if len(amounts) < MIN_DISC_TX_ANOMALY:
        return None

    def pct(p):
        i = (len(amounts) - 1) * p
        lo, hi = int(i), min(int(i) + 1, len(amounts) - 1)
        return amounts[lo] + (amounts[hi] - amounts[lo]) * (i - int(i))

    q1, q3 = pct(0.25), pct(0.75)
    iqr = q3 - q1
    fence, extreme = q3 + 1.5 * iqr, q3 + 3.0 * iqr
    recent = [(d, a) for d, t, a in rows
              if t == "discretionary" and today - timedelta(days=6) <= d <= today]
    flagged = [a for _, a in recent if a > fence]
    n_extreme = sum(1 for a in flagged if a > extreme)
    band = "high" if n_extreme else ("elevated" if flagged else "calm")
    return {
        "name": "anomaly",
        "value": len(flagged),
        "unit": "flagged_tx_last_7d",
        "band": band,
        "direction": "above_anchor" if flagged else "at_anchor",
        "evidence": {"anchor": ANCHOR_LABELS["anomaly"],
                     "fence": round(fence, 2), "extreme_fence": round(extreme, 2),
                     "history_n": len(amounts)},
    }


def _landmark(today):
    events = []
    for spike in config.SEASONAL_SPIKES:
        for year in (today.year, today.year + 1):
            try:
                d = date(year, spike["month"], spike["day"])
            except ValueError:
                d = date(year, spike["month"], spike["day"] - 1)
            if d >= today:
                events.append({"event": spike["name"], "kind": "spike", "days": (d - today).days})
                break
    nm_year, nm_month = (today.year + 1, 1) if today.month == 12 else (today.year, today.month + 1)
    events.append({"event": "New month", "kind": "fresh_start",
                   "days": (date(nm_year, nm_month, 1) - today).days})
    events.sort(key=lambda e: e["days"])
    nearest = events[0]
    nearest_spike = next((e for e in events if e["kind"] == "spike"), None)
    nearest_fresh = next((e for e in events if e["kind"] == "fresh_start"), None)
    return {
        "name": "landmark",
        "value": nearest["days"],
        "unit": "days_to_event",
        "band": _band("landmark", nearest["days"]),
        "direction": "at_anchor",
        "evidence": {"anchor": ANCHOR_LABELS["landmark"],
                     "nearest": nearest,
                     "next_spike": nearest_spike,
                     "next_fresh_start": nearest_fresh},
    }


# ---------------------------------------------------------------------------
# public API
# ---------------------------------------------------------------------------

def compute_signals(ledger, income, today):
    """Compute all mature L1 signals. Pure; immature signals are absent."""
    global last_skipped_rows
    rows, last_skipped_rows = _clean(ledger)
    today = _parse_day(today)
    span_days = (today - rows[0][0]).days if rows else 0

    candidates = [
        _savings_rate(rows, income, today, span_days),
        _runway(rows, today, span_days),
        _lifestyle_share(rows, income, today, span_days),
        _weekend_ratio(rows, today, span_days),
        _momentum(rows, today),
        _anomaly(rows, today),
        _landmark(today),
    ]
    return [s for s in candidates if s is not None]
