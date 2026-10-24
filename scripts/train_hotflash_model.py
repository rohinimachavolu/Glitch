"""
Train Glitch's educational hot-flash risk model.

Data: TSHS "Hot Flashes" dataset (Grau, Okungu & Sammel, 2023; baseline data from Freeman et al., 2001),
375 women aged 35-48, self-reported hot flashes in the past month. CC BY-NC-SA 4.0, educational use.
https://www.causeweb.org/tshs/hot-flashes/

The TSHS use agreement says inferences beyond the original study are not valid estimates, so the app
labels this as an *educational* risk indicator, never a prediction for an individual.

Fairness choice: race and education are in the dataset but are deliberately NOT used as features.
The raw data is downloaded to scripts/data/ (git-ignored) and never committed; only fitted
coefficients and evaluation metrics are written to the app.

Usage:
    python3 -m venv .venv && .venv/bin/pip install numpy pandas openpyxl
    .venv/bin/python scripts/train_hotflash_model.py
"""
from __future__ import annotations

import json
import urllib.request
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "scripts" / "data" / "hflash.xlsx"
OUT = ROOT / "client" / "src" / "lib" / "models" / "hotflashRisk.json"
URL = "https://causeweb.org/tshs/datasets/hflash.xlsx"

BASE_FEATURES = ["age_group", "smoker", "bmi30", "prior_symptoms"]
LAB_FEATURES = BASE_FEATURES + ["log_fsh", "log_estradiol"]


def load() -> pd.DataFrame:
    if not DATA.exists():
        DATA.parent.mkdir(parents=True, exist_ok=True)
        print(f"Downloading {URL}")
        urllib.request.urlretrieve(URL, DATA)
    d = pd.read_excel(DATA)
    return pd.DataFrame({
        "age_group": d["ageg"].astype(float),            # 1=35-39, 2=40-44, 3=45-48
        "smoker": d["f1a"].astype(float),
        "bmi30": d["bmi30"].astype(float),
        "prior_symptoms": d["d1"].astype(float),
        "log_fsh": np.log(d["fsh"].astype(float)),
        "log_estradiol": np.log(d["estra"].astype(float)),
        "y": d["hotflash"].astype(float),
    }).dropna()


def fit_logistic(X: np.ndarray, y: np.ndarray, l2: float = 1.0, iters: int = 50) -> np.ndarray:
    """Ridge-penalised logistic regression via Newton/IRLS. Intercept (column 0) is not penalised."""
    w = np.zeros(X.shape[1])
    penalty = np.eye(X.shape[1]) * l2
    penalty[0, 0] = 0.0
    for _ in range(iters):
        p = 1 / (1 + np.exp(-X @ w))
        grad = X.T @ (p - y) + penalty @ w
        H = X.T @ (X * (p * (1 - p))[:, None]) + penalty
        step = np.linalg.solve(H, grad)
        w -= step
        if np.max(np.abs(step)) < 1e-8:
            break
    return w


def auc(y: np.ndarray, s: np.ndarray) -> float:
    """Rank-based ROC AUC (Mann-Whitney)."""
    order = np.argsort(s)
    ranks = np.empty(len(s))
    ranks[order] = np.arange(1, len(s) + 1)
    # average ranks for ties
    for v in np.unique(s):
        idx = s == v
        ranks[idx] = ranks[idx].mean()
    pos = y == 1
    n1, n0 = pos.sum(), (~pos).sum()
    return float((ranks[pos].sum() - n1 * (n1 + 1) / 2) / (n1 * n0))


def standardise(df: pd.DataFrame, feats: list[str]):
    mu = df[feats].mean()
    sd = df[feats].std(ddof=0).replace(0, 1)
    X = ((df[feats] - mu) / sd).to_numpy()
    return np.column_stack([np.ones(len(X)), X]), mu, sd


def cross_validated_auc(df: pd.DataFrame, feats: list[str], folds: int = 5, repeats: int = 20, seed: int = 7) -> tuple[float, float]:
    rng = np.random.default_rng(seed)
    scores = []
    y_all = df["y"].to_numpy()
    for _ in range(repeats):
        # stratified fold assignment
        fold = np.empty(len(df), dtype=int)
        for cls in (0, 1):
            idx = np.where(y_all == cls)[0]
            rng.shuffle(idx)
            fold[idx] = np.arange(len(idx)) % folds
        for k in range(folds):
            tr, te = df[fold != k], df[fold == k]
            Xtr, mu, sd = standardise(tr, feats)
            w = fit_logistic(Xtr, tr["y"].to_numpy())
            Xte = np.column_stack([np.ones(len(te)), ((te[feats] - mu) / sd).to_numpy()])
            scores.append(auc(te["y"].to_numpy(), Xte @ w))
    return float(np.mean(scores)), float(np.std(scores))


def train(df: pd.DataFrame, feats: list[str]) -> dict:
    X, mu, sd = standardise(df, feats)
    w = fit_logistic(X, df["y"].to_numpy())
    cv_mean, cv_sd = cross_validated_auc(df, feats)
    # Odds ratio per 1 unit (binary features) / per 1 SD (continuous)
    return {
        "features": feats,
        "intercept": round(float(w[0]), 5),
        "coefficients": {f: round(float(c), 5) for f, c in zip(feats, w[1:])},
        "mean": {f: round(float(mu[f]), 5) for f in feats},
        "scale": {f: round(float(sd[f]), 5) for f in feats},
        "oddsRatioPerUnit": {f: round(float(np.exp(c / sd[f])), 2) for f, c in zip(feats, w[1:])},
        "cvAuc": round(cv_mean, 3),
        "cvAucSd": round(cv_sd, 3),
    }


def main() -> None:
    df = load()
    model = {
        "name": "Educational hot-flash risk indicator",
        "trainedOn": "TSHS Hot Flashes dataset (Freeman et al., 2001 baseline), n=%d women aged 35-48" % len(df),
        "citation": "Grau L, Okungu X, Sammel MD. \"Hot Flashes Dataset\", TSHS Resources Portal (2023). https://www.causeweb.org/tshs/hot-flashes/",
        "license": "CC BY-NC-SA 4.0 (educational use)",
        "outcome": "Self-reported hot flashes in the past month",
        "prevalence": round(float(df["y"].mean()), 3),
        "excludedFeatures": ["race", "education"],
        "caveat": "Educational indicator from a small 2001 cohort of late-reproductive-age women; not a validated prediction for any individual.",
        "base": train(df, BASE_FEATURES),
        "withLabs": train(df, LAB_FEATURES),
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(model, indent=2) + "\n")
    for k in ("base", "withLabs"):
        m = model[k]
        print(f"{k:9s} CV AUC {m['cvAuc']:.3f} ± {m['cvAucSd']:.3f}  OR/unit {m['oddsRatioPerUnit']}")
    print(f"Wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
