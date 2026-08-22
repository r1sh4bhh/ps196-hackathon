"""Regression tests for defaulted model features disclosed to callers."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ML_ROOT = Path(__file__).resolve().parents[1]
INFERENCE_ROOT = ML_ROOT / "inference"
sys.path[:0] = [str(INFERENCE_ROOT), str(ML_ROOT)]

try:
    import inference
    from preprocessing import (
        vector_and_defaulted_features_from_patient_diabetes,
        vector_and_defaulted_features_from_patient_heart,
    )
except ModuleNotFoundError as exc:
    if exc.name not in {"numpy", "pandas"}:
        raise
    inference = None


class _HighRiskModel:
    def predict_proba(self, _vectors):
        return [[0.1, 0.9]]


@unittest.skipIf(inference is None, "numpy and pandas are required for ML regression tests")
class DefaultedFeatureTests(unittest.TestCase):
    diabetes_medians = {
        "pregnancies": 3.0,
        "glucose": 117.0,
        "skin_thickness": 29.0,
        "insulin": 125.0,
    }

    @staticmethod
    def intake_patient():
        return {
            "demographics": {"age": 52, "sex": "female"},
            "vitals": {
                "systolic_bp": 132,
                "diastolic_bp": 78,
                "heart_rate": 72,
                "height_cm": 170,
                "weight_kg": 75,
            },
            "labs": {"glucose": 110, "cholesterol": 220},
        }

    def test_heart_defaulted_features_follow_the_lookup_order(self):
        _, defaulted = vector_and_defaulted_features_from_patient_heart(self.intake_patient())

        self.assertEqual(
            defaulted,
            ["cp", "restecg", "thalach", "exang", "oldpeak", "slope", "ca", "thal"],
        )
        self.assertNotIn("sex", defaulted)

    def test_heart_measured_model_fields_are_not_reported_as_defaulted(self):
        patient = self.intake_patient()
        patient["labs"]["cp"] = 0
        patient["vitals"]["thalach"] = 155

        _, defaulted = vector_and_defaulted_features_from_patient_heart(patient)

        self.assertNotIn("cp", defaulted)
        self.assertNotIn("thalach", defaulted)

    def test_unusable_values_are_defaulted_but_measured_zero_is_not(self):
        patient = self.intake_patient()
        patient["demographics"]["pregnancies"] = 0
        patient["labs"]["skin_thickness"] = float("nan")

        _, defaulted = vector_and_defaulted_features_from_patient_diabetes(
            patient, self.diabetes_medians
        )

        self.assertNotIn("pregnancies", defaulted)
        self.assertIn("skin_thickness", defaulted)

    def test_cardiac_missing_key_inputs_are_the_ordered_union(self):
        patient = self.intake_patient()
        del patient["labs"]["cholesterol"]

        result = self._predict_heart(patient)

        self.assertEqual(
            result["missing_key_inputs"],
            [
                "cholesterol",
                "cp",
                "chol",
                "restecg",
                "thalach",
                "exang",
                "oldpeak",
                "slope",
                "ca",
                "thal",
            ],
        )

    def test_cardiac_defaulted_feature_order_is_deterministic(self):
        patient = self.intake_patient()

        first = self._predict_heart(patient)["missing_key_inputs"]
        second = self._predict_heart(patient)["missing_key_inputs"]

        self.assertEqual(first, second)

    def test_diabetes_defaults_are_reported_without_changing_partial_input(self):
        _, defaulted = vector_and_defaulted_features_from_patient_diabetes(
            self.intake_patient(), self.diabetes_medians
        )
        result = self._predict_diabetes(self.intake_patient())

        self.assertEqual(
            defaulted,
            ["pregnancies", "skin_thickness", "insulin", "diabetes_pedigree_function"],
        )
        self.assertEqual(result["defaulted_features"], defaulted)
        self.assertEqual(result["missing_key_inputs"], [])
        self.assertFalse(result["partial_input"])
        self.assertEqual(result["risk_band"], "high")

    def test_missing_diabetes_glucose_still_caps_a_high_band(self):
        patient = self.intake_patient()
        del patient["labs"]["glucose"]

        result = self._predict_diabetes(patient)

        self.assertIn("glucose", result["defaulted_features"])
        self.assertEqual(result["missing_key_inputs"], ["glucose"])
        self.assertTrue(result["partial_input"])
        self.assertEqual(result["risk_band"], "elevated")
        self.assertEqual(inference._cap_band("high", True), "elevated")
        self.assertEqual(inference._cap_band("high", False), "high")

    def _predict_diabetes(self, patient):
        bundle = {"model": _HighRiskModel(), "medians": self.diabetes_medians}
        with patch.object(inference, "_load_model", return_value=(bundle, None)):
            return inference._predict_diabetes(patient)

    def _predict_heart(self, patient):
        with patch.object(inference, "_load_model", return_value=(_HighRiskModel(), None)):
            return inference._predict_heart(patient)


if __name__ == "__main__":
    unittest.main()
