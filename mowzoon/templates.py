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
        'text': "Weekends are taking {ratio}x their usual share of your spending right now. "
                "One treat you plan beats five you don't. Pick the one you'll actually enjoy.",
    },
    'impulse_hot_week': {
        'intervention': 'cooling_off',
        'text': "This week you're spending {ratio}x your usual pace. Try waiting a day before "
                "your next non-essential buy. Often the urge passes on its own.",
    },
    'impulse_big_buy': {
        'intervention': 'cooling_off',
        'text': "Your last purchase was well above your usual range. There's nothing wrong "
                "with that. If you sleep on the next big one, the choice stays yours.",
    },
    'impulse_lifestyle_creep': {
        'intervention': 'precommitment_smart',
        'text': "Fun and lifestyle spending is taking {pct}% of your income this month. Set a "
                "limit for next month now, before the spending starts.",
    },
    'impulse_savings_slip': {
        'intervention': 'precommitment_smart',
        'text': "You saved {pct}% of your income this month, down from your usual. A small "
                "automatic transfer next month makes saving happen without you thinking about it.",
    },
    'impulse_thin_cushion': {
        'intervention': 'micro_setaside',
        'text': "Right now your savings would cover {cover} of spending. A small regular "
                "transfer, even a tiny one, builds it back over time.",
    },
    'impulse_quiet_week_praise': {
        'intervention': None,
        'text': "Your spending this week is right at your normal pace. Keeping it steady like "
                "this is the hard part, and you're doing it.",
    },
    'impulse_steady_weekend_praise': {
        'intervention': None,
        'text': "Your weekends have stayed in line with the rest of your week lately. That's "
                "a hard habit to hold, so nice work.",
    },

    # --- 1 The Anxious Planner -------------------------------------------
    'anxious_oversaving': {
        'intervention': 'permission_reframe',
        'text': "You're saving {pct}% of your income, well above the 20% that's considered "
                "healthy. Your plan is already covered. It's okay to spend some of this on yourself.",
    },
    'anxious_deprivation': {
        'intervention': 'permission_reframe',
        'text': "You're spending only {pct}% of your income on yourself, less than 9 in 10 "
                "people. A planned treat won't hurt your plan. Go ahead.",
    },
    'anxious_hoarded_buffer': {
        'intervention': 'permission_reframe',
        'text': "Your savings now cover about {months} months of spending, more than the 6 a "
                "healthy range needs. Anything above that is money you're free to use.",
    },
    # Text claims only what the rule checks (lifestyle share above the
    # deprivation floor), not savings quality, which this rule does not see.
    'anxious_balance_praise': {
        'intervention': None,
        'text': "You let yourself enjoy some of your money this month. For someone who plans "
                "as carefully as you do, that's a good sign.",
    },
    'anxious_secure_praise': {
        'intervention': None,
        'text': "Your savings sit right in the healthy range of 3 to 6 months. You're "
                "covered, so try to let some of the worry go.",
    },

    # --- 2 The Blind Investor --------------------------------------------
    'blind_thin_runway': {
        'intervention': 'liquidity_first',
        'text': "Your cash would cover {cover} of spending. A healthy range is 3 to 6 months. "
                "This week, keep new money in cash instead of investing it.",
    },
    'blind_big_position': {
        'intervention': 'liquidity_first',
        'text': "One recent outflow was far above your usual range. Before the next big move, "
                "check that your cash covers you first.",
    },
    'blind_cashflow_leak': {
        'intervention': 'precommitment_smart',
        'text': "Only {pct}% of your income stayed with you this month. Move a set amount into "
                "cash first, before you spend or invest the rest.",
    },
    'blind_hot_week': {
        'intervention': 'liquidity_first',
        'text': "Your spending is at {ratio}x a typical week. Take a quick look at what's "
                "driving it before the month ends.",
    },
    'blind_buffer_built_praise': {
        'intervention': None,
        'text': "Your cash reserve is holding in the healthy range. That's a solid base for "
                "everything else you're doing.",
    },

    # --- 3 The Survivalist -------------------------------------------------
    'survivalist_no_cushion': {
        'intervention': 'micro_setaside',
        'text': "Right now your savings would cover {cover} of spending. Putting SAR 20 a week "
                "into a separate account is a good place to start.",
    },
    'survivalist_spike_ahead': {
        'intervention': 'sinking_fund',
        'text': "{event} is {days} days away. If you save a little each week from now, you "
                "won't have to find it all at once.",
    },
    'survivalist_dissaving': {
        'intervention': 'micro_setaside',
        'text': "You spent more than you earned this month. It happens. Cutting one regular "
                "bill and saving a little each week is how it starts to turn around.",
    },
    'survivalist_shock_spend': {
        'intervention': 'sinking_fund',
        'text': "An unexpected expense hit this week. Once things settle, saving a small "
                "amount for the next one will make it easier to handle.",
    },
    'survivalist_hot_week': {
        'intervention': 'fresh_start_commit',
        'text': "This week you spent {ratio}x your usual. If you planned for it, no worries. "
                "If not, next week you can get back on track.",
    },
    'survivalist_headroom_praise': {
        'intervention': None,
        'text': "You saved {pct}% of your income this month. On a tight budget like yours, "
                "that takes real discipline.",
    },
    'survivalist_steady_praise': {
        'intervention': None,
        'text': "Your spending stayed level with your normal week. Keeping it steady like "
                "this is how savings grow.",
    },
}


def _cover_phrase(n):
    """Months-of-spending covered, as a phrase. Keeps a near-zero runway from
    reading as the nonsensical "about 0 months"."""
    if n < 1:
        return "less than a month"
    if n < 1.5:
        return "about a month"
    return "about {} months".format(round(n, 1))


def build_context(signal):
    """Derive template fields from an L1 signal object."""
    value = signal.get('value', 0)
    months = round(value, 1) if isinstance(value, (int, float)) else 0
    ctx = {
        'value': value,
        # floored at 0: a dissaving month makes savings_rate negative and the
        # copy reads "only {pct}% stayed with you"
        'pct': max(0, round(value * 100) if signal.get('unit') == 'fraction_of_income' else round(value)),
        'months': months,
        'cover': _cover_phrase(months),
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
