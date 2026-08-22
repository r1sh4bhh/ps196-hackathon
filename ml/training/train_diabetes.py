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

Why accuracy alone is reported as insufficient here
---------------------------------------------------
The Pima classes are roughly 65/35, so a model that always predicts "no
diabetes" scores 65% while being clinically useless. ROC-AUC and the
confusion matrix are printed alongside so the failure mode is visible.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score
from sklearn.model_selection import train_test_split

_ML_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_ML_ROOT))
sys.path.insert(0, str(_ML_ROOT / "inference"))

from preprocessing import prepare_diabetes_features  # noqa: E402

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
    frame = pd.read_csv(DATA_PATH)
    features, labels, medians = prepare_diabetes_features(frame)

    if labels is None:
        print("ERROR: no 'Outcome' column found - cannot train.", file=sys.stderr)
        return 1

    print(f"  {features.shape[0]} rows, {features.shape[1]} features")
    print(f"  class balance: {labels.value_counts().to_dict()}")
    print(f"  imputed medians: { {k: round(v, 1) for k, v in medians.items()} }")

    x_train, x_test, y_train, y_test = train_test_split(
        features,
        labels,
        test_size=0.2,
        random_state=RANDOM_STATE,
        stratify=labels,
    )

    model = GradientBoostingClassifier(random_state=RANDOM_STATE)
    print("Training GradientBoostingClassifier ...")
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
    print(classification_report(y_test, predictions, target_names=["no diabetes", "diabetes"]))
    print("  NOTE: baseline accuracy from always predicting the majority class")
    print(f"  is {max(labels.mean(), 1 - labels.mean()):.4f}. Judge the model against")
    print("  that, and prefer ROC-AUC and recall over raw accuracy.")
    print()
    print("  LIMITATION: this cohort is 768 adult women of Pima Indian heritage.")
    print("  It does not generalise to the populations this tool targets.")
    print()

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(
        {
            "model": model,
            "medians": medians,
            "metrics": {"accuracy": accuracy, "roc_auc": auc},
        },
        MODEL_PATH,
    )
    print(f"Saved {MODEL_PATH.relative_to(_ML_ROOT.parent)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
