import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearHistory,
  exportHistory,
  getMetricHistory,
  importHistory,
  latestAssessment,
  listAssessments,
  removeAssessment,
  saveAssessment,
} from "../assessmentHistory";

function assessment(id, patientId, timestamp, systolicBp = 120) {
  return {
    id,
    patientId,
    timestamp,
    patientData: {
      vitals: { systolic_bp: systolicBp },
      labs: { glucose: 100 },
    },
    prediction: {
      risk_scores: { diabetes: 0.2 },
      top_disease: "diabetes",
      confidence: 0.2,
      evidence: [{ next_test: "HbA1c" }],
    },
    baselines: {},
  };
}

describe("assessmentHistory", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("round-trips assessments and filters them by patient", () => {
    saveAssessment(assessment("a1", "P001", "2026-02-01T00:00:00.000Z"));
    saveAssessment(assessment("a2", "P002", "2026-01-01T00:00:00.000Z"));
    saveAssessment(assessment("a3", "P001", "2026-01-01T00:00:00.000Z"));

    expect(listAssessments("P001").map((entry) => entry.id)).toEqual(["a3", "a1"]);
    expect(latestAssessment("P001").id).toBe("a1");
    expect(listAssessments("P002")).toHaveLength(1);
  });

  it("degrades safely when storage JSON is corrupted", () => {
    localStorage.setItem("ps196_assessment_history", "{bad json");

    expect(() => listAssessments("P001")).not.toThrow();
    expect(listAssessments("P001")).toEqual([]);
  });

  it("caps each patient's history at 100 assessments", () => {
    for (let index = 0; index < 101; index += 1) {
      saveAssessment(
        assessment(`a${index}`, "P001", new Date(Date.UTC(2026, 0, index + 1)).toISOString())
      );
    }

    const records = listAssessments("P001");
    expect(records).toHaveLength(100);
    expect(records.find((record) => record.id === "a0")).toBeUndefined();
  });

  it("exports, imports, and removes history", () => {
    saveAssessment(assessment("a1", "P001", "2026-01-01T00:00:00.000Z"));
    const exported = exportHistory();

    clearHistory();
    expect(listAssessments("P001")).toEqual([]);
    expect(importHistory(exported)).toBe(true);
    expect(listAssessments("P001")).toHaveLength(1);
    expect(removeAssessment("a1")).toBe(true);
    expect(removeAssessment("a1")).toBe(false);
  });

  it("returns metric values in chronological order", () => {
    saveAssessment(assessment("a1", "P001", "2026-03-01T00:00:00.000Z", 130));
    saveAssessment(assessment("a2", "P001", "2026-01-01T00:00:00.000Z", 120));

    expect(getMetricHistory("P001", "systolic_bp")).toEqual([
      { value: 120, timestamp: "2026-01-01T00:00:00.000Z" },
      { value: 130, timestamp: "2026-03-01T00:00:00.000Z" },
    ]);
  });

  it("preserves provenance needed to interpret historical values and predictions", () => {
    const record = assessment("a1", "P001", "2026-01-01T00:00:00.000Z");
    record.reusedLabs = {
      glucose: { value: 100, recordedAt: "2025-12-01T00:00:00.000Z", isStale: true },
    };
    record.source = "device";
    record.simulated = true;
    record.prediction.source = "model";
    record.prediction.ml_detail = {
      diabetes_risk: {
        partial_input: true,
        defaulted_features: ["insulin"],
        missing_key_inputs: ["insulin"],
      },
    };

    saveAssessment(record);
    const saved = listAssessments("P001")[0];

    expect(saved.reusedLabs.glucose.isStale).toBe(true);
    expect(saved.source).toBe("device");
    expect(saved.simulated).toBe(true);
    expect(saved.prediction.ml_detail.diabetes_risk.defaulted_features).toEqual(["insulin"]);
  });
});
