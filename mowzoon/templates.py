"""
Mowzoon - Insight copy templates (L2 matching layer).

One entry per insight_key from config.ARCHETYPE_PROFILES. English only for now;
insight_key is the stable handle the Arabic pass will attach to later (D2).
Every entry names the intervention it embodies so the advice stays auditable
(keys resolve to config.INTERVENTIONS).

Voice rules (binding, evidence-base section 7): first-person coach, no blame
wording, forward-looking, concrete numbers where they help.
"""

TEMPLATES = {
    # --- 0 The Impulse Spender -------------------------------------------
    'impulse_weekend_pattern': {
        'intervention': 'cooling_off',
        'text': "Weekends are carrying {ratio}x their share of your spending right now. "
                "One planned treat beats five unplanned ones; pick the one you'll actually remember.",
    },
    'impulse_hot_week': {
        'intervention': 'cooling_off',
        'text': "This week is running {ratio}x your usual pace. A 24-hour pause on the next "
                "non-essential buy resets the streak without costing you anything.",
    },
    'impulse_big_buy': {
        'intervention': 'cooling_off',
        'text': "That last purchase sat well above your usual range. No judgment, just a note: "
                "sleeping on the next one keeps the choice yours.",
    },
    'impulse_lifestyle_creep': {
        'intervention': 'precommitment_smart',
        'text': "Lifestyle spending is taking {pct}% of income this month. Set next month's "
                "ceiling now, while it's still easy to promise.",
    },
    'impulse_savings_slip': {
        'intervention': 'precommitment_smart',
        'text': "Savings slipped to {pct}% this month. A small automatic set-aside starting "
                "next month costs present-you nothing and pays future-you first.",
    },
    'impulse_thin_cushion': {
        'intervention': 'micro_setaside',
        'text': "Your cushion covers about {months} months right now. A standing transfer, "
                "however small, rebuilds it without needing willpower.",
    },
    'impulse_quiet_week_praise': {
        'intervention': None,
        'text': "Your spending pace is right at your normal this week. That steadiness is the "
                "skill; everything else builds on it.",
    },
    'impulse_steady_weekend_praise': {
        'intervention': None,
        'text': "Weekends have stayed level with the rest of your week lately. That's the "
                "pattern most people never manage.",
    },

    # --- 1 The Anxious Planner -------------------------------------------
    'anxious_oversaving': {
        'intervention': 'permission_reframe',
        'text': "You're keeping {pct}% of income, far beyond the 20% target. The plan is "
                "funded; some of this money is allowed to buy you a life.",
    },
    'anxious_deprivation': {
        'intervention': 'permission_reframe',
        'text': "Quality-of-life spending is down at {pct}% of income, lower than 9 in 10 "
                "people. A planned treat will not dent the plan; you've earned it.",
    },
    'anxious_hoarded_buffer': {
        'intervention': 'permission_reframe',
        'text': "Your buffer now covers {months} months, beyond the 6 the benchmark asks for. "
                "Everything above that line is a choice, not a requirement.",
    },
    # Text claims only what the rule checks (lifestyle share above the
    # deprivation floor), not savings quality, which this rule does not see.
    'anxious_balance_praise': {
        'intervention': None,
        'text': "You're letting quality of life have its share this month. For you, that is "
                "the win worth noticing.",
    },
    'anxious_secure_praise': {
        'intervention': None,
        'text': "Your buffer sits inside the healthy 3 to 6 month band. You are covered; let "
                "that fact do some of the relaxing for you.",
    },

    # --- 2 The Blind Investor --------------------------------------------
    'blind_thin_runway': {
        'intervention': 'liquidity_first',
        'text': "Cash on hand covers about {months} months of spending; the benchmark is 3 to "
                "6. This week, let liquidity win over one more position.",
    },
    'blind_big_position': {
        'intervention': 'liquidity_first',
        'text': "One recent outflow sat far above your usual range. Big moves deserve a cash "
                "check first: buffer, then bets.",
    },
    'blind_cashflow_leak': {
        'intervention': 'precommitment_smart',
        'text': "Only {pct}% of income stayed with you this month. Route a fixed slice to cash "
                "before anything else gets allocated.",
    },
    'blind_hot_week': {
        'intervention': 'liquidity_first',
        'text': "Outflows are at {ratio}x your typical week. Worth one glance at what's "
                "driving it before the month closes.",
    },
    'blind_buffer_built_praise': {
        'intervention': None,
        'text': "Your cash floor is holding inside the healthy band. That buffer is what lets "
                "the rest of your strategy breathe.",
    },

    # --- 3 The Survivalist -------------------------------------------------
    'survivalist_no_cushion': {
        'intervention': 'micro_setaside',
        'text': "The cushion covers about {months} months right now. Twenty riyals a week into "
                "a labelled pot is a real start, and it adds up faster than it sounds.",
    },
    'survivalist_spike_ahead': {
        'intervention': 'sinking_fund',
        'text': "{event} lands in {days} days. A small set-aside each week from now beats a "
                "scramble later.",
    },
    'survivalist_dissaving': {
        'intervention': 'micro_setaside',
        'text': "Spending ran past income this month. No blame here: one fixed cost reviewed "
                "and one small set-aside started is how the line turns.",
    },
    'survivalist_shock_spend': {
        'intervention': 'sinking_fund',
        'text': "A shock expense hit this week. Once it settles, a small named pot for the "
                "next one takes the sting out.",
    },
    'survivalist_hot_week': {
        'intervention': 'fresh_start_commit',
        'text': "This week ran {ratio}x your usual. If it was planned, ignore me; if not, next "
                "week is a clean page.",
    },
    'survivalist_headroom_praise': {
        'intervention': None,
        'text': "You kept {pct}% of income this month. With margins as tight as yours, that is "
                "a genuine win.",
    },
    'survivalist_steady_praise': {
        'intervention': None,
        'text': "Spending stayed level with your normal week. Steady is exactly what builds "
                "the cushion.",
    },
}


def build_context(signal):
    """Derive template fields from an L1 signal object."""
    value = signal.get('value', 0)
    ctx = {
        'value': value,
        'pct': round(value * 100) if signal.get('unit') == 'fraction_of_income' else round(value),
        'months': round(value, 1),
        'ratio': round(value, 1),
        'count': int(value) if isinstance(value, (int, float)) else value,
    }
    if signal.get('name') == 'landmark':
        spike = (signal.get('evidence') or {}).get('next_spike') \
            or (signal.get('evidence') or {}).get('nearest') or {}
        ctx['event'] = spike.get('event', 'A known expense')
        ctx['days'] = spike.get('days', int(value))
    return ctx


def render(insight_key, signal):
    """Render the template for insight_key against a signal. KeyError if unknown."""
    entry = TEMPLATES[insight_key]
    return entry['text'].format(**build_context(signal))
