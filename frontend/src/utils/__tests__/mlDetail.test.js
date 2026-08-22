import { describe, expect, it } from "vitest";
import {
  getDisclaimer,
  getPredictionSource,
  getRiskDetail,
  getSourceBadge,
  getSymptomDifferential,
  isDegraded,
} from "../mlDetail";

describe("getPredictionSource", () => {
  it("only reports 'model' when the payload says so", () => {
    expect(getPredictionSource({ source: "model" })).toBe("model");
    expect(getPredictionSource({ source: "mock" })).toBe("mock");
    expect(getPredictionSource({})).toBe("mock");
    expect(getPredictionSource(null)).toBe("mock");
  });
});

describe("getSourceBadge", () => {
  it("is low weight for model output", () => {
    const badge = getSourceBadge({ source: "model" });

    expect(badge.variant).toBe("model");
    expect(badge.label).toBe("Model output");
    expect(badge.reason).toBeNull();
  });

  it("warns and surfaces the fallback reason for mock output", () => {
    const badge = getSourceBadge({ source: "mock", fallback_reason: "Backend unreachable" });

    expect(badge.variant).toBe("mock");
    expect(badge.label).toContain("Simulated data");
    expect(badge.reason).toBe("Backend unreachable");
    expect(badge.title).toContain("Backend unreachable");
  });

  it("warns when source is missing entirely", () => {
    const badge = getSourceBadge({ risk_scores: {} });

    expect(badge.variant).toBe("mock");
    expect(badge.reason).toBeNull();
  });
});

describe("ml_detail readers", () => {
  it("degrade gracefully when ml_detail is absent", () => {
    const prediction = { risk_scores: { diabetes: 0.5 }, source: "mock" };

    expect(getRiskDetail(prediction, "diabetes")).toBeNull();
    expect(getDisclaimer(prediction)).toBeNull();
    expect(isDegraded(prediction)).toBe(false);
    expect(getSymptomDifferential(prediction)).toBeNull();
  });

  it("reads a partial-input model section", () => {
    const prediction = {
      source: "model",
      ml_detail: {
        cardiac_risk: {
          available: true,
          source: "model",
          risk_score: 0.35,
          risk_band: "elevated",
          partial_input: true,
          missing_key_inputs: ["ca", "thal", "slope", "oldpeak"],
        },
      },
    };

    const detail = getRiskDetail(prediction, "heart_disease");

    expect(detail.provenance).toBe("model");
    expect(detail.band).toBe("elevated");
    expect(detail.partialInput).toBe(true);
    expect(detail.missingKeyInputs).toEqual(["ca", "thal", "slope", "oldpeak"]);
  });

  it("distinguishes rule-derived bands", () => {
    const prediction = {
      source: "model",
      ml_detail: {
        hypertension: {
          available: true,
          source: "rule",
          stage: "stage_1",
          description: "Systolic 130-139 mmHg or diastolic 80-89 mmHg",
        },
      },
    };

    const detail = getRiskDetail(prediction, "hypertension");

    expect(detail.provenance).toBe("rule");
    expect(detail.band).toBe("stage_1");
    expect(detail.description).toBe("Systolic 130-139 mmHg or diastolic 80-89 mmHg");
    expect(detail.partialInput).toBe(false);
  });

  it("reads the symptom differential caveats", () => {
    const prediction = {
      source: "model",
      ml_detail: {
        symptom_differential: {
          available: true,
          predictions: [{ condition: "Diabetes", confidence: 0.41 }],
          confidence_is_ranking_only: true,
          sparse_input: true,
          unmatched_symptoms: 2,
        },
        disclaimer: "Screening support only.",
        degraded: true,
      },
    };

    const differential = getSymptomDifferential(prediction);

    expect(differential.rankingOnly).toBe(true);
    expect(differential.sparseInput).toBe(true);
    expect(differential.unmatchedSymptoms).toBe(2);
    expect(getDisclaimer(prediction)).toBe("Screening support only.");
    expect(isDegraded(prediction)).toBe(true);
  });

  it("ignores an unavailable symptom differential", () => {
    const prediction = {
      source: "model",
      ml_detail: { symptom_differential: { available: false, reason: "no symptoms provided" } },
    };

    expect(getSymptomDifferential(prediction)).toBeNull();
  });
});
