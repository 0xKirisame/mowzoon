# Mowzoon — Evidence Base ("The Truth")

> A living, analytical record of the statistics, research, and reasoning behind our product
> decisions. Every load-bearing claim is tagged with a **source** and a **confidence flag**
> so we never overstate what is actually proven.
>
> **Last updated:** 2026-07-13 · **Maintained by:** design/eng, updated continuously.
> **Rule of the file:** if a design choice isn't backed by something in here, it's a
> *hypothesis* — and we label it as one.

---

## Summary — what we actually know

1. **Analyzing spending is commoditized; changing it is not.** Don't compete on categorization. *(§2–3)*
2. **Most budgeting apps fail at behavior change** — retention collapses within weeks and budgeting shows no proven spending reduction. (The viral "67%" statistics turned out to be blog-laundered — see Corrections below.) *(§3)*
3. **The theory spine is solid where it counts:** present bias, CFPB well-being thresholds, Save More Tomorrow, mental accounting are robust. **Klontz money-types are framing only** — the 4-factor structure failed independent testing. *(§4)*
4. **Gamification works *if* aimed at the right behavior** — real savings gains exist, but Robinhood's $7.5M settlement shows it backfires when it rewards the wrong thing. *(§5)*
5. **Retention is the north-star metric.** If people stop opening the app, nothing else counts. *(§3, §7)*

**Confidence legend:** High = replicated / large-sample / field-tested. Medium = peer-reviewed but limited or contested. Low = vendor/marketing/self-report; hypothesis only.

**Source-hygiene rules** *(added after the 2026-07-13 audit)*:
- Prefer the **version of record**; if we link a preprint/author manuscript, say so.
- Prefer **effect sizes with denominators** over bare percentages.
- Watch for **blog-laundering**: the same number attributed to two different "facts," or a
  marketing blog citing an official body for a claim the official source doesn't contain.
  Verify against the primary source before a stat becomes load-bearing.

### Corrections log
| Date | Claim retracted / corrected | What happened |
|---|---|---|
| 2026-07-13 | ~~"CFPB 2024: 67% rated budgeting apps not helpful"~~ | **Retracted.** Traces only to a marketing blog (S14); CFPB's actual 2024 survey (*Making Ends Meet*) contains no such finding. Same "67%" as the blog's own quit-rate claim — laundered. |
| 2026-07-13 | ~~"67% quit budgeting apps in 30 days" / "Day-30 retention 38%"~~ | **Downgraded to low confidence, unverified.** Blog-only; the 38% figure also conflicts with industry D30 benchmarks (typically single-digit). Direction (poor retention) stands; numbers don't. |
| 2026-07-13 | ~~Duolingo "churn 47%→28%", "CURR moved DAU 5×"~~ | **Replaced with primary numbers** from Duolingo's ex-CPO: DAU **4.5×**/4yrs, **CURR +21%** ≈ **>40%** churn cut in best users, 10-day-streak cliff. Vendor-blog figures appear nowhere in primary sources. |
| 2026-07-13 | SMarT link quality | UCLA link is the **July 2003 author manuscript** (with "[Insert Table X]" placeholders — tables are appended at the end, standard for drafts). Content genuine; canonical version of record added: Thaler & Benartzi (2004), *JPE* 112(S1). Primary effect sizes extracted from full text. |

---

## Contents

- **Part I — Strategy:** [1. Thesis](#1-thesis) · [2. Market is commoditized](#2-the-analysis-layer-is-commoditized) · [3. The behavior-change gap](#3-the-behavior-change-gap)
- **Part II — The science:** [4. Theory spine](#4-theory-spine) · [5. Gamification & engagement](#5-gamification--engagement) · [6. Computational methods](#6-computational-methods)
- **Part III — Applying it:** [7. Design principles](#7-design-principles) · [8. Architecture layers](#8-architecture-layers) · [9. Data & scope](#9-data-foundation--scope-boundary) · [10. Research backlog](#10-research-backlog)
- **Part IV — Reference:** [11. Source register](#11-source-register) · [12. Changelog](#12-changelog)

---
# Part I — Strategy
---

## 1. Thesis

**The bet:** the valuable, unsolved layer of personal finance is not *analyzing* spending
(commoditized) but *changing* it — and change works better when guidance is (a) conditioned
on a behavioral archetype, (b) framed positively, (c) oriented toward the future, and
(d) delivered as an engaging game loop rather than a restrictive ledger.

For the bet to hold, two things must be true — both currently supported:
- The *analysis* layer is commoditized, so don't compete there. *(§2)*
- The *behavior-change* layer is unsolved and valuable, worth attacking. *(§3)*

## 2. The "analysis" layer is commoditized

Spending analysis is a large, crowded, commercially-proven market. The **solved** layers —
categorization, dashboards, robo-advice, fraud detection — are *not* where we win.

| Statistic | Value | Conf. |
|---|---|---|
| PFM app market size | ~$166B (2025) to ~$208B (2026); ~$508B by 2030 | Low — vendors disagree wildly; "big and growing" only |
| Cleo (AI money coach) | ~$300M ARR, 1M+ paying subs, ~$137M raised | Medium |
| Copilot budgeting logic | Budgets built from **3–6 months of actual spend** | High — baseline-from-history is table stakes |

**Build implication:** treat categorization as a *solved input*. Differentiate above it.

## 3. The behavior-change gap

The layer we target is popular yet mostly **doesn't work** — the strategic opening.

| Statistic | Value | Conf. |
|---|---|---|
| Effect of budgeting on spending vs. historic | **No reduction**; budgeted categories ~$30 *higher* | Medium — primary case study (Irrational Labs) |
| Budget-info direction | Can *increase* end-of-period spending (backfires) | Medium |
| PF-app retention | Poor — direction well-supported; the viral "67% quit / 38% D30" numbers are blog-only and **retracted** (see Corrections) | Low for the numbers, Medium for the direction |
| Retention w/ trend-viz + sync + contextual AI + goals | Day-90 ~58–64% vs ~22–28% baseline | Low |

> **Note:** the strongest evidence of failure here is not a retention percentage — it's the
> Irrational Labs behavioral result (budgeting-as-usual doesn't reduce spending) plus the
> Duolingo contrast (§5.2): retention *is* winnable, but through game mechanics, not ledgers.

**Three evidence-backed principles fall out (see §7):** positive framing > negative;
planning-first > tracking-first; **retention is the real success metric.**

---
# Part II — The Science
---

## 4. Theory spine

Ordered by weight. **We load the robust theories and treat the shaky taxonomy (Klontz) as
flavor.**

### 4.1 Present bias / hyperbolic discounting (high confidence)
Over-valuing the immediate vs. the future; empirically tied to worse spending, borrowing, and
saving. Decades of experimental support.
**Use:** mechanism behind the Impulse Spender; justifies friction/cooling-off and pre-commitment.

### 4.2 CFPB Financial Well-Being Scale (high confidence) *(our normative anchor)*
US-government instrument, independently **re-validated in 2024 against real household ratios.**
- Emergency-buffer benchmarks: **≥ $2,000** *and* **3–6 months of expenses.**
- Correlates with liquid savings and shock exposure — exactly what our *resilience* score proxies.
**Use:** re-anchor "resilience" and the liquidity-runway signal to these thresholds instead of
the hardcoded 10,000-CZK balance floor currently in `features.py`.
**In-house replication (Berka profiling, 2026-07-13):** on 4,417 real Berka accounts, median runway =
2.8 months and the 3–6-month band spans ~P52–P77 of the population — the normative anchor and the
empirical distribution agree. The 20% savings target sits at ~P70 (ambitious-but-attainable).
Full tables: [berka-profiling.md](berka-profiling.md). (High confidence.)

### 4.3 Save More Tomorrow (Thaler & Benartzi) (high confidence) *(proven intervention)*
Field-tested with **primary effect sizes** (extracted from the full paper text, first
implementation, midsize manufacturing firm):
- **78%** of employees offered the plan joined it.
- **80%** of joiners remained through **four annual pay raises** (only 2% quit before the 2nd).
- Average saving rate rose **3.5% → 13.6% of pay over 40 months** — more than tripling in 28 months.

*(Version-of-record: Thaler & Benartzi (2004), "Save More Tomorrow™," JPE 112(S1), S164–S187.
Our linked PDF is the July-2003 author manuscript — same content, tables appended at the end.)*

Three portable mechanics:
1. Commit **now**, start **later**: beats present bias.
2. Tie increases to **future income** so take-home never drops: beats loss aversion (how we tell
   an Anxious Planner to loosen up without triggering threat).
3. **Default/inertia**: persistence.
**Use:** template family for Impulse Spender & Survivalist; reframing for Anxious Planner.

### 4.4 Mental accounting & sinking funds (Thaler) (high confidence)
Labeling money into purpose "accounts" is a proven lever; justifies **sinking funds against the
seasonal spikes** `engine.py` already forecasts (Eids, back-to-school, insurance).
**Use:** the Survivalist's core intervention.

### 4.5 Klontz Money Scripts (medium-to-low confidence) *(vocabulary, NOT foundation)*
Four money-belief factors (avoidance, worship, status, vigilance) that *suggestively* map to our
archetypes. Handle with care:
- Subscales are **reliable** (α ≈ 0.70–0.86 across studies).
- Built from a **clinical convenience sample**, **self-reported beliefs**, **never validated
  against transaction behavior.**
- A **diverse-sample confirmatory study rejected the four-factor structure** (CFI = .762,
  TLI = .742 — both below the ~.90 bar).

**Use:** interpretive framing & hypothesis generator only — *explicitly labeled as such.* Never
claim our archetypes "are" Klontz types. Our advantage is the inverse of his weakness: we have
**behavioral data**, so we define archetypes behaviorally and lay Klontz on top.

**Archetype ↔ Klontz mapping (hypothesis, Medium):**
| Mowzoon archetype | Klontz script | Predicted behavior |
|---|---|---|
| Impulse Spender | Money Worship / low Vigilance | overspends, weekend spikes |
| Anxious Planner | Money Vigilance | over-saves, deprivation, anxiety |
| Blind Investor | Money Status / Worship | over-risk, thin buffer |
| Survivalist | Money Avoidance | avoids planning, fixed-cost trap |

### 4.6 Psychological targeting (high confidence) *(the keystone for L2: matching works, at scale)*
**Matz, Kosinski, Nave & Stillwell (2017, PNAS)** — three field experiments, **n > 3.5 million**:
persuasive appeals matched to a person's personality produced **up to +40% clicks and +50%
purchases** vs. mismatched or unpersonalized appeals. This is the strongest direct evidence that
**personality-conditioned messaging changes real behavior at scale** — the exact bet our L2 makes.
**Honesty caveats:** the domain was advertising (cosmetics/apps), the traits were Big-Five
extraversion/openness (not money archetypes) — so it's high confidence for *"matching works"* and medium confidence for transfer to
financial archetypes. Our validation run is precisely the transfer test.

### 4.7 Fresh Start Effect (high confidence) *(the "when" dimension)*
**Dai, Milkman & Riis (2014, Management Science):** aspirational behavior spikes after **temporal
landmarks** — new week/month/year, birthdays, holidays — because landmarks open a new "mental
accounting period" and relegate past failures to the old one. Crucially,
**Beshears, Dai, Milkman & Benartzi (2021, OBHDP)** applied it to **retirement savings** — fresh-start
framing nudged real contribution increases. **Use:** don't just pick *which* nudge — pick *when*.
Issue quests/commitments at landmarks: new month, salary day, post-Eid, Hijri new year, birthday.
The seasonal calendar in `engine.py` already exists; extend it from *spike warnings* to
*fresh-start opportunities*. Same infrastructure, second use.

## 5. Gamification & engagement

**The double-edged layer.** Gamification is how retention (§3's north-star) is won — but in
finance it can actively harm users if pointed at the wrong behavior. Both sides are evidenced.

### 5.1 It works — when designed well
| Finding | Value | Conf. |
|---|---|---|
| Gamified PFM apps raise motivation by satisfying **competence & autonomy** needs (Self-Determination Theory); rewards + progress tracking predict proactive financial behavior | peer-reviewed (IJBM) — effect **moderated by app expertise** | Medium |
| Mobile game w/ challenges, badges, interactive messaging | users saved **~25% more** | Medium |
| Engagement / savings uplift (younger users) | +45% engagement, +30% savings | Low — vendor claim |
| Adults more motivated to save with a game-like twist | ~70% | Low — vendor claim |

### 5.2 The mechanics that drive retention (Duolingo, the reference case — **primary sources**)
Numbers below come from Duolingo's ex-CPO (Jorge Mazal) and Duolingo's own engineering blog —
the earlier vendor-blog figures were retracted (see Corrections log):
- Growth simulations showed **CURR** (Current User Retention Rate — will an active user return
  tomorrow?) was the **highest-impact lever** of their whole growth model. (High confidence, primary source.)
- Four years of CURR work: **+21% CURR ≈ >40% reduction in daily churn of their best users**;
  DAU grew **4.5×** over the same period. (High confidence, primary source.)
- **The 10-day-streak cliff:** once a user reaches a 10-day streak, drop-off falls substantially —
  streaks compound motivation daily (loss aversion: don't break the chain). (High confidence, primary source.)
  Concrete L3 target: engineer the first 10-day streak.
- **Variable rewards** (unpredictable timing/magnitude) sustain engagement. (High confidence, established psychology.)
- **Goal-gradient effect** (motivation rises approaching a goal): show progress toward buffers. (High confidence.)

### 5.3 The cautionary tale — Robinhood
- Paid a **$7.5M settlement** (Massachusetts) over "gamification" of trading: **confetti** on first
  trade, free-stock rewards, push prompts. (High confidence, regulatory fact.)
- SEC studied whether rewards/bonuses/push notifications **promote behavior against the user's
  interest** (excessive trading). Active traders saw **~50% higher volatility over 20 yrs**. (High confidence.)
- **Overjustification effect:** extrinsic rewards can *undermine* intrinsic motivation once removed. (High confidence.)

### 5.4 What gamification is actually worth — honest effect sizes (high confidence)
**Sailer & Homner (2020, Educational Psychology Review meta-analysis):** gamification has
significant but **small-to-medium** effects — cognitive **g = .49**, motivational **g = .36**,
**behavioral g = .25** (k=9, N=951; the behavioral effect is the smallest and least stable).
**Read this as a design constraint:** gamification is an **amplifier, not a miracle** — it
multiplies a well-designed intervention (L2) but cannot rescue a bad one. Layer order matters:
substance first, game second.

### 5.5 Prize-linked savings — the strongest "make saving exciting" mechanic (high confidence), with a Saudi caveat
Field evidence that lottery-style rewards attached to *saving* genuinely move deposits:
- PLS introduction raised **total savings ~12 percentage points** on average, funded partly by
  reduced lottery spending and consumption. (High confidence.)
- Mexico (Gertler et al.): even a **2-month** lottery incentive caused a **persistent** increase in
  deposit flow and savings stock. (High confidence.)
- Kenya RCT: positive effects on savings among low-income men. (High confidence.)
- "Save to Win" (US credit unions, since 2009) scaled to multiple states. (High confidence.)

**Sharia-compatibility flag (product/legal decision, not ours to make):** lottery-like
structures raise *maysir/gharar* concerns in the Saudi market. Some Islamic-finance structurings
exist (prizes from provider funds, zero principal risk), but this needs scholarly sign-off.
**Halal-safe default:** keep the *variable-reward psychology* via non-monetary rewards — the
app's existing **drops/badges** economy — and treat monetary PLS as a flagged future option.

### 5.6 Design guardrails (binding on our L3 gamification layer)
1. **Reward the right verb.** Gamify *planning, saving, restraint, buffer-building* — **never
   spending.** (The Robinhood failure mode.)
2. **Feed intrinsic motivation first** (competence/autonomy/relatedness per SDT); use extrinsic
   rewards sparingly to avoid overjustification.
3. **Adopt a CURR-style retention metric** as north-star, not vanity insight counts.
4. **Streaks/goal-gradient toward healthy targets** (e.g. the CFPB 3–6-month buffer), not activity for its own sake.

## 6. Computational methods

| Method | Maturity | Use in Mowzoon |
|---|---|---|
| **Z-score & IQR outlier detection** | High — standard | Anomaly signal: spend deviates from *this user's* baseline. IQR for skewed spend. |
| **Historical behavioral baselining** | High — from fraud detection | The signal layer itself: per-user typical spend/timing/amount. |
| **Prophet / time-series + changepoint** | High | `engine.py` already references Prophet; changepoint adds "regime shift" alerts (lifestyle creep). |
| **Contextual bandits (LinUCB / Thompson)** | High — industry standard | Upgrade path for nudge/quest selection: learn what works per archetype from engagement. Start static, evolve to bandit. |

---
# Part III — Applying It
---

## 7. Design principles *(evidence-derived constraints on the engine)*

Each traces to a section above — these are constraints, not preferences:
1. **Positive framing only** — no "you overspent." *(§3)*
2. **Planning-first / forward-looking** — lead with forecast & set-asides. *(§3)*
3. **Same signal, archetype-specific advice** — the proof conditioning matters. *(§4)*
4. **Deterministic math, generated phrasing** — auditable numbers; only wording is templated/LLM. *(defensibility)*
5. **Gamify the right verb; retention matters.** *(§5.6)*
6. **Right moment, not just right message** — time interventions to fresh-start landmarks and
   JITAI decision points (states of opportunity), not arbitrary schedules. *(§4.7, §8.1)*
7. **Substance first, game second** — gamification amplifies good interventions (g≈.25 behavioral),
   it doesn't rescue bad ones. *(§5.4)*

## 8. Architecture layers

Three layers we build + one thin delivery layer, sitting **downstream of the classifier** (which
we don't own — §9).

```
[ Classifier ] -> L1 Rational -> L2 Archetype/Psych -> L3 Gamification -> L4 Delivery
 (not ours)        (universal      (personalize +         (game loop)        (phrasing,
  archetype +      financial       frame + rank)                             EN/AR, push)
  ledger)          signals)
```

| Layer | Role | In → Out | Theory/algorithms | Off-the-shelf? |
|---|---|---|---|---|
| **L1 Rational** *(archetype-agnostic)* | Objective financial truth from the ledger | ledger → **signals** w/ severity | IQR/Z-score, CFPB thresholds, 50/30/20, Prophet | mostly public |
| **L2 Archetype / Psych** | Interpret signals via archetype: which matter, mechanism, intervention, tone | (signals + archetype) → **ranked framed insights** | present bias, CFPB, SMarT, mental accounting; Klontz framing | our IP (config table) |
| **L3 Gamification** | Turn insight into quest/streak/score-move/reward | insight → **game object** | SDT, variable rewards, goal-gradient, streaks; §5.6 guardrails | frameworks public, loop is ours |
| **L4 Delivery** *(thin)* | Phrasing, EN/AR RTL, channel | game object → **rendered message** | §7.4 | standard |

### 8.1 The modern frame: our pipeline is a JITAI (high confidence)
**Just-in-Time Adaptive Interventions** (Nahum-Shani et al. 2018, *Annals of Behavioral
Medicine*) are the established mHealth architecture for delivering "the right support, at the
right time, adapted to the individual's changing state." Our 4-layer engine maps onto it
one-to-one — which grounds the *whole design* in a peer-reviewed intervention framework instead
of an ad-hoc pipeline:

| JITAI component | Mowzoon equivalent |
|---|---|
| **Distal outcome** | savings-rate movement (our primary success metric) |
| **Proximal outcomes** | weekly quest completion, streak days, score deltas |
| **Decision points** | app open, transaction log, fresh-start landmarks, spike proximity |
| **Tailoring variables** | **L1 signals** + archetype + engagement history |
| **Intervention options** | **L2 insight × L3 game-object** library (incl. "do nothing") |
| **Decision rules** | **L2 matching layer** (config-driven, later bandit-learned) |

Two JITAI concepts worth stealing outright: **states of opportunity** (a fresh-start landmark, a
salary day, a completed quest — moments when receptivity is high) and **states of vulnerability**
(late-night hours for the Impulse Spender, spike-adjacent weeks for the Survivalist). The engine
should classify each decision point as one or the other and choose intervention intensity
accordingly — including the evidence-backed option of **doing nothing** (over-notification kills
receptivity; the JITAI literature is explicit about this).
*(Transfer caveat, medium confidence: JITAI evidence is from health behavior; finance transfer is our hypothesis —
but the framework itself is the peer-reviewed way to structure exactly this kind of system.)*

### 8.2 In-house validation run (2026-07-13) — differentiation half confirmed

Full method, transcripts and raw log: [validation-log.md](validation-log.md)
and [validation-run.json](validation-run.json); reproducible via `validate.py`. Six
pre-registered criteria, six passes:

| Result | Value |
|---|---|
| Distinct top outputs across 4 archetypes, per mature scenario | 4 of 4, on all five scenarios |
| Direction flip (over-saver flagged only for Anxious Planner) | exact |
| Text overlap between archetype outputs (Jaccard) | 0.032 pairwise mean; 0.014 vs generic |
| Blame phrasing in 25 templates + all emitted text | zero |
| Restraint (runs issuing no quest / no insights) | 13 of 28 / 5 of 28; generic baseline advised 28 of 28 |

Confidence: High for what it measures (deterministic, reproducible, criteria fixed before
execution) with the scope caveat stated in the log itself: this validates that guidance
**reads differently and is mechanism-grounded**; whether it **lands better** (behavior
change, retention) requires the human protocol in the log's section 7 and stays open in the
backlog. One incidental observation worth keeping: the severity-ranked generic baseline told
an over-saver with a healthy 3.75-month buffer to build it up — the exact
severity-without-direction error the L2 direction gate removes (illustrative, in-house
baseline, not a competitor benchmark).

## 9. Data foundation & scope boundary

### Ownership boundary *(confirmed 2026-07-13)*
- **Owned by another engineer — we do NOT touch or rebuild:** the classification pipeline
  (`data_ingestor.py`, `features.py`, `model.py`) — K-Means → XGBoost on Berka.
- **What we consume ("its output"):** the **archetype** (id/name, mix) **plus the user's raw
  transaction ledger** (access model **A**). The ledger is app data, not the classifier's private
  output, so using it doesn't cross the boundary.
- **Out of our scope:** validating archetype separability / whether k=4 is justified — that's the
  classifier owner's concern.

### The Berka dataset *(what the ledger is, for now)*
- Real anonymized **Czech bank** data (PKDD'99): ~4,500 accounts, ~1M transactions, ~1996–1998, in
  **koruna**. Real behavior is its strength. (High confidence.)
- **Category reality check:** only reliable split is **Essential (fixed: insurance/household/
  leasing/loan) vs. Lifestyle (other withdrawals) vs. Savings.** The `CATEGORIES` list in
  `config.py` (Dining/Shopping…) is **aspirational — nothing computes it.** No merchant categories
  exist. (High confidence, verified in code.)
- **Underused gold:** transaction `type` (cash vs. transfer) and `date` (weekday/weekend timing —
  which *defines* the Impulse Spender) — both computable, both currently ignored. These are our two
  best new L1 signals.
- **External-validity caveat:** it's foreign, dated, koruna — a **placeholder for a real bank
  feed**, not "Saudi spending truth." Same pipeline would run on a live feed unchanged.

## 10. Research backlog

- [ ] Pull the **Texas Tech / Arizona KMSI-R** paper in full for exact fit stats. *(§4.5)*
- [ ] Confirm the **CFPB $2,000 / 3–6-month** thresholds' original regression source. *(§4.2)*
- [ ] Get **effect sizes** for the Irrational Labs "no reduction" finding (sample, design). *(§3)*
- [ ] Find/verify a **direct study of archetype/personality-conditioned advice vs. generic** — the
      exact thing we claim. The Wiley 2025 "gamification × behavioral traits" paper (S19) is the
      closest; it's paywalled — get full text. *(§4, §5)*
- [ ] **Run the human side-by-side efficacy test** (protocol: validation-log.md section 7)
      — the computational half passed 2026-07-13 (§8.2); "lands better" is the open half. Then
      the deployed north-star: savings-rate movement primary, CURR-style return rate secondary.
- [ ] Source **effect sizes for streaks/variable rewards** beyond the Duolingo case. *(§5.2)*
- [ ] ~~Validate Berka archetype separability~~ — **out of scope** (classifier owner's domain).

---
# Part IV — Reference
---

## 11. Source register

Every source, its key statistic, confidence, and how we use it.

| # | Source | Key claim / statistic | Conf. | Use |
|---|---|---|---|---|
| S1 | [Klontz MSI (JFT 2011)](https://qanr.usu.edu/fcse/files/money-beliefs-and-financial-behaviors-development-the-klontz-money-script-inventory-jft-2011.pdf) | 4 money-belief factors, n=422 clinical | Medium | Archetype framing vocab (§4.5) |
| S2 | [Money Scripts predict behaviors (FPA)](https://www.financialplanningassociation.org/article/journal/NOV12-how-clients-money-scripts-predict-their-financial-behaviors) | belief → behavior link | Medium | Signal→archetype hypothesis |
| S3 | [KMSI-R diverse-sample eval (TTU/Arizona)](https://ttu-ir.tdl.org/items/e81f5ef9-6949-4044-8d90-efe452ceecb9) | 4-factor fit **rejected**: CFI=.762, TLI=.742 | High (critique) | Why we demote Klontz (§4.5) |
| S4 | [KMSI-R reliability (JFT)](https://newprairiepress.org/cgi/viewcontent.cgi?article=1100&context=jft) | subscale α ≈ 0.70–0.86 | Medium | Subscales reliable, structure isn't |
| S5 | [Klontz Money Behavior Inventory](https://www.researchgate.net/publication/249963064_Disordered_Money_Behaviors_Development_of_the_Klontz_Money_Behavior_Inventory) | 8 disordered money behaviors | Medium | Optional severity-ramp vocab |
| S6 | [CFPB Well-Being Scale guide](https://files.consumerfinance.gov/f/201512_cfpb_financial-well-being-user-guide-scale.pdf) | validated FWB measure | High | Normative anchor (§4.2) |
| S7 | [CFPB validated vs household ratios (2024)](https://onlinelibrary.wiley.com/doi/full/10.1002/cfp2.1194) | construct validity; $2k & 3–6mo benchmarks | High | Buffer thresholds (§4.2) |
| S8 | [Save More Tomorrow — author manuscript, July 2003 (UCLA)](https://www.anderson.ucla.edu/documents/areas/fac/accounting/smartjpe226.pdf) · version of record: Thaler & Benartzi (2004), *JPE* 112(S1), S164–S187 | 78% joined; 80% stayed 4 raises; saving rate 3.5%→13.6% in 40mo | High (stats verified against full text) | Intervention templates + effect-size expectations (§4.3) |
| S9 | [Present bias & financial behavior (Xiao & Porto 2019)](https://digitalcommons.uri.edu/cgi/viewcontent.cgi?article=1066&context=hdf_facpubs) | present bias ↔ worse outcomes | High | Impulse Spender mechanism (§4.1) |
| S10 | [Chandola, Banerjee & Kumar (2009), "Anomaly Detection: A Survey," ACM Computing Surveys 41(3)](https://dl.acm.org/doi/10.1145/1541880.1541882) — replaces an earlier blog cite | canonical taxonomy of statistical outlier methods (Z-score/IQR family) | High | Anomaly signal (§6) |
| S11 | [Multi-Armed & Contextual Bandits survey](https://arxiv.org/pdf/1904.10040) | standard next-best-action | High | Nudge/quest selection (§6) |
| S12 | [Irrational Labs — budgeting](https://irrationallabs.com/case-studies/budgeting/) | no spend reduction; budgeted cats ~$30 higher | Medium | Budgeting-as-usual fails (§3) |
| S13 | [Budgeting App Trap (BehavioralEconomics.com)](https://www.behavioraleconomics.com/the-budgeting-app-trap-when-spending-information-backfires/) | budget info can raise spend; neg framing → avoidance | Medium | Positive-framing principle (§7) |
| S14 | [Strategia-X blog](https://www.strategia-x.com/blog/2026-04-12-why-budgeting-apps-fail-30-days-fintech-ux-data/) | ~~67% quit <30d; "CFPB 67% not helpful"~~ **retracted — blog-laundered** (fake CFPB attribution; see Corrections) | Low quarantined | Kept only as a record of what NOT to cite |
| S15 | [Cleo revenue (Sacra)](https://sacra.com/c/cleo/) | ~$300M ARR, 1M+ subs | Medium | Demand for behavioral coaching (§2–3) |
| S16 | [Copilot Money](https://www.copilot.money/) | budgets from 3–6mo actual spend | High | Baseline-from-history table stakes (§2) |
| S17 | [Personal Finance Apps market (TBRC)](https://www.thebusinessresearchcompany.com/report/personal-finance-apps-global-market-report) | market size & CAGR | Low | Order-of-magnitude only (§2) |
| S18 | [Gamification & financial behavior — app expertise (IJBM, Bayuk & Altobello)](https://www.emerald.com/ijbm/article/37/4/951/110545/Can-gamification-improve-financial-behavior-The) | motivation via competence/autonomy (SDT); rewards+progress predict proactive behavior; moderated by expertise | Medium | Core gamification evidence (§5.1) |
| S19 | [Gamification × behavioral traits (Wiley FPR 2025, Agrawal)](https://onlinelibrary.wiley.com/doi/full/10.1002/cfp2.70016) | gamification effect on financial conduct interacts w/ behavioral traits | Medium (paywalled — get full text) | Closest study to our exact thesis (§5, backlog) |
| S20 | [From play to pay: systematic review (ScienceDirect 2026)](https://www.sciencedirect.com/science/article/pii/S0001691826005810) | review of gamification in financial ecosystems | Medium | Gamification landscape (§5) |
| S21 | [Robinhood $7.5M gamification settlement (V&E)](https://www.velaw.com/insights/game-over-robinhood-pays-7-5-million-to-resolve-gamification-securities-violations/) | confetti/rewards ruled improper; $7.5M | High | Cautionary guardrail (§5.3–5.4) |
| S22 | [Robinhood & gamification of finance (OMFIF)](https://www.omfif.org/2022/07/cracking-down-on-the-gamification-of-finance/) | SEC scrutiny of rewards/push promoting overtrading | High | Regulatory risk (§5.3) |
| S23 | [Mazal (ex-CPO Duolingo), "How Duolingo reignited user growth" (Lenny's Newsletter)](https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth) — replaces a vendor-blog cite | CURR = highest-impact lever; +21% CURR ≈ >40% churn cut in best users; DAU 4.5×/4yrs; 10-day-streak cliff | High (primary practitioner account) | Retention mechanics & L3 targets (§5.2) |
| S25 | [Duolingo eng blog, "Meaningful metrics: growth model"](https://blog.duolingo.com/growth-model-duolingo/) | the CURR-centred growth-model framework itself | High (primary) | North-star metric design (§5.2, §7.5) |
| S26 | [Matz, Kosinski, Nave & Stillwell (2017), "Psychological targeting as an effective approach to digital mass persuasion," PNAS](https://www.pnas.org/doi/10.1073/pnas.1710966114) | n>3.5M field experiments; personality-matched appeals: **+40% clicks, +50% purchases** | High (matching works) · Medium (transfer to finance) | **Keystone evidence for L2** (§4.6) |
| S27 | [Dai, Milkman & Riis (2014), "The Fresh Start Effect," Management Science 60(10)](https://pubsonline.informs.org/doi/10.1287/mnsc.2014.1901) | aspirational behavior spikes at temporal landmarks | High | Timing layer — when to issue quests (§4.7) |
| S28 | [Beshears, Dai, Milkman & Benartzi (2021), "Using fresh starts to nudge increased retirement savings," OBHDP](https://www.sciencedirect.com/science/article/abs/pii/S0749597821000558) | fresh-start framing increased real savings contributions | High (savings-specific) | Landmark-timed savings nudges (§4.7) |
| S29 | [Sailer & Homner (2020), "The Gamification of Learning: a Meta-analysis," Educ. Psych. Review](https://link.springer.com/article/10.1007/s10648-019-09498-w) | cognitive g=.49, motivational g=.36, **behavioral g=.25** (least stable) | High | Honest L3 effect expectations (§5.4) |
| S30 | [Nahum-Shani et al. (2018), "Just-in-Time Adaptive Interventions (JITAIs) in Mobile Health," Ann. Behav. Med. 52(6)](https://academic.oup.com/abm/article/52/6/446/4733473) | the JITAI framework: decision points, tailoring variables, decision rules, states of opportunity/vulnerability | High (framework) · Medium (health→finance transfer) | **Architecture frame for the whole engine** (§8.1) |
| S31 | [Prize-linked savings — JEBO 2014](https://www.sciencedirect.com/science/article/abs/pii/S0167268114002194) · [Gertler et al., Mexico field experiment](https://www.povertyactionlab.org/sites/default/files/research-paper/Long-Term-Effect-of-Temporary-of-Incentivs-to-Save_Gertler.et_.al_March2018.pdf) | PLS raised total savings ~12pp; 2-month lottery incentive caused a persistent deposit increase | High | L3 variable-reward option — **Sharia flag** (§5.5) |
| S24 | [Gamification in personal finance (Smartico)](https://www.smartico.ai/blog-post/gamification-in-personal-finance-turn-money-management-into-a-fun-activity) | +45% engagement, +30% savings, 70% motivated | Low | Directional uplift only (§5.1) |

## 12. Changelog

- **2026-07-13 (v6 — validation run)** — Added section 8.2: the in-house validation
  run passed all six pre-registered criteria (4-of-4 distinct outputs per scenario, exact
  direction flip on the over-saver, Jaccard 0.032 between archetype texts, zero blame
  phrasing, 13/28 no-quest restraint vs a baseline that always advises). Full log:
  validation-log.md + validation-run.json, reproducible via validate.py. Scope
  stated: differentiation confirmed; efficacy ("lands better") added to the backlog with a
  human-test protocol. Backlog updated accordingly.
- **2026-07-13 (v5 — empirical thresholds)** — First in-house analysis:
  [berka-profiling.md](berka-profiling.md) profiles 4,417 Berka accounts **in the app's ledger
  schema** and derives percentile-based severity bands for all 7 L1 signals (+ 6 figures).
  Key findings: CFPB 3–6-month runway band ≈ P52–P77 of the real population (anchor validated);
  20% savings target ≈ P70; weekend ratio tightly centred on 1.0 (deviation ≥1.25 = top decile);
  momentum must be normalized to the user's own nonzero weeks (naive rolling baseline explodes);
  anomaly flags naturally rare (~3% median) — good for notification hygiene.
- **2026-07-13 (v4 — modern-evidence upgrade)** — Second research round to strengthen the 4-layer
  design with current, high-grade evidence: **(1) §4.6 Matz et al. (PNAS, n>3.5M)** — personality-
  matched persuasion moves real behavior (+40% clicks/+50% purchases): the keystone for L2, with
  the transfer-to-finance caveat stated. **(2) §4.7 Fresh Start Effect** (Dai/Milkman 2014 + the
  2021 *savings-specific* follow-up) — adds the "when" dimension; extend the seasonal calendar to
  fresh-start landmarks. **(3) §5.4 honest gamification effect sizes** (Sailer & Homner meta:
  behavioral g=.25) — new principle: substance first, game second. **(4) §5.5 prize-linked
  savings** (~+12pp savings) with an explicit **Sharia flag** and a halal-safe default (drops/
  badges). **(5) §8.1 the pipeline formally re-framed as a JITAI** (Nahum-Shani 2018) — decision
  points, states of opportunity/vulnerability, and the "do nothing" option. Design principles
  expanded to 7. Sources S26–S31 added.
- **2026-07-13 (v3 — source audit)** — User challenged source quality (correctly). Full audit:
  **(1)** SMarT link identified as July-2003 author manuscript (the "[Insert Table X]"
  placeholders are draft formatting, content genuine); canonical JPE 2004 citation added and
  **primary effect sizes extracted from the full text** (78% join, 80% retention, 3.5→13.6%).
  **(2)** "CFPB 67% not helpful" exposed as **blog-laundered** (no such finding in CFPB's real
  2024 survey) — retracted, along with the twin "67% quit in 30 days" figure. **(3)** Duolingo
  vendor-blog numbers replaced with **primary** ex-CPO figures (CURR +21% ≈ >40% churn cut,
  DAU 4.5×, 10-day-streak cliff). **(4)** Anomaly-detection blog cite upgraded to Chandola et al.
  (2009), ACM CSUR. Added source-hygiene rules and a standing **Corrections log**. S25 added.
- **2026-07-13 (v2)** — Restructured for readability (TL;DR, Parts I–IV, contents). Added **§5
  Gamification & engagement** (SDT, Duolingo mechanics, Robinhood cautionary tale, guardrails) and
  **§8 Architecture layers** (L1–L4). Recorded **ownership boundary** (classifier owned by another
  engineer; we consume archetype + ledger, access model A) and marked Berka separability
  out-of-scope. Sources S18–S24 added.
- **2026-07-13 (v1)** — File created: thesis, market vs behavior-change gap, theory spine with
  Klontz demoted after validity review, computational methods, design principles, Berka reality
  check, 17-source register.
