"""Train the churn model the web app serves, and export it as JSON.

The app used to score customers with hand-written weights and display metrics
that were typed in. This script replaces that with a real fit: an unweighted,
L2-regularised logistic regression on IBM's Telco Customer Churn data, scored on
a stratified 20% hold-out that the fit never sees. The coefficients are
converted back to raw units so the TypeScript engine is just
``sigmoid(intercept + sum(coef * value))``, with no runtime dependency on
Python.

An unweighted logistic regression is used on purpose: it is well calibrated by
construction, so "72%" on screen means about 72 in 100 similar customers left.

Run:  python scripts/train_model.py     ->  src/lib/model.json
"""

from __future__ import annotations

import hashlib
import json
import platform
import subprocess
import sys
from datetime import date
from pathlib import Path
from urllib.request import urlopen

import numpy as np
import pandas as pd
import sklearn
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (average_precision_score, brier_score_loss,
                             confusion_matrix, f1_score, precision_score,
                             recall_score, roc_auc_score)
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "telco_customer_churn.csv"
OUT = ROOT / "src" / "lib" / "model.json"
URL = ("https://raw.githubusercontent.com/IBM/watsonx-ai-samples/master/cpd4.8/"
       "data/customer_churn/WA_FnUseC_TelcoCustomerChurn.csv")
SEED = 42
MODEL_VERSION = "1.0.0"   # bump when the coefficients, features or training protocol change
# The public IBM Telco file, pinned: a changed or truncated download is refused, not silently trained on.
DATA_SHA256 = "3d5c233415c1b42bdea7172c73e620819f507f0a8294bc2337a1d8a8877feef0"
THRESHOLDS = [round(t, 2) for t in np.arange(0.20, 0.801, 0.05)]

# key -> (label shown in the app, category shown in the app)
FEATURES = {
    "tenure": ("Tenure (months)", "Tenure"),
    "monthlyCharges": ("Monthly bill", "Billing"),
    "seniorCitizen": ("Senior citizen", "Demographics"),
    "partner": ("Has a partner", "Demographics"),
    "dependents": ("Has dependents", "Demographics"),
    "phoneService": ("Phone service", "Services"),
    "multipleLines": ("Multiple phone lines", "Services"),
    "onlineSecurity": ("Online security", "Services"),
    "onlineBackup": ("Online backup", "Services"),
    "deviceProtection": ("Device protection", "Services"),
    "techSupport": ("Tech support", "Services"),
    "streamingTV": ("Streaming TV", "Services"),
    "streamingMovies": ("Streaming movies", "Services"),
    "paperlessBilling": ("Paperless billing", "Billing"),
    "contractOneYear": ("One-year contract", "Contract"),
    "contractTwoYear": ("Two-year contract", "Contract"),
    "internetFiber": ("Fibre-optic internet", "Services"),
    "internetNone": ("No internet service", "Services"),
    "payMailedCheck": ("Pays by mailed check", "Billing"),
    "payBankTransfer": ("Pays by bank transfer", "Billing"),
    "payCreditCard": ("Pays by credit card", "Billing"),
}
CONTINUOUS = ["tenure", "monthlyCharges"]


def load() -> pd.DataFrame:
    if not DATA.exists():
        DATA.parent.mkdir(parents=True, exist_ok=True)
        DATA.write_bytes(urlopen(URL, timeout=30).read())
    digest = hashlib.sha256(DATA.read_bytes()).hexdigest()
    if digest != DATA_SHA256:
        sys.exit(f"{DATA} has SHA-256 {digest}, expected {DATA_SHA256}. Delete it to re-download, "
                 "or update DATA_SHA256 after reviewing the change.")
    df = pd.read_csv(DATA)
    df["TotalCharges"] = pd.to_numeric(df["TotalCharges"], errors="coerce")
    return df.dropna(subset=["TotalCharges"]).reset_index(drop=True)


def yn(s: pd.Series) -> pd.Series:
    """'Yes' is 1; 'No', 'No phone service' and 'No internet service' are 0."""
    return (s == "Yes").astype(int)


def design(df: pd.DataFrame) -> pd.DataFrame:
    """Telco columns -> the app's feature vector. TotalCharges is left out: it is
    almost exactly tenure x monthly bill, so it adds collinearity and no signal."""
    return pd.DataFrame({
        "tenure": df["tenure"], "monthlyCharges": df["MonthlyCharges"],
        "seniorCitizen": df["SeniorCitizen"].astype(int),
        "partner": yn(df["Partner"]), "dependents": yn(df["Dependents"]),
        "phoneService": yn(df["PhoneService"]), "multipleLines": yn(df["MultipleLines"]),
        "onlineSecurity": yn(df["OnlineSecurity"]), "onlineBackup": yn(df["OnlineBackup"]),
        "deviceProtection": yn(df["DeviceProtection"]), "techSupport": yn(df["TechSupport"]),
        "streamingTV": yn(df["StreamingTV"]), "streamingMovies": yn(df["StreamingMovies"]),
        "paperlessBilling": yn(df["PaperlessBilling"]),
        "contractOneYear": (df["Contract"] == "One year").astype(int),
        "contractTwoYear": (df["Contract"] == "Two year").astype(int),
        "internetFiber": (df["InternetService"] == "Fiber optic").astype(int),
        "internetNone": (df["InternetService"] == "No").astype(int),
        "payMailedCheck": (df["PaymentMethod"] == "Mailed check").astype(int),
        "payBankTransfer": (df["PaymentMethod"] == "Bank transfer (automatic)").astype(int),
        "payCreditCard": (df["PaymentMethod"] == "Credit card (automatic)").astype(int),
    })[list(FEATURES)]


def profile_of(row: pd.Series) -> dict:
    """A raw Telco row as the app's CustomerProfile, for the golden tests."""
    return {
        "id": row["customerID"], "name": row["customerID"],
        "tenure": int(row["tenure"]), "monthlyCharges": float(row["MonthlyCharges"]),
        "contract": row["Contract"], "internetService": row["InternetService"],
        "onlineSecurity": row["OnlineSecurity"] == "Yes", "onlineBackup": row["OnlineBackup"] == "Yes",
        "deviceProtection": row["DeviceProtection"] == "Yes", "techSupport": row["TechSupport"] == "Yes",
        "streamingTV": row["StreamingTV"] == "Yes", "streamingMovies": row["StreamingMovies"] == "Yes",
        "paperlessBilling": row["PaperlessBilling"] == "Yes", "paymentMethod": row["PaymentMethod"],
        "seniorCitizen": bool(row["SeniorCitizen"]), "partner": row["Partner"] == "Yes",
        "dependents": row["Dependents"] == "Yes", "phoneService": row["PhoneService"] == "Yes",
        "multipleLines": row["MultipleLines"] == "Yes",
    }


def git(*args: str):
    try:
        return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True,
                              check=True, timeout=10).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return None


def main() -> None:
    df = load()
    y = (df["Churn"] == "Yes").astype(int)
    X = design(df)
    idx_tr, idx_te = train_test_split(np.arange(len(df)), test_size=0.2, stratify=y, random_state=SEED)
    X_tr, X_te, y_tr, y_te = X.iloc[idx_tr], X.iloc[idx_te], y.iloc[idx_tr], y.iloc[idx_te]

    mean, std = X_tr.mean(), X_tr.std(ddof=0)
    scale = pd.Series(1.0, index=X.columns)
    scale[CONTINUOUS] = std[CONTINUOUS]
    center = pd.Series(0.0, index=X.columns)
    center[CONTINUOUS] = mean[CONTINUOUS]

    lr = LogisticRegression(max_iter=2000, random_state=SEED)
    lr.fit((X_tr - center) / scale, y_tr)

    # back to raw units: logit = b0 + sum(w_j * (x_j - c_j) / s_j)
    coef_raw = lr.coef_[0] / scale.to_numpy()
    intercept_raw = float(lr.intercept_[0] - np.sum(coef_raw * center.to_numpy()))
    coef = dict(zip(X.columns, map(float, coef_raw)))

    def predict(frame: pd.DataFrame) -> np.ndarray:
        return 1 / (1 + np.exp(-(intercept_raw + frame.to_numpy() @ coef_raw)))

    p_te = predict(X_te)
    assert np.allclose(p_te, lr.predict_proba((X_te - center) / scale)[:, 1])  # export is lossless

    # bootstrap interval on the test AUC
    rng = np.random.default_rng(SEED)
    yt = y_te.to_numpy()
    aucs = []
    while len(aucs) < 2000:
        i = rng.integers(0, len(yt), len(yt))
        if yt[i].min() != yt[i].max():
            aucs.append(roc_auc_score(yt[i], p_te[i]))

    by_threshold = []
    for t in THRESHOLDS:
        pred = (p_te >= t).astype(int)
        tn, fp, fn, tp = confusion_matrix(yt, pred).ravel()
        by_threshold.append({
            "threshold": t, "tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp),
            "accuracy": float((tp + tn) / len(yt)),
            "precision": float(precision_score(yt, pred, zero_division=0)),
            "recall": float(recall_score(yt, pred, zero_division=0)),
            "f1": float(f1_score(yt, pred, zero_division=0)),
        })
    order = np.argsort(p_te)
    calibration = [{"predicted": float(p_te[b].mean()), "observed": float(yt[b].mean()), "n": int(len(b))}
                   for b in np.array_split(order, 5)]
    best_f1 = max(by_threshold, key=lambda r: r["f1"])["threshold"]

    # global importance: log-odds swing from a one-standard-deviation change
    sd = pd.Series(std.to_numpy(), index=X.columns)
    swing = pd.Series(np.abs(coef_raw) * sd.to_numpy(), index=X.columns)
    swing = (swing / swing.sum()).sort_values(ascending=False)
    importance = [{"feature": FEATURES[k][0], "weight": float(v)} for k, v in swing.head(8).items()]

    golden_rows = df.iloc[idx_te[:8]]
    golden = [{"profile": profile_of(r), "probability": float(p)}
              for (_, r), p in zip(golden_rows.iterrows(), p_te[:8])]

    core = json.dumps({"intercept": intercept_raw, "coefficients": coef, "features": list(FEATURES)},
                      sort_keys=True)
    provenance = {
        "modelVersion": MODEL_VERSION,
        "trainingCommit": git("rev-parse", "HEAD"),
        "trainingCodeDirty": bool(git("status", "--porcelain", "--", "scripts", "requirements.txt")),
        "dataSource": URL,
        "dataSha256": DATA_SHA256,
        "dataRows": int(len(df)),
        "featureSchemaSha256": hashlib.sha256("\n".join(FEATURES).encode()).hexdigest(),
        "coefficientsSha256": hashlib.sha256(core.encode()).hexdigest(),
        "algorithm": "Logistic regression, L2, unweighted",
        "calibration": "none applied; an unweighted logistic regression is checked against five reliability bins",
        "trainingWindow": "not applicable: the dataset has no dates, the split is a random stratified 80/20",
        "evaluationWindow": "not applicable (same reason)",
        "python": platform.python_version(), "sklearn": sklearn.__version__,
        "numpy": np.__version__, "pandas": pd.__version__,
    }
    model = {
        "modelVersion": MODEL_VERSION,
        "provenance": provenance,
        "algorithm": "Logistic regression (L2, unweighted)",
        "trainedOn": "IBM Telco Customer Churn",
        "trainedDate": date.today().isoformat(),
        "sklearn": sklearn.__version__, "seed": SEED,
        "nTrain": int(len(X_tr)), "nTest": int(len(X_te)),
        "baseRate": float(y.mean()),
        "intercept": intercept_raw, "coefficients": coef,
        "means": {k: float(v) for k, v in mean.items()},
        "features": {k: {"label": v[0], "category": v[1]} for k, v in FEATURES.items()},
        "metrics": {
            "rocAuc": float(roc_auc_score(yt, p_te)),
            "rocAucCi95": [float(np.percentile(aucs, 2.5)), float(np.percentile(aucs, 97.5))],
            "prAuc": float(average_precision_score(yt, p_te)),
            "brier": float(brier_score_loss(yt, p_te)),
            "brierNoSkill": float(brier_score_loss(yt, np.full(len(yt), y_tr.mean()))),
            "testChurnRate": float(yt.mean()),
        },
        "calibration": calibration,
        "byThreshold": by_threshold,
        "bestF1Threshold": best_f1,
        "globalImportance": importance,
        "golden": golden,
    }
    OUT.write_text(json.dumps(model, indent=2))
    m = model["metrics"]
    print(f"train {len(X_tr):,} | test {len(X_te):,} | test churn {m['testChurnRate']:.1%}")
    print(f"ROC-AUC {m['rocAuc']:.3f} (95% {m['rocAucCi95'][0]:.3f}-{m['rocAucCi95'][1]:.3f}) | "
          f"PR-AUC {m['prAuc']:.3f} | Brier {m['brier']:.3f} vs no-skill {m['brierNoSkill']:.3f}")
    print(f"best-F1 threshold {best_f1}; wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    sys.exit(main())
