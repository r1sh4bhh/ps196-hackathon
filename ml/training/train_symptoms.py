"""Train Model A - the 41-condition symptom differential.

    py ml/training/train_symptoms.py

Reads ``ml/data/dataset.csv`` and writes ``ml/models/model_a_symptoms.joblib``.

IMPORTANT CAVEAT
----------------
This dataset is synthetic and near-perfectly separable: every condition maps
to a fixed symptom set with only minor variation, so almost any classifier
scores close to 100%. **That number is not clinical accuracy.** It measures
how cleanly the dataset was constructed, not how well the model would perform
on real patients, who present with overlapping, partial and atypical symptoms.

The script prints this caveat alongside the score so it cannot be quoted out
of context. Report it honestly in any presentation - a judge who spots an
unqualified "99.8% accurate medical AI" claim will rightly distrust
everything else in the project.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split

_ML_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_ML_ROOT))
sys.path.insert(0, str(_ML_ROOT / "inference"))

from preprocessing import prepare_symptom_features  # noqa: E402

DATA_PATH = _ML_ROOT / "data" / "dataset.csv"
MODEL_PATH = _ML_ROOT / "models" / "model_a_symptoms.joblib"
RANDOM_STATE = 42


def main() -> int:
    if not DATA_PATH.exists():
        print(f"ERROR: {DATA_PATH} not found.", file=sys.stderr)
        print("Download it per ml/data/README.md before training.", file=sys.stderr)
        return 1

    import joblib

    print(f"Loading {DATA_PATH.name} ...")
    frame = pd.read_csv(DATA_PATH)
    features, labels = prepare_symptom_features(frame)
    print(f"  {features.shape[0]} rows, {features.shape[1]} symptom columns")
    print(f"  {labels.nunique()} distinct conditions")

    # Stratified split keeps every condition represented in both halves; with
    # 41 classes an unstratified split can drop rare classes from test entirely.
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

    holdout = model.score(x_test, y_test)
    cv_scores = cross_val_score(
        model,
        features,
        labels,
        cv=StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE),
        n_jobs=-1,
    )

    print()
    print(f"  Hold-out accuracy : {holdout:.4f}")
    print(f"  5-fold CV accuracy: {cv_scores.mean():.4f} (+/- {cv_scores.std() * 2:.4f})")
    print()
    print("  NOTE: this dataset is synthetic and near-perfectly separable.")
    print("  The score above reflects dataset construction, NOT clinical")
    print("  accuracy. Do not present it as diagnostic performance.")
    print()

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    print(f"Saved {MODEL_PATH.relative_to(_ML_ROOT.parent)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
