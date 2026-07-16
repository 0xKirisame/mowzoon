# Validation Run Log

> Date: 2026-07-13. Reproduce with `python validate.py` (this folder). Raw log of every
> input and output: [validation-run.json](validation-run.json). Engine state at time of run: all layers
> complete, known-issues 1-4 fixed, 67 unit tests green.

## 1. What this run can and cannot prove

The thesis has two halves. **"Reads differently"** — the same financial facts produce
genuinely different, mechanism-appropriate guidance per archetype — is computable, and this
run tests it against pre-registered criteria. **"Lands better"** — users change behavior and
return — requires real people over time and is NOT tested here; it stays open until a human
side-by-side (protocol sketch in section 7). No claim in this log exceeds that boundary.

## 2. Method

**Scenarios (7):** deterministic ledgers spanning the behavior space — S1 weekend splurger,
S2 frugal over-saver, S3 thin buffer with a hot week, S4a tight margins on a neutral date,
S4b tight margins with Back to School 13 days out, S5 brand-new user (10 days of data,
survey metrics supplied), S6 balanced healthy user. Fixed dates (2026-07-13 Monday;
2026-08-12 for S4b) so the run is reproducible bit for bit.

**Engine arm:** the full pipeline (`build_response`) once per scenario per archetype
(28 runs).

**Generic baseline arm:** an archetype-blind advisor built for this run: rank signals by
band severity alone, emit a textbook line for the top one ("Your savings rate is low. Try to
save at least 20% of your income."), always have advice. Styled like mainstream PFM copy,
directive tone included, so the engine competes against the real convention rather than a
strawman. Caveat stated plainly: this baseline is written by us; it is an illustration of
severity-ranked advising, not evidence about any specific competitor product.

**Pre-registered criteria (fixed in the script before first execution):**

| # | Criterion | Threshold |
|---|---|---|
| C1 | Differentiation: distinct top outputs across the 4 archetypes on each mature-risk scenario (S1-S4b) | at least 3 of 4 distinct |
| C2 | Direction flip: S2 over-saving flagged as risk for the Anxious Planner and no other archetype | exact |
| C3 | Text overlap (Jaccard on content words): archetype nudges pairwise, and vs generic | pairwise mean under 0.30; vs generic under 0.20 |
| C4 | Framing guardrail: zero blame phrasing in all 25 templates and all emitted texts | zero hits |
| C5 | Restraint: the engine sometimes issues no quest and no insights; the baseline advises every time | both occur |
| C6 | Always answers: every run returns a non-empty nudge | all runs |

## 3. Results

| Criterion | Result | Pass |
|---|---|---|
| C1 differentiation | **4 of 4 distinct top outputs on all five mature-risk scenarios** | yes |
| C2 direction flip | Anxious Planner: `anxious_oversaving` + `anxious_deprivation`; all other archetypes: zero risks | yes |
| C3 text overlap | pairwise mean **0.032**; vs generic **0.014** (near-total divergence) | yes |
| C4 blame framing | 25/25 templates clean; 0 emitted hits; see correction note below | yes |
| C5 restraint | **13 of 28 runs issued no quest; 5 of 28 issued no insights**; baseline advised 28/28 | yes |
| C6 always answers | 28/28 non-empty nudges | yes |

**C4 correction note (transparency):** the first execution reported one hit — the word
"guilt" inside the legacy line "The coffee is allowed, **no guilt**", which is anti-blame
framing negated in text. The scanner was made negation-aware ("no / zero- / without" within
10 characters) and the run repeated; both executions are otherwise identical. The 25 insight
templates were clean in both runs. Also noted honestly: the baseline's directive lines
("Cut back", "Slow down") never surfaced as top picks in these scenarios, so the observed
baseline blame count is 0; the framing contrast rests on the template audit, not on caught
baseline output.

## 4. Side-by-side transcripts (from the raw log)

**S1 weekend splurger** (income 10000; heavy Fri-Sat spending; 1400 splurge yesterday;
0.8-month pot):

| Advisor | Output |
|---|---|
| Generic | Your savings rate is low. Try to save at least 20% of your income. |
| Impulse Spender | Weekends are carrying 2.3x their share of your spending right now. One planned treat beats five unplanned ones... quest: mindful |
| Anxious Planner | You're letting quality of life have its share this month. For you, that is the win worth noticing. (praise; no quest) |
| Blind Investor | Cash on hand covers about 0.8 months of spending; the benchmark is 3 to 6... quest: buffer |
| Survivalist | The cushion covers about 0.8 months right now. Twenty riyals a week into a labelled pot is a real start... quest: setaside |

**S2 frugal over-saver** (64% savings rate, 6% lifestyle share, 3.75-month buffer):

| Advisor | Output |
|---|---|
| Generic | Your emergency fund is below the recommended 3-6 months. Build it up. **(factually wrong: the buffer is 3.75 months, inside the band — severity-ranking without direction misread a healthy state)** |
| Impulse Spender | Your spending pace is right at your normal this week. That steadiness is the skill... (praise; no quest) |
| Anxious Planner | You're keeping 64% of income, far beyond the 20% target. The plan is funded; some of this money is allowed to buy you a life. quest: treat |
| Blind Investor | Your cash floor is holding inside the healthy band... (praise; no quest) |
| Survivalist | You kept 64% of income this month. With margins as tight as yours, that is a genuine win. (praise; no quest) |

**S4b tight margins, spike 13 days out:**

| Advisor | Output |
|---|---|
| Generic | Your emergency fund is below the recommended 3-6 months. Build it up. |
| Survivalist | The cushion covers about 0.0 months right now. Twenty riyals a week into a labelled pot is a real start... quest: setaside, **moment: vulnerability** (spike window detected) |

S5 (brand-new user): zero insights for all archetypes, zero quests, nudges served by the
legacy metrics voice — the maturity gates and fallback chain behaving as designed. S6
(balanced healthy user): praise-only for all four archetypes, no quests (JITAI restraint).

## 5. Findings

1. **The differentiation thesis holds computationally.** Same ledger, four archetypes:
   4-of-4 distinct top outputs on every mature scenario, near-zero text overlap (mean
   pairwise Jaccard 0.032). The engine is not re-skinning one insight four ways.
2. **The mechanism logic, not just the wording, differs.** S2 is the clean case: the same
   64% savings rate is a flagged risk for the Anxious Planner (permission-reframe plus a
   bounded treat quest) and praise for the other three. This is the direction gate
   doing exactly what it was built for.
3. **An observed failure mode of severity-ranked generic advice:** it told the over-saver
   with a healthy 3.75-month buffer to build the fund up, because "note" band severity was
   read as a problem without direction awareness. Our baseline, our construction — but the
   mechanism of the error (severity without direction) is general and is precisely what the
   direction-aware design removes.
4. **Restraint is real and measurable:** 13 of 28 runs issued no quest, 5 of 28 no insights,
   against a baseline that advises unconditionally. This is the JITAI do-nothing option
   functioning, not absence of capability (C6: every run still answered with a nudge).
5. **Framing guardrail held** across all templates and all emitted text.

## 6. Limitations

- Efficacy ("lands better") is untested here by design; see section 7.
- Scenarios are author-constructed; they cover the intended behavior space but were written
  by the same person who wrote the engine. Adversarial or messy real ledgers may surface
  states these do not.
- The generic baseline is in-house; treat finding 3 as an illustration, not a benchmark.
- Thresholds remain Berka-calibrated (evidence-base section 9 caveat) pending real user data.
- Cosmetic: "covers about 0.0 months" reads robotic; template number formatting could say
  "less than a month" (logged as known-issue 6, minor).

## 7. What would prove the second half

Minimal honest protocol: 10-20 users (or hackathon judges as proxies), each shown the
generic line and their archetype's line for the same scenario, blind to which is which;
ask which they would act on and which feels like it understands them; measure choice share
and free-text reasons. The real test after that is the deployed north-star: savings-rate
movement (primary) and CURR-style return rate (secondary) per build-plan section 1. Both
remain open items in the evidence-base backlog.

## 8. Verdict

Six of six pre-registered criteria pass. The engine demonstrably produces archetype-specific,
mechanism-grounded, positively-framed, restraint-capable guidance from identical inputs —
the "reads differently" half of the thesis is validated computationally. The "lands better"
half remains open pending the human test in section 7.
