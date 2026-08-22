"""Train Model B - diabetes risk from the Pima Indians dataset.

    py ml/training/train_diabetes.py

Reads ``ml/data/diabetes.csv`` and writes ``ml/models/model_b_diabetes.joblib``.

The saved artefact is a dict::

    {"model": <estimator>, "medians": {...}, "metrics": {...}}

The medians are saved deliberately. Zeros in glucose, blood pressure, skin
thickness, insulin and BMI encode *missing readings* in this dataset, and are
imputed with the training-set median. Inference must reuse those exact values
- recomputing them from a single patient record is meaningless, and using
different values than training saw is textbook train/serve skew.

Why the medians come from the training split only
-------------------------------------------------
Computing them across the whole file lets test-set values influence the
imputation, so information leaks across the split and the reported score is
flattered. The split happens first here, medians are derived from the
training half, and the same values are then applied to the test half.

Why cross-validated AUC is reported
-----------------------------------
The test split is only ~154 rows. A single split at that size has wide
variance and can easily read several points high or low by luck. The
cross-validated figure across the full dataset is the more honest number to
quote, and is the one recorded in the artefact.

Why accuracy alone is insufficient here
---------------------------------------
The Pima classes are roughly 65/35, so a model that always predicts "no
diabetes" scores 65% while being clinically useless. ROC-AUC, recall and the
confusion matrix are printed alongside so that failure mode stays visible.
For a screening tool, recall on the positive class matters more than
accuracy: a missed case is worse than a false alarm that a clinician rules
out.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split

_ML_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_ML_ROOT))
sys.path.insert(0, str(_ML_ROOT / "inference"))

from preprocessing import (  # noqa: E402
    compute_imputation_medians,
    normalise_columns,
    prepare_diabetes_features,
)

DATA_PATH = _ML_ROOT / "data" / "diabetes.csv"
MODEL_PATH = _ML_ROOT / "models" / "model_b_diabetes.joblib"
RANDOM_STATE = 42


def main() -> int:
    if not DATA_PATH.exists():
        print(f"ERROR: {DATA_PATH} not found.", file=sys.stderr)
        print("Download it per ml/data/README.md before training.", file=sys.stderr)
        return 1

    import joblib

    print(f"Loading {DATA_PATH.name} ...")
    frame = normalise_columns(pd.read_csv(DATA_PATH))

    if "outcome" not in frame.columns:
        print("ERROR: no 'Outcome' column found - cannot train.", file=sys.stderr)
        return 1

    duplicates = int(frame.duplicated().sum())
    if duplicates:
        print(f"  removing {duplicates} duplicate row(s) to avoid split leakage")
        frame = frame.drop_duplicates().reset_index(drop=True)

    print(f"  {len(frame)} rows")
    print(f"  class balance: {frame['outcome'].value_counts().to_dict()}")

    # Split the RAW frame first, so the medians never see the test half.
    train_frame, test_frame = train_test_split(
        frame,
        test_size=0.2,
        random_state=RANDOM_STATE,
        stratify=frame["outcome"],
    )

    medians = compute_imputation_medians(train_frame)
    print(f"  medians (training split only): { {k: round(v, 1) for k, v in medians.items()} }")

    x_train, y_train, _ = prepare_diabetes_features(train_frame, medians)
    x_test, y_test, _ = prepare_diabetes_features(test_frame, medians)

    model = GradientBoostingClassifier(random_state=RANDOM_STATE)
    print("Training GradientBoostingClassifier ...")
    model.fit(x_train, y_train)

    predictions = model.predict(x_test)
    probabilities = model.predict_proba(x_test)[:, 1]

    accuracy = float(model.score(x_test, y_test))
    auc = float(roc_auc_score(y_test, probabilities))

    # Cross-validated AUC over the whole dataset - the figure worth quoting.
    all_x, all_y, _ = prepare_diabetes_features(frame, medians)
    cv_auc = cross_val_score(
        GradientBoostingClassifier(random_state=RANDOM_STATE),
        all_x,
        all_y,
        cv=StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE),
        scoring="roc_auc",
        n_jobs=-1,
    )

    majority = float(max(all_y.mean(), 1 - all_y.mean()))

    print()
    print(f"  Hold-out accuracy : {accuracy:.4f}  (majority baseline {majority:.4f})")
    print(f"  Hold-out ROC-AUC  : {auc:.4f}")
    print(f"  5-fold CV ROC-AUC : {cv_auc.mean():.4f} (+/- {cv_auc.std() * 2:.4f})  <- quote this")
    print()
    print("  Confusion matrix (rows=actual, cols=predicted):")
    print(confusion_matrix(y_test, predictions))
    print()
    print(classification_report(y_test, predictions, target_names=["no diabetes", "diabetes"]))
    print("  The hold-out test set is ~154 rows, so its ROC-AUC swings by several")
    print("  points between splits. Published results for this dataset sit around")
    print("  0.83-0.85 AUC; treat a materially higher single-split figure with")
    print("  suspicion rather than pride.")
    print()
    print("  For screening, recall on the positive class matters more than")
    print("  accuracy: a missed case is worse than a false alarm a clinician")
    print("  can rule out.")
    print()
    print("  LIMITATION: this cohort is 768 adult women of Pima Indian heritage.")
    print("  It does not generalise to the populations this tool targets.")
    print()

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(
        {
            "model": model,
            "medians": medians,
            "metrics": {
                "accuracy": accuracy,
                "roc_auc_holdout": auc,
                "roc_auc_cv_mean": float(cv_auc.mean()),
                "roc_auc_cv_std": float(cv_auc.std()),
                "majority_baseline": majority,
            },
        },
        MODEL_PATH,
    )
    print(f"Saved {MODEL_PATH.relative_to(_ML_ROOT.parent)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
