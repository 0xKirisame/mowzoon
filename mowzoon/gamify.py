"""
Mowzoon - L3 gamification brains.

Picks and parameterizes the daily quest from the top L2 insight plus the L1
signals, classifies the moment (JITAI opportunity / vulnerability / neutral),
and knows when to issue nothing. Stateless: streaks, drops, levels and quest
progress stay client-side in the UI's game economy (game.js), which measures
progress in three kinds only: days, count, money. Keys and targets reuse the
UI's existing quest vocabulary so the frontend adapter stays thin.

Design doc: mowzoon-analytic/gamify-design.md
"""

from datetime import date, datetime

import config

# Fresh-start opportunity window and spike vulnerability window, in days.
OPPORTUNITY_FRESH_DAYS = 3
VULNERABILITY_SPIKE_DAYS = 14

# Saudi weekend, Monday=0 indexing (matches signals.WEEKEND_DAYS).
WEEKEND_DAYS = (4, 5)

# Quest shapes anchored to the existing UI economy (game.js QUESTS + i18n keys).
# key: (kind, target, tx_type)
QUEST_SHAPES = {
    'mindful': ('days', 4, None),
    'treat': ('count', 1, 'discretionary'),
    'buffer': ('money', 100, 'savings'),
    'setaside': ('money', 20, 'savings'),
}

# Archetype default quest (same assignment the static UI table uses today).
ARCHETYPE_DEFAULT_QUEST = {0: 'mindful', 1: 'treat', 2: 'buffer', 3: 'setaside'}

# Intervention key -> quest key. SMarT-family interventions are commitment
# framings of the archetype default, not a different verb, so they map to None
# and fall back to ARCHETYPE_DEFAULT_QUEST.
INTERVENTION_QUEST = {
    'cooling_off': 'mindful',
    'permission_reframe': 'treat',
    'liquidity_first': 'buffer',
    'buffer_gradient': 'buffer',
    'sinking_fund': 'setaside',
    'micro_setaside': 'setaside',
    'precommitment_smart': None,
    'tie_to_income': None,
    'fresh_start_commit': None,
}


def _parse_day(value):
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    return datetime.strptime(str(value)[:10], "%Y-%m-%d").date()


def _landmark_evidence(signals):
    for s in signals:
        if s.get('name') == 'landmark':
            return s.get('evidence') or {}
    return {}


def classify_moment(archetype_id, signals, today):
    """JITAI moment for this decision point: vulnerability > opportunity > neutral."""
    profile = config.ARCHETYPE_PROFILES.get(archetype_id) or {}
    vulnerability = profile.get('vulnerability', [])
    evidence = _landmark_evidence(signals)
    spike = evidence.get('next_spike') or {}
    fresh = evidence.get('next_fresh_start') or {}

    if 'weekend' in vulnerability and today.weekday() in WEEKEND_DAYS:
        return 'vulnerability', {'context': 'weekend'}
    if 'spike_window' in vulnerability and spike.get('days', 999) <= VULNERABILITY_SPIKE_DAYS:
        return 'vulnerability', {'context': 'spike', 'event': spike.get('event'),
                                 'days': spike.get('days')}
    if fresh.get('days', 999) <= OPPORTUNITY_FRESH_DAYS:
        return 'opportunity', {'context': 'fresh_start', 'event': fresh.get('event'),
                               'days': fresh.get('days')}
    return 'neutral', {}


def _rationale_from_insight(insight):
    text = insight.get('text', '')
    first = text.split('. ')[0].strip()
    return first + ('.' if first and not first.endswith('.') else '')


def _fresh_start_rationale(ctx):
    days = ctx.get('days')
    if days == 0:
        return "A new month starts today. A good moment to start putting a little into savings."
    return f"A new month starts in {days} days. A good moment to start putting a little into savings."


def gamify(insight, archetype_id, signals, today):
    """Pick today's quest, or return None (a legitimate, evidence-backed choice).

    insight: top result of match_insights (risk preferred), or None.
    Returns a QuestSpec dict per the gamify design doc, or None.
    """
    if archetype_id not in config.ARCHETYPE_PROFILES:
        return None
    today = _parse_day(today)
    moment, ctx = classify_moment(archetype_id, signals, today)

    quest_key = None
    insight_key = None
    rationale = None

    if insight is not None and insight.get('kind') == 'risk':
        insight_key = insight.get('insight_key')
        intervention = (insight.get('intervention') or {}).get('key')
        quest_key = INTERVENTION_QUEST.get(intervention) or ARCHETYPE_DEFAULT_QUEST[archetype_id]
        if insight_key == 'survivalist_spike_ahead' and ctx.get('event'):
            rationale = (f"{ctx['event']} is {ctx['days']} days away. If you save a little "
                         "each week from now, you won't have to find it all at once.")
        else:
            rationale = _rationale_from_insight(insight)
    elif moment == 'opportunity':
        # No risk today, but a fresh start is near: issue the archetype default
        # as a commitment quest (Fresh Start Effect, S27/S28).
        quest_key = ARCHETYPE_DEFAULT_QUEST[archetype_id]
        rationale = _fresh_start_rationale(ctx)
    else:
        # Praise alone or nothing at all: no new quest. Restraint is the
        # JITAI-backed default; the UI keeps its current quest.
        return None

    kind, target, tx_type = QUEST_SHAPES[quest_key]
    return {
        'key': quest_key,
        'kind': kind,
        'target': target,
        'tx_type': tx_type,
        'moment': moment,
        'insight_key': insight_key,
        'rationale': rationale,
        'issued_for': today.isoformat(),
    }
