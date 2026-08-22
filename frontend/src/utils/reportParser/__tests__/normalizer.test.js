import { describe, expect, it } from "vitest";
import { toObservation, collapseObservations } from "../normalizer";

describe("toObservation", () => {
  it("marks unresolved lab names as needs_review", () => {
    const observation = toObservation({ rawName: "Some Unknown Marker", value: 42 });
    expect(observation.key).toBeNull();
    expect(observation.status).toBe("needs_review");
  });

  it("lowers confidence when the unit is missing", () => {
    const withUnit = toObservation({ rawName: "glucose", value: 100, unit: "mg/dL" });
    const withoutUnit = toObservation({ rawName: "glucose", value: 100 });

    expect(withoutUnit.source.confidence).toBeLessThan(withUnit.source.confidence);
  });

  it("flags out-of-range values with low confidence and needs_review", () => {
    const observation = toObservation({ rawName: "glucose", value: 900, unit: "mg/dL" });
    expect(observation.status).toBe("needs_review");
    expect(observation.source.confidence).toBeLessThanOrEqual(0.3);
  });

  it("produces a parsed status for a clean, in-range, known value", () => {
    const observation = toObservation({ rawName: "Glucose", value: 100, unit: "mg/dL" });
    expect(observation.key).toBe("glucose");
    expect(observation.status).toBe("parsed");
    expect(observation.value).toBe(100);
  });

  it("never throws, even on garbage input", () => {
    expect(() => toObservation()).not.toThrow();
    expect(() => toObservation(null)).not.toThrow();
    expect(() => toObservation({ rawName: 123, value: {}, unit: [] })).not.toThrow();
    expect(toObservation().status).toBe("needs_review");
  });
});

describe("collapseObservations", () => {
  it("keeps the latest accepted value per key", () => {
    const observations = [
      toObservation({
        rawName: "glucose",
        value: 100,
        unit: "mg/dL",
        observedAt: "2024-01-01",
      }),
      toObservation({
        rawName: "glucose",
        value: 120,
        unit: "mg/dL",
        observedAt: "2024-06-01",
      }),
    ];

    const collapsed = collapseObservations(observations);
    expect(collapsed.glucose.value).toBe(120);
  });

  it("only considers status === parsed observations", () => {
    const observations = [
      toObservation({ rawName: "Unknown Marker", value: 42 }),
      toObservation({ rawName: "glucose", value: 100, unit: "mg/dL" }),
    ];

    const collapsed = collapseObservations(observations);
    expect(Object.keys(collapsed)).toEqual(["glucose"]);
  });

  it("handles an empty or undefined list", () => {
    expect(collapseObservations([])).toEqual({});
    expect(collapseObservations()).toEqual({});
  });
});
