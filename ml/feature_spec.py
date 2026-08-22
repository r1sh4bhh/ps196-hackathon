"""Frozen feature specifications for the PS196 ML layer.

This module is the SINGLE SOURCE OF TRUTH for feature ordering across every
model in the system. Training code and inference code must both import from
here. Never redefine a feature order anywhere else.

Why this matters
----------------
A positional mismatch between the vector built at inference time and the
column order the model was trained on does NOT raise an error. scikit-learn
sees a float array of the correct length and predicts confidently against
scrambled meaning. Blood pressure gets read as cholesterol, and the output
looks entirely plausible. This is the highest-risk failure mode in the
pipeline, so ordering is frozen here and validated on every call.

Models
------
Model A : 41-condition symptom differential  (132 ordered binary symptoms)
Model B : diabetes risk                      (Pima Indians, 8 features)
Model C : cardiac risk                       (UCI Cleveland, 13 features)

Hypertension and obesity are deliberately NOT models. They are deterministic
clinical rules (see ``ml/rules/clinical_rules.py``): obesity from BMI is
``weight / height**2``, and hypertension is a threshold on measured blood
pressure. Learning either would be circular. They are labelled
``"source": "rule"`` in the inference output to keep provenance honest.
"""

from __future__ import annotations

from typing import Iterable, Sequence

__all__ = [
    "MODEL_A_SYMPTOMS",
    "MODEL_A_CONDITIONS",
    "MODEL_B_FEATURES",
    "MODEL_C_FEATURES",
    "FEATURE_ORDERS",
    "FeatureSpecError",
    "validate_vector",
    "symptom_index",
    "build_symptom_vector",
]


class FeatureSpecError(ValueError):
    """Raised when a feature vector does not match its frozen specification."""


# ---------------------------------------------------------------------------
# Model A — symptom differential
# ---------------------------------------------------------------------------
# The 132 binary symptom columns from the Kaggle disease-symptom dataset
# (itachi9604/disease-symptom-description-dataset), in their canonical order.
# Names are normalised to lowercase snake_case with no leading/trailing spaces;
# the raw CSV contains inconsistent whitespace which preprocessing strips.
#
# ORDER IS FROZEN. Append-only if the vocabulary ever grows, and bump the
# model version if you do — existing pickled models depend on these positions.
MODEL_A_SYMPTOMS: tuple[str, ...] = (
    "itching",
    "skin_rash",
    "nodal_skin_eruptions",
    "continuous_sneezing",
    "shivering",
    "chills",
    "joint_pain",
    "stomach_pain",
    "acidity",
    "ulcers_on_tongue",
    "muscle_wasting",
    "vomiting",
    "burning_micturition",
    "spotting_urination",
    "fatigue",
    "weight_gain",
    "anxiety",
    "cold_hands_and_feets",
    "mood_swings",
    "weight_loss",
    "restlessness",
    "lethargy",
    "patches_in_throat",
    "irregular_sugar_level",
    "cough",
    "high_fever",
    "sunken_eyes",
    "breathlessness",
    "sweating",
    "dehydration",
    "indigestion",
    "headache",
    "yellowish_skin",
    "dark_urine",
    "nausea",
    "loss_of_appetite",
    "pain_behind_the_eyes",
    "back_pain",
    "constipation",
    "abdominal_pain",
    "diarrhoea",
    "mild_fever",
    "yellow_urine",
    "yellowing_of_eyes",
    "acute_liver_failure",
    "fluid_overload",
    "swelling_of_stomach",
    "swelled_lymph_nodes",
    "malaise",
    "blurred_and_distorted_vision",
    "phlegm",
    "throat_irritation",
    "redness_of_eyes",
    "sinus_pressure",
    "runny_nose",
    "congestion",
    "chest_pain",
    "weakness_in_limbs",
    "fast_heart_rate",
    "pain_during_bowel_movements",
    "pain_in_anal_region",
    "bloody_stool",
    "irritation_in_anus",
    "neck_pain",
    "dizziness",
    "cramps",
    "bruising",
    "obesity",
    "swollen_legs",
    "swollen_blood_vessels",
    "puffy_face_and_eyes",
    "enlarged_thyroid",
    "brittle_nails",
    "swollen_extremeties",
    "excessive_hunger",
    "extra_marital_contacts",
    "drying_and_tingling_lips",
    "slurred_speech",
    "knee_pain",
    "hip_joint_pain",
    "muscle_weakness",
    "stiff_neck",
    "swelling_joints",
    "movement_stiffness",
    "spinning_movements",
    "loss_of_balance",
    "unsteadiness",
    "weakness_of_one_body_side",
    "loss_of_smell",
    "bladder_discomfort",
    "foul_smell_of_urine",
    "continuous_feel_of_urine",
    "passage_of_gases",
    "internal_itching",
    "toxic_look_typhos",
    "depression",
    "irritability",
    "muscle_pain",
    "altered_sensorium",
    "red_spots_over_body",
    "belly_pain",
    "abnormal_menstruation",
    "dischromic_patches",
    "watering_from_eyes",
    "increased_appetite",
    "polyuria",
    "family_history",
    "mucoid_sputum",
    "rusty_sputum",
    "lack_of_concentration",
    "visual_disturbances",
    "receiving_blood_transfusion",
    "receiving_unsterile_injections",
    "coma",
    "stomach_bleeding",
    "distention_of_abdomen",
    "history_of_alcohol_consumption",
    "fluid_overload_2",
    "blood_in_sputum",
    "prominent_veins_on_calf",
    "palpitations",
    "painful_walking",
    "pus_filled_pimples",
    "blackheads",
    "scurring",
    "skin_peeling",
    "silver_like_dusting",
    "small_dents_in_nails",
    "inflammatory_nails",
    "blister",
    "red_sore_around_nose",
    "yellow_crust_ooze",
)

# The 41 target conditions Model A discriminates between. Sorted alphabetically
# to match scikit-learn's ``classes_`` ordering after ``LabelEncoder``.
MODEL_A_CONDITIONS: tuple[str, ...] = (
    "(vertigo) Paroymsal  Positional Vertigo",
    "AIDS",
    "Acne",
    "Alcoholic hepatitis",
    "Allergy",
    "Arthritis",
    "Bronchial Asthma",
    "Cervical spondylosis",
    "Chicken pox",
    "Chronic cholestasis",
    "Common Cold",
    "Dengue",
    "Diabetes ",
    "Dimorphic hemmorhoids(piles)",
    "Drug Reaction",
    "Fungal infection",
    "GERD",
    "Gastroenteritis",
    "Heart attack",
    "Hepatitis B",
    "Hepatitis C",
    "Hepatitis D",
    "Hepatitis E",
    "Hypertension ",
    "Hyperthyroidism",
    "Hypoglycemia",
    "Hypothyroidism",
    "Impetigo",
    "Jaundice",
    "Malaria",
    "Migraine",
    "Osteoarthristis",
    "Paralysis (brain hemorrhage)",
    "Peptic ulcer diseae",
    "Pneumonia",
    "Psoriasis",
    "Tuberculosis",
    "Typhoid",
    "Urinary tract infection",
    "Varicose veins",
    "hepatitis A",
)


# ---------------------------------------------------------------------------
# Model B — diabetes risk (Pima Indians Diabetes Database)
# ---------------------------------------------------------------------------
# NOTE: in the raw Pima CSV a value of 0 in glucose, blood_pressure,
# skin_thickness, insulin or bmi means MISSING, not a real measurement of zero.
# Median imputation is applied in preprocessing — see ZERO_AS_MISSING below.
MODEL_B_FEATURES: tuple[str, ...] = (
    "pregnancies",
    "glucose",
    "blood_pressure",
    "skin_thickness",
    "insulin",
    "bmi",
    "diabetes_pedigree_function",
    "age",
)

# Columns where a literal 0 must be treated as a missing value.
MODEL_B_ZERO_AS_MISSING: tuple[str, ...] = (
    "glucose",
    "blood_pressure",
    "skin_thickness",
    "insulin",
    "bmi",
)


# ---------------------------------------------------------------------------
# Model C — cardiac risk (UCI Heart Disease, Cleveland subset)
# ---------------------------------------------------------------------------
MODEL_C_FEATURES: tuple[str, ...] = (
    "age",
    "sex",
    "cp",
    "trestbps",
    "chol",
    "fbs",
    "restecg",
    "thalach",
    "exang",
    "oldpeak",
    "slope",
    "ca",
    "thal",
)


FEATURE_ORDERS: dict[str, tuple[str, ...]] = {
    "model_a": MODEL_A_SYMPTOMS,
    "model_b": MODEL_B_FEATURES,
    "model_c": MODEL_C_FEATURES,
}


def _expected_order(model: str) -> tuple[str, ...]:
    try:
        return FEATURE_ORDERS[model]
    except KeyError:
        known = ", ".join(sorted(FEATURE_ORDERS))
        raise FeatureSpecError(f"Unknown model {model!r}. Expected one of: {known}.") from None


def validate_vector(model: str, vector: Sequence[float], names: Iterable[str] | None = None) -> None:
    """Validate a feature vector against a model's frozen specification.

    Args:
        model: One of ``"model_a"``, ``"model_b"``, ``"model_c"``.
        vector: The ordered feature values about to be handed to the model.
        names: Optional ordered feature names. When supplied, these are checked
            position-by-position against the frozen order. Always pass this if
            you have it — length alone cannot catch a transposition, which is
            precisely the bug this module exists to prevent.

    Raises:
        FeatureSpecError: If the length differs from the specification, or if
            ``names`` is supplied and does not match the frozen order exactly.
    """
    expected = _expected_order(model)

    if len(vector) != len(expected):
        raise FeatureSpecError(
            f"{model}: expected {len(expected)} features, got {len(vector)}. "
            "Feature order is frozen in ml/feature_spec.py — do not build vectors by hand."
        )

    if names is None:
        return

    supplied = tuple(names)
    if len(supplied) != len(expected):
        raise FeatureSpecError(
            f"{model}: expected {len(expected)} feature names, got {len(supplied)}."
        )

    mismatches = [
        (index, expected_name, supplied_name)
        for index, (expected_name, supplied_name) in enumerate(zip(expected, supplied))
        if expected_name != supplied_name
    ]
    if mismatches:
        index, expected_name, supplied_name = mismatches[0]
        raise FeatureSpecError(
            f"{model}: feature order mismatch at position {index} — "
            f"expected {expected_name!r}, got {supplied_name!r} "
            f"({len(mismatches)} position(s) differ in total)."
        )


def symptom_index(symptom: str) -> int:
    """Return the frozen column index for a Model A symptom name.

    Raises:
        FeatureSpecError: If the symptom is not in the canonical vocabulary.
    """
    normalised = symptom.strip().lower().replace(" ", "_").replace("__", "_")
    try:
        return MODEL_A_SYMPTOMS.index(normalised)
    except ValueError:
        raise FeatureSpecError(
            f"Unknown symptom {symptom!r} (normalised to {normalised!r}). "
            "It is not part of the frozen 132-symptom vocabulary."
        ) from None


def build_symptom_vector(symptoms: Iterable[str], strict: bool = True) -> list[int]:
    """Build an ordered 132-length binary vector from symptom names.

    This is the ONLY supported way to construct a Model A input. Building the
    list by hand risks a silent positional mismatch.

    Args:
        symptoms: Symptom names in any order; casing and spacing are normalised.
        strict: When True (default) an unrecognised symptom raises. When False
            unrecognised symptoms are ignored, which is appropriate at inference
            time where user-supplied free text may not map cleanly.

    Returns:
        A list of 0/1 values, positionally aligned with ``MODEL_A_SYMPTOMS``.
    """
    vector = [0] * len(MODEL_A_SYMPTOMS)

    for symptom in symptoms:
        try:
            vector[symptom_index(symptom)] = 1
        except FeatureSpecError:
            if strict:
                raise

    return vector
