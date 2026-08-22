"""Train Model A: 41-disease differential over 132 binary symptoms.

**Honesty caveat (read before trusting the printed accuracy):** the Kaggle
``itachi9604/disease-symptom-description-dataset`` is synthetic and each
disease maps to a near-fixed, near-perfectly-separable symptom pattern.
Random Forest routinely scores ~100% cross-validated accuracy on it. That
number reflects the dataset's construction, **not** real-world diagnostic
performance, and must never be presented as such. This warning is printed
to stdout and also written verbatim into the metrics JSON.

Usage (PowerShell or POSIX shell, run from ``ml/``)::

    python training/train_symptom_model.py
    python training/train_symptom_model.py --fixture   # force the synthetic fixture
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Allow `import feature_spec` / `import training.evaluate` regardless of cwd.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import joblib
import pandas as pd
import sklearn
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder

from feature_spec import MODEL_A_FEATURE_ORDER, RAW_COLUMN_ALIASES
from training.evaluate import evaluate_classifier, write_metrics

RANDOM_STATE = 42

SYNTHETIC_DATASET_CAVEAT = (
    "CAVEAT: this dataset (Kaggle itachi9604/disease-symptom-description-dataset) "
    "is synthetic with a near-fixed symptom pattern per disease, so near-100% "
    "accuracy is expected. It does NOT indicate real-world diagnostic performance. "
    "Treat Model A's output as a screening shortlist, not a diagnosis."
)


def _dataset_path(use_fixture: bool) -> Path:
    ml_root = Path(__file__).resolve().parent.parent
    if use_fixture:
        return ml_root / "data" / "fixtures" / "dataset_fixture.csv"
    return ml_root / "data" / "dataset.csv"


def load_dataset(use_fixture: bool = False) -> pd.DataFrame:
    """Load the Model A training CSV, or raise a clear, actionable error.

    Args:
        use_fixture: If True, load the small synthetic fixture instead of
            the real dataset.

    Returns:
        The raw dataframe with symptom columns plus ``prognosis``.

    Raises:
        FileNotFoundError: If the expected CSV is not present on disk.
    """
    path = _dataset_path(use_fixture)
    if not path.exists():
        raise FileNotFoundError(
            f"Model A dataset not found at '{path}'.\n"
            "Download it first - see ml/data/README.md for exact instructions:\n"
            "  Kaggle dataset: itachi9604/disease-symptom-description-dataset\n"
            "  Expected file:  ml/data/dataset.csv\n"
            "Or pass --fixture to train on the small synthetic fixture instead."
        )
    frame = pd.read_csv(path, comment="#")
    frame.columns = [RAW_COLUMN_ALIASES.get(col.strip(), col.strip()) for col in frame.columns]
    return frame


def prepare_features(frame: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    """Select and order symptom columns, and extract the label column.

    Args:
        frame: Raw dataframe as loaded by :func:`load_dataset`.

    Returns:
        A tuple of (ordered symptom feature dataframe, prognosis labels).
    """
    missing_cols = [col for col in MODEL_A_FEATURE_ORDER if col not in frame.columns]
    if missing_cols:
        raise ValueError(
            f"Dataset is missing expected symptom column(s): {missing_cols}. "
            "This dataset does not match ml/feature_spec.py's MODEL_A_FEATURE_ORDER."
        )
    x = frame[list(MODEL_A_FEATURE_ORDER)].fillna(0).astype(int)
    y = frame["prognosis"].astype(str).str.strip()
    return x, y


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--fixture",
        action="store_true",
        help="Train on the small synthetic fixture instead of the real dataset.",
    )
    args = parser.parse_args()

    print(f"scikit-learn version: {sklearn.__version__}")
    print(SYNTHETIC_DATASET_CAVEAT)

    frame = load_dataset(use_fixture=args.fixture)
    x, y = prepare_features(frame)

    encoder = LabelEncoder()
    y_encoded = encoder.fit_transform(y)

    model = RandomForestClassifier(random_state=RANDOM_STATE)
    metrics = evaluate_classifier(
        model,
        x.values,
        y_encoded,
        feature_names=list(MODEL_A_FEATURE_ORDER),
    )
    metrics["caveat"] = SYNTHETIC_DATASET_CAVEAT
    metrics["sklearn_version"] = sklearn.__version__
    metrics["label_classes"] = encoder.classes_.tolist()

    print(f"Accuracy (cross-validated, {metrics['cv_folds']}-fold): {metrics['accuracy']:.4f}")
    print("Reminder: this figure does NOT indicate real-world performance. See caveat above.")

    ml_root = Path(__file__).resolve().parent.parent
    models_dir = ml_root / "models"
    models_dir.mkdir(parents=True, exist_ok=True)

    # evaluate_classifier() already fits `model` on the full dataset as part
    # of computing feature importances; no need to fit again here.
    joblib.dump(model, models_dir / "symptom_model.joblib")
    joblib.dump(encoder, models_dir / "symptom_label_encoder.joblib")
    write_metrics(metrics, models_dir / "symptom_model_metrics.json")

    print(f"Saved model to {models_dir / 'symptom_model.joblib'}")
    print(f"Saved metrics to {models_dir / 'symptom_model_metrics.json'}")


if __name__ == "__main__":
    main()
