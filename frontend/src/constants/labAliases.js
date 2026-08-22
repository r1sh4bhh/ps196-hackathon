// Labs permitted in the `/predict` request payload, per `docs/API.md`.
// This is the ONLY set of lab keys that may appear in `patientData.labs`.
// Do not add to this list without updating `docs/API.md` first.
export const API_LAB_KEYS = ["glucose", "cholesterol", "triglycerides", "hdl"];

// Full set of labs the app understands, including local-only extras that are
// useful for the patient's own record but are never sent to the backend.
export const LAB_DEFINITIONS = {
  glucose: { label: "Glucose", unit: "mg/dL", min: 40, max: 600 },
  cholesterol: { label: "Total Cholesterol", unit: "mg/dL", min: 50, max: 500 },
  triglycerides: { label: "Triglycerides", unit: "mg/dL", min: 30, max: 1000 },
  hdl: { label: "HDL", unit: "mg/dL", min: 10, max: 150 },
  ldl: { label: "LDL", unit: "mg/dL", min: 10, max: 300 },
  hba1c: { label: "HbA1c", unit: "%", min: 3, max: 20 },
  creatinine: { label: "Creatinine", unit: "mg/dL", min: 0.1, max: 15 },
  hemoglobin: { label: "Hemoglobin", unit: "g/dL", min: 3, max: 20 },
};

// Lowercased, alias -> canonical key lookup. Keys here should already be
// lowercase; `resolveLabKey` normalizes incoming names before lookup.
export const LAB_ALIASES = {
  glucose: "glucose",
  fbs: "glucose",
  "fasting blood sugar": "glucose",
  "blood glucose": "glucose",
  "blood sugar": "glucose",
  cholesterol: "cholesterol",
  "total cholesterol": "cholesterol",
  tc: "cholesterol",
  triglycerides: "triglycerides",
  tg: "triglycerides",
  hdl: "hdl",
  "hdl-c": "hdl",
  "hdl cholesterol": "hdl",
  "high density lipoprotein": "hdl",
  ldl: "ldl",
  "ldl-c": "ldl",
  "ldl cholesterol": "ldl",
  "low density lipoprotein": "ldl",
  hba1c: "hba1c",
  a1c: "hba1c",
  "glycated hemoglobin": "hba1c",
  "glycosylated hemoglobin": "hba1c",
  creatinine: "creatinine",
  "serum creatinine": "creatinine",
  hemoglobin: "hemoglobin",
  hb: "hemoglobin",
  hgb: "hemoglobin",
};

// Lowercases, strips punctuation, and collapses whitespace before looking up
// the alias table. Returns the canonical key, or null when unrecognized.
export function resolveLabKey(rawName) {
  if (typeof rawName !== "string") {
    return null;
  }

  const normalized = rawName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return null;
  }

  if (LAB_ALIASES[normalized]) {
    return LAB_ALIASES[normalized];
  }

  // Also try with hyphens collapsed to spaces (e.g. "hdl-c" vs "hdl c").
  const dehyphenated = normalized.replace(/-/g, " ").replace(/\s+/g, " ").trim();
  return LAB_ALIASES[dehyphenated] || null;
}
