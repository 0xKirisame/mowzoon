# Mowzoon Guidance Engine — Architecture

> The one-document explanation of how the engine works: what runs where, what flows between
> the layers, and where every number comes from. Written 2026-07-13, at engine completion
> (engine complete, 67 tests green). Deeper rationale per layer lives in
> [plans/](plans/); the research behind every design choice lives in
> [evidence-base.md](evidence-base.md).

## 1. What this engine is

A stateless analysis-and-guidance pipeline for the Mowzoon app. Input: a user's archetype
(from the classifier, which we do not own) plus their transaction ledger and monthly income.
Output: graded financial signals, ranked archetype-specific insights, one quest (or
deliberately none), and a single coach line. The design bet, validated computationally in
[validation-log.md](validation-log.md): the same financial facts should produce
genuinely different, mechanism-appropriate guidance depending on who the user is.

## 2. The flow

```
UI (React, game.js economy)
  |  POST /insights  {archetype, income, ledger[], metrics?, today?}
  v
api.py ............. route + validation only (thin)
  v
delivery.py ........ L4: composes the response, owns the nudge fallback chain
  |
  |-- signals.py ......... L1: ledger -> 7 graded signals        (archetype-blind math)
  |-- engine.py .......... L2: signals + profile -> ranked insights
  |     |-- config.py ......... ARCHETYPE_PROFILES + INTERVENTIONS (the tuning surface)
  |     '-- templates.py ...... 25 coach-voice texts, one per insight key
  '-- gamify.py .......... L3: top insight + moment -> QuestSpec or None
  v
{nudge, signals[], insights[], quest|null, meta}
```

The classifier pipeline (`data_ingestor.py`, `features.py`, `model.py`) is upstream and owned
by another engineer; it assigns the archetype and is never imported by any file above. The
legacy `GET /insights` route still serves the current UI untouched.

## 3. The layers

| Layer | File | Job | Key property |
|---|---|---|---|
| L1 Signals | `signals.py` | Turn the raw ledger into 7 graded measurements | Archetype-blind, pure math, maturity-gated |
| L2 Matching | `engine.py` (module level) + `config.py` + `templates.py` | Read the signals through the archetype's psychology; rank and phrase | All personality logic is config data, not code branches |
| L3 Gamify | `gamify.py` | Turn the top insight into a quest the UI economy can run; classify the moment | Knows when to do nothing |
| L4 Delivery | `delivery.py` + `api.py` | Compose the HTTP response; keep the legacy field alive | Imports nothing from the classifier |

### L1 — signals (the facts)

Seven measurements, each returned as
`{name, value, unit, band, direction, evidence}`:

| Signal | Measures | Matures after |
|---|---|---|
| savings_rate | (income - 30d spend) / income | 28 days of history |
| runway | savings pot / avg monthly spend, in months | 56 days |
| lifestyle_share | 30d discretionary / income | 28 days |
| weekend_ratio | Fri-Sat share of spend vs the calendar-neutral 2/7 | 14 days, 8+ transactions |
| momentum | this week vs own typical nonzero week | 4 nonzero prior weeks |
| anomaly | purchases above the user's own Tukey fence (pre-window history) | 20 transactions |
| landmark | days to next seasonal spike and next fresh start | instantly |

`band` grades strength on calm / note / elevated / high, using thresholds derived from 4,417
real accounts ([berka-profiling.md](berka-profiling.md)) blended with normative anchors (CFPB
3-6 month buffer, the 20% savings norm). `direction` says which side of the healthy zone the
value sits (below_anchor / at_anchor / above_anchor) — band measures how far, direction says
which way, and the split is what makes layer 2 possible. `evidence` carries the anchor name
and the user's percentile in the reference population, so every judgment travels with its
receipt. An immature signal is absent, never faked.

### L2 — matching (the meaning)

`match_insights(signals, archetype_id)` scores each signal against the archetype's profile in
`config.ARCHETYPE_PROFILES`. A watch rule fires only when the signal's direction matches the
rule's risk direction — the **direction gate**, which is how the same 64% savings rate is a
flagged risk for the Anxious Planner (over-saving) and praise material for everyone else.
Priority = band score (calm 0 to high 3) x rule weight, with two documented special cases:
rules that fire in generically-calm states floor at "elevated" (otherwise the Anxious
Planner's defining risks could never rank), and landmark rules fire only inside a 30-day
spike window. Output: top 2 risks plus at most one praise, each rendered through
`templates.py` and carrying its mechanism, tone, and evidence-cited intervention. An empty
list is a valid answer.

### L3 — gamify (the action)

`gamify(top_insight, archetype_id, signals, today)` maps the insight's intervention to a
quest the UI already knows how to measure (keys mindful / treat / buffer / setaside; kinds
days / count / money), and classifies the JITAI moment: weekend vulnerability for the Impulse
Spender, spike-window vulnerability for the Survivalist, fresh-start opportunity within 3
days, else neutral. Praise-only days produce no quest unless a fresh start is near. Returning
None instructs the UI to keep its current quest. Guardrails are pinned by tests: money quests
only ever point at savings; the treat quest is the single bounded exception (count 1,
archetype 1 only, documented in [plans/gamify-design.md](plans/gamify-design.md)
section 4).

### L4 — delivery (the answer)

`build_response` runs L1, L2, L3 in order and assembles the payload. The legacy `nudge`
string is always present via a three-step fallback: top insight text; else the old
per-archetype metrics line when the ledger is too young and survey metrics were sent; else a
planning line built from the landmark signal. Frontend contract with worked examples and a
degradation table: [api-contract.md](api-contract.md).

## 4. Statelessness and ownership boundaries

Every request carries the full ledger; the backend computes from scratch and stores nothing.
Game state (drops, levels, streaks, quest progress) lives client-side in `game.js`. The
classifier is a black box that hands us an archetype. Consequence: any layer can be re-run,
tested, or replaced in isolation, and the same inputs always produce the same outputs (pinned
by determinism tests in every suite).

Two consequences of statelessness worth understanding rather than fearing:
- **Quest stability.** Within a day, identical inputs give the identical quest (pure
  function). Across days the proposal can change as the ledger moves, so the contract defines
  an adoption rule: a QuestSpec is a proposal for the next quest slot, and the UI never
  replaces an in-flight quest (api-contract.md, "Adoption rule"). Lifecycle is the UI's.
- **Quest progress.** Needs no server state: the UI measures progress from its own ledger
  since the quest's start date, exactly as the pre-engine static quests did. The ledger is
  the state; everything else is derived.

## 5. Where the numbers come from, and how to change them

Every threshold is a named constant in `signals.py` traceable to the Berka profiling study
([berka-profiling.md](berka-profiling.md), raw percentiles in
[thresholds.json](thresholds.json)). When real user data replaces the Berka
calibration, re-run the profiling script on the new ledger population and update the constants;
no logic changes. Archetype behavior is tuned in `config.ARCHETYPE_PROFILES` (weights,
directions, cutpoints) and `templates.py` (copy) — both data, both guarded by schema tests.

## 6. Test map

All suites live in `mowzoon/tests/`; run each with `python tests/test_<name>.py` from the
backend folder. 67 tests total.

| Suite | Guards |
|---|---|
| test_signals.py (17) | Band edges, maturity gates, direction logic, Saudi weekend, dirty-row tolerance, determinism |
| test_profiles.py (8) | Profile schema integrity, praise-only-on-healthy-bands (the Robinhood pin), the Anxious-Planner direction inversion |
| test_matching.py (15) | The proof case (same signals, different archetypes), ranking, praise suppression, landmark window, template completeness |
| test_gamify.py (18) | Quest selection, moment classification, restraint, the treat-quest boundary, UI-vocabulary compliance |
| test_delivery.py (9) | Response shape, nudge fallback chain, restraint path, skipped-row surfacing, JSON serializability |

## 7. Document map

| Where | What |
|---|---|
| [plans/](plans/) | The build plan (locked decisions D1-D8) and the five component design docs with rationale and trade-offs |
| [evidence-base.md](evidence-base.md) | The research behind every design choice, source register, corrections log |
| [berka-profiling.md](berka-profiling.md) + [figures/](figures/) | Threshold derivation study and its charts |
| [api-contract.md](api-contract.md) | Frontend handoff for POST /insights |
| [validation-log.md](validation-log.md) + `validate.py` | The validation run (6 of 6 criteria) and the script to reproduce it |
| [known-issues.md](known-issues.md) | Review findings: 1-4 fixed, 5 open by design, 6 cosmetic |
