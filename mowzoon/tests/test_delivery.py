"""Tests for the L4 delivery composition. Run: python test_delivery.py

api.py route wiring is not importable here (xgboost not installed locally);
it is compile-checked instead. Everything the route delegates to is tested.
"""


import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import unittest
from datetime import date, timedelta

from delivery import build_response

TODAY = date(2026, 7, 13)


def rich_ledger():
    """84 days: rent, weekday + heavy Fri/Sat discretionary, one splurge, savings pot."""
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
    led.append({"type": "savings", "amount": 8000,
                "date": (TODAY - timedelta(days=60)).isoformat()})
    led.append({"type": "discretionary", "amount": 1400,
                "date": (TODAY - timedelta(days=1)).isoformat()})
    return led


METRICS = {"efficiency": 30.0, "resilience": 45.0, "eq": 35.0}


class TestResponseShape(unittest.TestCase):
    def test_full_response_for_mature_user(self):
        out = build_response(0, rich_ledger(), 10000, today=TODAY)
        self.assertEqual(
            set(out), {"nudge", "signals", "insights", "quest", "meta"})
        self.assertEqual(out["meta"]["signals_computed"], len(out["signals"]))
        self.assertEqual(out["meta"]["insights_count"], len(out["insights"]))
        self.assertEqual(out["meta"]["skipped_rows"], 0)
        self.assertEqual(out["meta"]["engine"], "v1")
        self.assertTrue(out["insights"])            # weekend-heavy user has risks
        self.assertIsNotNone(out["quest"])
        self.assertEqual(out["nudge"], out["insights"][0]["text"])

    def test_json_serializable(self):
        import json
        out = build_response(3, rich_ledger(), 10000, today=TODAY)
        json.dumps(out)  # must not raise

    def test_deterministic(self):
        a = build_response(2, rich_ledger(), 10000, today=TODAY)
        b = build_response(2, rich_ledger(), 10000, today=TODAY)
        self.assertEqual(a, b)


class TestNudgeFallbackChain(unittest.TestCase):
    def test_top_insight_wins_when_insights_exist(self):
        out = build_response(0, rich_ledger(), 10000, today=TODAY)
        self.assertEqual(out["nudge"], out["insights"][0]["text"])

    def test_legacy_nudge_for_immature_user_with_metrics(self):
        out = build_response(0, [], 10000, metrics=METRICS, today=TODAY)
        self.assertEqual(out["insights"], [])
        # legacy Impulse Spender line for eq < 40 mentions Financial EQ
        self.assertIn("Financial EQ", out["nudge"])

    def test_landmark_line_without_metrics(self):
        out = build_response(0, [], 10000, today=TODAY)
        self.assertEqual(out["insights"], [])
        self.assertTrue(out["nudge"].startswith("Nothing needs your attention today."))

    def test_unknown_archetype_still_answers(self):
        out = build_response(42, rich_ledger(), 10000, metrics=METRICS, today=TODAY)
        self.assertEqual(out["insights"], [])
        self.assertIsNone(out["quest"])
        self.assertTrue(out["nudge"])  # falls through to the landmark line


class TestRestraintPath(unittest.TestCase):
    def test_praise_only_user_gets_no_quest_on_neutral_day(self):
        # Genuinely balanced ledger: savings rate ~0.19 (inside no-risk range for
        # the Anxious Planner, whose risk is over-saving), lifestyle ~0.36 (above
        # the 0.15 deprivation floor). Praise fires, no risks. Monday, no fresh
        # start within 3 days. (First draft of this fixture saved 40% of income
        # and the engine correctly flagged it as anxious_oversaving.)
        led = []
        d = TODAY - timedelta(days=84)
        while d <= TODAY:
            if d.day == 1:
                led.append({"type": "fixed", "amount": 4500, "date": d.isoformat()})
            if d.weekday() in (0, 2, 5):
                led.append({"type": "discretionary", "amount": 280, "date": d.isoformat()})
            d += timedelta(days=1)
        out = build_response(1, led, 10000, today=TODAY)
        kinds = [i["kind"] for i in out["insights"]]
        self.assertNotIn("risk", kinds)
        self.assertIsNone(out["quest"])


class TestDirtyRows(unittest.TestCase):
    def test_skipped_rows_surface_in_meta(self):
        led = rich_ledger() + [
            {"type": "unknown", "amount": 10, "date": "2026-07-01"},
            {"type": "fixed", "amount": -5, "date": "2026-07-02"},
        ]
        out = build_response(0, led, 10000, today=TODAY)
        self.assertEqual(out["meta"]["skipped_rows"], 2)


if __name__ == "__main__":
    unittest.main(verbosity=2)
