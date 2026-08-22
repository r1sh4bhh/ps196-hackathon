import { API_LAB_KEYS } from "../constants/labAliases";
import { CANONICAL_SYMPTOMS } from "../constants/symptoms";

// Builds the exact `patientData` shape defined in `docs/API.md` from a
// stored user profile. Labs are restricted to `API_LAB_KEYS` (the only labs
// the contract allows) and symptoms are restricted to `CANONICAL_SYMPTOMS`.
// No fields are invented beyond what the contract defines.
export function buildPatientDataFromProfile(profile) {
  if (!profile) {
    return null;
  }

  const answers = profile.questionnaire || {};
  const reportLabs = profile.labs?.fromReports || {};
  const manualLabs = profile.labs?.manual || {};

  const labs = {};
  for (const key of API_LAB_KEYS) {
    const manualValue = manualLabs[key];
    const reportValue = reportLabs[key];
    const value =
      manualValue !== undefined && manualValue !== null && manualValue !== ""
        ? manualValue
        : reportValue;

    labs[key] = typeof value === "number" ? value : value ? Number(value) : null;
    if (Number.isNaN(labs[key])) {
      labs[key] = null;
    }
  }

  const symptoms = Array.isArray(answers.baseline_symptoms)
    ? answers.baseline_symptoms.filter((symptom) => CANONICAL_SYMPTOMS.includes(symptom))
    : [];

  return {
    patientId: profile.patientId || null,
    age: toNullableNumber(answers.age),
    vitals: {
      systolic_bp: toNullableNumber(profile.vitals?.systolic_bp),
      diastolic_bp: toNullableNumber(profile.vitals?.diastolic_bp),
      heart_rate: toNullableNumber(profile.vitals?.heart_rate),
      temperature: toNullableNumber(profile.vitals?.temperature),
      weight_kg: toNullableNumber(answers.weight_kg ?? profile.vitals?.weight_kg),
      height_cm: toNullableNumber(answers.height_cm ?? profile.vitals?.height_cm),
    },
    symptoms,
    labs,
  };
}

function toNullableNumber(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const numeric = Number(value);
  return Number.isNaN(numeric) ? null : numeric;
}
