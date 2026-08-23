import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import VisitHistory, { getVisitDelta } from "../VisitHistory";

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

function visit({
  id,
  patientId = "P001",
  timestamp,
  glucose,
  cholesterol = 180,
  reusedLabs,
  source = "model",
  mlDetail,
  simulated = false,
}) {
  return {
    id,
    patientId,
    timestamp,
    reusedLabs,
    simulated,
    source: simulated ? "device" : null,
    patientData: {
      patientId,
      vitals: {
        systolic_bp: 120,
        diastolic_bp: 80,
        heart_rate: 70,
        weight_kg: 70,
      },
      labs: { glucose, cholesterol, hdl: 45, triglycerides: 120 },
      symptoms: ["fatigue"],
    },
    prediction: {
      risk_scores: { diabetes: 0.6 },
      top_disease: "diabetes",
      confidence: 0.6,
      source,
      ml_detail: mlDetail,
      evidence: [{ disease: "diabetes", factors: ["glucose"], next_test: "HbA1c" }],
    },
  };
}

function render(props) {
  act(() => {
    root.render(<VisitHistory patientId="P001" visits={[]} onBack={() => {}} {...props} />);
  });
  return container;
}

describe("VisitHistory", () => {
  it("renders newest first and computes changes against the preceding visit", () => {
    const dom = render({
      visits: [
        visit({ id: "old", timestamp: "2026-01-01T00:00:00.000Z", glucose: 90 }),
        visit({ id: "new", timestamp: "2026-02-01T00:00:00.000Z", glucose: 105 }),
      ],
    });
    const rows = [...dom.querySelectorAll(".visit-summary-row")];

    expect(rows[0].textContent).toContain("1 Feb 2026");
    expect(rows[1].textContent).toContain("1 Jan 2026");
    expect(rows[0].textContent).toContain("↑ +15");
    expect(getVisitDelta(90, 105)).toEqual({ direction: "down", symbol: "↓", delta: -15 });
    expect(getVisitDelta(90, 90)).toEqual({ direction: "flat", symbol: "→", delta: 0 });
  });

  it("explains a single visit and renders no change indicators", () => {
    const dom = render({
      visits: [visit({ id: "only", timestamp: "2026-01-01T00:00:00.000Z", glucose: 90 })],
    });

    expect(dom.textContent).toContain("one recorded visit");
    expect(dom.querySelector(".history-delta")).toBeNull();
  });

  it("renders an explanatory empty state", () => {
    const dom = render();
    expect(dom.textContent).toContain("No visits recorded yet");
    expect(dom.textContent).toContain("Completed assessments will appear here");
  });

  it("marks carried-forward, stale, defaulted, simulated, and demo provenance", () => {
    const record = visit({
      id: "provenance",
      timestamp: "2026-01-01T00:00:00.000Z",
      glucose: 100,
      reusedLabs: {
        glucose: { value: 100, recordedAt: "2025-12-01T00:00:00.000Z", isStale: true },
        cholesterol: { value: 180, recordedAt: "2025-12-20T00:00:00.000Z", isStale: false },
      },
      simulated: true,
      mlDetail: {
        diabetes_risk: {
          source: "model",
          partial_input: true,
          defaulted_features: ["glucose"],
          missing_key_inputs: ["insulin"],
          risk_band: "elevated",
        },
      },
    });
    record.isDemo = true;
    const dom = render({ visits: [record] });

    expect(dom.textContent).toContain("Stale carried forward");
    expect(dom.textContent).toContain("Carried forward");
    expect(dom.textContent).toContain("Defaulted for prediction");
    expect(dom.textContent).toContain("Simulated device");
    expect(dom.textContent).toContain("Partial input");
    expect(dom.textContent).toContain("Missing key inputs: insulin");
    expect(dom.textContent).toContain("Demo");
    expect(dom.textContent).toContain("Model-derived");
  });

  it("shows missing metrics as not recorded and isolates visits by patient", () => {
    const p001 = visit({
      id: "p001",
      timestamp: "2026-01-01T00:00:00.000Z",
      glucose: undefined,
    });
    const p002 = visit({
      id: "p002",
      patientId: "P002",
      timestamp: "2026-02-01T00:00:00.000Z",
      glucose: 999,
    });
    const dom = render({ visits: [p002, p001] });

    expect(dom.querySelectorAll(".visit-summary-row")).toHaveLength(1);
    expect(dom.textContent).toContain("not recorded");
    expect(dom.textContent).not.toContain("999");
    expect(dom.textContent).not.toContain("1 Feb 2026");
  });
});
