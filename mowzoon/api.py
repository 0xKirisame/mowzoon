"""
Mowzoon - API Service

Serves the trained pipeline (data_ingestor -> features -> model -> engine)
over HTTP for the UI. First run trains on the Berka dataset and pickles
the artifacts, later runs load them from disk.

Run:  python api.py            (or)  python -m uvicorn api:app --port 8000
"""

import os
import pickle
from datetime import datetime

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# make relative paths ("data/") work no matter where the server starts from
os.chdir(os.path.dirname(os.path.abspath(__file__)))

import config
import delivery
from data_ingestor import load_data
from features import extract_features
from model import MowzoonModel
from engine import PredictiveEngine

ARTIFACTS_PATH = os.path.join("data", "artifacts.pkl")
FEATURE_COLS = ["spending_efficiency", "proactive_resilience", "financial_eq"]

# same fixed/discretionary split as features.py, so the cohort baseline
# matches what the model was trained on
# POJISTNE=insurance, SIPO=household, LEASING=leasing, UVER=loan
FIXED_SYMBOLS = ["POJISTNE", "SIPO", "LEASING", "UVER"]


def compute_cohort_shares(transactions, features_df):
    """Average income allocation (Essential / Lifestyle / Savings) per archetype.

    Fixed symbols count as Essential, other withdrawals as Lifestyle, unspent
    income as Savings. Each account is grouped by the archetype the model
    assigned it. Shares are fractions of income. Shock has no Berka analogue
    so it is left out.
    """
    tx = transactions
    debit = tx["type"] == "VYDAJ"
    credit = tx["type"] == "PRIJEM"
    fixed = debit & tx["k_symbol"].isin(FIXED_SYMBOLS)

    income = tx[credit].groupby("account_id")["amount"].sum()
    spend = tx[debit].groupby("account_id")["amount"].sum()
    fixed_spend = tx[fixed].groupby("account_id")["amount"].sum()

    acct = pd.DataFrame({"income": income, "spend": spend, "fixed": fixed_spend})
    # Align to the accounts the model actually labelled, in the same order.
    acct = acct.reindex(features_df["user_id"].to_numpy())
    acct["archetype"] = features_df["true_archetype"].to_numpy()
    acct[["spend", "fixed"]] = acct[["spend", "fixed"]].fillna(0.0)
    acct = acct[acct["income"] > 0]  # a share of income needs an income base

    disc = acct["spend"] - acct["fixed"]
    # clip outliers so tiny-income accounts don't dominate the means
    acct["essential"] = (acct["fixed"] / acct["income"]).clip(0, 1.5)
    acct["lifestyle"] = (disc / acct["income"]).clip(0, 1.5)
    acct["savings"] = ((acct["income"] - acct["spend"]) / acct["income"]).clip(0, 1)

    shares = {}
    for arch_id, grp in acct.groupby("archetype"):
        shares[int(arch_id)] = {
            "count": int(len(grp)),
            "essential": round(float(grp["essential"].mean()), 4),
            "lifestyle": round(float(grp["lifestyle"].mean()), 4),
            "savings": round(float(grp["savings"].mean()), 4),
        }
    return shares


def build_artifacts():
    transactions = load_data()
    features_df = extract_features(transactions)
    model = MowzoonModel()
    (X_train, X_test, y_train, y_test), features_df = model.prepare_data(features_df)
    model.train(X_train, y_train)
    accuracy, _ = model.evaluate(X_test, y_test)
    cohort_shares = compute_cohort_shares(transactions, features_df)
    artifacts = {
        "model": model,
        "features": features_df,
        "accuracy": accuracy,
        "cohort_shares": cohort_shares,
    }
    with open(ARTIFACTS_PATH, "wb") as f:
        pickle.dump(artifacts, f)
    return artifacts


def load_artifacts():
    if os.path.exists(ARTIFACTS_PATH):
        with open(ARTIFACTS_PATH, "rb") as f:
            artifacts = pickle.load(f)
        # older pickles may not have cohort_shares yet; add it without retraining
        if "cohort_shares" not in artifacts:
            artifacts["cohort_shares"] = compute_cohort_shares(load_data(), artifacts["features"])
            with open(ARTIFACTS_PATH, "wb") as f:
                pickle.dump(artifacts, f)
        return artifacts
    return build_artifacts()


ART = load_artifacts()
MODEL: MowzoonModel = ART["model"]
FEATURES: pd.DataFrame = ART["features"]
ENGINE = PredictiveEngine()

# Survey scores (0-100) don't live on the same scale as the raw Berka
# features, so a raw survey point lands outside every cluster. Treat each
# score as a percentile and quantile-map it onto the real distributions.
SORTED_FEATURES = {col: np.sort(FEATURES[col].to_numpy()) for col in FEATURE_COLS}


def calibrate(score: float, col: str) -> float:
    q = min(max(score / 100.0, 0.0), 1.0)
    return float(np.quantile(SORTED_FEATURES[col], q))

app = FastAPI(title="Mowzoon API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

from arena import router as arena_router  # noqa: E402  (needs the chdir above)

app.include_router(arena_router)


class Metrics(BaseModel):
    """The three core scores in UI naming (0-100)."""
    efficiency: float = Field(ge=0, le=100)
    resilience: float = Field(ge=0, le=100)
    eq: float = Field(ge=0, le=100)

    def as_frame(self) -> pd.DataFrame:
        return pd.DataFrame(
            [[self.efficiency, self.resilience, self.eq]], columns=FEATURE_COLS
        )


def upcoming_spikes(lookahead_days=365):
    """Days-until for every configured seasonal spike, nearest first."""
    now = datetime.now()
    spikes = []
    for spike in config.SEASONAL_SPIKES:
        for year in (now.year, now.year + 1):
            try:
                date = datetime(year, spike["month"], spike["day"])
            except ValueError:
                date = datetime(year, spike["month"], spike["day"] - 1)
            days = (date - now).days
            if 0 <= days <= lookahead_days:
                spikes.append({"name": spike["name"], "days": days})
                break
    return sorted(spikes, key=lambda s: s["days"])


@app.get("/health")
def health():
    return {
        "status": "ok",
        "accounts": int(len(FEATURES)),
        "accuracy": round(float(ART["accuracy"]), 4),
    }


@app.post("/classify")
def classify(metrics: Metrics):
    mapped = {
        "spending_efficiency": calibrate(metrics.efficiency, "spending_efficiency"),
        "proactive_resilience": calibrate(metrics.resilience, "proactive_resilience"),
        "financial_eq": calibrate(metrics.eq, "financial_eq"),
    }
    X = pd.DataFrame([mapped], columns=FEATURE_COLS)
    X_scaled = MODEL.scaler.transform(X)

    # Label comes from the XGBoost classifier. For the mixture, use Gaussian
    # affinity to the K-Means centroids instead of XGBoost's probabilities,
    # which saturate near 1.0 and look broken in the UI.
    archetype_id = int(MODEL.classifier.predict(X_scaled)[0])
    d2 = ((MODEL.kmeans.cluster_centers_ - X_scaled) ** 2).sum(axis=1)
    w = np.exp(-d2 / 2.0)
    w = w / w.sum()
    probs = [0.0] * 4
    for cluster_idx, arch_id in MODEL.cluster_to_archetype.items():
        probs[arch_id] = float(w[cluster_idx])

    # Where the calibrated point ranks inside its assigned cohort
    cohort = FEATURES[FEATURES["true_archetype"] == archetype_id]
    cohort_percentiles = {
        "efficiency": round(float((cohort["spending_efficiency"] < mapped["spending_efficiency"]).mean() * 100)),
        "resilience": round(float((cohort["proactive_resilience"] < mapped["proactive_resilience"]).mean() * 100)),
        "eq": round(float((cohort["financial_eq"] < mapped["financial_eq"]).mean() * 100)),
    }

    return {
        "id": archetype_id,
        "name": config.ARCHETYPES[archetype_id]["name"],
        "description": config.ARCHETYPES[archetype_id]["description"],
        "probs": [round(p, 4) for p in probs],
        "point": {
            "e": round(mapped["spending_efficiency"], 1),
            "r": round(mapped["proactive_resilience"], 1),
            "q": round(mapped["financial_eq"], 1),
        },
        "cohort_percentiles": cohort_percentiles,
        "cohort_size": int(len(cohort)),
        "population": int(len(FEATURES)),
    }


@app.get("/population")
def population(sample: int = 1200):
    """Metric triples + archetype for real Berka accounts (down-sampled for
    plotting) plus per-archetype cohort means over all accounts."""
    df = FEATURES
    plot_df = df.sample(n=min(sample, len(df)), random_state=42) if sample else df
    points = [
        {
            "e": round(float(row.spending_efficiency), 1),
            "r": round(float(row.proactive_resilience), 1),
            "q": round(float(row.financial_eq), 1),
            "a": int(row.true_archetype),
        }
        for row in plot_df.itertuples()
    ]
    cohorts = {}
    for archetype_id, group in df.groupby("true_archetype"):
        cohorts[int(archetype_id)] = {
            "count": int(len(group)),
            "efficiency": round(float(group["spending_efficiency"].mean()), 1),
            "resilience": round(float(group["proactive_resilience"].mean()), 1),
            "eq": round(float(group["financial_eq"].mean()), 1),
        }
    return {"points": points, "cohorts": cohorts, "total": int(len(df))}


@app.get("/category-cohort")
def category_cohort():
    """Typical income allocation (Essential / Lifestyle / Savings) for each
    archetype, over the real Berka accounts. Shock has no Berka analogue."""
    return {"cohorts": ART["cohort_shares"], "total": int(len(FEATURES))}


class LedgerRow(BaseModel):
    """One app-ledger transaction. Unknown types and non-positive amounts are
    quarantined by the signal layer, not rejected here (count in meta.skipped_rows)."""
    type: str
    amount: float
    date: str


class InsightsRequest(BaseModel):
    """POST /insights body. income is MONTHLY net income (see api-contract.md)."""
    archetype: int
    income: float = Field(ge=0, description="MONTHLY net income, same currency as the ledger")
    ledger: list[LedgerRow] = []
    metrics: Metrics | None = None   # survey scores; legacy-nudge fallback only
    today: str | None = None         # ISO date; lets the UI and tests pin the clock


@app.post("/insights")
def insights_post(req: InsightsRequest):
    """Full signals -> insights -> quest response (non-breaking;
    the GET route below still serves the legacy UI)."""
    return delivery.build_response(
        req.archetype,
        [row.model_dump() for row in req.ledger],
        req.income,
        metrics=req.metrics.model_dump() if req.metrics else None,
        today=req.today,
    )


@app.get("/insights")
def insights(archetype: int, efficiency: float, resilience: float, eq: float):
    if archetype not in config.ARCHETYPES:
        raise HTTPException(status_code=422, detail="Unknown archetype id")
    spikes = upcoming_spikes()
    nearest = ENGINE.forecast_seasonal_spikes(current_date=datetime.now(), lookahead_days=365)
    nudge = ENGINE.generate_micro_nudge(
        archetype,
        {
            "spending_efficiency": round(efficiency),
            "proactive_resilience": round(resilience),
            "financial_eq": round(eq),
        },
        nearest,
    )
    return {"nudge": nudge, "spikes": spikes}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
