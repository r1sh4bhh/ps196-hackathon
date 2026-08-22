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

Categorical encoding
--------------------
Some mirrors of the UCI heart data ship ``sex``, ``cp``, ``exang``, ``slope``
and ``thal`` as human-readable text rather than the original numeric codes.
These are decoded with **explicit value maps**, never with
``pandas.Categorical.codes``.

That distinction is important. ``cat.codes`` assigns integers in alphabetical
order, so ``thal`` would become ``fixed defect=0, normal=1, reversable=2`` -
while the original UCI encoding is ``normal=3, fixed defect=6,
reversable defect=7``. Inference would then send a value meaning one thing
and the model would interpret it as another, with no error raised anywhere.
Silent disagreements about what a number means are precisely what the frozen
feature spec exists to prevent.

Derived values
--------------
The intake form collects height and weight, not BMI. ``derive_bmi`` computes
it so the model receives the patient's actual value rather than falling back
to a training median - see the note on that function for why this was a real
bug, not a hypothetical one.
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
    "derive_bmi",
    "vector_from_patient_diabetes",
    "vector_from_patient_heart",
    "HEART_VALUE_MAPS",
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


# Explicit text -> numeric maps for the UCI heart data. Keys are lowercased
# and stripped before lookup. Values follow the ORIGINAL UCI encoding so that
# the numbers mean the same thing here, in the model, and in
# vector_from_patient_heart below.
HEART_VALUE_MAPS: dict[str, dict[str, float]] = {
    "sex": {
        "male": 1.0,
        "m": 1.0,
        "female": 0.0,
        "f": 0.0,
    },
    "cp": {
        "typical angina": 1.0,
        "atypical angina": 2.0,
        "non-anginal": 3.0,
        "non-anginal pain": 3.0,
        "asymptomatic": 4.0,
    },
    "fbs": {
        "true": 1.0,
        "false": 0.0,
        "yes": 1.0,
        "no": 0.0,
    },
    "restecg": {
        "normal": 0.0,
        "st-t abnormality": 1.0,
        "st-t wave abnormality": 1.0,
        "lv hypertrophy": 2.0,
        "left ventricular hypertrophy": 2.0,
    },
    "exang": {
        "true": 1.0,
        "false": 0.0,
        "yes": 1.0,
        "no": 0.0,
    },
    "slope": {
        "upsloping": 1.0,
        "flat": 2.0,
        "downsloping": 3.0,
    },
    "thal": {
        "normal": 3.0,
        "fixed defect": 6.0,
        "reversable defect": 7.0,
        "reversible defect": 7.0,
    },
}

# Values used when the intake form does not supply a field. These MUST be
# expressible in the same encoding as HEART_VALUE_MAPS above - sending cp=0 or
# thal=2 would be sending a code that does not exist in the training data.
HEART_DEFAULTS: dict[str, float] = {
    "age": 50.0,
    "sex": 0.0,
    "cp": 4.0,  # asymptomatic - the neutral presentation for screening
    "trestbps": 130.0,
    "chol": 240.0,
    "fbs": 0.0,
    "restecg": 0.0,  # normal
    "thalach": 150.0,
    "exang": 0.0,
    "oldpeak": 0.0,
    "slope": 2.0,  # flat - the modal value in Cleveland
    "ca": 0.0,
    "thal": 3.0,  # normal, in the 3/6/7 encoding
}


def normalise_columns(frame: pd.DataFrame) -> pd.DataFrame:
    """Return a copy of ``frame`` with canonical lowercase column names."""
    renamed = {}
    for column in frame.columns:
        key = str(column).strip().lower().replace(" ", "").replace("-", "")
        renamed[column] = _COLUMN_ALIASES.get(key, str(column).strip().lower().replace(" ", "_"))
    return frame.rename(columns=renamed)


def derive_bmi(vitals: dict[str, Any]) -> float | None:
    """Return BMI from an explicit value, or compute it from height and weight.

    The intake form collects height and weight; it does not ask for BMI. Before
    this existed, ``vector_from_patient_diabetes`` looked only for a ``bmi``
    key, found nothing, and silently substituted the training median of ~32.4 -
    so a patient with a measured BMI of 28.4 was scored as if obese, with no
    warning anywhere. BMI is one of the stronger Pima predictors, so this
    materially moved the risk score.

    The clinical rules already derived BMI correctly from the same fields. The
    lesson is that a fallback default is only safe when the value genuinely is
    unknown - reaching for one while the real data sits unread in the request
    is a silent wrong answer, which is worse than a loud failure.

    Accepts height in centimetres or metres, and weight in kilograms. Returns
    ``None`` when the inputs are absent or not physiologically plausible,
    letting the caller fall back to a median and report ``partial_input``.
    """
    if not isinstance(vitals, dict):
        return None

    explicit = vitals.get("bmi")
    if explicit not in (None, ""):
        try:
            value = float(explicit)
            if 8.0 <= value <= 100.0:
                return round(value, 1)
        except (TypeError, ValueError):
            pass

    weight = vitals.get("weight_kg", vitals.get("weight"))
    height = vitals.get("height_cm", vitals.get("height"))

    if weight in (None, "") or height in (None, ""):
        return None

    try:
        weight = float(weight)
        height = float(height)
    except (TypeError, ValueError):
        return None

    # Accept metres as well as centimetres; anything under 3 is clearly metres.
    if height < 3.0:
        height *= 100.0

    if not (50.0 <= height <= 260.0) or not (2.0 <= weight <= 500.0):
        return None

    bmi = weight / ((height / 100.0) ** 2)

    if not (8.0 <= bmi <= 100.0):
        return None

    return round(bmi, 1)


def _decode_heart_column(series: pd.Series, name: str) -> pd.Series:
    """Convert one heart-data column to float, decoding text via explicit maps.

    Handles three shapes seen across mirrors: already numeric, boolean
    (``True``/``False`` for fbs and exang), and human-readable text.

    Note this checks for text with ``pandas.api.types.is_numeric_dtype``
    rather than ``dtype == object``. Under pandas 3.0 string columns are
    ``StringDtype``, not ``object``, so an object-identity check silently
    fails to fire and the strings reach ``astype(float)``.
    """
    if pd.api.types.is_bool_dtype(series):
        return series.astype(float)

    if pd.api.types.is_numeric_dtype(series):
        return series.astype(float)

    text = series.astype("string").str.strip().str.lower()

    # A mirror may ship numbers stored as text; take those directly.
    numeric = pd.to_numeric(text, errors="coerce")

    value_map = HEART_VALUE_MAPS.get(name)
    if value_map is not None:
        mapped = text.map(value_map)
        # Prefer the explicit map, fall back to any parsed number.
        numeric = mapped.astype(float).fillna(numeric)

    return numeric.astype(float)


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

    Callers that are about to evaluate a model should pass ONLY the training
    split here. Computing medians over the full dataset lets test-set values
    influence the imputation, which leaks information across the split and
    flatters the reported metrics.
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

    Args:
        frame: Raw or normalised Pima data.
        medians: Pre-computed medians to apply. Pass the training-split
            medians when preparing a test split, so no test information is
            used to impute.

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

    BMI is derived from height and weight when not supplied directly, so a
    measured value is never discarded in favour of a median.

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
        "bmi": derive_bmi(vitals),
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
    """Prepare heart features, decoding text categoricals via explicit maps.

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

    for column in features.columns:
        features[column] = _decode_heart_column(features[column], column)

    # Any value that neither parsed as a number nor matched a known category
    # is now NaN. Impute with the column median, then zero as a last resort
    # for a column that is entirely missing.
    features = features.fillna(features.median(numeric_only=True)).fillna(0.0)

    labels = None
    if "target" in frame.columns:
        raw = pd.to_numeric(frame["target"], errors="coerce").fillna(0)
        labels = (raw > 0).astype(int)

    return features.to_numpy(dtype=float), labels


def vector_from_patient_heart(patient: dict[str, Any]) -> list[float]:
    """Build one ordered Model C vector from a normalised patient record.

    Fields the intake form does not collect (``ca``, ``thal``, ``slope``,
    ``oldpeak``) fall back to ``HEART_DEFAULTS``, which are expressed in the
    same encoding the model was trained on. This is a real limitation and is
    surfaced to the caller as ``partial_input: true``: cardiac risk from a
    partial record is a coarser estimate than the model's headline metrics
    imply.
    """
    vitals = patient.get("vitals") or {}
    labs = patient.get("labs") or {}
    demographics = patient.get("demographics") or {}

    sex = demographics.get("sex") or demographics.get("gender") or ""
    sex_code = HEART_VALUE_MAPS["sex"].get(str(sex).strip().lower(), HEART_DEFAULTS["sex"])

    glucose = labs.get("glucose")
    try:
        fbs = 1.0 if glucose is not None and float(glucose) > 120 else 0.0
    except (TypeError, ValueError):
        fbs = 0.0

    lookup: dict[str, Any] = {
        "age": demographics.get("age"),
        "sex": sex_code,
        "cp": labs.get("chest_pain_type"),
        "trestbps": vitals.get("systolic_bp"),
        "chol": labs.get("cholesterol"),
        "fbs": fbs,
        "restecg": labs.get("resting_ecg"),
        "thalach": vitals.get("max_heart_rate", vitals.get("heart_rate")),
        "exang": labs.get("exercise_angina"),
        "oldpeak": labs.get("st_depression"),
        "slope": labs.get("st_slope"),
        "ca": labs.get("major_vessels"),
        "thal": labs.get("thalassemia"),
    }

    vector: list[float] = []
    for name in MODEL_C_FEATURES:
        value = lookup.get(name)

        # Allow text for the categorical fields, decoded the same way the
        # training data was.
        if isinstance(value, str) and name in HEART_VALUE_MAPS:
            value = HEART_VALUE_MAPS[name].get(value.strip().lower())

        if value is None or value == "":
            vector.append(HEART_DEFAULTS[name])
            continue

        try:
            vector.append(float(value))
        except (TypeError, ValueError):
            vector.append(HEART_DEFAULTS[name])

    validate_vector("model_c", vector, MODEL_C_FEATURES)
    return vector
