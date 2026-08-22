"""Deterministic clinical rules for the PS196 screening layer.

These findings are NOT machine-learned, and that is a deliberate design
decision rather than a shortcut:

* **Obesity** is derived from BMI, which is ``weight / height**2``. Training a
  model to predict obesity from weight and height would be learning a formula
  we already know exactly. The model could only ever be a lossy approximation
  of arithmetic.
* **Hypertension** is *defined* by blood pressure thresholds. Under the 2017
  ACC/AHA guideline, stage 1 hypertension simply means a reading at or above
  130/80 mmHg. There is no latent pattern to discover — the label is a
  function of the input.

Both are therefore implemented as transparent, auditable threshold rules and
tagged ``"source": "rule"`` in the inference output, so a clinician reviewing
a result can always tell which findings came from a model and which came from
a published guideline.

References
----------
Hypertension staging: Whelton PK et al., *2017 ACC/AHA/AAPA/ABC/ACPM/AGS/
APhA/ASH/ASPC/NMA/PCNA Guideline for the Prevention, Detection, Evaluation,
and Management of High Blood Pressure in Adults*. Hypertension. 2018;71(6).

BMI classification: WHO, *Obesity: preventing and managing the global
epidemic*. WHO Technical Report Series 894, 2000.
"""

from __future__ import annotations

from typing import Any

__all__ = [
    "classify_blood_pressure",
    "classify_bmi",
    "calculate_bmi",
    "evaluate_clinical_rules",
    "HYPERTENSION_STAGES",
    "BMI_CLASSES",
]


# Human-readable descriptions, kept beside the thresholds so the UI never has
# to hardcode clinical wording.
HYPERTENSION_STAGES: dict[str, str] = {
    "normal": "Below 120/80 mmHg",
    "elevated": "Systolic 120-129 mmHg and diastolic below 80 mmHg",
    "stage_1": "Systolic 130-139 mmHg or diastolic 80-89 mmHg",
    "stage_2": "Systolic 140 mmHg or higher, or diastolic 90 mmHg or higher",
    "hypertensive_crisis": "Systolic above 180 mmHg or diastolic above 120 mmHg",
}

BMI_CLASSES: dict[str, str] = {
    "underweight": "BMI below 18.5",
    "normal": "BMI 18.5-24.9",
    "overweight": "BMI 25.0-29.9",
    "obese": "BMI 30.0 or higher",
}


def _to_float(value: Any) -> float | None:
    """Coerce a value to float, returning None for anything unusable."""
    if value is None or value == "":
        return None
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    # Guard against NaN, which compares false against every threshold and
    # would otherwise silently fall through to the lowest category.
    if result != result:
        return None
    return result


def classify_blood_pressure(systolic: Any, diastolic: Any) -> dict[str, Any]:
    """Stage a blood pressure reading per the 2017 ACC/AHA guideline.

    Staging uses the *higher* of the two categories implied by systolic and
    diastolic, which is what the guideline specifies. A reading of 135/75 is
    stage 1 on systolic alone even though the diastolic is normal.

    Args:
        systolic: Systolic pressure in mmHg.
        diastolic: Diastolic pressure in mmHg.

    Returns:
        A dict with ``stage``, ``description``, the echoed readings, a
        ``source`` of ``"rule"``, and ``available`` indicating whether the
        inputs were usable. Never raises — missing or malformed input yields
        ``stage: None`` with ``available: False`` so inference can degrade
        gracefully rather than crash mid-request.
    """
    systolic_value = _to_float(systolic)
    diastolic_value = _to_float(diastolic)

    if systolic_value is None or diastolic_value is None:
        return {
            "stage": None,
            "description": "Blood pressure not recorded",
            "systolic": systolic_value,
            "diastolic": diastolic_value,
            "source": "rule",
            "available": False,
        }

    # Ordered most severe first — the first match wins, which naturally
    # implements the "higher category governs" rule.
    if systolic_value > 180 or diastolic_value > 120:
        stage = "hypertensive_crisis"
    elif systolic_value >= 140 or diastolic_value >= 90:
        stage = "stage_2"
    elif systolic_value >= 130 or diastolic_value >= 80:
        stage = "stage_1"
    elif 120 <= systolic_value <= 129 and diastolic_value < 80:
        stage = "elevated"
    else:
        stage = "normal"

    return {
        "stage": stage,
        "description": HYPERTENSION_STAGES[stage],
        "systolic": systolic_value,
        "diastolic": diastolic_value,
        "source": "rule",
        "available": True,
    }


def calculate_bmi(weight_kg: Any, height_cm: Any) -> float | None:
    """Return BMI from weight in kilograms and height in centimetres.

    Returns None when either input is missing, non-numeric, or non-positive.
    """
    weight = _to_float(weight_kg)
    height = _to_float(height_cm)

    if weight is None or height is None:
        return None
    if weight <= 0 or height <= 0:
        return None

    height_m = height / 100.0
    return weight / (height_m**2)


def classify_bmi(weight_kg: Any, height_cm: Any, bmi: Any = None) -> dict[str, Any]:
    """Classify body mass index per WHO categories.

    Args:
        weight_kg: Weight in kilograms.
        height_cm: Height in centimetres.
        bmi: Optional pre-computed BMI. When supplied and valid it is used
            directly, which avoids recomputing when the caller already has it.

    Returns:
        A dict with ``class``, ``description``, ``bmi`` rounded to one decimal,
        a ``source`` of ``"rule"``, and ``available``. Never raises.
    """
    bmi_value = _to_float(bmi)
    if bmi_value is None or bmi_value <= 0:
        bmi_value = calculate_bmi(weight_kg, height_cm)

    if bmi_value is None:
        return {
            "class": None,
            "description": "Height and weight not recorded",
            "bmi": None,
            "source": "rule",
            "available": False,
        }

    if bmi_value < 18.5:
        bmi_class = "underweight"
    elif bmi_value < 25.0:
        bmi_class = "normal"
    elif bmi_value < 30.0:
        bmi_class = "overweight"
    else:
        bmi_class = "obese"

    return {
        "class": bmi_class,
        "description": BMI_CLASSES[bmi_class],
        "bmi": round(bmi_value, 1),
        "source": "rule",
        "available": True,
    }


def evaluate_clinical_rules(patient_data: dict[str, Any]) -> dict[str, Any]:
    """Apply every deterministic rule to a normalised patient record.

    Expects the shape produced by the backend normaliser::

        {"vitals": {"systolic_bp": ..., "diastolic_bp": ...,
                    "weight_kg": ..., "height_cm": ..., "bmi": ...}}

    Missing sections and missing fields are tolerated — each rule independently
    reports ``available: False`` rather than failing the whole request. This
    matters because the screening flow must still return partial results when
    a patient record is incomplete.

    Returns:
        ``{"hypertension": {...}, "obesity": {...}}``
    """
    vitals = patient_data.get("vitals") or {}

    return {
        "hypertension": classify_blood_pressure(
            vitals.get("systolic_bp"),
            vitals.get("diastolic_bp"),
        ),
        "obesity": classify_bmi(
            vitals.get("weight_kg"),
            vitals.get("height_cm"),
            vitals.get("bmi"),
        ),
    }
