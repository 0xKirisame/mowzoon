# Mowzoon — XGBoost Archetype Classifier: Verified Metrics

Generated 2026-07-12 21:47 by `evaluate_repo.py`.
Reproducible: `python3 evaluate_repo.py` (downloads Berka on first run).

## Headline
- **Accuracy: 97.67%** classifying accounts into the 4 money archetypes
- Dataset: PKDD'99 Berka — **1,056,320 transactions** across **4,500 unique accounts**
- Method: 3 behavioral metrics -> K-Means(k=4) bootstraps archetype labels -> XGBoost(multi:softprob) classifier
- Train/test split: 80/20, stratified, seed 42

## Per-archetype performance (test set)
| Archetype | Precision | Recall | F1 | Support |
|---|---:|---:|---:|---:|
| The Impulse Spender | 0.980 | 0.992 | 0.986 | 251 |
| The Anxious Planner | 0.965 | 0.949 | 0.957 | 117 |
| The Blind Investor | 0.987 | 0.984 | 0.986 | 383 |
| The Survivalist | 0.953 | 0.953 | 0.953 | 149 |
| **macro avg** | 0.971 | 0.970 | 0.970 | 900 |
| **accuracy** | | | **0.977** | 900 |

## Confusion matrix (rows = true, cols = predicted)
| | The Impulse Spender | The Anxious Planner | The Blind Investor | The Survivalist |
|---|---|---|---|---|
| The Impulse Spender | 249 | 2 | 0 | 0 |
| The Anxious Planner | 4 | 111 | 0 | 2 |
| The Blind Investor | 1 | 0 | 377 | 5 |
| The Survivalist | 0 | 2 | 5 | 142 |

## Archetype distribution (full cohort of 4500 accounts)
- **The Impulse Spender**: 1277 accounts (28.4%)
- **The Anxious Planner**: 485 accounts (10.8%)
- **The Blind Investor**: 1911 accounts (42.5%)
- **The Survivalist**: 827 accounts (18.4%)

## Why this number is honest
The XGBoost predicts the K-Means cluster an account belongs to from its three
behavioral metrics. Because the labels are *derived* from those same metrics, a
near-perfect score is expected — it confirms the classifier faithfully reproduces
the cluster boundaries. The real product value is the **K-Means archetype discovery**
on unseen bank feeds, not beating a synthetic benchmark.
