import { describe, expect, it } from "vitest";
import { buildRiskTrajectory } from "../trajectory";

describe("buildRiskTrajectory", () => {
  it("returns an empty array without at least one usable assessment", () => {
    expect(buildRiskTrajectory([], "diabetes")).toEqual([]);
    expect(buildRiskTrajectory(null, "diabetes")).toEqual([]);
    expect(buildRiskTrajectory([{ prediction: {} }], null)).toEqual([]);
  });

  it("builds a point per real assessment, in chronological order", () => {
    const assessments = [
      { timestamp: "2026-02-01T00:00:00.000Z", prediction: { risk_scores: { diabetes: 0.4 } } },
      { timestamp: "2026-01-01T00:00:00.000Z", prediction: { risk_scores: { diabetes: 0.3 } } },
    ];

    const trajectory = buildRiskTrajectory(assessments, "diabetes");

    expect(trajectory).toEqual([
      { day: 1, risk: 0.3, timestamp: "2026-01-01T00:00:00.000Z" },
      { day: 2, risk: 0.4, timestamp: "2026-02-01T00:00:00.000Z" },
    ]);
  });

  it("skips visits missing that disease's risk score rather than inventing one", () => {
    const assessments = [
      { timestamp: "2026-01-01T00:00:00.000Z", prediction: { risk_scores: { diabetes: 0.3 } } },
      { timestamp: "2026-02-01T00:00:00.000Z", prediction: { risk_scores: {} } },
    ];

    expect(buildRiskTrajectory(assessments, "diabetes")).toEqual([
      { day: 1, risk: 0.3, timestamp: "2026-01-01T00:00:00.000Z" },
    ]);
  });
});
