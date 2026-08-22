function normalizePatientData(patientData) {
  const { vitals, symptoms, labs } = patientData;
  const bmi = calculateBmi(vitals.weight_kg, vitals.height_cm);

  return {
    normalized_vitals: {
      systolic_bp: normalize(vitals.systolic_bp, 60, 250),
      diastolic_bp: normalize(vitals.diastolic_bp, 40, 150),
      heart_rate: normalize(vitals.heart_rate, 30, 220),
      bmi: round(bmi),
    },
    symptoms_encoded: encodeSymptoms(symptoms),
    labs_normalized: {
      glucose: normalize(labs.glucose, 40, 600),
      cholesterol: normalize(labs.cholesterol, 50, 500),
    },
  };
}

const KNOWN_SYMPTOMS = [
  "fatigue",
  "frequent_urination",
  "blurred_vision",
  "chest_pain",
  "shortness_of_breath",
];

function encodeSymptoms(symptoms = []) {
  return KNOWN_SYMPTOMS.map((symptom) => (symptoms.includes(symptom) ? 1 : 0));
}

function calculateBmi(weightKg, heightCm) {
  if (!weightKg || !heightCm) {
    return 0;
  }

  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

function normalize(value, min, max) {
  if (typeof value !== "number") {
    return 0;
  }

  return round(clamp((value - min) / (max - min), 0, 1));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

module.exports = { normalizePatientData };
