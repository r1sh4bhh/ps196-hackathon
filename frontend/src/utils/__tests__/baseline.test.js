import { describe, expect, it } from "vitest";
import { computeAllBaselines, computeBaseline } from "../baseline";

describe("computeBaseline", () => {
  it("returns unavailable without history", () => {
    const result = computeBaseline("systolic_bp", [], 138);

    expect(result.status).toBe("unavailable");
    expect(result.baseline).toBeNull();
    expect(result.difference).toBeNull();
  });

  it("does not fabricate a baseline from one or two observations", () => {
    const result = computeBaseline("systolic_bp", [{ value: 118 }, { value: 121 }], 130);

    expect(result.status).toBe("establishing");
    expect(result.baseline).toBeNull();
    expect(result.difference).toBeNull();
  });

  it("computes an established baseline, difference, and percentage change", () => {
    const history = [118, 120, 117, 119, 121].map((value) => ({ value }));
    const result = computeBaseline("systolic_bp", history, 138);

    expect(result.status).toBe("established");
    expect(result.baseline).toBe(119);
    expect(result.recentBaseline).toBe(119);
    expect(result.difference).toBe(19);
    expect(result.percentage_change).toBe(15.97);
  });

  it("uses the dead-band for values at the baseline", () => {
    const result = computeBaseline(
      "systolic_bp",
      [{ value: 120 }, { value: 120 }, { value: 120 }],
      120
    );

    expect(result.direction).toBe("at_baseline");
  });

  it.each([
    [[100, 101, 110, 111], "rising"],
    [[111, 110, 101, 100], "falling"],
    [[100, 101, 100, 101], "stable"],
    [[100, 101, 102], "unknown"],
  ])("reports a %s trend as %s", (values, trend) => {
    const result = computeBaseline(
      "systolic_bp",
      values.map((value) => ({ value })),
      120
    );

    expect(result.trend).toBe(trend);
  });

  it("ignores null, missing, and non-numeric values", () => {
    expect(() =>
      computeBaseline("glucose", [{ value: null }, {}, { value: "no" }], "no")
    ).not.toThrow();
    expect(computeBaseline("glucose", [{ value: null }, { value: "no" }], "no").status).toBe(
      "unavailable"
    );
    expect(() =>
      computeAllBaselines([{ patientData: {} }, null], { patientData: {} })
    ).not.toThrow();
  });
});
