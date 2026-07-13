# API Contract — POST /insights

> Handoff for the frontend engineer (decision D4). Backend: `mowzoon/api.py` route
> `insights_post`, composing `delivery.py` over the signal, matching and gamification layers. The legacy
> `GET /insights` is unchanged and keeps working; migrate at your own pace.
> Date: 2026-07-13.

## Request

```
POST /insights
Content-Type: application/json
```

```json
{
  "archetype": 0,
  "income": 10000,
  "ledger": [
    {"type": "fixed",         "amount": 5500, "date": "2026-07-01"},
    {"type": "discretionary", "amount": 320,  "date": "2026-07-11"},
    {"type": "savings",       "amount": 500,  "date": "2026-07-05"},
    {"type": "spike",         "amount": 3000, "date": "2026-06-20"}
  ],
  "metrics": {"efficiency": 30, "resilience": 45, "eq": 35},
  "today": "2026-07-13"
}
```

| Field | Required | Meaning |
|---|---|---|
| `archetype` | yes | 0 Impulse Spender, 1 Anxious Planner, 2 Blind Investor, 3 Survivalist. Unknown ids return an empty analysis, not an error. |
| `income` | yes | MONTHLY net income, same currency as the ledger. Must be >= 0. Annual or per-paycheck figures will produce wrong ratios; this is the caller's contract. |
| `ledger` | yes (may be empty) | The user's full transaction history in the app schema. **Filter out demo rows before sending** (`t.demo` in the UI store); the backend treats every row as real behavior. |
| `metrics` | no | The three survey scores (0-100). Used only as a fallback voice for users whose ledger is too young to produce insights. Send them when you have them. |
| `today` | no | ISO date. Defaults to server date. Send the device date so weekend detection matches the user's calendar. |

Row-level dirt (unknown `type`, non-positive `amount`, unparseable `date`) does not fail the
request: rows are quarantined and counted in `meta.skipped_rows`. Watch that number; if it is
persistently nonzero you are sending something malformed.

## Response

```json
{
  "nudge": "Weekends are carrying 2.3x their share of your spending right now. ...",
  "signals": [
    {
      "name": "weekend_ratio",
      "value": 2.251,
      "unit": "ratio",
      "band": "high",
      "direction": "above_anchor",
      "evidence": {
        "anchor": "calendar-neutral weekend share (2/7)",
        "percentile_context": ">=P90 of reference population",
        "window": "trailing 56d",
        "weekend_days": "Fri-Sat"
      }
    }
  ],
  "insights": [
    {
      "insight_key": "impulse_weekend_pattern",
      "kind": "risk",
      "score": 9.0,
      "signal": { "... the full signal object above ..." },
      "mechanism": "present_bias",
      "tone": "playful, zero-guilt, momentum-focused",
      "intervention": {"key": "cooling_off", "label": "Cooling-off pause before non-essential buys"},
      "text": "Weekends are carrying 2.3x their share of your spending right now. ..."
    }
  ],
  "quest": {
    "key": "mindful",
    "kind": "days",
    "target": 4,
    "tx_type": null,
    "moment": "vulnerability",
    "insight_key": "impulse_weekend_pattern",
    "rationale": "Weekends are carrying 2.3x their share of your spending right now.",
    "issued_for": "2026-07-13"
  },
  "meta": {"signals_computed": 7, "insights_count": 3, "skipped_rows": 0, "engine": "v1"}
}
```

## Semantics you must handle

**`nudge`** is the drop-in replacement for the legacy GET field: always present, always a
single coach line. If you render nothing else from this response, render this.

**`signals` may be missing entries.** Signals mature progressively; a young account has few.
Absence means "not enough data yet", never zero. Do not render placeholders for absent
signals. Possible names: `savings_rate`, `runway`, `lifestyle_share`, `weekend_ratio`,
`momentum`, `anomaly`, `landmark` (landmark is always present). Bands: `calm`, `note`,
`elevated`, `high` (signal strength, not user blame). Directions: `below_anchor`,
`at_anchor`, `above_anchor`.

**`insights`** is ranked: risks first (highest score first), then at most one praise entry.
May be empty; empty is a legitimate "nothing needs attention" answer. `kind` is `risk` or
`praise`. Praise entries have `intervention: null` and `score: 0`.

**`quest` may be null, and null is an instruction:** keep whatever quest the user already
has; do not clear or regenerate. When non-null, the spec is measurable with the existing
`game.js` machinery: `kind` is one of `days` (distinct days with any log since `issued_for`),
`count` (number of transactions of `tx_type`), `money` (sum of amounts of `tx_type`);
`tx_type` is `discretionary`, `savings`, or null (null = any log counts). Keys are the
existing quest ids (`mindful`, `treat`, `buffer`, `setaside`), so current i18n copy resolves;
`rationale` is new display copy explaining why this quest today.

**Adoption rule (important — quests are proposals, not commands):** a non-null spec is the
backend's proposal for the user's NEXT quest slot. Adopt it only when there is no active
quest, or the active quest is finished/collected, or the weekly cadence has rolled over
(compare `issued_for` week vs the active quest's `startedISO` week). Never replace an
in-flight quest with a new spec: signals move as the user logs, so the day's proposal can
change mid-week, and clobbering an in-progress quest breaks progress and the streak loop.
The backend is stateless by design; quest lifecycle (start date, progress, completion) is
yours, exactly as it is with the current static quest table. Progress needs no server:
measure from your ledger since `startedISO`, as `questProgress` already does.

**`quest.moment`** is `opportunity` (fresh-start landmark near: good day for commitments),
`vulnerability` (weekend for archetype 0, spike window for archetype 3: render gently), or
`neutral`.

## Worked degradation table

| User state | signals | insights | quest | nudge source |
|---|---|---|---|---|
| Brand new (empty ledger) | landmark only | [] | null | legacy metrics line if `metrics` sent, else a planning line |
| 2-3 weeks of logs | 3-4 signals | usually [] or praise | null unless fresh start near | same as above |
| Mature, healthy | most signals | praise only | null on most days | praise text |
| Mature, with risks | most signals | 1-2 risks + praise | quest tied to top risk | top risk text |

## Errors

422 only for structurally invalid JSON (missing required field, negative income, wrong
types at the top level). Everything else answers 200 with honest emptiness rather than
erroring: unknown archetype, empty ledger, all-dirty rows.
