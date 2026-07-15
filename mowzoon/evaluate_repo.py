"""
Reproducible evaluation of the Mowzoon XGBoost archetype classifier.
Trains on the Berka-derived K-Means labels and writes TRAINING_RESULTS.md
with accuracy, per-class F1 and the confusion matrix. Run from mowzoon/:
    python3 evaluate_repo.py
"""
import os, json, datetime
import numpy as np
import pandas as pd
from sklearn.metrics import classification_report, confusion_matrix

import config
from data_ingestor import load_data
from features import extract_features
from model import MowzoonModel

os.chdir(os.path.dirname(os.path.abspath(__file__)))

print("[eval] loading Berka + extracting features...")
transactions = load_data()
features_df = extract_features(transactions)

model = MowzoonModel()
(X_train, X_test, y_train, y_test), features_df = model.prepare_data(features_df)
model.train(X_train, y_train)

X_test_scaled = model.scaler.transform(X_test)
pred = model.classifier.predict(X_test_scaled)
acc = (pred == y_test.to_numpy()).mean()

labels = sorted(features_df["true_archetype"].unique())
rep = classification_report(y_test, pred, output_dict=True, labels=labels,
                            target_names=[config.ARCHETYPES[i]["name"] for i in labels])
cm = confusion_matrix(y_test, pred, labels=labels)

# archetype membership over the full cohort
counts = features_df["true_archetype"].value_counts().to_dict()

md = f"""# Mowzoon — XGBoost Archetype Classifier: Verified Metrics

Generated {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')} by `evaluate_repo.py`.
Reproducible: `python3 evaluate_repo.py` (downloads Berka on first run).

## Headline
- **Accuracy: {acc*100:.2f}%** classifying accounts into the 4 money archetypes
- Dataset: PKDD'99 Berka — **{len(transactions):,} transactions** across **{len(features_df):,} unique accounts**
- Method: 3 behavioral metrics -> K-Means(k=4) bootstraps archetype labels -> XGBoost(multi:softprob) classifier
- Train/test split: 80/20, stratified, seed 42

## Per-archetype performance (test set)
| Archetype | Precision | Recall | F1 | Support |
|---|---:|---:|---:|---:|
"""
for i in labels:
    name = config.ARCHETYPES[i]["name"]
    r = rep[name]
    md += f"| {name} | {r['precision']:.3f} | {r['recall']:.3f} | {r['f1-score']:.3f} | {int(r['support'])} |\n"
md += f"| **macro avg** | {rep['macro avg']['precision']:.3f} | {rep['macro avg']['recall']:.3f} | {rep['macro avg']['f1-score']:.3f} | {int(rep['macro avg']['support'])} |\n"
md += f"| **accuracy** | | | **{rep['accuracy']:.3f}** | {int(rep['macro avg']['support'])} |\n"

md += "\n## Confusion matrix (rows = true, cols = predicted)\n"
md += "| | " + " | ".join(config.ARCHETYPES[i]["name"] for i in labels) + " |\n"
md += "|---" * (len(labels) + 1) + "|\n"
for i, row in zip(labels, cm):
    md += f"| {config.ARCHETYPES[i]['name']} | " + " | ".join(str(x) for x in row) + " |\n"

md += "\n## Archetype distribution (full cohort of {0} accounts)\n".format(len(features_df))
for i in labels:
    md += f"- **{config.ARCHETYPES[i]['name']}**: {int(counts.get(i,0))} accounts ({counts.get(i,0)/len(features_df)*100:.1f}%)\n"

md += """
## Why this number is honest
The XGBoost predicts the K-Means cluster an account belongs to from its three
behavioral metrics. Because the labels are *derived* from those same metrics, a
near-perfect score is expected — it confirms the classifier faithfully reproduces
the cluster boundaries. The real product value is the **K-Means archetype discovery**
on unseen bank feeds, not beating a synthetic benchmark.
"""

open("TRAINING_RESULTS.md", "w").write(md)
print(f"[eval] accuracy={acc*100:.2f}%  -> TRAINING_RESULTS.md written")
