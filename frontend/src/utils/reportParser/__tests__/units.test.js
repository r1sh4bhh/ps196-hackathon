import { describe, expect, it } from "vitest";
import { convertToCanonical } from "../units";

describe("convertToCanonical", () => {
  it("converts glucose mmol/L to mg/dL", () => {
    const result = convertToCanonical("glucose", 8, "mmol/L");
    expect(result.converted).toBe(true);
    expect(result.unit).toBe("mg/dL");
    expect(result.value).toBeCloseTo(144.15, 1);
  });

  it("converts cholesterol/LDL/HDL mmol/L to mg/dL", () => {
    expect(convertToCanonical("cholesterol", 5, "mmol/L").value).toBeCloseTo(193.35, 1);
    expect(convertToCanonical("ldl", 3, "mmol/L").value).toBeCloseTo(116.01, 1);
    expect(convertToCanonical("hdl", 1, "mmol/L").value).toBeCloseTo(38.67, 1);
  });

  it("converts triglycerides mmol/L to mg/dL", () => {
    expect(convertToCanonical("triglycerides", 2, "mmol/L").value).toBeCloseTo(177.14, 1);
  });

  it("converts creatinine µmol/L to mg/dL", () => {
    const result = convertToCanonical("creatinine", 88.4, "µmol/L");
    expect(result.unit).toBe("mg/dL");
    expect(result.value).toBeCloseTo(1, 2);
  });

  it("converts hemoglobin g/L to g/dL", () => {
    const result = convertToCanonical("hemoglobin", 140, "g/L");
    expect(result.unit).toBe("g/dL");
    expect(result.value).toBeCloseTo(14, 2);
  });

  it("converts HbA1c mmol/mol to %", () => {
    const result = convertToCanonical("hba1c", 53, "mmol/mol");
    expect(result.unit).toBe("%");
    expect(result.value).toBeCloseTo(7, 1);
  });

  it("passes through values already in the canonical unit", () => {
    const result = convertToCanonical("glucose", 145, "mg/dL");
    expect(result.converted).toBe(false);
    expect(result.value).toBe(145);
  });

  it("returns null value for non-numeric input", () => {
    expect(convertToCanonical("glucose", "not-a-number", "mg/dL").value).toBeNull();
    expect(convertToCanonical("glucose", null, "mg/dL").value).toBeNull();
    expect(convertToCanonical("glucose", "", "mg/dL").value).toBeNull();
  });
});
