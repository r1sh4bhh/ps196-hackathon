import { describe, expect, it } from "vitest";
import { formatMeasurement, formatNumber, formatOptionLabel } from "../format";

describe("formatNumber", () => {
  it("rounds a raw float to one decimal place", () => {
    expect(formatNumber(29.069767441860467)).toBe("29.1");
    expect(formatNumber(23.055555555555554)).toBe("23.1");
  });

  it("keeps whole numbers whole", () => {
    expect(formatNumber(135)).toBe("135");
    expect(formatNumber(74.7)).toBe("74.7");
  });

  it("returns null for missing or non-numeric values", () => {
    expect(formatNumber(null)).toBeNull();
    expect(formatNumber(undefined)).toBeNull();
    expect(formatNumber("")).toBeNull();
    expect(formatNumber("abc")).toBeNull();
  });
});

describe("formatMeasurement", () => {
  it("appends the unit to the rounded value", () => {
    expect(formatMeasurement(29.069767441860467, "kg/m²")).toBe("29.1 kg/m²");
    expect(formatMeasurement(148, "mmHg")).toBe("148 mmHg");
  });

  it("renders an em-dash when there is no value", () => {
    expect(formatMeasurement(null, "kg/m²")).toBe("—");
  });

  it("omits a missing unit", () => {
    expect(formatMeasurement(1.25, undefined)).toBe("1.3");
  });
});

describe("formatOptionLabel", () => {
  it("renders a raw option value in sentence case", () => {
    expect(formatOptionLabel("moderately_active")).toBe("Moderately active");
    expect(formatOptionLabel("never")).toBe("Never");
  });

  it("uses sentence case rather than title case", () => {
    expect(formatOptionLabel("kidney_disease")).toBe("Kidney disease");
    expect(formatOptionLabel("KIDNEY_DISEASE")).toBe("Kidney disease");
  });

  it("returns an empty string for missing values", () => {
    expect(formatOptionLabel(undefined)).toBe("");
    expect(formatOptionLabel(null)).toBe("");
    expect(formatOptionLabel("  ")).toBe("");
  });
});
