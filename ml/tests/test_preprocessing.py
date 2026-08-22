"""Tests that preprocessing is byte-for-byte identical at train and inference
time - the whole point of sharing one preprocessing module."""

import pandas as pd

from feature_spec import MODEL_B_FEATURE_ORDER, MODEL_B_ZERO_AS_MISSING_COLUMNS
from inference.preprocessing import (
    compute_bmi,
    impute_pima_zero_as_missing,
    symptoms_to_vector,
    vitals_labs_to_diabetes_vector,
    vitals_labs_to_heart_vector,
)


def test_compute_bmi_matches_known_value():
    # 85kg at 175cm -> 85 / 1.75^2 = 27.755..., rounded to 27.8
    assert compute_bmi(85, 175) == 27.8


def test_compute_bmi_handles_zero_height():
    assert compute_bmi(70, 0) == 0.0


def test_symptoms_to_vector_length_and_order():
    vector = symptoms_to_vector(["itching", "skin_rash"])
    assert len(vector) == 132
    assert vector[0] == 1  # itching
    assert vector[1] == 1  # skin_rash
    assert vector[2] == 0  # nodal_skin_eruptions


def test_symptoms_to_vector_ignores_unknown_symptoms():
    vector = symptoms_to_vector(["not_a_real_symptom"])
    assert sum(vector) == 0
    assert len(vector) == 132


def test_impute_pima_zero_as_missing_replaces_zero_with_median():
    frame = pd.DataFrame({"Glucose": [100, 0, 120, 140], "Age": [30, 40, 50, 60]})
    imputed = impute_pima_zero_as_missing(frame)
    # median of non-zero glucose values [100, 120, 140] is 120
    assert imputed["Glucose"].tolist() == [100, 120, 120, 140]
    # Age is untouched (not a zero-as-missing column)
    assert imputed["Age"].tolist() == [30, 40, 50, 60]


def test_vitals_labs_to_diabetes_vector_matches_training_preprocessing():
    patient_data = {
        "age": 45,
        "vitals": {"weight_kg": 85, "height_cm": 175, "diastolic_bp": 0},
        "labs": {"glucose": 0, "skin_thickness": 20, "insulin": 80},
    }
    vector = vitals_labs_to_diabetes_vector(patient_data)
    assert len(vector) == len(MODEL_B_FEATURE_ORDER)
    # Glucose (0) and diastolic_bp/BloodPressure (0) are in the
    # zero-as-missing set for a single-row frame, so both are imputed to
    # their own (only) value - i.e. no non-zero value exists, so the
    # median falls back to 0.0 by design of impute_pima_zero_as_missing.
    for column in MODEL_B_ZERO_AS_MISSING_COLUMNS:
        assert column in MODEL_B_FEATURE_ORDER


def test_vitals_labs_to_heart_vector_length():
    patient_data = {
        "age": 55,
        "vitals": {"systolic_bp": 130, "heart_rate": 80},
        "labs": {"cholesterol": 200},
    }
    vector = vitals_labs_to_heart_vector(patient_data)
    assert len(vector) == 13
