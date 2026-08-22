// Canonical units the app stores values in, per lab key.
export const CANONICAL_UNITS = {
  glucose: "mg/dL",
  cholesterol: "mg/dL",
  triglycerides: "mg/dL",
  hdl: "mg/dL",
  ldl: "mg/dL",
  hba1c: "%",
  creatinine: "mg/dL",
  hemoglobin: "g/dL",
};

// Conversion factors for mmol/L -> mg/dL, keyed by lab.
const MMOL_TO_MGDL = {
  glucose: 18.0182,
  cholesterol: 38.67,
  ldl: 38.67,
  hdl: 38.67,
  triglycerides: 88.57,
};

function normalizeUnit(unit) {
  if (typeof unit !== "string") {
    return "";
  }
  return unit.trim().toLowerCase().replace(/\s+/g, "");
}

// Converts `value` (given in `unit`) to the canonical unit for `key`.
// Returns { value, unit, converted }. `value` is null when the input isn't
// numeric. `unit` is the resulting (canonical) unit when a conversion is
// applied, otherwise the original unit is passed through unchanged.
export function convertToCanonical(key, value, unit) {
  const numeric = Number(value);
  const canonicalUnit = CANONICAL_UNITS[key] || unit || "";

  if (value === null || value === undefined || value === "" || Number.isNaN(numeric)) {
    return { value: null, unit: unit || canonicalUnit || null, converted: false };
  }

  const normalizedUnit = normalizeUnit(unit);

  if (!normalizedUnit) {
    return { value: numeric, unit: canonicalUnit || null, converted: false };
  }

  if (normalizedUnit === "mmol/l" && MMOL_TO_MGDL[key]) {
    return {
      value: round(numeric * MMOL_TO_MGDL[key]),
      unit: "mg/dL",
      converted: true,
    };
  }

  if (key === "creatinine" && normalizedUnit === "µmol/l") {
    return { value: round(numeric / 88.4), unit: "mg/dL", converted: true };
  }

  if (key === "creatinine" && normalizedUnit === "umol/l") {
    return { value: round(numeric / 88.4), unit: "mg/dL", converted: true };
  }

  if (key === "hemoglobin" && normalizedUnit === "g/l") {
    return { value: round(numeric / 10), unit: "g/dL", converted: true };
  }

  if (key === "hba1c" && normalizedUnit === "mmol/mol") {
    // IFCC -> DCCT/NGSP percent conversion.
    return { value: round(numeric / 10.929 + 2.15), unit: "%", converted: true };
  }

  return { value: numeric, unit: unit || canonicalUnit || null, converted: false };
}

function round(value) {
  return Math.round(value * 100) / 100;
}
