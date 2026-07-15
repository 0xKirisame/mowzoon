"""
Mowzoon - Recommendation and Predictive Engine

PredictiveEngine.generate_micro_nudge serves the legacy GET path (no ledger,
no signals). match_insights below is the L2 matching layer for the
POST path: it scores L1 signals against config.ARCHETYPE_PROFILES and
returns ranked, template-rendered insights. Design:
mowzoon-analytic/matching-design.md
"""

from datetime import datetime, timedelta
import config
import templates

class PredictiveEngine:
    def __init__(self):
        # Mock Redis cache
        self.redis_cache = {}
        
    def forecast_seasonal_spikes(self, current_date=None, lookahead_days=60):
        """
        Statistical time-series forecasting method (simulating Meta Prophet).
        Scans upcoming calendar windows to identify imminent seasonal spikes.
        """
        if current_date is None:
            current_date = datetime.now()
            
        end_date = current_date + timedelta(days=lookahead_days)
        upcoming_spikes = []
        
        for spike in config.SEASONAL_SPIKES:
            # Check if spike occurs between current_date and end_date
            # Simple simulation: Check month and day
            try:
                spike_date_this_year = datetime(current_date.year, spike['month'], spike['day'])
            except ValueError:
                # Handle leap year edge cases
                spike_date_this_year = datetime(current_date.year, spike['month'], spike['day'] - 1)
                
            try:
                spike_date_next_year = datetime(current_date.year + 1, spike['month'], spike['day'])
            except ValueError:
                spike_date_next_year = datetime(current_date.year + 1, spike['month'], spike['day'] - 1)
            
            if current_date <= spike_date_this_year <= end_date:
                upcoming_spikes.append((spike['name'], (spike_date_this_year - current_date).days))
            elif current_date <= spike_date_next_year <= end_date:
                upcoming_spikes.append((spike['name'], (spike_date_next_year - current_date).days))
                
        # Sort by proximity
        upcoming_spikes.sort(key=lambda x: x[1])
        return upcoming_spikes[0] if upcoming_spikes else None

    def generate_micro_nudge(self, archetype_id, metrics, predicted_spike):
        """
        Generates hyper-personalized daily micro-nudge.
        Maps archetypes + metrics to conditional daily micro-nudges cached via Mock Redis.
        """
        # Create a cache key representing user state
        spike_name = predicted_spike[0] if predicted_spike else "None"
        # Discretizing metrics for caching simulator purposes
        eff = round(metrics['spending_efficiency'] / 10) * 10
        res = round(metrics['proactive_resilience'] / 10) * 10
        eq = round(metrics['financial_eq'] / 10) * 10
        
        cache_key = f"nudge_arch_{archetype_id}_spike_{spike_name}_eff_{eff}_res_{res}_eq_{eq}"
        
        # Simulating <10ms Redis retrieval
        if cache_key in self.redis_cache:
            return self.redis_cache[cache_key]
            
        archetype_name = config.ARCHETYPES[archetype_id]['name']
        exact_eff = metrics['spending_efficiency']
        exact_res = metrics['proactive_resilience']
        exact_eq = metrics['financial_eq']
        
        # Nudges are written in Mowzoon's first-person coach voice.
        nudge = ""

        if archetype_id == 0: # Impulse Spender
            if exact_eq < 40:
                nudge = f"Late-night buys are what's pulling your Financial EQ down ({exact_eq}/100). Give tonight a pause. I'll notice."
            else:
                nudge = "Your impulse buys have gone quiet lately. That calm is worth keeping."

        elif archetype_id == 1: # Anxious Planner
            if exact_eff < 50:
                nudge = f"You're saving plenty, but your Spending Efficiency sits at {exact_eff}/100. The coffee is allowed, no guilt."
            else:
                nudge = "Saving and still living a little. That's the balance I want for you."

        elif archetype_id == 2: # Blind Investor
            if exact_res < 40:
                nudge = f"Your cash cushion is thin (resilience {exact_res}/100). This week, let liquidity win over one more position."
            else:
                nudge = "Your buffer is filling back in. The bets can breathe now."

        elif archetype_id == 3: # Survivalist
            if predicted_spike:
                nudge = f"{predicted_spike[0]} lands in {predicted_spike[1]} days. A small set-aside now beats a scramble later."
            else:
                nudge = "No spikes in sight for a while. The quiet is the moment to tuck a little away."

        # Cache the generated nudge
        self.redis_cache[cache_key] = nudge
        return nudge


# ---------------------------------------------------------------------------
# L2 matching layer (module-level; PredictiveEngine untouched)
# ---------------------------------------------------------------------------

BAND_BASE = {"calm": 0, "note": 1, "elevated": 2, "high": 3}

# A spike-landmark rule only fires inside this window (timing risk, not behavior).
LANDMARK_FIRE_DAYS = 30
LANDMARK_URGENT_DAYS = 14


def _rule_fires(rule, sig):
    """Direction gate plus optional archetype-specific cutpoints (profile convention)."""
    if sig["name"] == "landmark":
        spike = (sig.get("evidence") or {}).get("next_spike")
        return bool(spike) and spike.get("days", 999) <= LANDMARK_FIRE_DAYS
    if sig["direction"] != rule["risk_direction"]:
        return False
    if "value_lt" in rule and not sig["value"] < rule["value_lt"]:
        return False
    if "value_gt" in rule and not sig["value"] > rule["value_gt"]:
        return False
    return True


def _base_score(rule, sig):
    if sig["name"] == "landmark":
        spike = (sig.get("evidence") or {}).get("next_spike") or {}
        return 2 if spike.get("days", 999) <= LANDMARK_URGENT_DAYS else 1
    base = BAND_BASE.get(sig["band"], 0)
    # Fired-rule floor: inverted rules (e.g. Anxious Planner over-saving) fire in
    # states the generic bands call calm; firing already proved the archetype-
    # specific condition, so "elevated" is the honest minimum.
    return base if base > 0 else 2


def _praise_fires(rule, sig):
    if sig["band"] not in rule["when_band"]:
        return False
    if "when_value_gt" in rule and not sig["value"] > rule["when_value_gt"]:
        return False
    return True


def _insight(kind, key, score, sig, profile):
    entry = templates.TEMPLATES[key]
    intervention = None
    if entry["intervention"]:
        intervention = {
            "key": entry["intervention"],
            "label": config.INTERVENTIONS[entry["intervention"]]["label"],
        }
    return {
        "insight_key": key,
        "kind": kind,
        "score": round(score, 2),
        "signal": sig,
        "mechanism": profile["mechanism"],
        "tone": profile["tone"],
        "intervention": intervention,
        "text": templates.render(key, sig),
    }


def match_insights(signals, archetype_id, max_risks=2):
    """Score signals against the archetype profile; return ranked insights.

    Top max_risks risk insights plus at most one praise insight. An empty
    list is a legitimate result (the JITAI "do nothing" option).
    """
    profile = config.ARCHETYPE_PROFILES.get(archetype_id)
    if profile is None:
        return []
    by_name = {s["name"]: s for s in signals}

    risks = []
    fired_signals = set()
    for order, (sig_name, rule) in enumerate(profile["watch"].items()):
        sig = by_name.get(sig_name)
        if sig is None or not _rule_fires(rule, sig):
            continue
        score = _base_score(rule, sig) * rule["weight"]
        risks.append((score, rule["weight"], -order, rule["insight_key"], sig))
        fired_signals.add(sig_name)
    risks.sort(reverse=True)

    out = [
        _insight("risk", key, score, sig, profile)
        for score, _w, _o, key, sig in risks[:max_risks]
    ]

    for rule in profile["praise"]:
        sig = by_name.get(rule["signal"])
        if sig is None or rule["signal"] in fired_signals:
            continue
        if _praise_fires(rule, sig):
            out.append(_insight("praise", rule["insight_key"], 0.0, sig, profile))
            break
    return out
