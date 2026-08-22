import { CANONICAL_SYMPTOMS, SYMPTOM_LABELS } from "./symptoms";

// Data-driven questionnaire schema. Each question is a plain object describing
// how to render it and how to validate it. Add a new question by adding a new
// entry here — no component code needs to change.
//
// Question shape:
// {
//   id: string,                 // storage key under profile.questionnaire
//   section: string,             // section heading, used for grouping
//   label: string,                // question text
//   type: "boolean" | "single" | "multi" | "number" | "text",
//   options?: string[],           // value list for single/multi
//   optionLabels?: object,        // value -> display label overrides
//   unit?: string,                // display unit for number fields
//   min?: number,                 // numeric lower bound (inclusive)
//   max?: number,                 // numeric upper bound (inclusive)
//   required?: boolean,
//   dependsOn?: { id: string, equals: any }, // only visible when another
//                                             // question's answer matches
// }
export const QUESTIONNAIRE_SECTIONS = [
  "Demographics",
  "Lifestyle",
  "Medical History",
  "Family History",
  "Medications",
  "Symptom Review",
];

export const QUESTIONNAIRE = [
  // --- Demographics ---
  {
    id: "age",
    section: "Demographics",
    label: "Age",
    type: "number",
    unit: "years",
    min: 0,
    max: 120,
    required: true,
  },
  {
    id: "sex",
    section: "Demographics",
    label: "Sex",
    type: "single",
    options: ["male", "female", "other"],
    required: true,
  },
  {
    id: "height_cm",
    section: "Demographics",
    label: "Height",
    type: "number",
    unit: "cm",
    min: 50,
    max: 250,
    required: true,
  },
  {
    id: "weight_kg",
    section: "Demographics",
    label: "Weight",
    type: "number",
    unit: "kg",
    min: 20,
    max: 300,
    required: true,
  },

  // --- Lifestyle ---
  {
    id: "smoking_status",
    section: "Lifestyle",
    label: "Smoking status",
    type: "single",
    options: ["never", "former", "current"],
    required: true,
  },
  {
    id: "pack_years",
    section: "Lifestyle",
    label: "Pack-years",
    type: "number",
    unit: "pack-years",
    min: 0,
    max: 200,
    dependsOn: { id: "smoking_status", equals: "current" },
  },
  {
    id: "alcohol",
    section: "Lifestyle",
    label: "Alcohol consumption",
    type: "single",
    options: ["none", "occasional", "moderate", "heavy"],
    required: true,
  },
  {
    id: "activity_level",
    section: "Lifestyle",
    label: "Physical activity level",
    type: "single",
    options: ["sedentary", "light", "moderate", "active"],
    required: true,
  },
  {
    id: "diet_type",
    section: "Lifestyle",
    label: "Diet type",
    type: "single",
    options: ["omnivore", "vegetarian", "vegan", "other"],
    required: true,
  },
  {
    id: "sleep_hours",
    section: "Lifestyle",
    label: "Average sleep",
    type: "number",
    unit: "hours/night",
    min: 0,
    max: 24,
    required: true,
  },

  // --- Medical History ---
  {
    id: "chronic_conditions",
    section: "Medical History",
    label: "Chronic conditions",
    type: "multi",
    options: ["diabetes", "hypertension", "asthma", "thyroid", "kidney_disease", "none"],
  },
  {
    id: "past_surgeries",
    section: "Medical History",
    label: "Past surgeries",
    type: "text",
  },
  {
    id: "allergies",
    section: "Medical History",
    label: "Known allergies",
    type: "text",
  },

  // --- Family History ---
  {
    id: "family_diabetes",
    section: "Family History",
    label: "Family history of diabetes",
    type: "boolean",
  },
  {
    id: "family_hypertension",
    section: "Family History",
    label: "Family history of hypertension",
    type: "boolean",
  },
  {
    id: "family_cardiac",
    section: "Family History",
    label: "Family history of cardiac disease",
    type: "boolean",
  },
  {
    id: "family_cancer",
    section: "Family History",
    label: "Family history of cancer",
    type: "boolean",
  },
  {
    id: "family_stroke",
    section: "Family History",
    label: "Family history of stroke",
    type: "boolean",
  },
  {
    id: "family_kidney",
    section: "Family History",
    label: "Family history of kidney disease",
    type: "boolean",
  },

  // --- Medications ---
  {
    id: "medications",
    section: "Medications",
    label: "Current medications",
    type: "text",
  },
  {
    id: "supplements",
    section: "Medications",
    label: "Supplements",
    type: "text",
  },

  // --- Symptom Review ---
  {
    id: "baseline_symptoms",
    section: "Symptom Review",
    label: "Symptoms you are currently experiencing",
    type: "multi",
    options: CANONICAL_SYMPTOMS,
    optionLabels: SYMPTOM_LABELS,
  },
];

export function isQuestionVisible(question, answers) {
  if (!question.dependsOn) {
    return true;
  }

  const { id, equals } = question.dependsOn;
  return answers?.[id] === equals;
}

export function validateQuestionnaire(answers = {}) {
  const errors = {};

  for (const question of QUESTIONNAIRE) {
    if (!isQuestionVisible(question, answers)) {
      continue;
    }

    const value = answers[question.id];
    const isEmpty =
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0);

    if (question.required && isEmpty) {
      errors[question.id] = `${question.label} is required.`;
      continue;
    }

    if (isEmpty) {
      continue;
    }

    if (question.type === "number") {
      const numeric = Number(value);
      if (Number.isNaN(numeric)) {
        errors[question.id] = `${question.label} must be a number.`;
      } else if (question.min !== undefined && numeric < question.min) {
        errors[question.id] = `${question.label} must be at least ${question.min}.`;
      } else if (question.max !== undefined && numeric > question.max) {
        errors[question.id] = `${question.label} must be at most ${question.max}.`;
      }
    }
  }

  return { isValid: Object.keys(errors).length === 0, errors };
}

export function computeBmi(heightCm, weightKg) {
  const height = Number(heightCm);
  const weight = Number(weightKg);

  if (!height || !weight || height <= 0) {
    return null;
  }

  const heightM = height / 100;
  return Math.round((weight / (heightM * heightM)) * 10) / 10;
}
