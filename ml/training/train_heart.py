"""Train Model C - cardiac risk from the UCI Heart Disease data.

    py ml/training/train_heart.py

Reads ``ml/data/heart.csv`` and writes ``ml/models/model_c_heart.joblib``.

Why this filters to Cleveland
-----------------------------
The commonly mirrored CSV contains all 920 rows from four collection sites
(Cleveland 304, Hungary 293, VA Long Beach 200, Switzerland 123). The
non-Cleveland sites did not reliably record ``ca`` and ``thal``: across the
full file those columns are missing in roughly 611 and 486 rows respectively.

Training on everything means two of thirteen features become mostly imputed
constants, so the model leans on defaults rather than signal - and the
inference path already defaults those same fields, compounding the problem.
Cleveland's 304 rows have them largely intact, and Cleveland is the subset
published benchmarks refer to, so reported metrics stay comparable to the
literature.

If the ``dataset`` column is absent (some mirrors ship Cleveland only), the
file is used as-is.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score
from sklearn.model_selection import train_test_split

_ML_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_ML_ROOT))
sys.path.insert(0, str(_ML_ROOT / "inference"))

from preprocessing import prepare_heart_features  # noqa: E402

DATA_PATH = _ML_ROOT / "data" / "heart.csv"
MODEL_PATH = _ML_ROOT / "models" / "model_c_heart.joblib"
RANDOM_STATE = 42


def main() -> int:
    if not DATA_PATH.exists():
        print(f"ERROR: {DATA_PATH} not found.", file=sys.stderr)
        print("Download it per ml/data/README.md before training.", file=sys.stderr)
        return 1

    import joblib

    print(f"Loading {DATA_PATH.name} ...")
    frame = pd.read_csv(DATA_PATH)
    print(f"  {len(frame)} rows in file")

    site_column = next(
        (c for c in frame.columns if str(c).strip().lower() in {"dataset", "site", "source"}),
        None,
    )
    if site_column is not None:
        cleveland = frame[frame[site_column].astype(str).str.strip().str.lower() == "cleveland"]
        if len(cleveland) >= 100:
            print(f"  filtering to Cleveland: {len(cleveland)} rows")
            print("  (other sites omit ca/thal too often to be usable)")
            frame = cleveland
        else:
            print(f"  WARNING: only {len(cleveland)} Cleveland rows; using all sites")

    features, labels = prepare_heart_features(frame)

    if labels is None:
        print("ERROR: no target column found - cannot train.", file=sys.stderr)
        return 1

    print(f"  {features.shape[0]} rows, {features.shape[1]} features")
    print(f"  class balance: {labels.value_counts().to_dict()}")

    x_train, x_test, y_train, y_test = train_test_split(
        features,
        labels,
        test_size=0.2,
        random_state=RANDOM_STATE,
        stratify=labels,
    )

    model = RandomForestClassifier(
        n_estimators=200,
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )
    print("Training RandomForestClassifier ...")
    model.fit(x_train, y_train)

    predictions = model.predict(x_test)
    probabilities = model.predict_proba(x_test)[:, 1]

    accuracy = float(model.score(x_test, y_test))
    auc = float(roc_auc_score(y_test, probabilities))

    print()
    print(f"  Accuracy: {accuracy:.4f}")
    print(f"  ROC-AUC : {auc:.4f}")
    print()
    print("  Confusion matrix (rows=actual, cols=predicted):")
    print(confusion_matrix(y_test, predictions))
    print()
    print(classification_report(y_test, predictions, target_names=["no disease", "disease"]))
    print("  LIMITATION: 304 rows collected in 1988. The intake form does not")
    print("  capture every Model C feature, so live predictions run on partial")
    print("  input and are coarser than these figures suggest.")
    print()

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(
        {
            "model": model,
            "metrics": {"accuracy": accuracy, "roc_auc": auc},
        },
        MODEL_PATH,
    )
    print(f"Saved {MODEL_PATH.relative_to(_ML_ROOT.parent)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
