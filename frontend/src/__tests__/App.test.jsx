import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { ROLES, getRole } from "../storage/roleStore";
import { saveLabResults, saveProfile, setActivePatientId } from "../storage/userProfileStore";
import { saveAssessment } from "../storage/assessmentHistory";

vi.mock("../api/predictService", () => ({
  submitPatientData: vi.fn(async () => ({
    risk_scores: { diabetes: 0.5 },
    top_disease: "diabetes",
    confidence: 0.5,
    source: "model",
  })),
}));

let container;
let root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  localStorage.clear();
});

function render() {
  act(() => {
    root.render(<App />);
  });
}

function seedProfile(patientId, age, heightCm) {
  return saveProfile({
    patientId,
    questionnaire: { age, height_cm: heightCm, weight_kg: 70 },
    vitals: {},
    labs: { manual: {}, fromReports: {} },
  });
}

function seedAssessment(patientId, age, heightCm) {
  saveAssessment({
    patientId,
    patientData: {
      patientId,
      age,
      vitals: {
        systolic_bp: 120,
        diastolic_bp: 80,
        heart_rate: 70,
        temperature: 98.6,
        weight_kg: 70,
        height_cm: heightCm,
      },
      symptoms: [],
      labs: { glucose: 100, cholesterol: 180, triglycerides: 120, hdl: 45 },
    },
    prediction: { risk_scores: { diabetes: 0.4 }, top_disease: "diabetes", confidence: 0.4 },
    baselines: {},
  });
}

describe("App role selection", () => {
  it("asks for a role on first launch", () => {
    render();
    expect(container.textContent).toContain("I'm a Patient");
    expect(container.textContent).toContain("I'm a Clinician");
  });

  it("persists the chosen role and skips the role screen next launch", () => {
    render();
    const patientButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent.includes("I'm a Patient")
    );
    act(() => patientButton.click());

    expect(getRole()).toBe(ROLES.PATIENT);
    expect(container.textContent).not.toContain("I'm a Patient");

    act(() => root.unmount());
    container.remove();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    render();

    expect(container.textContent).not.toContain("I'm a Patient");
  });

  it("lets the role be changed at any time from a visible header control", () => {
    seedProfile("P001", 45, 170);
    localStorage.setItem("ps196_role", ROLES.PATIENT);
    render();

    const switcher = [...container.querySelectorAll("button")].find((button) =>
      button.textContent.includes("switch to Clinician")
    );
    expect(switcher).toBeTruthy();

    act(() => switcher.click());

    expect(getRole()).toBe(ROLES.CLINICIAN);
    expect(container.textContent).toContain("Patients");
  });
});

describe("App returning-patient recognition", () => {
  it("recognises a returning patient automatically and offers the short flow", () => {
    seedProfile("P001", 45, 170);
    seedAssessment("P001", 45, 170);
    localStorage.setItem("ps196_role", ROLES.PATIENT);

    render();

    expect(container.textContent).toContain("Continuing as");
    expect(container.textContent).toContain("P001");
    // Stable fields are carried forward silently, not re-asked.
    const labels = [...container.querySelectorAll("label")].map((label) => label.textContent);
    expect(labels.some((text) => text.includes("Height"))).toBe(false);
  });

  it("uses the full questionnaire for a brand new patient with no prior visits", () => {
    seedProfile("P002", 30, 165);
    localStorage.setItem("ps196_role", ROLES.PATIENT);

    render();

    expect(container.textContent).toContain("Patient ID");
  });
});

describe("App multi-person switching", () => {
  it("switches between saved people without leaking one person's data into another", () => {
    seedProfile("P001", 45, 170);
    seedAssessment("P001", 45, 170);
    seedProfile("P002", 30, 165);
    seedAssessment("P002", 30, 165);
    setActivePatientId("P002");
    localStorage.setItem("ps196_role", ROLES.PATIENT);

    render();

    expect(container.textContent).toContain("Continuing as");
    expect(container.textContent).toContain("P002");
    expect(container.textContent).toContain("age 30");
    expect(container.textContent).not.toContain("age 45");

    const select = container.querySelector(".person-switcher select");
    expect(select).toBeTruthy();

    act(() => {
      select.value = "P001";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(container.textContent).toContain("P001");
    expect(container.textContent).toContain("age 45");
    expect(container.textContent).not.toContain("age 30");
  });

  it("shows only the active person's stored labs when switching people", () => {
    seedProfile("P001", 45, 170);
    seedAssessment("P001", 45, 170);
    saveLabResults("P001", { cholesterol: 181 });
    seedProfile("P002", 30, 165);
    seedAssessment("P002", 30, 165);
    saveLabResults("P002", { cholesterol: 222 });
    setActivePatientId("P002");
    localStorage.setItem("ps196_role", ROLES.PATIENT);

    render();
    expect(container.textContent).toContain("Total Cholesterol 222 mg/dL");
    expect(container.textContent).not.toContain("Total Cholesterol 181 mg/dL");

    const select = container.querySelector(".person-switcher select");
    act(() => {
      select.value = "P001";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(container.textContent).toContain("Total Cholesterol 181 mg/dL");
    expect(container.textContent).not.toContain("Total Cholesterol 222 mg/dL");
  });

  it("leaves return-visit labs blank for a legacy profile without timestamped lab history", () => {
    saveProfile({
      patientId: "legacy",
      questionnaire: { age: 60, height_cm: 170, weight_kg: 70 },
      labs: { manual: { glucose: 123 }, fromReports: {} },
    });
    seedAssessment("legacy", 60, 170);
    localStorage.setItem("ps196_role", ROLES.PATIENT);

    render();

    const glucose = [...container.querySelectorAll("label")].find((label) =>
      label.textContent.includes("Glucose")
    );
    expect(glucose.querySelector("input").value).toBe("");
    expect(glucose.textContent).not.toContain("Previous result");
  });
});

describe("App clinician patient list", () => {
  it("lists saved patients and lets a clinician select one", () => {
    seedProfile("P001", 45, 170);
    seedAssessment("P001", 45, 170);
    seedProfile("P002", 30, 165);
    localStorage.setItem("ps196_role", ROLES.CLINICIAN);

    render();

    expect(container.textContent).toContain("P001");
    expect(container.textContent).toContain("P002");
    expect(container.textContent).toContain("Add new patient");

    const rows = [...container.querySelectorAll(".clinician-patient-list-select")];
    const p001Row = rows.find((row) => row.textContent.includes("P001"));
    act(() => p001Row.click());

    expect(container.textContent).toContain("Continuing as");
    expect(container.textContent).toContain("P001");
  });
});
