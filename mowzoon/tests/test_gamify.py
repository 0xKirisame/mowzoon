"""Tests for the L3 gamification brains. Run: python test_gamify.py"""


import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import unittest
from datetime import date

import config
from gamify import gamify, classify_moment, QUEST_SHAPES, INTERVENTION_QUEST

MONDAY = date(2026, 7, 13)      # weekday 0
FRIDAY = date(2026, 7, 17)      # weekday 4 (Saudi weekend)
MONTH_END = date(2026, 7, 30)   # new month in 2 days


def landmark(spike_days=None, spike_event="Eid al-Adha", fresh_days=10):
    ev = {"next_fresh_start": {"event": "New month", "kind": "fresh_start",
                               "days": fresh_days}}
    if spike_days is not None:
        ev["next_spike"] = {"event": spike_event, "kind": "spike", "days": spike_days}
    return {"name": "landmark", "value": fresh_days, "unit": "days_to_event",
            "band": "note", "direction": "at_anchor", "evidence": ev}


def risk(insight_key, intervention_key, text="First sentence here. Second sentence."):
    iv = None
    if intervention_key:
        iv = {"key": intervention_key,
              "label": config.INTERVENTIONS[intervention_key]["label"]}
    return {"insight_key": insight_key, "kind": "risk", "score": 6.0,
            "signal": {}, "mechanism": "m", "tone": "t",
            "intervention": iv, "text": text}


def praise(insight_key="impulse_quiet_week_praise"):
    return {"insight_key": insight_key, "kind": "praise", "score": 0.0,
            "signal": {}, "mechanism": "m", "tone": "t",
            "intervention": None, "text": "Nice and steady."}


class TestMomentClassification(unittest.TestCase):
    def test_weekend_is_vulnerability_for_impulse_only(self):
        m, ctx = classify_moment(0, [landmark()], FRIDAY)
        self.assertEqual((m, ctx["context"]), ("vulnerability", "weekend"))
        m, _ = classify_moment(2, [landmark()], FRIDAY)
        self.assertEqual(m, "neutral")

    def test_spike_window_is_vulnerability_for_survivalist(self):
        m, ctx = classify_moment(3, [landmark(spike_days=9)], MONDAY)
        self.assertEqual((m, ctx["context"]), ("vulnerability", "spike"))
        m, _ = classify_moment(3, [landmark(spike_days=25)], MONDAY)
        self.assertEqual(m, "neutral")

    def test_fresh_start_within_3_days_is_opportunity(self):
        m, ctx = classify_moment(1, [landmark(fresh_days=2)], MONTH_END)
        self.assertEqual((m, ctx["context"]), ("opportunity", "fresh_start"))

    def test_vulnerability_outranks_opportunity(self):
        # Impulse Spender on a Friday with a fresh start 1 day away.
        m, ctx = classify_moment(0, [landmark(fresh_days=1)], FRIDAY)
        self.assertEqual(m, "vulnerability")

    def test_no_landmark_signal_is_neutral(self):
        m, _ = classify_moment(0, [], MONDAY)
        self.assertEqual(m, "neutral")


class TestQuestSelection(unittest.TestCase):
    def test_cooling_off_gives_mindful(self):
        q = gamify(risk("impulse_hot_week", "cooling_off"), 0, [landmark()], MONDAY)
        self.assertEqual((q["key"], q["kind"], q["target"]), ("mindful", "days", 4))
        self.assertEqual(q["rationale"], "First sentence here.")
        self.assertEqual(q["insight_key"], "impulse_hot_week")

    def test_permission_reframe_gives_treat(self):
        q = gamify(risk("anxious_oversaving", "permission_reframe"), 1, [landmark()], MONDAY)
        self.assertEqual((q["key"], q["kind"], q["target"], q["tx_type"]),
                         ("treat", "count", 1, "discretionary"))

    def test_liquidity_first_gives_buffer(self):
        q = gamify(risk("blind_thin_runway", "liquidity_first"), 2, [landmark()], MONDAY)
        self.assertEqual((q["key"], q["tx_type"]), ("buffer", "savings"))

    def test_smart_family_falls_back_to_archetype_default(self):
        q = gamify(risk("impulse_savings_slip", "precommitment_smart"), 0, [landmark()], MONDAY)
        self.assertEqual(q["key"], "mindful")

    def test_spike_quest_names_the_event(self):
        q = gamify(risk("survivalist_spike_ahead", "sinking_fund"), 3,
                   [landmark(spike_days=10)], MONDAY)
        self.assertEqual(q["key"], "setaside")
        self.assertEqual(q["moment"], "vulnerability")
        self.assertIn("Eid al-Adha", q["rationale"])
        self.assertIn("10 days", q["rationale"])


class TestRestraint(unittest.TestCase):
    def test_praise_only_on_neutral_day_yields_none(self):
        self.assertIsNone(gamify(praise(), 0, [landmark()], MONDAY))

    def test_nothing_at_all_yields_none(self):
        self.assertIsNone(gamify(None, 2, [landmark()], MONDAY))
        self.assertIsNone(gamify(None, 99, [], MONDAY))

    def test_fresh_start_turns_praise_only_into_commit_quest(self):
        q = gamify(praise(), 3, [landmark(fresh_days=2)], MONTH_END)
        self.assertEqual((q["key"], q["moment"]), ("setaside", "opportunity"))
        self.assertIn("new month", q["rationale"])
        self.assertIsNone(q["insight_key"])


class TestGuardrails(unittest.TestCase):
    def test_money_quests_only_point_at_savings(self):
        for key, (kind, _t, tx_type) in QUEST_SHAPES.items():
            if kind == "money":
                self.assertEqual(tx_type, "savings", key)

    def test_treat_is_the_only_discretionary_quest_and_is_bounded(self):
        disc = [(k, s) for k, s in QUEST_SHAPES.items() if s[2] == "discretionary"]
        self.assertEqual([k for k, _ in disc], ["treat"])
        kind, target, _ = QUEST_SHAPES["treat"]
        self.assertEqual((kind, target), ("count", 1))

    def test_treat_only_reachable_via_permission_reframe(self):
        routes = [iv for iv, qk in INTERVENTION_QUEST.items() if qk == "treat"]
        self.assertEqual(routes, ["permission_reframe"])

    def test_kinds_stay_inside_ui_vocabulary(self):
        for key, (kind, _t, _tx) in QUEST_SHAPES.items():
            self.assertIn(kind, {"days", "count", "money"}, key)


class TestDeterminism(unittest.TestCase):
    def test_same_input_same_output(self):
        args = (risk("blind_thin_runway", "liquidity_first"), 2, [landmark()], MONDAY)
        self.assertEqual(gamify(*args), gamify(*args))


if __name__ == "__main__":
    unittest.main(verbosity=2)
