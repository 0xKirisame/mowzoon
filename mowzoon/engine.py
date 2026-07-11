"""
Mowzoon - Recommendation and Predictive Engine
"""

from datetime import datetime, timedelta
import config

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
