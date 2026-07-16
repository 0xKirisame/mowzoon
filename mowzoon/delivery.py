"""
Mowzoon - L4 delivery composition.

build_response composes the full POST /insights payload from the L1-L3 layers.
Deliberately imports nothing from the classifier chain (data_ingestor, features,
model): the archetype arrives in the request, so this path stays runnable and
testable without xgboost. api.py wires it to the route.

Design doc: mowzoon-analytic/delivery-design.md
"""

from datetime import date, datetime

import signals as signals_mod
from engine import PredictiveEngine, match_insights
from gamify import gamify

# One engine instance for the legacy-nudge fallback (its cache is per-process
# and harmless; nothing else in this module holds state).
_ENGINE = PredictiveEngine()


def _parse_day(value):
    if value is None:
        return date.today()
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    return datetime.strptime(str(value)[:10], "%Y-%m-%d").date()


def _landmark_line(sigs):
    """Planning-first fallback nudge built from the landmark signal."""
    for s in sigs:
        if s["name"] == "landmark":
            ev = s.get("evidence") or {}
            spike = ev.get("next_spike")
            fresh = ev.get("next_fresh_start")
            if spike and spike.get("days", 999) <= 60:
                return (f"Nothing needs your attention today. {spike['event']} is "
                        f"{spike['days']} days out; a small set-aside now stays ahead of it.")
            if fresh:
                return (f"Nothing needs your attention today. A new month starts in "
                        f"{fresh['days']} days; a good moment to set one small intention.")
    return "Nothing needs your attention today."


def _legacy_nudge(archetype_id, metrics, today):
    """The legacy metrics-based nudge, kept for signal-immature users (old voice, D7)."""
    spike = _ENGINE.forecast_seasonal_spikes(
        current_date=datetime(today.year, today.month, today.day), lookahead_days=365)
    return _ENGINE.generate_micro_nudge(
        archetype_id,
        {
            "spending_efficiency": round(metrics["efficiency"]),
            "proactive_resilience": round(metrics["resilience"]),
            "financial_eq": round(metrics["eq"]),
        },
        spike,
    )


def build_response(archetype_id, ledger, income, metrics=None, today=None):
    """Compose the POST /insights response. Pure given its inputs.

    income is MONTHLY net income (contract; see api-contract.md).
    metrics, when present, is {"efficiency": .., "resilience": .., "eq": ..}
    on the 0-100 scale (the survey scores), used only for the legacy fallback.
    """
    today = _parse_day(today)
    sigs, skipped_rows = signals_mod.compute_signals_with_skipped(ledger, income, today)
    skipped = len(skipped_rows)

    insights = match_insights(sigs, archetype_id)
    top = next((i for i in insights if i["kind"] == "risk"),
               insights[0] if insights else None)
    quest = gamify(top, archetype_id, sigs, today)

    if insights:
        nudge = insights[0]["text"]
    elif metrics is not None and archetype_id in (0, 1, 2, 3):
        nudge = _legacy_nudge(archetype_id, metrics, today)
    else:
        nudge = _landmark_line(sigs)

    return {
        "nudge": nudge,
        "signals": sigs,
        "insights": insights,
        "quest": quest,
        "meta": {
            "signals_computed": len(sigs),
            "insights_count": len(insights),
            "skipped_rows": skipped,
            "engine": "v1",
        },
    }
