"""
Mowzoon - Configuration and Definitions
"""

# Archetypes definition
ARCHETYPES = {
    0: {
        'name': 'The Impulse Spender',
        'description': 'High emotion-driven spending, high weekend spikes, low efficiency'
    },
    1: {
        'name': 'The Anxious Planner',
        'description': 'High savings rate, low discretionary spend, low quality of life/spending efficiency score'
    },
    2: {
        'name': 'The Blind Investor',
        'description': 'High investment allocation, critical lack of cash buffer, vulnerable to liquidity shocks'
    },
    3: {
        'name': 'The Survivalist',
        'description': 'Income tightly consumed by fixed costs, highly vulnerable to predictable periodic spikes'
    }
}

# General Hyperparameters
NUM_USERS = 1000
DAYS_OF_HISTORY = 365

# Transaction Categories
CATEGORIES = [
    'Fixed_Housing', 
    'Fixed_Utilities', 
    'Fixed_Insurance', 
    'Discretionary_Dining', 
    'Discretionary_Shopping', 
    'Discretionary_Entertainment',
    'Savings',
    'Investments'
]

# Seasonal spikes (Eid dates drift each year; these are the 2026 dates)
SEASONAL_SPIKES = [
    {'name': 'Eid al-Fitr', 'month': 3, 'day': 20},
    {'name': 'Eid al-Adha', 'month': 5, 'day': 27},
    {'name': 'Back to School', 'month': 8, 'day': 25},
    {'name': 'Car Insurance Renewal', 'month': 11, 'day': 15}
]

# ---------------------------------------------------------------------------
# L2 archetype profiles. Declarative config consumed by the matching
# layer; no logic lives here. Evidence pointers reference the source register
# in mowzoon-analytic/evidence-base.md; design rationale in
# mowzoon-analytic/profiles-design.md.
#
# Scoring convention (matching layer): band base score calm=0/note=1/elevated=2/high=3,
# a watch rule fires only when the signal's direction matches risk_direction
# (and any value_lt/value_gt cutpoint holds); priority = base * weight.
# ---------------------------------------------------------------------------

# Shared intervention vocabulary. S-numbers in comments are rows in the source
# register (mowzoon-analytic/evidence-base.md, section 11).
INTERVENTIONS = {
    # S9 present bias; hot-state/cold-state gap
    'cooling_off': {'label': 'Cooling-off pause before non-essential buys'},
    # S8 Save More Tomorrow: 78% joined, saving rate 3.5% -> 13.6% in 40 months
    'precommitment_smart': {'label': 'Commit now to a change that starts later'},
    # S8 SMarT loss-aversion mechanic
    'tie_to_income': {'label': 'Tie increases to future income so take-home never drops'},
    # S8/Thaler mental accounting; pairs with the engine.py spike forecast
    'sinking_fund': {'label': 'Labelled set-aside toward a known upcoming spike'},
    # S8 inertia/default mechanic at micro scale
    'micro_setaside': {'label': 'Very small recurring set-aside (start tiny, start now)'},
    # evidence-base 4.5 money vigilance; 3 negative-framing backfire
    'permission_reframe': {'label': 'Explicit permission to spend on quality of life'},
    # S6/S7 CFPB 3-6 month buffer benchmarks
    'liquidity_first': {'label': 'Let the cash buffer win over one more position'},
    # evidence-base 5.2 goal-gradient effect
    'buffer_gradient': {'label': 'Visible progress bar toward the 3-6 month buffer'},
    # S27/S28 Fresh Start Effect (savings-specific in S28)
    'fresh_start_commit': {'label': 'Issue commitments at temporal landmarks'},
}

# Klontz frames are FRAMING VOCABULARY ONLY - a hypothesis mapping, not a
# validated diagnosis (the 4-factor structure failed independent replication;
# evidence-base 4.5).
ARCHETYPE_PROFILES = {
    0: {  # The Impulse Spender
        'mechanism': 'present_bias',  # S9 Xiao & Porto 2019
        'klontz_frame': 'money_worship',
        'tone': 'playful, zero-guilt, momentum-focused',
        'watch': {
            'weekend_ratio': {'weight': 3.0, 'risk_direction': 'above_anchor',
                              'insight_key': 'impulse_weekend_pattern'},
            'momentum': {'weight': 3.0, 'risk_direction': 'above_anchor',
                         'insight_key': 'impulse_hot_week'},
            'anomaly': {'weight': 2.5, 'risk_direction': 'above_anchor',
                        'insight_key': 'impulse_big_buy'},
            'lifestyle_share': {'weight': 1.5, 'risk_direction': 'above_anchor',
                                'insight_key': 'impulse_lifestyle_creep'},
            'savings_rate': {'weight': 1.5, 'risk_direction': 'below_anchor',
                             'insight_key': 'impulse_savings_slip'},
            'runway': {'weight': 1.0, 'risk_direction': 'below_anchor',
                       'insight_key': 'impulse_thin_cushion'},
        },
        'praise': [
            {'signal': 'momentum', 'when_band': ['calm'],
             'insight_key': 'impulse_quiet_week_praise'},
            {'signal': 'weekend_ratio', 'when_band': ['calm'],
             'insight_key': 'impulse_steady_weekend_praise'},
        ],
        'interventions': ['cooling_off', 'precommitment_smart', 'fresh_start_commit'],
        'vulnerability': ['weekend', 'late_night'],
    },
    1: {  # The Anxious Planner - the proof case: their risks are others' successes
        'mechanism': 'scarcity_vigilance',  # evidence-base 4.5 money vigilance (framing); S1
        'klontz_frame': 'money_vigilance',
        'tone': 'reassuring, permission-granting, gentle',
        'watch': {
            'savings_rate': {'weight': 3.0, 'risk_direction': 'above_anchor',
                             'insight_key': 'anxious_oversaving'},
            'lifestyle_share': {'weight': 3.0, 'risk_direction': 'at_anchor',
                                'value_lt': 0.15,  # deprivation: below ~P10
                                'insight_key': 'anxious_deprivation'},
            'runway': {'weight': 1.0, 'risk_direction': 'above_anchor',
                       'insight_key': 'anxious_hoarded_buffer'},
        },
        'praise': [
            {'signal': 'lifestyle_share', 'when_band': ['calm', 'note'],
             'when_value_gt': 0.15,
             'insight_key': 'anxious_balance_praise'},
            {'signal': 'runway', 'when_band': ['note', 'calm'],
             'insight_key': 'anxious_secure_praise'},
        ],
        'interventions': ['permission_reframe', 'tie_to_income', 'fresh_start_commit'],
        'vulnerability': ['post_spike_anxiety'],
    },
    2: {  # The Blind Investor
        'mechanism': 'overconfidence_illiquidity',  # S6/S7 CFPB buffer; evidence-base 4 overconfidence
        'klontz_frame': 'money_status',
        'tone': 'competence-respecting, data-forward',
        'watch': {
            'runway': {'weight': 3.0, 'risk_direction': 'below_anchor',
                       'insight_key': 'blind_thin_runway'},
            'anomaly': {'weight': 1.5, 'risk_direction': 'above_anchor',
                        'insight_key': 'blind_big_position'},
            'savings_rate': {'weight': 1.5, 'risk_direction': 'below_anchor',
                             'insight_key': 'blind_cashflow_leak'},
            'momentum': {'weight': 1.0, 'risk_direction': 'above_anchor',
                         'insight_key': 'blind_hot_week'},
        },
        'praise': [
            {'signal': 'runway', 'when_band': ['note', 'calm'],
             'insight_key': 'blind_buffer_built_praise'},
        ],
        'interventions': ['liquidity_first', 'buffer_gradient', 'precommitment_smart'],
        'vulnerability': ['market_event'],
    },
    3: {  # The Survivalist
        'mechanism': 'fixed_cost_trap',  # evidence-base 4.4 scarcity bandwidth / sinking funds
        'klontz_frame': 'money_avoidance',
        'tone': 'steady, practical, small-wins',
        'watch': {
            'runway': {'weight': 3.0, 'risk_direction': 'below_anchor',
                       'insight_key': 'survivalist_no_cushion'},
            'landmark': {'weight': 2.5, 'risk_direction': 'at_anchor',
                         'insight_key': 'survivalist_spike_ahead'},
            'savings_rate': {'weight': 2.0, 'risk_direction': 'below_anchor',
                             'insight_key': 'survivalist_dissaving'},
            'anomaly': {'weight': 1.5, 'risk_direction': 'above_anchor',
                        'insight_key': 'survivalist_shock_spend'},
            'momentum': {'weight': 1.0, 'risk_direction': 'above_anchor',
                         'insight_key': 'survivalist_hot_week'},
        },
        'praise': [
            {'signal': 'savings_rate', 'when_band': ['note', 'calm'],
             'insight_key': 'survivalist_headroom_praise'},
            {'signal': 'momentum', 'when_band': ['calm'],
             'insight_key': 'survivalist_steady_praise'},
        ],
        'interventions': ['sinking_fund', 'micro_setaside', 'fresh_start_commit'],
        'vulnerability': ['spike_window'],
    },
}
