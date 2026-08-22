"""PS196 merged ML inference entry point.

Reads exactly one JSON object from **stdin**, writes exactly one merged JSON
object to **stdout**, and on any error writes a JSON error object to
**stderr** and exits non-zero. Fully offline - no network calls.

Models are loaded once at module import. If a model file is missing (for
example because training has not been run yet), that model's contribution
is omitted from the output and flagged in ``models_available`` - inference
never crashes because one model is absent.

PowerShell usage (PowerShell does not support ``<`` redirection)::

    Get-Content tests/fixtures/sample_patient.json | python inference/inference.py

POSIX shell usage::

    python inference/inference.py < tests/fixtures/sample_patient.json
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import joblib
import numpy as np

from feature_spec import (
    DISEASE_LABELS,
    MODEL_B_FEATURE_ORDER,
    MODEL_C_FEATURE_ORDER,
)
from inference.preprocessing import (
    bmi_from_patient_data,
    symptoms_to_vector,
    vitals_labs_to_diabetes_vector,
    vitals_labs_to_heart_vector,
)
from rules.clinical_rules import classify_bmi, classify_hypertension

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"

TOP_DIFFERENTIAL_SIZE = 5


def _try_load(filename: str) -> Any:
    """Load a joblib artifact, returning ``None`` if it is not present.

    Args:
        filename: The model artifact file name, relative to ``ml/models/``.

    Returns:
        The unpickled object, or ``None`` if the file does not exist or
        fails to load for any reason (corrupt file, version mismatch, etc).
    """
    path = MODELS_DIR / filename
    if not path.exists():
        return None
    try:
        return joblib.load(path)
    except Exception:  # noqa: BLE001 - any load failure degrades gracefully
        return None


# Loaded once at import time, per the module contract.
_SYMPTOM_MODEL = _try_load("symptom_model.joblib")
_SYMPTOM_LABEL_ENCODER = _try_load("symptom_label_encoder.joblib")
_DIABETES_MODEL = _try_load("diabetes_model.joblib")
_HEART_MODEL = _try_load("heart_model.joblib")


def _differential_from_model_a(patient_data: dict[str, Any]) -> list[dict[str, Any]] | None:
    if _SYMPTOM_MODEL is None:
        return None

    vector = symptoms_to_vector(patient_data.get("symptoms", []))
    x = np.array(vector, dtype=float).reshape(1, -1)

    if hasattr(_SYMPTOM_MODEL, "predict_proba"):
        proba = _SYMPTOM_MODEL.predict_proba(x)[0]
        class_indices = _SYMPTOM_MODEL.classes_
    else:
        prediction = _SYMPTOM_MODEL.predict(x)[0]
        class_indices = [prediction]
        proba = [1.0]

    if _SYMPTOM_LABEL_ENCODER is not None:
        labels = _SYMPTOM_LABEL_ENCODER.inverse_transform(class_indices)
    else:
        labels = [DISEASE_LABELS[i] if i < len(DISEASE_LABELS) else str(i) for i in class_indices]

    ranked = sorted(zip(labels, proba), key=lambda pair: pair[1], reverse=True)
    return [
        {"condition": str(condition), "score": round(float(score), 4), "source": "model_a"}
        for condition, score in ranked[:TOP_DIFFERENTIAL_SIZE]
    ]


def _risk_from_model(model: Any, vector: list[float]) -> float | None:
    if model is None:
        return None
    x = np.array(vector, dtype=float).reshape(1, -1)
    if hasattr(model, "predict_proba"):
        classes = list(model.classes_)
        if 1 not in classes:
            # Positive class not present in this model's encoding - refuse to
            # guess rather than silently returning the wrong class's score.
            return None
        positive_index = classes.index(1)
        return round(float(model.predict_proba(x)[0][positive_index]), 4)
    return round(float(model.predict(x)[0]), 4)


def _feature_importances(model: Any, feature_order: tuple[str, ...]) -> list[dict[str, Any]] | None:
    if model is None or not hasattr(model, "feature_importances_"):
        return None
    ranked = sorted(
        zip(feature_order, model.feature_importances_.tolist()),
        key=lambda pair: pair[1],
        reverse=True,
    )
    return [{"feature": name, "importance": float(importance)} for name, importance in ranked]


def run_inference(patient_data: dict[str, Any]) -> dict[str, Any]:
    """Merge Model A/B/C predictions and clinical rules into one response.

    Args:
        patient_data: Raw patient payload (``vitals``, ``symptoms``,
            ``labs``, ``age``, etc).

    Returns:
        The merged inference response described in ``ml/README.md``.
    """
    warnings: list[str] = []

    differential = _differential_from_model_a(patient_data)
    if differential is None:
        warnings.append("model_a unavailable: symptom_model.joblib not found; run training first")
        differential = []

    diabetes_risk = None
    diabetes_importances = None
    try:
        diabetes_vector = vitals_labs_to_diabetes_vector(patient_data)
        diabetes_risk = _risk_from_model(_DIABETES_MODEL, diabetes_vector)
        diabetes_importances = _feature_importances(_DIABETES_MODEL, MODEL_B_FEATURE_ORDER)
    except Exception as exc:  # noqa: BLE001 - degrade gracefully, never crash
        warnings.append(f"model_b failed: {exc}")

    heart_risk = None
    heart_importances = None
    try:
        heart_vector = vitals_labs_to_heart_vector(patient_data)
        heart_risk = _risk_from_model(_HEART_MODEL, heart_vector)
        heart_importances = _feature_importances(_HEART_MODEL, MODEL_C_FEATURE_ORDER)
    except Exception as exc:  # noqa: BLE001 - degrade gracefully, never crash
        warnings.append(f"model_c failed: {exc}")

    if _DIABETES_MODEL is None:
        warnings.append("model_b unavailable: diabetes_model.joblib not found; run training first")
    if _HEART_MODEL is None:
        warnings.append("model_c unavailable: heart_model.joblib not found; run training first")

    vitals = patient_data.get("vitals", {}) or {}
    hypertension = classify_hypertension(
        vitals.get("systolic_bp", 0), vitals.get("diastolic_bp", 0)
    )
    bmi = bmi_from_patient_data(patient_data)
    obesity = classify_bmi(bmi)

    risk_scores = {}
    if diabetes_risk is not None:
        risk_scores["diabetes"] = diabetes_risk
    if heart_risk is not None:
        risk_scores["heart_disease"] = heart_risk

    candidates: list[tuple[str, float]] = []
    if differential:
        candidates.append((differential[0]["condition"], differential[0]["score"]))
    for name, score in risk_scores.items():
        candidates.append((name, score))
    top_risk, confidence = max(candidates, key=lambda pair: pair[1]) if candidates else (None, 0.0)

    feature_importances = {}
    if diabetes_importances:
        feature_importances["diabetes"] = diabetes_importances
    if heart_importances:
        feature_importances["heart_disease"] = heart_importances

    result: dict[str, Any] = {
        "differential": differential,
        "risk_scores": risk_scores,
        "clinical_findings": {
            "hypertension": hypertension,
            "obesity": obesity,
        },
        "top_risk": top_risk,
        "confidence": round(float(confidence), 4) if confidence is not None else 0.0,
        "feature_importances": feature_importances,
        "models_available": {
            "model_a": _SYMPTOM_MODEL is not None,
            "model_b": _DIABETES_MODEL is not None,
            "model_c": _HEART_MODEL is not None,
        },
    }
    if warnings:
        result["warnings"] = warnings
    return result


def main() -> None:
    raw_input = sys.stdin.read()
    try:
        patient_data = json.loads(raw_input)
        if not isinstance(patient_data, dict):
            raise ValueError("Input JSON must be an object")
    except (json.JSONDecodeError, ValueError) as exc:
        print(json.dumps({"error": f"Invalid JSON input: {exc}"}), file=sys.stderr)
        sys.exit(1)

    try:
        result = run_inference(patient_data)
    except Exception as exc:  # noqa: BLE001 - top-level safety net
        print(json.dumps({"error": f"Inference failed: {exc}"}), file=sys.stderr)
        sys.exit(1)

    print(json.dumps(result))


if __name__ == "__main__":
    main()
