function validatePatientData(patientData) {
  const errors = [];

  if (!patientData.patientId || typeof patientData.patientId !== "string") {
    errors.push("patientId is required");
  }

  if (
    typeof patientData.age !== "number" ||
    patientData.age <= 0 ||
    patientData.age > 120
  ) {
    errors.push("age must be a number between 1 and 120");
  }

  const vitals = patientData.vitals || {};
  checkRange(errors, "systolic_bp", vitals.systolic_bp, 60, 250);
  checkRange(errors, "diastolic_bp", vitals.diastolic_bp, 40, 150);
  checkRange(errors, "heart_rate", vitals.heart_rate, 30, 220);
  checkRange(errors, "temperature", vitals.temperature, 90, 110);
  checkRange(errors, "weight_kg", vitals.weight_kg, 20, 300);
  checkRange(errors, "height_cm", vitals.height_cm, 50, 250);

  if (!Array.isArray(patientData.symptoms)) {
    errors.push("symptoms must be an array");
  }

  const labs = patientData.labs || {};
  checkRange(errors, "glucose", labs.glucose, 40, 600);
  checkRange(errors, "cholesterol", labs.cholesterol, 50, 500);
  checkRange(errors, "triglycerides", labs.triglycerides, 30, 1000);
  checkRange(errors, "hdl", labs.hdl, 10, 150);

  return { isValid: errors.length === 0, errors };
}

function checkRange(errors, field, value, min, max) {
  if (typeof value !== "number" || value < min || value > max) {
    errors.push(`${field} must be a number between ${min} and ${max}`);
  }
}

module.exports = { validatePatientData };
