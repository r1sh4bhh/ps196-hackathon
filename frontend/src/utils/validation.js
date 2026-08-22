export function validatePatientData(patientData) {
  const errors = {};

  if (!patientData.patientId || typeof patientData.patientId !== "string") {
    errors.patientId = "Patient ID is required.";
  }

  if (!patientData.age || patientData.age <= 0 || patientData.age > 120) {
    errors.age = "Enter a valid age (1-120).";
  }

  const vitals = patientData.vitals || {};
  if (!isInRange(vitals.systolic_bp, 60, 250)) {
    errors.systolic_bp = "Systolic BP out of range.";
  }
  if (!isInRange(vitals.diastolic_bp, 40, 150)) {
    errors.diastolic_bp = "Diastolic BP out of range.";
  }
  if (!isInRange(vitals.heart_rate, 30, 220)) {
    errors.heart_rate = "Heart rate out of range.";
  }
  if (!isInRange(vitals.temperature, 90, 110)) {
    errors.temperature = "Temperature out of range.";
  }
  if (!isInRange(vitals.weight_kg, 20, 300)) {
    errors.weight_kg = "Weight out of range.";
  }
  if (!isInRange(vitals.height_cm, 50, 250)) {
    errors.height_cm = "Height out of range.";
  }

  if (!Array.isArray(patientData.symptoms)) {
    errors.symptoms = "Symptoms must be a list.";
  }

  const labs = patientData.labs || {};
  if (!isInRange(labs.glucose, 40, 600)) {
    errors.glucose = "Glucose out of range.";
  }
  if (!isInRange(labs.cholesterol, 50, 500)) {
    errors.cholesterol = "Cholesterol out of range.";
  }
  if (!isInRange(labs.triglycerides, 30, 1000)) {
    errors.triglycerides = "Triglycerides out of range.";
  }
  if (!isInRange(labs.hdl, 10, 150)) {
    errors.hdl = "HDL out of range.";
  }

  return { isValid: Object.keys(errors).length === 0, errors };
}

function isInRange(value, min, max) {
  return typeof value === "number" && value >= min && value <= max;
}
