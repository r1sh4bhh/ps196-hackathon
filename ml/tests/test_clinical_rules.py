"""Boundary tests for the deterministic clinical rules.

Hypertension and obesity are rule-based (not ML) by deliberate design - see
ml/rules/clinical_rules.py module docstring. These tests pin the exact
ACC/AHA and WHO/CDC thresholds.
"""

from rules.clinical_rules import classify_bmi, classify_hypertension


def test_hypertension_normal_just_below_elevated():
    result = classify_hypertension(119, 79)
    assert result["stage"] == "normal"
    assert result["source"] == "rule"


def test_hypertension_stage1_boundary_130_80():
    result = classify_hypertension(130, 80)
    assert result["stage"] == "stage_1"


def test_hypertension_elevated_just_below_stage1():
    result = classify_hypertension(129, 79)
    assert result["stage"] == "elevated"


def test_hypertension_stage1_just_below_stage2():
    result = classify_hypertension(139, 89)
    assert result["stage"] == "stage_1"


def test_hypertension_stage2_boundary_140_90():
    result = classify_hypertension(140, 90)
    assert result["stage"] == "stage_2"


def test_hypertension_stage2_via_diastolic_alone():
    # Diastolic >= 90 alone is stage 2, even with normal systolic.
    result = classify_hypertension(110, 90)
    assert result["stage"] == "stage_2"


def test_bmi_normal_just_below_obese():
    result = classify_bmi(29.9)
    assert result["class"] == "overweight"
    assert result["source"] == "rule"


def test_bmi_obese_boundary_30():
    result = classify_bmi(30.0)
    assert result["class"] == "obese"


def test_bmi_underweight():
    result = classify_bmi(17.0)
    assert result["class"] == "underweight"


def test_bmi_normal():
    result = classify_bmi(22.0)
    assert result["class"] == "normal"
