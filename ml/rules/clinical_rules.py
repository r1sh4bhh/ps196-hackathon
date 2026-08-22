"""Deterministic clinical rules for hypertension and obesity.

Hypertension and obesity are **rule-based, not ML**, by deliberate design:

- Obesity is derived from BMI = weight(kg) / height(m)^2. Training a model
  to predict a value that is a closed-form function of two of its own
  inputs is circular - it can only ever re-learn arithmetic, with added
  noise and no benefit.
- Hypertension is defined directly by blood-pressure thresholds published
  by the ACC/AHA. There is no ambiguity or hidden pattern for a model to
  learn; the guideline *is* the rule.

Every output from this module carries ``"source": "rule"`` so that
downstream consumers (``ml/inference/inference.py``, and eventually the
backend) can never mistake a deterministic rule for an ML prediction.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from inference.preprocessing import compute_bmi


def classify_hypertension(systolic: float, diastolic: float) -> dict[str, Any]:
    """Stage blood pressure per the ACC/AHA 2017 guideline.

    Staging thresholds (ACC/AHA 2017 High Blood Pressure Clinical Practice
    Guideline):

    - Normal:          systolic < 120  and diastolic < 80
    - Elevated:        120 <= systolic < 130  and diastolic < 80
    - Stage 1:         130 <= systolic < 140  or  80 <= diastolic < 90
    - Stage 2:         systolic >= 140  or  diastolic >= 90

    When systolic and diastolic values fall into different bands, the
    higher (more severe) stage governs, matching standard clinical
    practice.

    Args:
        systolic: Systolic blood pressure in mmHg.
        diastolic: Diastolic blood pressure in mmHg.

    Returns:
        A dict with ``stage``, the input readings, and ``source: "rule"``.
    """
    if systolic >= 140 or diastolic >= 90:
        stage = "stage_2"
    elif systolic >= 130 or diastolic >= 80:
        stage = "stage_1"
    elif systolic >= 120:
        stage = "elevated"
    else:
        stage = "normal"

    return {
        "stage": stage,
        "systolic_bp": systolic,
        "diastolic_bp": diastolic,
        "criteria": "ACC/AHA 2017 (stage 1 >= 130/80, stage 2 >= 140/90)",
        "source": "rule",
    }


def classify_bmi(bmi: float) -> dict[str, Any]:
    """Classify BMI per the standard WHO/CDC adult weight categories.

    Categories:

    - Underweight: BMI < 18.5
    - Normal:      18.5 <= BMI < 25.0
    - Overweight:  25.0 <= BMI < 30.0
    - Obese:       BMI >= 30.0

    Args:
        bmi: Body mass index (kg/m^2).

    Returns:
        A dict with ``class``, ``bmi``, and ``source: "rule"``.
    """
    if bmi >= 30.0:
        weight_class = "obese"
    elif bmi >= 25.0:
        weight_class = "overweight"
    elif bmi >= 18.5:
        weight_class = "normal"
    else:
        weight_class = "underweight"

    return {
        "class": weight_class,
        "bmi": bmi,
        "criteria": "WHO/CDC adult BMI categories (obese >= 30.0)",
        "source": "rule",
    }


def evaluate_clinical_rules(patient_data: dict[str, Any]) -> dict[str, Any]:
    """Run every deterministic clinical rule over raw patient data.

    Args:
        patient_data: Raw patient payload containing a ``vitals`` dict with
            ``systolic_bp``, ``diastolic_bp``, ``weight_kg``, ``height_cm``.

    Returns:
        A dict with ``hypertension`` and ``obesity`` findings, each tagged
        ``source: "rule"``.
    """
    vitals = patient_data.get("vitals", {}) or {}
    systolic = vitals.get("systolic_bp", 0)
    diastolic = vitals.get("diastolic_bp", 0)
    bmi = vitals.get("bmi") or compute_bmi(
        vitals.get("weight_kg", 0), vitals.get("height_cm", 0)
    )

    hypertension = classify_hypertension(systolic, diastolic)
    obesity = classify_bmi(bmi)

    return {
        "hypertension": hypertension,
        "obesity": obesity,
    }
