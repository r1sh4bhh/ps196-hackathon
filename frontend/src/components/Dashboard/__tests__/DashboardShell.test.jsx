import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import DashboardShell, { getRiskTier } from "../DashboardShell";

let container;
let root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(props) {
  act(() => {
    root.render(<DashboardShell onBackToForm={() => {}} {...props} />);
  });
  return container;
}

const basePrediction = {
  risk_scores: { diabetes: 0.67, heart_disease: 0.35 },
  top_disease: "diabetes",
  confidence: 0.67,
};

describe("DashboardShell source badge", () => {
  it("renders a neutral badge for model output", () => {
    const dom = render({ prediction: { ...basePrediction, source: "model" } });
    const badge = dom.querySelector(".source-badge");

    expect(badge.className).toContain("source-badge-model");
    expect(badge.textContent).toContain("Model output");
  });

  it("renders a warning badge with the fallback reason for mock output", () => {
    const dom = render({
      prediction: { ...basePrediction, source: "mock", fallback_reason: "Failed to fetch" },
    });
    const badge = dom.querySelector(".source-badge");

    expect(badge.className).toContain("source-badge-mock");
    expect(badge.textContent).toContain("Simulated data");
    expect(badge.textContent).toContain("Failed to fetch");
  });

  it("treats a missing source as simulated", () => {
    const dom = render({ prediction: basePrediction });
    const badge = dom.querySelector(".source-badge");

    expect(badge.className).toContain("source-badge-mock");
    expect(badge.textContent).toContain("Simulated data");
  });
});

describe("DashboardShell ml_detail caveats", () => {
  const prediction = {
    ...basePrediction,
    risk_scores: { diabetes: 0.67, heart_disease: 0.35, hypertension: 0.8 },
    source: "model",
    ml_detail: {
      diabetes_risk: {
        available: true,
        source: "model",
        risk_band: "elevated",
        partial_input: false,
        missing_key_inputs: [],
      },
      cardiac_risk: {
        available: true,
        source: "model",
        risk_band: "elevated",
        partial_input: true,
        missing_key_inputs: [
          "cp",
          "restecg",
          "thalach",
          "exang",
          "oldpeak",
          "slope",
          "ca",
          "thal",
        ],
      },
      hypertension: {
        available: true,
        source: "rule",
        stage: "stage_2",
        description: "Systolic 140 mmHg or higher",
      },
      degraded: true,
      disclaimer: "Screening support only. Not a diagnosis.",
      symptom_differential: {
        available: true,
        predictions: [{ condition: "Diabetes", confidence: 0.42 }],
        confidence_is_ranking_only: true,
        sparse_input: true,
        unmatched_symptoms: 1,
      },
    },
  };

  it("flags a partial-input cardiac score and lists the missing inputs", () => {
    const dom = render({ prediction });
    const cards = [...dom.querySelectorAll(".summary-card")];
    const cardiac = cards.find((card) => card.textContent.includes("heart disease"));

    expect(cardiac.textContent).toContain("Computed without all trained features");
    expect(cardiac.textContent).toContain(
      "cp, restecg, thalach, exang, oldpeak, slope, ca, thal"
    );
  });

  describe("DashboardShell risk tiers", () => {
    it.each([
      ["low", "low"],
      ["elevated", "moderate"],
      ["high", "high"],
      ["severe", "severe"],
      ["very_high", "severe"],
      ["stage_2", "severe"],
      ["unknown_band", null],
      [null, null],
    ])("derives %s from the existing band value", (band, expectedTier) => {
      expect(getRiskTier(band)).toBe(expectedTier);
    });

    it("uses the band-derived tier class while retaining the band label", () => {
      const dom = render({
        prediction: {
          ...basePrediction,
          source: "model",
          ml_detail: {
            diabetes_risk: { available: true, source: "model", risk_band: "high" },
          },
        },
      });
      const diabetes = [...dom.querySelectorAll(".summary-card")].find((card) =>
        card.textContent.includes("diabetes")
      );

      expect(diabetes.className).toContain("risk-tier-high");
      expect(diabetes.textContent).toContain("Band: high");
    });
  });

  it("shows risk bands and distinguishes rule-derived bands", () => {
    const dom = render({ prediction });
    const cards = [...dom.querySelectorAll(".summary-card")];
    const hypertension = cards.find((card) => card.textContent.includes("hypertension"));
    const diabetes = cards.find((card) => card.textContent.includes("diabetes"));

    expect(hypertension.textContent).toContain("stage 2");
    expect(hypertension.textContent).toContain("Rule-derived band");
    expect(hypertension.textContent).toContain("Systolic 140 mmHg or higher");
    expect(diabetes.textContent).toContain("Band: elevated");
    expect(diabetes.textContent).toContain("Model-derived score");
  });

  it("renders the degraded notice, differential caveats, and disclaimer", () => {
    const dom = render({ prediction });

    expect(dom.querySelector(".dashboard-notice").textContent).toContain("models were unavailable");
    expect(dom.querySelector(".symptom-differential").textContent).toContain("Ranking only");
    expect(dom.querySelector(".symptom-differential").textContent).toContain("weak evidence");
    expect(dom.querySelector(".symptom-differential").textContent).toContain("was not recognized");
    expect(dom.querySelector(".dashboard-disclaimer").textContent).toContain(
      "Screening support only."
    );
  });
});

describe("DashboardShell symptom differential", () => {
  function predictionWithDifferential({ sparseInput, confidence }) {
    return {
      ...basePrediction,
      source: "model",
      ml_detail: {
        symptom_differential: {
          available: true,
          predictions: [{ condition: "Fungal infection", confidence }],
          confidence_is_ranking_only: true,
          sparse_input: sparseInput,
          unmatched_symptoms: 1,
        },
      },
    };
  }

  const baselineProps = {
    baselineCurrent: { bmi: 29.4 },
    baselineData: {
      recordedAt: "2026-08-22",
      risk_scores: {
        bmi: { status: "unavailable", baseline: null, difference: null },
      },
    },
  };

  it("places a collapsed weak-signal disclosure below the baseline table", () => {
    const dom = render({
      prediction: predictionWithDifferential({ sparseInput: false, confidence: 0.32 }),
      ...baselineProps,
    });
    const baselineTable = dom.querySelector(".baseline-table");
    const differential = dom.querySelector(".symptom-differential");

    expect(differential.tagName).toBe("DETAILS");
    expect(differential.open).toBe(false);
    expect(differential.querySelector("summary").textContent).toContain(
      "Symptom-based ranking (weak signal)"
    );
    expect(
      baselineTable.compareDocumentPosition(differential) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(differential.textContent).toContain("synthetic dataset");
    expect(differential.textContent).toContain(
      "lab-derived risk scores above are the stronger signal"
    );
  });

  it("suppresses a sparse ranking when its top score is below the threshold", () => {
    const dom = render({
      prediction: predictionWithDifferential({ sparseInput: true, confidence: 0.39 }),
    });
    const differential = dom.querySelector(".symptom-differential");

    expect(differential.textContent).toContain(
      "Not enough symptom detail for a meaningful ranking."
    );
    expect(differential.querySelector(".differential-list")).toBeNull();
    expect(differential.textContent).not.toContain("Fungal infection");
  });

  it.each([
    ["non-sparse input", false, 0.12],
    ["sparse input at or above the threshold", true, 0.4],
  ])("renders the ranking for %s", (_label, sparseInput, confidence) => {
    const dom = render({
      prediction: predictionWithDifferential({ sparseInput, confidence }),
    });
    const differential = dom.querySelector(".symptom-differential");

    expect(differential.querySelector(".differential-list")).not.toBeNull();
    expect(differential.textContent).toContain("Fungal infection");
    expect(differential.textContent).toContain("Ranking only");
    expect(differential.textContent).toContain("was not recognized");
  });
});

describe("DashboardShell without ml_detail", () => {
  it("renders risk scores without caveats and never prints undefined", () => {
    const dom = render({ prediction: { ...basePrediction, source: "mock" } });

    expect(dom.querySelectorAll(".summary-card")).toHaveLength(2);
    expect(dom.querySelector(".risk-band")).toBeNull();
    expect(dom.querySelector(".risk-caveat")).toBeNull();
    expect(dom.querySelector(".dashboard-notice")).toBeNull();
    expect(dom.querySelector(".dashboard-disclaimer")).toBeNull();
    expect(dom.querySelector(".symptom-differential")).toBeNull();
    expect(dom.textContent).not.toContain("undefined");
  });

  it("rounds BMI in the personal health baseline table", () => {
    const dom = render({
      prediction: { ...basePrediction, source: "model" },
      baselineCurrent: { bmi: 29.069767441860467, systolic_bp: 149 },
      baselineData: {
        recordedAt: "2026-08-22",
        risk_scores: {
          bmi: { status: "unavailable", baseline: null, difference: null },
          systolic_bp: { status: "unavailable", baseline: null, difference: null },
        },
      },
    });
    const rows = [...dom.querySelectorAll(".baseline-table tbody tr")];
    const bmiRow = rows.find((row) => row.textContent.includes("BMI"));

    expect(bmiRow.textContent).toContain("29.1 kg/m²");
    expect(bmiRow.textContent).not.toContain("29.069767441860467");
  });
});
