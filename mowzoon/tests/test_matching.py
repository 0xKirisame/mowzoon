"""Tests for the L2 matching layer. Run: python test_matching.py"""


import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import unittest

import config
import templates
from engine import match_insights


def sig(name, value, band, direction, evidence=None, unit=None):
    units = {
        "savings_rate": "fraction_of_income",
        "lifestyle_share": "fraction_of_income",
        "runway": "months",
        "weekend_ratio": "ratio",
        "momentum": "ratio_to_typical_week",
        "anomaly": "flagged_tx_last_7d",
        "landmark": "days_to_event",
    }
    return {"name": name, "value": value, "unit": unit or units[name],
            "band": band, "direction": direction, "evidence": evidence or {}}


# A frugal over-saver: high saving, low lifestyle, big buffer.
OVERSAVER = [
    sig("savings_rate", 0.42, "calm", "above_anchor"),
    sig("lifestyle_share", 0.10, "calm", "at_anchor"),
    sig("runway", 7.5, "calm", "above_anchor"),
]

# A weekend-heavy spender in a hot week.
HOT_WEEKEND = [
    sig("weekend_ratio", 1.8, "high", "above_anchor"),
    sig("momentum", 3.1, "elevated", "above_anchor"),
    sig("savings_rate", 0.02, "high", "below_anchor"),
]


def keys(insights):
    return [i["insight_key"] for i in insights]


class TestProofCase(unittest.TestCase):
    """Same signals, different archetypes, different output."""

    def test_oversaver_flags_for_anxious_planner(self):
        out = match_insights(OVERSAVER, 1)
        risk_keys = [i["insight_key"] for i in out if i["kind"] == "risk"]
        self.assertIn("anxious_oversaving", risk_keys)
        self.assertIn("anxious_deprivation", risk_keys)

    def test_oversaver_is_no_risk_for_impulse_spender(self):
        out = match_insights(OVERSAVER, 0)
        self.assertEqual([i for i in out if i["kind"] == "risk"], [])

    def test_direction_gate_on_low_savings(self):
        low_savings = [sig("savings_rate", 0.02, "high", "below_anchor")]
        self.assertTrue(match_insights(low_savings, 0))   # Impulse: fires
        self.assertTrue(match_insights(low_savings, 3))   # Survivalist: fires
        self.assertEqual(match_insights(low_savings, 1), [])  # Anxious: gated off


class TestRankingAndSelection(unittest.TestCase):
    def test_weekend_high_outranks_momentum_elevated(self):
        out = match_insights(HOT_WEEKEND, 0)
        self.assertEqual(out[0]["insight_key"], "impulse_weekend_pattern")  # 3*3=9
        self.assertEqual(out[1]["insight_key"], "impulse_hot_week")         # 2*3=6

    def test_cap_max_risks_plus_one_praise(self):
        out = match_insights(HOT_WEEKEND, 0, max_risks=2)
        self.assertLessEqual(len(out), 3)
        self.assertLessEqual(len([i for i in out if i["kind"] == "risk"]), 2)
        self.assertLessEqual(len([i for i in out if i["kind"] == "praise"]), 1)

    def test_all_calm_blind_investor_gets_praise_only(self):
        calm = [sig("runway", 4.2, "note", "at_anchor"),
                sig("savings_rate", 0.25, "calm", "at_anchor"),
                sig("momentum", 0.9, "calm", "at_anchor")]
        out = match_insights(calm, 2)
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0]["kind"], "praise")
        self.assertEqual(out[0]["insight_key"], "blind_buffer_built_praise")

    def test_praise_suppressed_when_signal_fired_as_risk(self):
        # Anxious Planner: runway above anchor fires as risk (hoarded buffer),
        # so the runway praise rule must not also fire.
        out = match_insights([sig("runway", 8.0, "calm", "above_anchor")], 1)
        self.assertEqual(keys(out), ["anxious_hoarded_buffer"])

    def test_empty_signals_do_nothing(self):
        self.assertEqual(match_insights([], 0), [])
        self.assertEqual(match_insights([], 99), [])  # unknown archetype


class TestLandmarkSpecialCase(unittest.TestCase):
    def test_spike_within_window_fires_for_survivalist(self):
        lm = sig("landmark", 10, "elevated", "at_anchor",
                 evidence={"next_spike": {"event": "Eid al-Adha", "kind": "spike", "days": 10}})
        out = match_insights([lm], 3)
        self.assertEqual(out[0]["insight_key"], "survivalist_spike_ahead")
        self.assertIn("Eid al-Adha", out[0]["text"])
        self.assertIn("10 days", out[0]["text"])

    def test_fresh_start_alone_does_not_fire(self):
        lm = sig("landmark", 3, "elevated", "at_anchor",
                 evidence={"next_spike": None,
                           "next_fresh_start": {"event": "New month", "days": 3}})
        self.assertEqual(match_insights([lm], 3), [])

    def test_distant_spike_does_not_fire(self):
        lm = sig("landmark", 20, "note", "at_anchor",
                 evidence={"next_spike": {"event": "Back to School", "days": 80}})
        self.assertEqual(match_insights([lm], 3), [])


class TestTemplates(unittest.TestCase):
    def test_every_profile_insight_key_has_a_template_and_renders(self):
        rendered = 0
        for aid, profile in config.ARCHETYPE_PROFILES.items():
            rules = list(profile["watch"].items())
            for sig_name, rule in rules:
                key = rule["insight_key"]
                self.assertIn(key, templates.TEMPLATES, key)
                evidence = {"next_spike": {"event": "Eid al-Fitr", "days": 12}}
                s = sig(sig_name, 2.5 if sig_name != "landmark" else 12,
                        "elevated", rule["risk_direction"], evidence=evidence)
                text = templates.render(key, s)
                self.assertTrue(text and "{" not in text, key)
                rendered += 1
            for rule in profile["praise"]:
                key = rule["insight_key"]
                self.assertIn(key, templates.TEMPLATES, key)
                text = templates.render(key, sig(rule["signal"], 0.25, "calm", "at_anchor"))
                self.assertTrue(text and "{" not in text, key)
                rendered += 1
        self.assertEqual(rendered, 25)

    def test_no_orphan_templates(self):
        used = set()
        for profile in config.ARCHETYPE_PROFILES.values():
            used |= {r["insight_key"] for r in profile["watch"].values()}
            used |= {r["insight_key"] for r in profile["praise"]}
        self.assertEqual(set(templates.TEMPLATES), used)

    def test_risk_insights_carry_intervention_praise_does_not(self):
        out = match_insights(HOT_WEEKEND, 0)
        for i in out:
            if i["kind"] == "risk":
                self.assertIsNotNone(i["intervention"])
                self.assertIn(i["intervention"]["key"], config.INTERVENTIONS)
            else:
                self.assertIsNone(i["intervention"])


class TestDeterminism(unittest.TestCase):
    def test_same_input_same_output(self):
        a = match_insights(HOT_WEEKEND, 0)
        b = match_insights(HOT_WEEKEND, 0)
        self.assertEqual(a, b)


if __name__ == "__main__":
    unittest.main(verbosity=2)
