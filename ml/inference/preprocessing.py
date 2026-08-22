"""Shared preprocessing for training and inference.

Every transformation applied to training data MUST also be applied at
inference time, in exactly the same way. Duplicating this logic across the
training scripts and the inference entry point is how train/serve skew
creeps in: a median imputation done one way during training and another way
at inference produces a model that quietly underperforms in production while
looking fine in cross-validation.

So both sides import from here. Nothing in this module is allowed to depend
on anything under ``ml/training/`` or ``ml/inference/inference.py``.

Column naming
-------------
The public dataset CSVs use inconsistent naming (``BloodPressure`` in Pima,
``trestbps`` in Cleveland, ``thalch`` vs ``thalach`` between Cleveland
mirrors). ``normalise_columns`` maps all known variants onto the canonical
names frozen in ``ml/feature_spec.py`` so downstream code sees one vocabulary.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Iterable

import numpy as np
import pandas as pd

# Allow ``python ml/inference/preprocessing.py`` and package-style imports to
# both resolve feature_spec, which lives one directory up.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from feature_spec import (  # noqa: E402
    MODEL_B_FEATURES,
    MODEL_B_ZERO_AS_MISSING,
    MODEL_C_FEATURES,
    build_symptom_vector,
    validate_vector,
)

__all__ = [
    "normalise_columns",
    "prepare_symptom_features",
    "prepare_diabetes_features",
    "prepare_heart_features",
    "compute_imputation_medians",
    "vector_from_patient_diabetes",
    "vector_from_patient_heart",
    "PreprocessingError",
]


class PreprocessingError(ValueError):
    """Raised when input data cannot be prepared for a model."""


# Maps every observed raw column spelling onto our canonical name.
_COLUMN_ALIASES: dict[str, str] = {
    # Pima variants
    "pregnancies": "pregnancies",
    "glucose": "glucose",
    "bloodpressure": "blood_pressure",
    "blood_pressure": "blood_pressure",
    "skinthickness": "skin_thickness",
    "skin_thickness": "skin_thickness",
    "insulin": "insulin",
    "bmi": "bmi",
    "diabetespedigreefunction": "diabetes_pedigree_function",
    "diabetes_pedigree_function": "diabetes_pedigree_function",
    "dpf": "diabetes_pedigree_function",
    "age": "age",
    "outcome": "outcome",
    # Cleveland variants
    "sex": "sex",
    "cp": "cp",
    "chestpaintype": "cp",
    "trestbps": "trestbps",
    "restingbp": "trestbps",
    "chol": "chol",
    "cholesterol": "chol",
    "fbs": "fbs",
    "fastingbs": "fbs",
    "restecg": "restecg",
    "restingecg": "restecg",
    "thalach": "thalach",
    "thalch": "thalach",
    "maxhr": "thalach",
    "exang": "exang",
    "exerciseangina": "exang",
    "oldpeak": "oldpeak",
    "slope": "slope",
    "st_slope": "slope",
    "ca": "ca",
    "thal": "thal",
    "num": "target",
    "target": "target",
    "heartdisease": "target",
    # Symptom dataset
    "disease": "disease",
    "prognosis": "disease",
}


def normalise_columns(frame: pd.DataFrame) -> pd.DataFrame:
    """Return a copy of ``frame`` with canonical lowercase column names."""
    renamed = {}
    for column in frame.columns:
        key = str(column).strip().lower().replace(" ", "").replace("-", "")
        renamed[column] = _COLUMN_ALIASES.get(key, str(column).strip().lower().replace(" ", "_"))
    return frame.rename(columns=renamed)


# ---------------------------------------------------------------------------
# Model A - symptom differential
# ---------------------------------------------------------------------------
def prepare_symptom_features(frame: pd.DataFrame) -> tuple[np.ndarray, pd.Series]:
    """Convert the raw symptom dataset into a binary matrix and label series.

    The Kaggle dataset stores symptoms as up to 17 free-text columns per row
    (``Symptom_1`` ... ``Symptom_17``) padded with NaN, not as a binary matrix.
    Each row is collapsed into a 132-length vector via ``build_symptom_vector``
    so column positions match the frozen specification.

    Unrecognised symptom strings are skipped rather than raising: the raw CSV
    contains whitespace and spelling inconsistencies, and dropping a rare
    unmapped symptom is preferable to failing the whole training run.
    """
    frame = normalise_columns(frame)

    if "disease" not in frame.columns:
        raise PreprocessingError(
            "Symptom dataset must contain a 'Disease' (or 'prognosis') column. "
            f"Found: {list(frame.columns)[:8]}"
        )

    symptom_columns = [c for c in frame.columns if c.startswith("symptom_")]

    if symptom_columns:
        rows = []
        for _, row in frame[symptom_columns].iterrows():
            names: Iterable[str] = (
                str(value) for value in row.tolist() if isinstance(value, str) and value.strip()
            )
            rows.append(build_symptom_vector(names, strict=False))
        matrix = np.asarray(rows, dtype=np.int8)
    else:
        # Already a wide binary matrix - reorder onto the frozen spec.
        from feature_spec import MODEL_A_SYMPTOMS

        missing = [s for s in MODEL_A_SYMPTOMS if s not in frame.columns]
        if missing:
            raise PreprocessingError(
                f"Symptom matrix is missing {len(missing)} expected column(s), "
                f"e.g. {missing[:5]}"
            )
        matrix = frame[list(MODEL_A_SYMPTOMS)].to_numpy(dtype=np.int8)

    labels = frame["disease"].astype(str).str.strip()
    return matrix, labels


# ---------------------------------------------------------------------------
# Model B - diabetes risk
# ---------------------------------------------------------------------------
def compute_imputation_medians(frame: pd.DataFrame) -> dict[str, float]:
    """Compute medians for Pima columns where zero encodes 'missing'.

    These medians are saved alongside the trained model and reused verbatim at
    inference time. Recomputing them from a single patient record at inference
    would be meaningless, and using a different value than training saw is
    exactly the train/serve skew this module exists to prevent.
    """
    frame = normalise_columns(frame)
    medians: dict[str, float] = {}
    for column in MODEL_B_ZERO_AS_MISSING:
        if column in frame.columns:
            valid = frame.loc[frame[column] != 0, column]
            medians[column] = float(valid.median()) if not valid.empty else 0.0
    return medians


def prepare_diabetes_features(
    frame: pd.DataFrame,
    medians: dict[str, float] | None = None,
) -> tuple[np.ndarray, pd.Series | None, dict[str, float]]:
    """Prepare Pima features, treating encoded zeros as missing values.

    In the raw Pima CSV a zero in glucose, blood pressure, skin thickness,
    insulin or BMI is a *missing reading*, not a measurement - a living person
    does not have a blood pressure of zero. Left untouched these zeros drag
    the decision boundaries toward physiologically impossible values.

    Returns:
        ``(features, labels_or_None, medians_used)``
    """
    frame = normalise_columns(frame)

    missing = [c for c in MODEL_B_FEATURES if c not in frame.columns]
    if missing:
        raise PreprocessingError(
            f"Diabetes dataset is missing column(s): {missing}. "
            f"Found: {list(frame.columns)}"
        )

    if medians is None:
        medians = compute_imputation_medians(frame)

    features = frame[list(MODEL_B_FEATURES)].astype(float).copy()
    for column, median in medians.items():
        if column in features.columns:
            features.loc[features[column] == 0, column] = median

    labels = frame["outcome"].astype(int) if "outcome" in frame.columns else None
    return features.to_numpy(dtype=float), labels, medians


def vector_from_patient_diabetes(
    patient: dict[str, Any],
    medians: dict[str, float] | None = None,
) -> list[float]:
    """Build one ordered Model B vector from a normalised patient record.

    Unknown fields fall back to the training median where one is available,
    then to zero. The result is validated against the frozen spec before it is
    returned, so a positional error surfaces here rather than as a confident
    but meaningless prediction.
    """
    medians = medians or {}
    vitals = patient.get("vitals") or {}
    labs = patient.get("labs") or {}
    demographics = patient.get("demographics") or {}

    lookup: dict[str, Any] = {
        "pregnancies": demographics.get("pregnancies", 0),
        "glucose": labs.get("glucose"),
        "blood_pressure": vitals.get("diastolic_bp"),
        "skin_thickness": labs.get("skin_thickness"),
        "insulin": labs.get("insulin"),
        "bmi": vitals.get("bmi"),
        "diabetes_pedigree_function": labs.get("diabetes_pedigree_function", 0.3725),
        "age": demographics.get("age"),
    }

    vector: list[float] = []
    for name in MODEL_B_FEATURES:
        value = lookup.get(name)
        if value in (None, ""):
            value = medians.get(name, 0.0)
        try:
            vector.append(float(value))
        except (TypeError, ValueError):
            vector.append(float(medians.get(name, 0.0)))

    validate_vector("model_b", vector, MODEL_B_FEATURES)
    return vector


# ---------------------------------------------------------------------------
# Model C - cardiac risk
# ---------------------------------------------------------------------------
def prepare_heart_features(frame: pd.DataFrame) -> tuple[np.ndarray, pd.Series | None]:
    """Prepare Cleveland features.

    The UCI original encodes missing values as ``?`` in ``ca`` and ``thal``;
    these become NaN and are median-imputed. The target is binarised: the raw
    ``num`` column is 0-4 severity, and any value above zero indicates disease
    present, which is the standard treatment for this dataset.
    """
    frame = normalise_columns(frame).replace("?", np.nan)

    missing = [c for c in MODEL_C_FEATURES if c not in frame.columns]
    if missing:
        raise PreprocessingError(
            f"Heart dataset is missing column(s): {missing}. "
            f"Found: {list(frame.columns)}"
        )

    features = frame[list(MODEL_C_FEATURES)].copy()

    # Categorical text (some mirrors ship strings for sex/cp/exang) -> codes.
    for column in features.columns:
        if features[column].dtype == object:
            converted = pd.to_numeric(features[column], errors="coerce")
            if converted.isna().all():
                converted = features[column].astype("category").cat.codes.astype(float)
            features[column] = converted

    features = features.astype(float)
    features = features.fillna(features.median(numeric_only=True)).fillna(0.0)

    labels = None
    if "target" in frame.columns:
        raw = pd.to_numeric(frame["target"], errors="coerce").fillna(0)
        labels = (raw > 0).astype(int)

    return features.to_numpy(dtype=float), labels


def vector_from_patient_heart(patient: dict[str, Any]) -> list[float]:
    """Build one ordered Model C vector from a normalised patient record.

    Fields the intake form does not collect (``ca``, ``thal``, ``slope``,
    ``oldpeak``) default to their dataset-typical values. This is a real
    limitation and is documented in ml/README.md: cardiac risk from a partial
    record is a coarser estimate than the model's headline metrics imply.
    """
    vitals = patient.get("vitals") or {}
    labs = patient.get("labs") or {}
    demographics = patient.get("demographics") or {}

    sex = demographics.get("sex") or demographics.get("gender") or ""
    sex_code = 1.0 if str(sex).strip().lower() in {"m", "male", "1"} else 0.0

    glucose = labs.get("glucose")
    try:
        fbs = 1.0 if glucose is not None and float(glucose) > 120 else 0.0
    except (TypeError, ValueError):
        fbs = 0.0

    lookup: dict[str, Any] = {
        "age": demographics.get("age", 50),
        "sex": sex_code,
        "cp": labs.get("chest_pain_type", 0),
        "trestbps": vitals.get("systolic_bp", 130),
        "chol": labs.get("cholesterol", 240),
        "fbs": fbs,
        "restecg": labs.get("resting_ecg", 0),
        "thalach": vitals.get("max_heart_rate", vitals.get("heart_rate", 150)),
        "exang": labs.get("exercise_angina", 0),
        "oldpeak": labs.get("st_depression", 0.0),
        "slope": labs.get("st_slope", 1),
        "ca": labs.get("major_vessels", 0),
        "thal": labs.get("thalassemia", 2),
    }

    vector: list[float] = []
    for name in MODEL_C_FEATURES:
        value = lookup.get(name)
        try:
            vector.append(float(value))
        except (TypeError, ValueError):
            vector.append(0.0)

    validate_vector("model_c", vector, MODEL_C_FEATURES)
    return vector
