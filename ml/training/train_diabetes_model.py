"""Train Model B: Pima Indians diabetes risk classifier.

Zeros in ``Glucose``, ``BloodPressure``, ``SkinThickness``, ``Insulin``, and
``BMI`` are missing values, not physiological readings of zero - they are
median-imputed before training via
``ml.inference.preprocessing.impute_pima_zero_as_missing``, the exact same
function used at inference time. Expected accuracy on the real dataset is
roughly 75-80%; this script never hardcodes that figure, it only reports
whatever ``evaluate.py`` actually measures.

Usage (run from ``ml/``)::

    python training/train_diabetes_model.py
    python training/train_diabetes_model.py --fixture
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import joblib
import pandas as pd
import sklearn
from sklearn.ensemble import RandomForestClassifier

from feature_spec import MODEL_B_FEATURE_ORDER
from inference.preprocessing import impute_pima_zero_as_missing
from training.evaluate import evaluate_classifier, write_metrics

RANDOM_STATE = 42


def _dataset_path(use_fixture: bool) -> Path:
    ml_root = Path(__file__).resolve().parent.parent
    if use_fixture:
        return ml_root / "data" / "fixtures" / "diabetes_fixture.csv"
    return ml_root / "data" / "diabetes.csv"


def load_dataset(use_fixture: bool = False) -> pd.DataFrame:
    """Load the Pima diabetes CSV, or raise a clear, actionable error.

    Args:
        use_fixture: If True, load the small synthetic fixture instead of
            the real dataset.

    Returns:
        The raw dataframe with feature columns plus ``Outcome``.

    Raises:
        FileNotFoundError: If the expected CSV is not present on disk.
    """
    path = _dataset_path(use_fixture)
    if not path.exists():
        raise FileNotFoundError(
            f"Model B dataset not found at '{path}'.\n"
            "Download it first - see ml/data/README.md for exact instructions:\n"
            "  Dataset: Pima Indians Diabetes Database (768 rows)\n"
            "  Expected file: ml/data/diabetes.csv\n"
            "Or pass --fixture to train on the small synthetic fixture instead."
        )
    return pd.read_csv(path, comment="#")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--fixture",
        action="store_true",
        help="Train on the small synthetic fixture instead of the real dataset.",
    )
    args = parser.parse_args()

    print(f"scikit-learn version: {sklearn.__version__}")

    frame = load_dataset(use_fixture=args.fixture)
    frame = impute_pima_zero_as_missing(frame)

    x = frame[list(MODEL_B_FEATURE_ORDER)]
    y = frame["Outcome"].astype(int)

    model = RandomForestClassifier(random_state=RANDOM_STATE)
    metrics = evaluate_classifier(
        model,
        x.values,
        y.values,
        feature_names=list(MODEL_B_FEATURE_ORDER),
        binary_positive_label=1,
    )
    metrics["sklearn_version"] = sklearn.__version__
    metrics["note"] = (
        "Zeros in Glucose/BloodPressure/SkinThickness/Insulin/BMI were treated as "
        "missing and median-imputed before training, matching inference preprocessing."
    )

    print(f"Accuracy (cross-validated, {metrics['cv_folds']}-fold): {metrics['accuracy']:.4f}")
    if "roc_auc" in metrics:
        print(f"ROC-AUC: {metrics['roc_auc']:.4f}")

    ml_root = Path(__file__).resolve().parent.parent
    models_dir = ml_root / "models"
    models_dir.mkdir(parents=True, exist_ok=True)

    # evaluate_classifier() already fits `model` on the full dataset as part
    # of computing feature importances; no need to fit again here.
    joblib.dump(model, models_dir / "diabetes_model.joblib")
    write_metrics(metrics, models_dir / "diabetes_model_metrics.json")

    print(f"Saved model to {models_dir / 'diabetes_model.joblib'}")
    print(f"Saved metrics to {models_dir / 'diabetes_model_metrics.json'}")


if __name__ == "__main__":
    main()
