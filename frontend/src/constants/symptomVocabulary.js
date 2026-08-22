import vocabulary from "../../../shared/symptomVocabulary.json";

export const CANONICAL_SYMPTOMS = Object.freeze([...vocabulary]);

const LABEL_OVERRIDES = {
  blurred_and_distorted_vision: "Blurred or distorted vision",
  cold_hands_and_feets: "Cold hands and feet",
  continuous_feel_of_urine: "Constant urge to urinate",
  extra_marital_contacts: "Multiple sexual partners",
  fluid_overload_2: "Fluid overload",
  foul_smell_of_urine: "Strong-smelling urine",
  polyuria: "Passing urine very often",
  scurring: "Scarring",
  spotting_urination: "Blood spotting when urinating",
  toxic_look_typhos: "Toxic appearance",
};

export const SYMPTOM_LABELS = Object.freeze(
  Object.fromEntries(
    CANONICAL_SYMPTOMS.map((symptom) => [
      symptom,
      LABEL_OVERRIDES[symptom] ||
        symptom.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
    ])
  )
);

export function isKnownSymptom(symptom) {
  return CANONICAL_SYMPTOMS.includes(symptom);
}
