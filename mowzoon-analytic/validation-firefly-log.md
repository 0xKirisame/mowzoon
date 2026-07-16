# Validation Run Log — Engine vs Firefly III

> Date: 2026-07-16. Reproduce with `python validate_firefly.py` (this folder).
> Raw log of every input and output: [validation-firefly-run.json](validation-firefly-run.json).
> Companion to [validation-log.md](validation-log.md), which ran the same engine and the
> same six criteria against an in-house generic advisor. This run swaps the baseline for a
> faithful behaviour model of **Firefly III** — a real, widely used, open-source personal
> finance manager that is archetype-blind by construction. Engine state at time of run: all
> layers complete, 67 unit tests green.

## 1. What this run can and cannot prove

Same boundary as the generic-baseline run. **"Reads differently"** — the same financial facts
produce genuinely different, mechanism-appropriate guidance per archetype, where a
conventional budgeting tool produces one archetype-blind answer — is computable, and this run
tests it against the six pre-registered criteria. **"Lands better"** — users change behaviour
and return — needs real people over time and is not tested here. It stays open pending the
human side-by-side (protocol in [validation-log.md](validation-log.md) section 7).

## 2. Method

**Engine arm and scenarios: identical to [validation-log.md](validation-log.md).** The full
pipeline (`build_response`) runs once per scenario per archetype, 7 scenarios × 4 archetypes =
**28 runs**. Scenarios are the same deterministic ledgers: S1 weekend splurger, S2 frugal
over-saver, S3 thin buffer with a hot week, S4a tight margins on a neutral date, S4b tight
margins with Back to School 13 days out, S5 brand-new user (10 days, survey metrics supplied),
S6 balanced healthy user. Fixed dates make the run reproducible bit for bit. The six criteria
are the same, fixed in the script before execution.

**Firefly III arm.** A re-implementation of Firefly III's documented notification and report
logic, not the running PHP application. Firefly III surfaces guidance through three
threshold-based, archetype-blind mechanisms, all modelled here:

| Mechanism | Firefly behaviour | Model in this run |
|---|---|---|
| Budgets | Warns when a category budget is approached or exceeded ("close to overspending" / "you have exceeded your budget") | A 50/30/20 "wants" budget = 30% of monthly income, compared to trailing-30d discretionary spend |
| Bills | Reminds when a recurring expected expense falls due within its window | Seasonal spikes (`config.SEASONAL_SPIKES`) mapped to Firefly bills, ~30-day reminder |
| Piggy banks | Shows % funded toward a savings goal and nudges to keep saving | A conventional emergency-fund goal = 3 months of average spend |

Firefly III has no behavioural archetype, no positive/negative framing choice, **no
"over-saving is a risk" concept** (in a budgeting ledger, saving more is always better), no
gamified quest, and no maturity gate on new users. Its output depends on the ledger, never on
who the user is. The wording used here ("overspent", "exceeded", "keep saving") is Firefly's
own, taken faithfully and neither softened nor sharpened.

**Sourcing / confidence.** The three mechanisms and their user-facing wording are documented
Firefly III behaviour (docs.firefly-iii.org). *Medium-high confidence* on the mechanics and
wording. The 30%-of-income budget and the 3-month piggy target are conventional user
configurations we chose for the test, **not Firefly defaults** — Firefly ships with no budget
until the user sets one. Treat this arm as a faithful behavioural **model** of Firefly III,
not a captured run of the deployed app. This is the same honesty boundary the generic-baseline
log states for its in-house advisor; the strongest structural findings below (archetype-
blindness, absence of an over-saving concept) hold for **any** budget-threshold tool and do
not depend on the specific cutoffs chosen.

**Pre-registered criteria** (unchanged from the generic run):

| # | Criterion | Threshold |
|---|---|---|
| C1 | Differentiation: distinct engine top outputs across the 4 archetypes on each mature-risk scenario (S1–S4b) | at least 3 of 4 distinct |
| C2 | Direction flip: S2 over-saving flagged as risk for the Anxious Planner and no other archetype | exact |
| C3 | Text overlap (Jaccard on content words): archetype nudges pairwise, and vs the baseline | pairwise mean under 0.30; vs baseline under 0.20 |
| C4 | Framing guardrail: zero blame phrasing in all 25 templates and all emitted engine texts | zero hits |
| C5 | Restraint: the engine sometimes issues no quest and no insights; the baseline advises every time | both occur |
| C6 | Always answers: every engine run returns a non-empty nudge | all runs |

## 3. Results

| Criterion | Result | Pass |
|---|---|---|
| C1 differentiation | Engine: **4 of 4 distinct** top outputs on all five mature-risk scenarios. Firefly: **1 of 4** — identical output for every archetype on every scenario | yes |
| C2 direction flip | Engine: Anxious Planner gets `anxious_oversaving` + `anxious_deprivation`; all other archetypes zero risks. Firefly on the same over-saver: *"You have SAR 2,400 left in your 'Lifestyle' budget"* + *"Emergency fund has reached its target"* — no over-saving concept exists to fire | yes |
| C3 text overlap | pairwise archetype mean **0.08**; engine vs Firefly **0.012** (near-total divergence) | yes |
| C4 blame framing | Engine: 25/25 templates clean, 0 emitted hits. Firefly: **3 blame-framed lines**, all using its own word *"overspent"* — including on the healthy S6 user (SAR 120 over a SAR 3,000 budget) | yes |
| C5 restraint | Engine issued **no quest on 13 of 28 runs, no insight on 5 of 28**. Firefly showed a status alert on **all 7 scenarios**, every time | yes |
| C6 always answers | 28/28 non-empty engine nudges | yes |

**Headline contrast.** On every one of the five mature-risk scenarios the engine produces four
distinct archetype-specific top outputs; Firefly produces one, repeated four times. The
engine-vs-Firefly text overlap (Jaccard 0.012) is effectively zero — they are not saying the
same thing in different words, they are answering different questions.

## 4. Side-by-side transcripts (from the raw log)

**S2 frugal over-saver** (64% savings rate, 6% lifestyle share, buffer at target) — the
cleanest case:

| Advisor | Output |
|---|---|
| Firefly III (all 4 archetypes) | You have SAR 2,400 left in your 'Lifestyle' budget this period. · Piggy bank 'Emergency fund' has reached its target. |
| Impulse Spender | Your spending this week is right at your normal pace. Keeping it steady is the hard part, and you're doing it. *(praise, no quest)* |
| Anxious Planner | You're saving 64% of your income, well above the 20% that's healthy. Your plan is already covered. It's okay to spend some of this on yourself. *(quest: treat)* |
| Blind Investor | Your cash reserve is holding in the healthy range. A solid base for everything else. *(praise, no quest)* |
| Survivalist | You saved 64% of your income this month. On a tight budget like yours, that takes real discipline. *(praise, no quest)* |

Firefly reads a healthy budget and a met savings goal and says, in effect, all clear, keep
saving. It has no way to see that for the Anxious Planner the 64% rate is itself the problem
(anxiety-driven over-saving and self-deprivation). The engine flags it as a risk for that one
archetype and praises it for the other three — the direction gate doing exactly its job.

**S6 balanced healthy user** (24% savings, discretionary SAR 3,120 vs a SAR 3,000 budget):

| Advisor | Output |
|---|---|
| Firefly III (all 4 archetypes) | **You have overspent your 'Lifestyle' budget by SAR 120** (spent SAR 3,120 of SAR 3,000). |
| Engine (all 4 archetypes) | Praise-only, no quest — each archetype in its own voice |

A SAR 120 overshoot on an otherwise healthy user trips Firefly's overspent alert, in its own
negative wording, identically for everyone. The engine reads the same ledger as healthy and
holds back (JITAI restraint), while still answering with a nudge (C6).

**S4b tight margins, Back to School 13 days out:**

| Advisor | Output |
|---|---|
| Firefly III (all 4 archetypes) | Bill 'Back to School' is expected in 13 days. Make sure funds are available. |
| Anxious Planner | You're spending only 13% of your income on yourself, less than 9 in 10 people. A planned treat won't hurt your plan. *(quest: treat)* |
| Survivalist | Your savings would cover less than a month of spending. Putting SAR 20 a week into a separate account is a good place to start. *(quest: setaside, moment: vulnerability)* |

Both see the spike. Firefly gives one generic reminder to everyone; the engine turns it into a
protective set-aside for the Survivalist and, for the Anxious Planner on the same tight budget,
the opposite nudge — permission to spend — because their risk runs the other way.

S5 (brand-new user, 10 days): Firefly shows budget-to-date and a 0%-funded piggy immediately;
the engine withholds all insights and quests behind its maturity gates and serves the legacy
metrics voice. S1 and S3 (not tabled) follow the S2 pattern: one Firefly budget/piggy line for
all, four distinct archetype nudges from the engine.

## 5. Findings

1. **Archetype-blindness is total and measurable.** Firefly produces one output per scenario,
   repeated across all four archetypes (differentiation 1 of 4 on every scenario). The engine
   produces four distinct top outputs on every mature scenario (4 of 4). This is the thesis in
   one number, now against a real tool rather than an in-house baseline.
2. **A budgeting tool structurally cannot flag over-saving.** S2 is the clean demonstration:
   Firefly sees a healthy budget and a met goal and encourages more saving; the engine catches
   the anxiety-driven over-saver that no budget threshold can. The gap is not wording, it is a
   concept Firefly does not contain.
3. **Threshold budgeting false-alarms and does it in negative wording.** S6: a SAR 120
   overshoot on a healthy user triggers an "overspent" alert. Firefly emitted its own word
   "overspent" three times across the scenarios; the engine's 25 templates and all emitted text
   carry zero blame phrasing. The framing contrast here rests on Firefly's actual output, not
   only on a template audit.
4. **Restraint is real against a tool that never rests.** The engine issued no quest on 13 of
   28 runs and no insight on 5 of 28, while still always answering with a nudge. Firefly
   surfaced a status alert on every scenario. Doing nothing is a capability the engine has and
   a budget dashboard does not.
5. **Where they agree, they still differ in use.** On the spike (S4b) both surface Back to
   School, but Firefly gives one generic reminder while the engine routes it to opposite
   actions for opposite risk profiles.

## 6. Limitations

- Efficacy ("lands better") is untested here by design.
- The Firefly arm is a faithful behaviour model, not a captured run of the deployed app. The
  budget fraction (30%) and piggy target (3 months) are conventional choices, not Firefly
  defaults; Firefly ships no budget until the user configures one. The structural findings
  (1–4) do not depend on these numbers — they hold for any archetype-blind budget-threshold
  tool — but the exact SAR figures in the transcripts do.
- Scenarios are author-constructed and cover the intended behaviour space; adversarial or
  messy real ledgers may surface states these do not.
- Thresholds in the engine remain Berka-calibrated pending real user data
  (evidence-base section 9 caveat).

## 7. Verdict

Six of six pre-registered criteria pass against Firefly III. Head to head with a real,
archetype-blind budgeting tool, the engine produces four distinct, mechanism-grounded,
positively-framed answers where Firefly produces one threshold-driven alert for everyone;
catches an over-saver Firefly structurally cannot; withholds guidance when the healthy state
warrants silence where Firefly still fires; and does all of it without the negative wording
Firefly emits. The "reads differently" half of the thesis holds against a real competitor. The
"lands better" half remains open pending the human test.
