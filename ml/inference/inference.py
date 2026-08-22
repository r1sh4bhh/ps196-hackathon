"""Inference entry point for the PS196 ML layer.

Reads one JSON patient record on stdin, writes one JSON result on stdout.
This process-per-request contract keeps the Node backend free of any Python
bindings: it spawns this script, pipes JSON in, reads JSON out.

Design commitment: **this script must never fail the caller.**

A screening tool that returns nothing when a model file is absent is worse
than one that returns partial results, because the deterministic clinical
rules (hypertension, BMI) need no models at all and are the findings most
likely to require immediate action. So every model is loaded independently
and every prediction is wrapped: a missing, corrupt, or version-incompatible
model degrades that one section to ``available: false`` with a reason, while
everything else still returns.

Exit code is always 0 unless stdin itself could not be parsed.

Usage::

    echo '{"symptoms":["headache"],"vitals":{"systolic_bp":135}}' | py ml/inference/inference.py
"""

from __future__ import annotations

import json
import sys
import traceback
from pathlib import Path
from typing import Any

_HERE = Path(__file__).resolve().parent
_ML_ROOT = _HERE.parent
sys.path.insert(0, str(_ML_ROOT))
sys.path.insert(0, str(_HERE))

MODEL_DIR = _ML_ROOT / "models"

SCHEMA_VERSION = "1.2.0"


# Screening thresholds, deliberately lower than the 0.5 a classifier uses by
# default.
#
# On the held-out Pima split, argmax classification caught only 30 of 54
# diabetic patients - recall 0.56. For a triage tool that is the wrong failure
# mode: a false alarm costs a clinician a few minutes of review, while a missed
# case costs the patient months or years of undetected progression. Flagging
# from 0.30 raises recall substantially at some cost in precision, which is the
# correct trade here.
#
# These are review-priority bands, NOT calibrated probabilities of disease, and
# must never be presented to a user as "you have an N% chance of diabetes".
RISK_THRESHOLDS: dict[str, dict[str, float]] = {
    "diabetes": {"elevated": 0.30, "high": 0.60},
    "cardiac": {"elevated": 0.35, "high": 0.65},
}

# Inputs without which a score is mostly imputed medians rather than
# measurement. Missing any of these caps the reported band - see _cap_band.
KEY_INPUTS: dict[str, tuple[str, ...]] = {
    "diabetes": ("glucose",),
    "cardiac": ("cholesterol",),
}


def _unavailable(reason: str) -> dict[str, Any]:
    """A uniform 'this section could not be produced' payload."""
    return {"available": False, "reason": reason, "source": "model"}


def _load_model(filename: str) -> tuple[Any, str | None]:
    """Load a joblib artefact, returning ``(model, error_message)``.

    Never raises. A missing file is an expected state before training has been
    run, not an error condition, and is reported as such.
    """
    path = MODEL_DIR / filename
    if not path.exists():
        return None, f"model not trained yet ({filename} not found)"
    try:
        import joblib

        return joblib.load(path), None
    except Exception as exc:  # noqa: BLE001 - degrade, never crash
        return None, f"could not load {filename}: {exc.__class__.__name__}: {exc}"


def _top_predictions(model: Any, vector: list[float], limit: int = 5) -> list[dict[str, Any]]:
    """Return the highest-probability classes with their confidences."""
    import numpy as np

    probabilities = model.predict_proba([vector])[0]
    order = np.argsort(probabilities)[::-1][:limit]
    return [
        {
            "condition": str(model.classes_[index]),
            "confidence": round(float(probabilities[index]), 4),
        }
        for index in order
        if probabilities[index] > 0
    ]


def _band(probability: float, kind: str) -> str:
    """Map a probability onto a screening band using the thresholds above.

    Three buckets, not a percentage, because the underlying probabilities are
    not calibrated well enough to justify finer granularity.
    """
    thresholds = RISK_THRESHOLDS[kind]
    if probability >= thresholds["high"]:
        return "high"
    if probability >= thresholds["elevated"]:
        return "elevated"
    return "low"


def _cap_band(band: str, missing_key_inputs: bool) -> str:
    """Downgrade 'high' to 'elevated' when a dominant predictor is absent.

    Lowering the flagging threshold buys recall, which is the right trade for
    screening. It must not also manufacture confidence out of absence.

    Without a glucose reading, a diabetes score is driven by age plus five
    training medians - the model is scoring a statistical average, not this
    patient. Reporting that as 'high' is the kind of over-flagging that gets a
    screening tool switched off, and each false alarm costs a clinician real
    time. The finding is still surfaced for review; it just does not claim a
    certainty the input cannot support.
    """
    if missing_key_inputs and band == "high":
        return "elevated"
    return band


def _predict_symptoms(patient: dict[str, Any]) -> dict[str, Any]:
    """Model A - symptom differential across 41 conditions."""
    from feature_spec import MODEL_A_SYMPTOMS, build_symptom_vector, validate_vector

    symptoms = patient.get("symptoms") or []
    if not symptoms:
        return _unavailable("no symptoms provided")

    model, error = _load_model("model_a_symptoms.joblib")
    if model is None:
        return _unavailable(error or "model unavailable")

    try:
        # strict=False: free-text symptoms from the intake form will not all
        # map onto the frozen vocabulary, and dropping an unmapped term is
        # better than refusing to screen the patient at all.
        vector = build_symptom_vector(symptoms, strict=False)
        validate_vector("model_a", vector, MODEL_A_SYMPTOMS)

        matched = sum(vector)
        if matched == 0:
            return _unavailable("none of the provided symptoms are in the model vocabulary")

        submitted = len(list(symptoms))
        return {
            "available": True,
            "source": "model",
            "predictions": _top_predictions(model, vector),
            "symptoms_matched": matched,
            "symptoms_submitted": submitted,
            # Confidences come from a model trained on synthetic, near-perfectly
            # separable data. They rank plausible conditions; they are not
            # probabilities of the patient having them.
            "confidence_is_ranking_only": True,
            "unmatched_symptoms": max(0, submitted - matched),
            # Two or three symptoms cannot separate 41 conditions. Below this
            # the ranking is weak evidence and the UI should say so.
            "sparse_input": matched < 4,
        }
    except Exception as exc:  # noqa: BLE001
        return _unavailable(f"prediction failed: {exc.__class__.__name__}: {exc}")


def _predict_diabetes(patient: dict[str, Any]) -> dict[str, Any]:
    """Model B - diabetes risk."""
    from preprocessing import vector_and_defaulted_features_from_patient_diabetes

    bundle, error = _load_model("model_b_diabetes.joblib")
    if bundle is None:
        return _unavailable(error or "model unavailable")

    try:
        # Training saves {"model": ..., "medians": ...} so the exact medians
        # used during training are reapplied here. Recomputing them from one
        # patient record would be meaningless.
        model = bundle.get("model") if isinstance(bundle, dict) else bundle
        medians = bundle.get("medians", {}) if isinstance(bundle, dict) else {}

        vector, defaulted_features = vector_and_defaulted_features_from_patient_diabetes(
            patient, medians
        )
        probability = float(model.predict_proba([vector])[0][1])

        labs = patient.get("labs") or {}
        missing = [name for name in KEY_INPUTS["diabetes"] if labs.get(name) in (None, "")]

        band = _cap_band(_band(probability, "diabetes"), bool(missing))

        return {
            "available": True,
            "source": "model",
            "risk_score": round(probability, 4),
            "risk_band": band,
            "flagged_for_review": band != "low",
            "threshold_used": RISK_THRESHOLDS["diabetes"]["elevated"],
            # Glucose is by far the strongest predictor. Without it the score
            # rests on training medians, so the caller must say so.
            #
            # Other defaulted features are reported separately below. They do
            # not change partial_input or band capping, which remain tied to
            # the dominant glucose predictor.
            "partial_input": bool(missing),
            "missing_key_inputs": missing,
            "defaulted_features": defaulted_features,
        }
    except Exception as exc:  # noqa: BLE001
        return _unavailable(f"prediction failed: {exc.__class__.__name__}: {exc}")


def _predict_heart(patient: dict[str, Any]) -> dict[str, Any]:
    """Model C - cardiac risk."""
    from preprocessing import vector_and_defaulted_features_from_patient_heart

    bundle, error = _load_model("model_c_heart.joblib")
    if bundle is None:
        return _unavailable(error or "model unavailable")

    try:
        model = bundle.get("model") if isinstance(bundle, dict) else bundle
        vector, defaulted_features = vector_and_defaulted_features_from_patient_heart(patient)
        probability = float(model.predict_proba([vector])[0][1])

        labs = patient.get("labs") or {}
        missing = [name for name in KEY_INPUTS["cardiac"] if labs.get(name) in (None, "")]

        # The intake form cannot populate every cardiac feature, so a cardiac
        # score is always partly defaulted and the cap therefore always applies.
        band = _cap_band(_band(probability, "cardiac"), True)

        return {
            "available": True,
            "source": "model",
            "risk_score": round(probability, 4),
            "risk_band": band,
            "flagged_for_review": band != "low",
            "threshold_used": RISK_THRESHOLDS["cardiac"]["elevated"],
            # The preprocessing lookup returns the exact positions supplied by
            # defaults, keeping this disclosure aligned with the model vector.
            "partial_input": True,
            "missing_key_inputs": list(dict.fromkeys(missing + defaulted_features)),
        }
    except Exception as exc:  # noqa: BLE001
        return _unavailable(f"prediction failed: {exc.__class__.__name__}: {exc}")


def run(patient: dict[str, Any]) -> dict[str, Any]:
    """Run every model and rule against one patient record.

    Each section is independent: a failure in one never suppresses the others.
    """
    from rules.clinical_rules import evaluate_clinical_rules

    try:
        rules = evaluate_clinical_rules(patient)
    except Exception as exc:  # noqa: BLE001 - rules should never raise, but belt and braces
        rules = {"error": f"{exc.__class__.__name__}: {exc}"}

    results: dict[str, Any] = {
        "schema_version": SCHEMA_VERSION,
        "symptom_differential": _predict_symptoms(patient),
        "diabetes_risk": _predict_diabetes(patient),
        "cardiac_risk": _predict_heart(patient),
        "hypertension": rules.get("hypertension"),
        "obesity": rules.get("obesity"),
    }

    model_sections = ("symptom_differential", "diabetes_risk", "cardiac_risk")
    results["degraded"] = any(
        not results[section].get("available", False) for section in model_sections
    )

    # A single flat list of everything a clinician should look at, so the UI
    # does not have to re-derive priority from five separate sections.
    review: list[dict[str, Any]] = []

    hypertension = results.get("hypertension") or {}
    if hypertension.get("available") and hypertension.get("stage") in {
        "stage_2",
        "hypertensive_crisis",
    }:
        review.append(
            {
                "finding": "blood pressure",
                "detail": hypertension.get("description"),
                "urgency": (
                    "immediate"
                    if hypertension.get("stage") == "hypertensive_crisis"
                    else "routine"
                ),
                "source": "rule",
            }
        )

    for key, label in (("diabetes_risk", "diabetes risk"), ("cardiac_risk", "cardiac risk")):
        section = results[key]
        if section.get("flagged_for_review"):
            detail = f"{section['risk_band']} ({section['risk_score']})"
            if section.get("partial_input"):
                detail += " - based on incomplete input"
            review.append(
                {
                    "finding": label,
                    "detail": detail,
                    "urgency": "routine",
                    "source": "model",
                }
            )

    results["review_priority"] = review

    results["disclaimer"] = (
        "Screening support only. Not a diagnosis. Risk bands are review "
        "priorities, not probabilities of disease. All findings require "
        "review by a qualified clinician."
    )

    return results


def main() -> int:
    raw = sys.stdin.read()

    if not raw.strip():
        json.dump(
            {"error": "empty input", "detail": "expected a JSON patient record on stdin"},
            sys.stdout,
        )
        sys.stdout.write("\n")
        return 1

    try:
        patient = json.loads(raw)
    except json.JSONDecodeError as exc:
        json.dump({"error": "invalid JSON", "detail": str(exc)}, sys.stdout)
        sys.stdout.write("\n")
        return 1

    if not isinstance(patient, dict):
        json.dump(
            {"error": "invalid input", "detail": "expected a JSON object at the top level"},
            sys.stdout,
        )
        sys.stdout.write("\n")
        return 1

    try:
        result = run(patient)
    except Exception as exc:  # noqa: BLE001 - last line of defence
        result = {
            "schema_version": SCHEMA_VERSION,
            "degraded": True,
            "error": f"{exc.__class__.__name__}: {exc}",
            "trace": traceback.format_exc(limit=3),
        }

    json.dump(result, sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
