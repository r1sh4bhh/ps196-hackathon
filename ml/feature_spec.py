"""Frozen feature specifications for every PS196 ML model.

This module is the **single source of truth** for feature order across the
three models used by PS196:

- Model A: 41-disease symptom differential (Random Forest over 132 binary
  symptom columns).
- Model B: Pima Indians diabetes risk model.
- Model C: UCI Cleveland heart disease risk model.

Why this file exists
---------------------
Three models means three ordered feature lists. A positional mismatch
between training and inference fails **silently** - the model still returns
a confident-looking number, it is just nonsense. Both training scripts and
``ml/inference/inference.py`` must import the ``FEATURE_ORDER`` constants
and ``validate_vector()`` helper from *this* file. Feature order must never
be redefined anywhere else in the codebase.

The 132-symptom vocabulary below matches the column order of the Kaggle
``itachi9604/disease-symptom-description-dataset`` ``Training.csv`` /
``Testing.csv`` files, including the dataset's known quirk of a duplicated
``fluid_overload`` column (it genuinely appears twice in the source data,
at position 44 and 108-ish). We keep both occurrences so a real download of
that dataset lines up column-for-column with this list.
"""

from __future__ import annotations

from typing import Sequence

# ---------------------------------------------------------------------------
# Model A: 41-disease symptom differential
# ---------------------------------------------------------------------------

#: Canonical, ordered vocabulary of the 132 binary symptom columns used by
#: Model A. Order matches the source Kaggle dataset column order exactly.
SYMPTOM_VOCABULARY: tuple[str, ...] = (
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
    "fluid_overload",  # duplicated in the source dataset - see module docstring
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

#: Ordered feature vector expected by Model A. Identical to
#: ``SYMPTOM_VOCABULARY`` - kept as a separate name so callers use the
#: ``*_FEATURE_ORDER`` naming convention consistently across all models.
MODEL_A_FEATURE_ORDER: tuple[str, ...] = SYMPTOM_VOCABULARY

#: The real Kaggle CSV ships a handful of column names with stray spaces or
#: punctuation (e.g. ``"spotting_ urination"``, ``"toxic_look_(typhos)"``).
#: Training reads the raw CSV, strips whitespace from headers, then applies
#: this alias map so the resulting columns line up exactly with the clean
#: names in ``SYMPTOM_VOCABULARY``. Inference never touches this map - it
#: only consumes clean names via ``FEATURE_ORDER``.
RAW_COLUMN_ALIASES: dict[str, str] = {
    "spotting_ urination": "spotting_urination",
    "foul_smell_of urine": "foul_smell_of_urine",
    "toxic_look_(typhos)": "toxic_look_typhos",
    "dischromic _patches": "dischromic_patches",
}

#: The 41 disease labels Model A can predict, in the order used to build
#: the label encoder during training. Must stay stable across retraining
#: runs since ``joblib``-pickled label encoders embed this ordering.
DISEASE_LABELS: tuple[str, ...] = (
    "Fungal infection",
    "Allergy",
    "GERD",
    "Chronic cholestasis",
    "Drug Reaction",
    "Peptic ulcer diseae",
    "AIDS",
    "Diabetes",
    "Gastroenteritis",
    "Bronchial Asthma",
    "Hypertension",
    "Migraine",
    "Cervical spondylosis",
    "Paralysis (brain hemorrhage)",
    "Jaundice",
    "Malaria",
    "Chicken pox",
    "Dengue",
    "Typhoid",
    "hepatitis A",
    "Hepatitis B",
    "Hepatitis C",
    "Hepatitis D",
    "Hepatitis E",
    "Alcoholic hepatitis",
    "Tuberculosis",
    "Common Cold",
    "Pneumonia",
    "Dimorphic hemmorhoids(piles)",
    "Heart attack",
    "Varicose veins",
    "Hypothyroidism",
    "Hyperthyroidism",
    "Hypoglycemia",
    "Osteoarthristis",
    "Arthritis",
    "(vertigo) Paroymsal Positional Vertigo",
    "Acne",
    "Urinary tract infection",
    "Psoriasis",
    "Impetigo",
)

# ---------------------------------------------------------------------------
# Model B: Pima Indians diabetes risk
# ---------------------------------------------------------------------------

#: Ordered feature vector expected by Model B, matching the canonical Pima
#: Indians Diabetes CSV column order (minus the ``Outcome`` label column).
MODEL_B_FEATURE_ORDER: tuple[str, ...] = (
    "Pregnancies",
    "Glucose",
    "BloodPressure",
    "SkinThickness",
    "Insulin",
    "BMI",
    "DiabetesPedigreeFunction",
    "Age",
)

#: Columns where ``0`` is a recorded missing value rather than a genuine
#: reading (a physiologically impossible zero blood pressure, BMI, etc.).
#: ``ml/inference/preprocessing.py`` and the training script both use this
#: list so imputation is identical at train and inference time.
MODEL_B_ZERO_AS_MISSING_COLUMNS: tuple[str, ...] = (
    "Glucose",
    "BloodPressure",
    "SkinThickness",
    "Insulin",
    "BMI",
)

# ---------------------------------------------------------------------------
# Model C: UCI Cleveland heart disease risk
# ---------------------------------------------------------------------------

#: Ordered feature vector expected by Model C, matching the canonical UCI
#: Cleveland Heart Disease column order (minus the ``target`` column).
MODEL_C_FEATURE_ORDER: tuple[str, ...] = (
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

# ---------------------------------------------------------------------------
# Validation helper - shared by training and inference
# ---------------------------------------------------------------------------


def validate_vector(vector: Sequence[float], expected_order: Sequence[str]) -> None:
    """Raise ``ValueError`` if ``vector`` does not match ``expected_order``.

    This only checks length, since numeric feature vectors carry no names at
    runtime. Callers that hold a name->value mapping should build the vector
    by iterating over ``expected_order`` directly (see
    ``ml/inference/preprocessing.py``) so that order can never drift; this
    function is the last line of defense against a silent, confidently wrong
    prediction caused by a length/order mismatch.

    Args:
        vector: The numeric feature vector about to be fed to a model.
        expected_order: The frozen ``*_FEATURE_ORDER`` tuple for that model.

    Raises:
        ValueError: If ``vector`` length does not match ``expected_order``.
    """
    if len(vector) != len(expected_order):
        raise ValueError(
            "Feature vector length mismatch: got "
            f"{len(vector)} values but expected {len(expected_order)} "
            f"({expected_order[0]}..{expected_order[-1]}). "
            "This indicates a feature order/definition drift between "
            "training and inference - do not proceed."
        )


def validate_named_vector(named_values: dict, expected_order: Sequence[str]) -> list:
    """Build an ordered feature list from a name->value mapping, safely.

    Args:
        named_values: Mapping of feature name to numeric value.
        expected_order: The frozen ``*_FEATURE_ORDER`` tuple for that model.

    Returns:
        A list of values ordered exactly per ``expected_order``.

    Raises:
        ValueError: If any expected feature name is absent from
            ``named_values``.
    """
    missing = [name for name in expected_order if name not in named_values]
    if missing:
        raise ValueError(
            f"Missing required feature(s) for ordered vector: {missing}. "
            "Every feature in FEATURE_ORDER must be present, even if the "
            "value is a neutral default, to avoid silent misalignment."
        )
    ordered = [named_values[name] for name in expected_order]
    validate_vector(ordered, expected_order)
    return ordered
