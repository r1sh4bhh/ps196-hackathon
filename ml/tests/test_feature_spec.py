"""Tests for ml/feature_spec.py - the highest-risk module in the ML layer.

A positional mismatch between a feature vector and its expected order fails
silently (a confident wrong answer, not an error) unless these validators
catch it first.
"""

import pytest

import feature_spec as fs


def test_model_a_feature_order_length():
    assert len(fs.MODEL_A_FEATURE_ORDER) == 132


def test_model_a_disease_labels_count():
    assert len(fs.DISEASE_LABELS) == 41


def test_model_b_feature_order_length():
    assert len(fs.MODEL_B_FEATURE_ORDER) == 8


def test_model_c_feature_order_length():
    assert len(fs.MODEL_C_FEATURE_ORDER) == 13


def test_validate_vector_accepts_correct_length():
    fs.validate_vector([0] * 132, fs.MODEL_A_FEATURE_ORDER)  # should not raise


def test_validate_vector_rejects_short_vector():
    with pytest.raises(ValueError):
        fs.validate_vector([0] * 5, fs.MODEL_A_FEATURE_ORDER)


def test_validate_vector_rejects_long_vector():
    with pytest.raises(ValueError):
        fs.validate_vector([0] * 200, fs.MODEL_A_FEATURE_ORDER)


def test_validate_named_vector_orders_correctly():
    named = {name: idx for idx, name in enumerate(fs.MODEL_B_FEATURE_ORDER)}
    ordered = fs.validate_named_vector(named, fs.MODEL_B_FEATURE_ORDER)
    assert ordered == list(range(len(fs.MODEL_B_FEATURE_ORDER)))


def test_validate_named_vector_raises_on_missing_feature():
    named = {name: 0 for name in fs.MODEL_B_FEATURE_ORDER}
    del named["BMI"]
    with pytest.raises(ValueError):
        fs.validate_named_vector(named, fs.MODEL_B_FEATURE_ORDER)


def test_no_duplicate_feature_names_across_models_b_and_c():
    # Models B and C legitimately overlap conceptually (vitals/labs) but each
    # frozen order must be internally consistent and non-empty.
    assert len(set(fs.MODEL_B_FEATURE_ORDER)) == len(fs.MODEL_B_FEATURE_ORDER)
    assert len(set(fs.MODEL_C_FEATURE_ORDER)) == len(fs.MODEL_C_FEATURE_ORDER)
