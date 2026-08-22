import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PatientForm from "../PatientForm";

vi.mock("../../../api/predictService", () => ({
  submitPatientData: vi.fn(async (patientData) => ({
    risk_scores: { diabetes: 0.5 },
    top_disease: "diabetes",
    confidence: 0.5,
    source: "model",
    __submittedPatientData: patientData,
  })),
}));

import { submitPatientData } from "../../../api/predictService";

let container;
let root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  submitPatientData.mockClear();
});

afterEach(async () => {
  await act(async () => root.unmount());
  vi.useRealTimers();
  container.remove();
  localStorage.clear();
});

const stableInitialData = {
  patientId: "P001",
  age: 45,
  vitals: {
    systolic_bp: null,
    diastolic_bp: null,
    heart_rate: null,
    temperature: null,
    weight_kg: 80,
    height_cm: 175,
  },
  symptoms: [],
  labs: { glucose: 100, cholesterol: 180, triglycerides: 120, hdl: 45 },
};

function render(props) {
  act(() => {
    root.render(<PatientForm onPredictionReceived={() => {}} {...props} />);
  });
}

function fillRequiredVitalsAndLabs() {
  const inputs = [...container.querySelectorAll("input[type='number']")];
  const byPlaceholderOrLabel = (label) =>
    inputs.find((input) => input.closest("label")?.textContent.includes(label));

  const set = (label, value) => {
    const input = byPlaceholderOrLabel(label);
    if (input) {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      ).set;
      act(() => {
        nativeSetter.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }
  };

  set("Systolic", "120");
  set("Diastolic", "80");
  set("Heart Rate", "70");
  set("Temperature", "98.6");
}

describe("PatientForm return-visit short flow", () => {
  it("hides stable identity fields on a returning visit but still submits them", async () => {
    render({ initialData: stableInitialData, mode: "short" });

    expect(container.textContent).toContain("Continuing as");
    expect(container.querySelector("input")?.closest("fieldset")?.textContent).not.toContain(
      "Patient ID"
    );
    // Height is hidden (carried forward silently); weight remains editable.
    const labels = [...container.querySelectorAll("label")].map((label) => label.textContent);
    expect(labels.some((text) => text.includes("Height"))).toBe(false);
    expect(labels.some((text) => text.includes("Weight"))).toBe(true);

    fillRequiredVitalsAndLabs();

    const form = container.querySelector("form");
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(submitPatientData).toHaveBeenCalledTimes(1);
    const submitted = submitPatientData.mock.calls[0][0];
    expect(submitted.patientId).toBe("P001");
    expect(submitted.age).toBe(45);
    expect(submitted.vitals.height_cm).toBe(175);
  });

  it("falls back to the full flow when a stable field was never captured", () => {
    render({
      initialData: { ...stableInitialData, vitals: { ...stableInitialData.vitals, height_cm: null } },
      mode: "short",
    });

    expect(container.textContent).toContain("Patient ID");
    const labels = [...container.querySelectorAll("label")].map((label) => label.textContent);
    expect(labels.some((text) => text.includes("Height"))).toBe(true);
  });

  it("shows every field on a first visit (full mode)", () => {
    render({ initialData: stableInitialData, mode: "full" });

    expect(container.textContent).toContain("Patient ID");
    expect(container.textContent).not.toContain("Continuing as");
  });

  it("lets a returning patient reveal and edit their carried-forward stable details", () => {
    render({ initialData: stableInitialData, mode: "short" });

    const editLink = [...container.querySelectorAll("button")].find((button) =>
      button.textContent.includes("Review / edit")
    );
    expect(editLink).toBeTruthy();

    act(() => editLink.click());

    expect(container.textContent).toContain("Patient ID");
    const labels = [...container.querySelectorAll("label")].map((label) => label.textContent);
    expect(labels.some((text) => text.includes("Height"))).toBe(true);
  });

  it("prefills a fresh lab, keeps a stale lab empty, and shows both ages", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-22T12:00:00.000Z"));
    render({
      initialData: { ...stableInitialData, labs: {} },
      mode: "short",
      storedLabs: {
        glucose: { value: 101, recordedAt: "2026-08-20T12:00:00.000Z" },
        cholesterol: { value: 195, recordedAt: "2025-08-21T12:00:00.000Z" },
      },
    });

    const glucose = [...container.querySelectorAll("label")].find((label) =>
      label.textContent.includes("Glucose")
    );
    const cholesterol = [...container.querySelectorAll("label")].find((label) =>
      label.textContent.includes("Total Cholesterol")
    );

    expect(glucose.querySelector("input").value).toBe("101");
    expect(glucose.querySelector("input").className).toContain("lab-input-carried");
    expect(glucose.textContent).toContain("from 20 Aug (2 days ago)");
    expect(cholesterol.querySelector("input").value).toBe("");
    expect(cholesterol.textContent).toContain("from 21 Aug (366 days ago)");
    expect(cholesterol.textContent).toContain("stale");
  });

  it("submits an explicitly reused stale value in the normal lab payload shape", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-22T12:00:00.000Z"));
    render({
      initialData: { ...stableInitialData, labs: {} },
      mode: "short",
      storedLabs: {
        cholesterol: { value: 195, recordedAt: "2025-08-21T12:00:00.000Z" },
      },
    });

    const cholesterol = [...container.querySelectorAll("label")].find((label) =>
      label.textContent.includes("Total Cholesterol")
    );
    act(() => cholesterol.querySelector(".lab-reuse").click());
    expect(cholesterol.querySelector("input").value).toBe("195");

    fillRequiredVitalsAndLabs();
    await act(async () => {
      container
        .querySelector("form")
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    const submitted = submitPatientData.mock.calls[0][0];
    expect(Object.keys(submitted.labs)).toEqual([
      "glucose",
      "cholesterol",
      "triglycerides",
      "hdl",
    ]);
    expect(submitted.labs.cholesterol).toBe(195);
  });
});
