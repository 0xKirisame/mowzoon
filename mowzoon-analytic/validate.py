"""
Validation run: archetype-conditioned engine vs a generic baseline.

Reproducible: python validate.py  (from mowzoon-analytic/)
Writes validation-run.json (raw log of every input and output) and prints the
metric summary consumed by validation-log.md.

Scope: this run validates DIFFERENTIATION, mechanism correctness, framing
guardrails and restraint - all computable. It cannot validate efficacy
("lands better"), which needs real users; the log says so.
"""

import json
import os
import re
import sys
from datetime import date, timedelta
from itertools import combinations

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "mowzoon"))

import config                      # noqa: E402
import templates                   # noqa: E402
from delivery import build_response  # noqa: E402
from signals import compute_signals_with_skipped  # noqa: E402

TODAY = date(2026, 7, 13)          # Monday
SPIKE_DAY = date(2026, 8, 12)      # Back to School 13 days out (spike window)


# ---------------------------------------------------------------------------
# scenarios (deterministic ledger builders)
# ---------------------------------------------------------------------------

def weekend_splurger():
    led = []
    d = TODAY - timedelta(days=84)
    while d <= TODAY:
        if d.day == 1:
            led.append({"type": "fixed", "amount": 5500, "date": d.isoformat()})
        if d.weekday() == 1:
            led.append({"type": "discretionary", "amount": 180, "date": d.isoformat()})
        if d.weekday() in (4, 5):
            led.append({"type": "discretionary", "amount": 320, "date": d.isoformat()})
        d += timedelta(days=1)
    led.append({"type": "savings", "amount": 8000, "date": (TODAY - timedelta(days=60)).isoformat()})
    led.append({"type": "discretionary", "amount": 1400, "date": (TODAY - timedelta(days=1)).isoformat()})
    return led


def oversaver():
    led = []
    d = TODAY - timedelta(days=84)
    while d <= TODAY:
        if d.day == 1:
            led.append({"type": "fixed", "amount": 3000, "date": d.isoformat()})
            led.append({"type": "savings", "amount": 4500, "date": d.isoformat()})
        if d.weekday() == 2:
            led.append({"type": "discretionary", "amount": 150, "date": d.isoformat()})
        d += timedelta(days=1)
    return led


def thin_buffer_hot():
    led = []
    d = TODAY - timedelta(days=84)
    while d <= TODAY:
        if d.day == 1:
            led.append({"type": "fixed", "amount": 4000, "date": d.isoformat()})
        if d.weekday() in (0, 2, 4):
            led.append({"type": "discretionary", "amount": 250, "date": d.isoformat()})
        d += timedelta(days=1)
    led.append({"type": "savings", "amount": 2000, "date": (TODAY - timedelta(days=80)).isoformat()})
    for k in (1, 2, 4):
        led.append({"type": "discretionary", "amount": 1800,
                    "date": (TODAY - timedelta(days=k)).isoformat()})
    return led


def tight_margins(anchor_day):
    led = []
    d = anchor_day - timedelta(days=84)
    while d <= anchor_day:
        if d.day == 1:
            led.append({"type": "fixed", "amount": 7600, "date": d.isoformat()})
        if d.weekday() in (0, 3):
            led.append({"type": "discretionary", "amount": 140, "date": d.isoformat()})
        d += timedelta(days=1)
    led.append({"type": "spike", "amount": 2800,
                "date": (anchor_day - timedelta(days=40)).isoformat()})
    return led


def brand_new():
    led = []
    d = TODAY - timedelta(days=10)
    while d <= TODAY:
        if d.weekday() in (0, 3):
            led.append({"type": "discretionary", "amount": 90, "date": d.isoformat()})
        d += timedelta(days=1)
    return led


def balanced():
    led = []
    d = TODAY - timedelta(days=84)
    while d <= TODAY:
        if d.day == 1:
            led.append({"type": "fixed", "amount": 4500, "date": d.isoformat()})
            led.append({"type": "savings", "amount": 1500, "date": d.isoformat()})
        if d.weekday() in (0, 1, 3):
            led.append({"type": "discretionary", "amount": 240, "date": d.isoformat()})
        d += timedelta(days=1)
    led.append({"type": "savings", "amount": 25000,
                "date": (TODAY - timedelta(days=70)).isoformat()})
    return led


SCENARIOS = [
    ("S1 weekend splurger", weekend_splurger(), 10000, None, TODAY),
    ("S2 frugal over-saver", oversaver(), 10000, None, TODAY),
    ("S3 thin buffer, hot week", thin_buffer_hot(), 10000, None, TODAY),
    ("S4a tight margins (neutral date)", tight_margins(TODAY), 9500, None, TODAY),
    ("S4b tight margins (spike 13d out)", tight_margins(SPIKE_DAY), 9500, None, SPIKE_DAY),
    ("S5 brand-new user (10 days)", brand_new(), 10000,
     {"efficiency": 40, "resilience": 55, "eq": 35}, TODAY),
    ("S6 balanced healthy user", balanced(), 10000, None, TODAY),
]


# ---------------------------------------------------------------------------
# generic baseline: archetype-blind, severity-ranked, textbook lines.
# Deliberately styled like mainstream PFM copy (including its negative
# framing) so the contrast is against the real competitor, not a strawman.
# ---------------------------------------------------------------------------

GENERIC_LINES = {
    "savings_rate": "Your savings rate is low. Try to save at least 20% of your income.",
    "runway": "Your emergency fund is below the recommended 3-6 months. Build it up.",
    "lifestyle_share": "Your discretionary spending is high. Cut back on non-essentials.",
    "momentum": "You are spending more than usual this week. Slow down.",
    "weekend_ratio": "Your weekend spending is high. Watch your weekend purchases.",
    "anomaly": "You made an unusually large purchase. Be careful with big buys.",
    "landmark": "A big expense period is coming up. Prepare for it.",
}
GENERIC_PRIORITY = ["savings_rate", "runway", "lifestyle_share", "momentum",
                    "weekend_ratio", "anomaly", "landmark"]
SEVERITY = {"high": 3, "elevated": 2, "note": 1, "calm": 0}


def generic_advice(sigs):
    ranked = sorted(
        (s for s in sigs if SEVERITY.get(s["band"], 0) > 0),
        key=lambda s: (-SEVERITY[s["band"]], GENERIC_PRIORITY.index(s["name"])),
    )
    if ranked:
        return GENERIC_LINES[ranked[0]["name"]]
    return "You're doing fine. Keep tracking your spending."


# ---------------------------------------------------------------------------
# metrics
# ---------------------------------------------------------------------------

STOP = {"the", "a", "an", "to", "is", "are", "your", "you", "of", "in", "and",
        "for", "on", "it", "that", "with", "this", "at", "now", "not", "one"}


def tokens(text):
    return {w for w in re.findall(r"[a-z']+", text.lower()) if w not in STOP}


def jaccard(a, b):
    ta, tb = tokens(a), tokens(b)
    return len(ta & tb) / len(ta | tb) if ta | tb else 0.0


BLAME_PHRASES = ["overspent", "over budget", "you failed", "stop spending",
                 "cut back", "be careful", "slow down", "irresponsible",
                 "bad with money", "warning", "guilt"]


def blame_hits(text):
    """Negation-aware: 'no guilt' / 'zero-guilt' / 'without guilt' is anti-blame
    framing, not blame (first run false-positived on the legacy line
    'The coffee is allowed, no guilt.')."""
    low = text.lower()
    hits = []
    for p in BLAME_PHRASES:
        for m in re.finditer(re.escape(p), low):
            prefix = low[max(0, m.start() - 10):m.start()]
            if any(neg in prefix for neg in ("no ", "zero-", "without ")):
                continue
            hits.append(p)
    return hits


# ---------------------------------------------------------------------------
# run
# ---------------------------------------------------------------------------

def main():
    log = {"date": str(TODAY), "criteria": {}, "scenarios": []}
    all_engine_texts = []

    for name, ledger, income, metrics, day in SCENARIOS:
        sigs, skipped = compute_signals_with_skipped(ledger, income, day)
        generic = generic_advice(sigs)
        entry = {
            "scenario": name, "income": income, "today": str(day),
            "ledger_rows": len(ledger), "skipped_rows": len(skipped),
            "signals": sigs, "generic_nudge": generic, "archetypes": {},
        }
        for aid in range(4):
            out = build_response(aid, ledger, income, metrics=metrics, today=day)
            entry["archetypes"][config.ARCHETYPES[aid]["name"]] = out
            all_engine_texts.append(out["nudge"])
            all_engine_texts += [i["text"] for i in out["insights"]]
            if out["quest"]:
                all_engine_texts.append(out["quest"]["rationale"])
        log["scenarios"].append(entry)

    # C1 differentiation on mature-risk scenarios (S1-S4b)
    c1 = {}
    for entry in log["scenarios"][:5]:
        tops = set()
        for aname, out in entry["archetypes"].items():
            if out["insights"]:
                tops.add((out["insights"][0]["kind"], out["insights"][0]["insight_key"]))
            else:
                tops.add(("none", "none"))
        c1[entry["scenario"]] = len(tops)
    log["criteria"]["C1_distinct_top_outputs"] = c1
    c1_pass = all(v >= 3 for v in c1.values())

    # C2 direction flip on S2: over-saving risk fires for archetype 1 only
    s2 = log["scenarios"][1]["archetypes"]
    risky = {a: [i["insight_key"] for i in out["insights"] if i["kind"] == "risk"]
             for a, out in s2.items()}
    c2_pass = (any("oversaving" in k or "deprivation" in k for k in risky["The Anxious Planner"])
               and all(not ks for a, ks in risky.items() if a != "The Anxious Planner"))
    log["criteria"]["C2_oversaver_risks_by_archetype"] = risky

    # C3 text overlap: archetype pairwise and vs generic, S1-S4b
    pair_j, gen_j = [], []
    for entry in log["scenarios"][:5]:
        nudges = [out["nudge"] for out in entry["archetypes"].values()]
        pair_j += [jaccard(x, y) for x, y in combinations(nudges, 2)]
        gen_j += [jaccard(n, entry["generic_nudge"]) for n in nudges]
    c3 = {"mean_pairwise_archetype": round(sum(pair_j) / len(pair_j), 3),
          "mean_vs_generic": round(sum(gen_j) / len(gen_j), 3)}
    log["criteria"]["C3_jaccard"] = c3
    c3_pass = c3["mean_pairwise_archetype"] < 0.30 and c3["mean_vs_generic"] < 0.20

    # C4 framing guardrail: engine texts and all 25 templates carry no blame phrasing
    template_hits = {k: blame_hits(v["text"]) for k, v in templates.TEMPLATES.items()
                     if blame_hits(v["text"])}
    emitted_hits = [t for t in all_engine_texts if blame_hits(t)]
    generic_hits = [e["generic_nudge"] for e in log["scenarios"]
                    if blame_hits(e["generic_nudge"])]
    log["criteria"]["C4_blame"] = {
        "template_hits": template_hits, "emitted_hits": emitted_hits,
        "generic_baseline_hits_count": len(generic_hits)}
    c4_pass = not template_hits and not emitted_hits

    # C5 restraint: engine sometimes issues nothing; generic always advises
    no_quest = sum(1 for e in log["scenarios"] for out in e["archetypes"].values()
                   if out["quest"] is None)
    no_insight = sum(1 for e in log["scenarios"] for out in e["archetypes"].values()
                     if not out["insights"])
    log["criteria"]["C5_restraint"] = {
        "runs": 4 * len(log["scenarios"]), "no_quest_runs": no_quest,
        "no_insight_runs": no_insight, "generic_advises_every_time": True}
    c5_pass = no_quest > 0 and no_insight > 0

    # C6 every run answers with a nudge
    c6_pass = all(out["nudge"] for e in log["scenarios"] for out in e["archetypes"].values())
    log["criteria"]["C6_nudge_always_present"] = c6_pass

    verdict = {"C1_differentiation": c1_pass, "C2_direction_flip": c2_pass,
               "C3_low_text_overlap": c3_pass, "C4_no_blame_framing": c4_pass,
               "C5_restraint_exists": c5_pass, "C6_always_answers": c6_pass}
    log["verdict"] = verdict

    out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "validation-run.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(log, f, indent=1)

    print(json.dumps({"criteria": log["criteria"], "verdict": verdict}, indent=1))
    print("\nraw log:", out_path)


if __name__ == "__main__":
    main()
