"""Shared preprocessing used identically by training and inference.

Both ``ml/training/*.py`` and ``ml/inference/inference.py`` import from this
module. There must be **no duplicated preprocessing logic** anywhere else -
if training and inference preprocess data differently, evaluation metrics
become meaningless.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from feature_spec import (
    MODEL_A_FEATURE_ORDER,
    MODEL_B_FEATURE_ORDER,
    MODEL_B_ZERO_AS_MISSING_COLUMNS,
    MODEL_C_FEATURE_ORDER,
    validate_named_vector,
)


def impute_pima_zero_as_missing(frame: pd.DataFrame) -> pd.DataFrame:
    """Median-impute Pima columns where ``0`` means "missing", not a reading.

    ``Glucose``, ``BloodPressure``, ``SkinThickness``, ``Insulin``, and
    ``BMI`` are physiologically impossible at zero; the Pima dataset uses
    zero to encode a missing measurement. This function replaces zeros in
    those columns with the column median (computed on non-zero values) and
    must be used identically at training time and at inference time.

    Args:
        frame: A dataframe containing (a subset of) the Pima columns.

    Returns:
        A new dataframe with zeros replaced by the column median.
    """
    result = frame.copy()
    for column in MODEL_B_ZERO_AS_MISSING_COLUMNS:
        if column not in result.columns:
            continue
        non_zero = result[column][result[column] != 0]
        median = non_zero.median() if len(non_zero) > 0 else 0.0
        result[column] = result[column].replace(0, median)
    return result


def symptoms_to_vector(symptoms: list[str]) -> list[int]:
    """Convert a list of symptom names into Model A's 132-length binary vector.

    Unknown symptom names are silently ignored (they contribute no signal)
    rather than raising, since user-entered free text may not perfectly
    match the canonical vocabulary. The resulting vector always has the
    correct length and order per ``MODEL_A_FEATURE_ORDER``.

    Args:
        symptoms: Symptom names reported for a patient.

    Returns:
        A binary vector, one entry per symptom in ``MODEL_A_FEATURE_ORDER``.
    """
    present = set(symptoms or [])
    return [1 if symptom in present else 0 for symptom in MODEL_A_FEATURE_ORDER]


def compute_bmi(weight_kg: float, height_cm: float) -> float:
    """Compute BMI = weight(kg) / height(m)^2.

    Args:
        weight_kg: Weight in kilograms.
        height_cm: Height in centimeters.

    Returns:
        BMI rounded to 1 decimal place, or ``0.0`` if height is not positive.
    """
    if not height_cm or height_cm <= 0:
        return 0.0
    height_m = height_cm / 100.0
    return round(weight_kg / (height_m**2), 1)


def vitals_labs_to_diabetes_vector(patient_data: dict[str, Any]) -> list[float]:
    """Build Model B's ordered, imputed feature vector from raw patient data.

    Args:
        patient_data: Raw patient payload containing ``vitals``, ``labs``,
            and optionally ``age`` / ``pregnancies``.

    Returns:
        Ordered feature list matching ``MODEL_B_FEATURE_ORDER``, with
        zero-as-missing columns median-imputed exactly as in training.
    """
    vitals = patient_data.get("vitals", {}) or {}
    labs = patient_data.get("labs", {}) or {}

    weight = vitals.get("weight_kg", 0)
    height = vitals.get("height_cm", 0)
    bmi = vitals.get("bmi") or compute_bmi(weight, height)

    raw = {
        "Pregnancies": patient_data.get("pregnancies", 0),
        "Glucose": labs.get("glucose", 0),
        "BloodPressure": vitals.get("diastolic_bp", 0),
        "SkinThickness": labs.get("skin_thickness", 0),
        "Insulin": labs.get("insulin", 0),
        "BMI": bmi,
        "DiabetesPedigreeFunction": patient_data.get("diabetes_pedigree_function", 0.5),
        "Age": patient_data.get("age", 0),
    }

    frame = pd.DataFrame([raw])
    frame = impute_pima_zero_as_missing(frame)
    imputed = frame.iloc[0].to_dict()
    return validate_named_vector(imputed, MODEL_B_FEATURE_ORDER)


def vitals_labs_to_heart_vector(patient_data: dict[str, Any]) -> list[float]:
    """Build Model C's ordered feature vector from raw patient data.

    Missing fields default to clinically neutral values rather than zero
    where zero would be meaningful (e.g. ``thal`` defaults to ``3`` -
    "normal" in the Cleveland encoding - not ``0``, which is not a valid
    category in that dataset).

    Args:
        patient_data: Raw patient payload containing ``vitals`` and ``labs``.

    Returns:
        Ordered feature list matching ``MODEL_C_FEATURE_ORDER``.
    """
    vitals = patient_data.get("vitals", {}) or {}
    labs = patient_data.get("labs", {}) or {}

    raw = {
        "age": patient_data.get("age", 0),
        "sex": patient_data.get("sex", 0),
        "cp": labs.get("chest_pain_type", 0),
        "trestbps": vitals.get("systolic_bp", 0),
        "chol": labs.get("cholesterol", 0),
        "fbs": 1 if labs.get("glucose", 0) > 120 else 0,
        "restecg": labs.get("restecg", 0),
        "thalach": vitals.get("heart_rate", 0),
        "exang": labs.get("exercise_angina", 0),
        "oldpeak": labs.get("st_depression", 0.0),
        "slope": labs.get("st_slope", 1),
        "ca": labs.get("num_major_vessels", 0),
        "thal": labs.get("thal", 3),
    }
    return validate_named_vector(raw, MODEL_C_FEATURE_ORDER)


def bmi_from_patient_data(patient_data: dict[str, Any]) -> float:
    """Return the patient's BMI, computing it from vitals if not provided."""
    vitals = patient_data.get("vitals", {}) or {}
    if vitals.get("bmi"):
        return float(vitals["bmi"])
    return compute_bmi(vitals.get("weight_kg", 0), vitals.get("height_cm", 0))


def to_numpy(vector: list[float]) -> np.ndarray:
    """Convert an ordered feature list into a 2D numpy array for sklearn."""
    return np.array(vector, dtype=float).reshape(1, -1)
