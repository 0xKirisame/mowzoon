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
        
        nudge = ""
        
        if archetype_id == 0: # Impulse Liver
            if exact_eq < 40:
                nudge = f"We noticed late-night spending is dragging down your Financial EQ ({exact_eq}/100). Take a pause tonight!"
            else:
                nudge = "Great job managing impulse buys recently! Keep that streak going."
                
        elif archetype_id == 1: # Anxious Planner
            if exact_eff < 50:
                nudge = f"Your Savings are great, but Spending Efficiency is {exact_eff}/100. It's okay to treat yourself to that coffee today without guilt."
            else:
                nudge = "You've been balancing saving and enjoying life perfectly. Keep it up!"
                
        elif archetype_id == 2: # Blind Investor
            if exact_res < 40:
                nudge = f"Your Proactive Resilience is critically low ({exact_res}/100). Consider keeping more cash on hand instead of over-investing this week."
            else:
                nudge = "Your liquidity buffer is looking healthier. Great job protecting your investments."
                
        elif archetype_id == 3: # Survivalist
            if predicted_spike:
                nudge = f"Warning: '{predicted_spike[0]}' is coming up in {predicted_spike[1]} days. Let's stash $20 today to soften the blow."
            else:
                nudge = "No major spikes coming up soon. A perfect time to build a small buffer."

        # Cache the generated nudge
        self.redis_cache[cache_key] = nudge
        return nudge
