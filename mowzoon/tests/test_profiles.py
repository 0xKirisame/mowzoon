"""Schema-integrity tests for ARCHETYPE_PROFILES. Run: python test_profiles.py"""


import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import unittest

import config
from config import ARCHETYPE_PROFILES, INTERVENTIONS

SIGNAL_NAMES = {"savings_rate", "runway", "lifestyle_share", "weekend_ratio",
                "momentum", "anomaly", "landmark"}
DIRECTIONS = {"above_anchor", "below_anchor", "at_anchor"}
BANDS = {"calm", "note", "elevated", "high"}


class TestProfileSchema(unittest.TestCase):
    def test_all_four_archetypes_present_and_aligned_with_archetypes(self):
        self.assertEqual(set(ARCHETYPE_PROFILES), {0, 1, 2, 3})
        self.assertEqual(set(ARCHETYPE_PROFILES), set(config.ARCHETYPES))

    def test_required_fields_complete(self):
        for aid, p in ARCHETYPE_PROFILES.items():
            for field in ("mechanism", "klontz_frame",
                          "tone", "watch", "praise", "interventions", "vulnerability"):
                self.assertIn(field, p, f"archetype {aid} missing {field}")
                self.assertTrue(p[field], f"archetype {aid} empty {field}")

    def test_watch_rules_reference_real_signals_and_valid_fields(self):
        for aid, p in ARCHETYPE_PROFILES.items():
            for sig, rule in p["watch"].items():
                self.assertIn(sig, SIGNAL_NAMES, f"a{aid}: unknown signal {sig}")
                self.assertGreater(rule["weight"], 0, f"a{aid}/{sig}: weight must be > 0")
                self.assertIn(rule["risk_direction"], DIRECTIONS, f"a{aid}/{sig}")
                self.assertIn("insight_key", rule, f"a{aid}/{sig}: missing insight_key")

    def test_praise_rules_valid_and_present(self):
        for aid, p in ARCHETYPE_PROFILES.items():
            self.assertGreaterEqual(len(p["praise"]), 1,
                                    f"a{aid}: positive framing requires >=1 praise rule")
            for rule in p["praise"]:
                self.assertIn(rule["signal"], SIGNAL_NAMES, f"a{aid} praise")
                self.assertTrue(set(rule["when_band"]) <= BANDS, f"a{aid} praise bands")
                self.assertIn("insight_key", rule)

    def test_interventions_resolve_to_vocabulary(self):
        for aid, p in ARCHETYPE_PROFILES.items():
            for key in p["interventions"]:
                self.assertIn(key, INTERVENTIONS, f"a{aid}: unknown intervention {key}")
        for key, meta in INTERVENTIONS.items():
            self.assertTrue(meta.get("label"), f"{key}: intervention must have a label")

    def test_insight_keys_unique_within_each_profile(self):
        for aid, p in ARCHETYPE_PROFILES.items():
            keys = [r["insight_key"] for r in p["watch"].values()]
            keys += [r["insight_key"] for r in p["praise"]]
            self.assertEqual(len(keys), len(set(keys)), f"a{aid}: duplicate insight_key")

    def test_praise_never_attaches_to_unhealthy_bands(self):
        # Robinhood guardrail: praise only on calm/note states
        for aid, p in ARCHETYPE_PROFILES.items():
            for rule in p["praise"]:
                self.assertTrue(set(rule["when_band"]) <= {"calm", "note"},
                                f"a{aid}: praise on unhealthy band {rule['when_band']}")

    def test_direction_gate_encodes_the_proof_case(self):
        # Anxious Planner risk = over-saving; everyone else's savings risk = under-saving
        self.assertEqual(
            ARCHETYPE_PROFILES[1]["watch"]["savings_rate"]["risk_direction"],
            "above_anchor")
        for aid in (0, 2, 3):
            watch = ARCHETYPE_PROFILES[aid]["watch"]
            if "savings_rate" in watch:
                self.assertEqual(watch["savings_rate"]["risk_direction"], "below_anchor",
                                 f"a{aid}")


if __name__ == "__main__":
    unittest.main(verbosity=2)
