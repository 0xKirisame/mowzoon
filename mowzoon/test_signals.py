"""Tests for signals.py (Phase 1). Run:  python test_signals.py"""

import unittest
from datetime import date, timedelta

import signals
from signals import compute_signals

TODAY = date(2026, 7, 13)


def tx(days_ago, type_, amount):
    return {"type": type_, "amount": amount,
            "date": (TODAY - timedelta(days=days_ago)).isoformat()}


def weekly_ledger(weeks=12, disc_per_week=250.0):
    """One discretionary tx per PRIOR week (current week left empty for tests)."""
    rows = []
    for k in range(1, weeks + 1):
        d = TODAY - timedelta(days=7 * k + 3)
        rows.append({"type": "discretionary", "amount": disc_per_week,
                     "date": d.isoformat()})
    return rows


def by_name(result):
    return {s["name"]: s for s in result}


class TestMaturityGates(unittest.TestCase):
    def test_empty_ledger_yields_only_landmark(self):
        out = by_name(compute_signals([], 10000, TODAY))
        self.assertEqual(set(out), {"landmark"})

    def test_two_week_user_gets_shares_but_not_runway_momentum_anomaly(self):
        ledger = [tx(d, "discretionary", 50) for d in range(0, 15, 2)]
        out = by_name(compute_signals(ledger, 10000, TODAY))
        self.assertIn("savings_rate", out)
        self.assertIn("lifestyle_share", out)
        self.assertNotIn("runway", out)      # needs 56d span
        self.assertNotIn("momentum", out)    # needs 4 nonzero prior weeks
        self.assertNotIn("anomaly", out)     # needs 20 disc tx

    def test_no_income_suppresses_income_denominated_signals(self):
        ledger = [tx(d, "discretionary", 50) for d in range(0, 30, 2)]
        out = by_name(compute_signals(ledger, 0, TODAY))
        self.assertNotIn("savings_rate", out)
        self.assertNotIn("lifestyle_share", out)


class TestSavingsRate(unittest.TestCase):
    def test_bands_and_direction(self):
        # spend 9,600 of 10,000 over last 30d -> rate 0.04 -> elevated, below anchor
        ledger = ([tx(1, "fixed", 5000), tx(2, "discretionary", 4600)]
                  + [tx(d, "discretionary", 1) for d in range(31, 51)])  # history outside window
        out = by_name(compute_signals(ledger, 10000, TODAY))
        s = out["savings_rate"]
        self.assertAlmostEqual(s["value"], 0.04, places=3)
        self.assertEqual(s["band"], "elevated")
        self.assertEqual(s["direction"], "below_anchor")

    def test_oversaver_direction_above_anchor(self):
        ledger = [tx(1, "discretionary", 100)] + [tx(20, "fixed", 100)]
        out = by_name(compute_signals(ledger, 10000, TODAY))
        s = out["savings_rate"]
        self.assertEqual(s["band"], "calm")
        self.assertEqual(s["direction"], "above_anchor")  # >P90: over-saving territory


class TestRunway(unittest.TestCase):
    def test_runway_months_and_band(self):
        ledger = []
        for k in range(12):  # 12 weeks of spend: 900/wk fixed+disc
            ledger.append(tx(7 * k + 1, "fixed", 500))
            ledger.append(tx(7 * k + 2, "discretionary", 400))
        ledger.append(tx(30, "savings", 8000))
        out = by_name(compute_signals(ledger, 10000, TODAY))
        s = out["runway"]
        # ~3,857/mo spend, pot 8,000 -> ~2.07 months -> elevated, below CFPB band
        self.assertEqual(s["band"], "elevated")
        self.assertEqual(s["direction"], "below_anchor")
        self.assertEqual(s["unit"], "months")

    def test_spike_counts_toward_spend(self):
        base = []
        for k in range(12):
            base.append(tx(7 * k + 1, "fixed", 500))
        base.append(tx(45, "savings", 6000))
        no_spike = by_name(compute_signals(base, 10000, TODAY))["runway"]["value"]
        with_spike = by_name(compute_signals(base + [tx(10, "spike", 3000)], 10000, TODAY))["runway"]["value"]
        self.assertLess(with_spike, no_spike)


class TestWeekendRatio(unittest.TestCase):
    def make_ledger(self, weekend_amt, weekday_amt):
        rows = []
        d = TODAY - timedelta(days=55)
        while d <= TODAY:
            if d.weekday() in (4, 5) and weekend_amt:      # Fri/Sat
                rows.append({"type": "discretionary", "amount": weekend_amt, "date": d.isoformat()})
            if d.weekday() == 1 and weekday_amt:           # Tue
                rows.append({"type": "discretionary", "amount": weekday_amt, "date": d.isoformat()})
            d += timedelta(days=1)
        return rows

    def test_friday_saturday_is_the_weekend(self):
        out = by_name(compute_signals(self.make_ledger(100, 0), 0, TODAY))
        s = out["weekend_ratio"]
        self.assertAlmostEqual(s["value"], 3.5, places=1)  # all spend on 2/7 of days
        self.assertEqual(s["band"], "high")

    def test_calendar_neutral_is_calm(self):
        # equal spend every day -> weekend share = 2/7 -> ratio 1.0
        rows = []
        d = TODAY - timedelta(days=55)
        while d <= TODAY:
            rows.append({"type": "discretionary", "amount": 50, "date": d.isoformat()})
            d += timedelta(days=1)
        s = by_name(compute_signals(rows, 0, TODAY))["weekend_ratio"]
        self.assertAlmostEqual(s["value"], 1.0, places=2)
        self.assertEqual(s["band"], "calm")
        self.assertEqual(s["direction"], "at_anchor")


class TestMomentum(unittest.TestCase):
    def test_typical_week_is_calm_1x(self):
        ledger = weekly_ledger(12) + [tx(3, "discretionary", 250)]
        s = by_name(compute_signals(ledger, 0, TODAY))["momentum"]
        self.assertAlmostEqual(s["value"], 1.0, places=2)
        self.assertEqual(s["band"], "calm")

    def test_hot_week_is_high(self):
        ledger = weekly_ledger(12) + [tx(2, "discretionary", 1500)]
        s = by_name(compute_signals(ledger, 0, TODAY))["momentum"]
        self.assertEqual(s["band"], "high")   # 6x typical
        self.assertEqual(s["direction"], "above_anchor")


class TestAnomaly(unittest.TestCase):
    def test_routine_purchases_calm(self):
        ledger = [tx(d + 8, "discretionary", 30 + (d % 5)) for d in range(25)]
        ledger.append(tx(1, "discretionary", 32))
        s = by_name(compute_signals(ledger, 0, TODAY))["anomaly"]
        self.assertEqual(s["band"], "calm")
        self.assertEqual(s["value"], 0)

    def test_extreme_purchase_flags_high(self):
        ledger = [tx(d + 8, "discretionary", 30 + (d % 5)) for d in range(25)]
        ledger.append(tx(1, "discretionary", 500))
        s = by_name(compute_signals(ledger, 0, TODAY))["anomaly"]
        self.assertEqual(s["band"], "high")
        self.assertEqual(s["value"], 1)
        self.assertIn("fence", s["evidence"])


class TestLandmark(unittest.TestCase):
    def test_always_present_with_spike_and_fresh_start(self):
        s = by_name(compute_signals([], 0, TODAY))["landmark"]
        self.assertEqual(s["evidence"]["next_fresh_start"]["event"], "New month")
        self.assertIsNotNone(s["evidence"]["next_spike"])
        self.assertGreaterEqual(s["value"], 0)

    def test_proximity_band(self):
        # 2026-07-31 -> new month in 1 day -> elevated
        s = by_name(compute_signals([], 0, date(2026, 7, 31)))["landmark"]
        self.assertEqual(s["band"], "elevated")


class TestRobustness(unittest.TestCase):
    def test_dirty_rows_skipped_not_fatal(self):
        ledger = [tx(1, "discretionary", 50),
                  {"type": "unknown", "amount": 10, "date": "2026-07-01"},
                  {"type": "fixed", "amount": -5, "date": "2026-07-02"},
                  {"type": "fixed", "amount": 10, "date": "not-a-date"}]
        compute_signals(ledger, 1000, TODAY)  # must not raise
        self.assertEqual(len(signals.last_skipped_rows), 3)

    def test_deterministic(self):
        ledger = weekly_ledger(12) + [tx(1, "discretionary", 100)]
        a = compute_signals(ledger, 9000, TODAY)
        b = compute_signals(ledger, 9000, TODAY)
        self.assertEqual(a, b)


if __name__ == "__main__":
    unittest.main(verbosity=2)
