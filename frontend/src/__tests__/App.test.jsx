import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { ROLES, getRole } from "../storage/roleStore";
import {
  loadProfile,
  saveLabResults,
  saveProfile,
  setActivePatientId,
} from "../storage/userProfileStore";
import { listAssessments, saveAssessment } from "../storage/assessmentHistory";
import { demoPatientHistory, demoPatientIds } from "../mocks/demoPatientHistory";
import { computeAllBaselines } from "../utils/baseline";
import { submitPatientData } from "../api/predictService";

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
  submitPatientData.mockClear();
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

  it("groups patient actions and gives adding a family member primary hierarchy", () => {
    seedProfile("P001", 45, 170);
    localStorage.setItem("ps196_role", ROLES.PATIENT);

    render();

    const actionCluster = container.querySelector(".patient-actions");
    expect(actionCluster).toBeTruthy();
    expect(actionCluster.querySelector(".person-switcher")).toBeTruthy();
    expect(actionCluster.textContent).toContain("Continuing as");
    expect(actionCluster.textContent).toContain("Edit profile / redo onboarding");

    const addButton = [...actionCluster.querySelectorAll("button")].find((button) =>
      button.textContent.includes("Add a family member")
    );
    const editButton = [...actionCluster.querySelectorAll("button")].find((button) =>
      button.textContent.includes("Edit profile / redo onboarding")
    );

    expect(addButton.classList.contains("btn-primary")).toBe(true);
    expect(editButton.classList.contains("btn-secondary")).toBe(true);
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

  it("opens an isolated patient history directly and returns to the clinician list", () => {
    seedProfile("P001", 45, 170);
    seedAssessment("P001", 45, 170);
    seedProfile("P002", 30, 165);
    seedAssessment("P002", 30, 165);
    localStorage.setItem("ps196_role", ROLES.CLINICIAN);
    render();

    const p001Item = [...container.querySelectorAll(".clinician-patient-list-item")].find((item) =>
      item.textContent.includes("P001")
    );
    act(() => p001Item.querySelector(".clinician-patient-history").click());

    expect(container.textContent).toContain("Visit history");
    expect(container.textContent).toContain("Patient P001");
    expect(container.textContent).not.toContain("Patient P002");

    const back = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Back"
    );
    act(() => back.click());
    expect(container.textContent).toContain("Patients");
    expect(container.textContent).toContain("P002");
  });

  it("loads clearly marked demo patients only after a clinician opts in", () => {
    localStorage.setItem("ps196_role", ROLES.CLINICIAN);
    render();

    expect(container.textContent).toContain("No patients saved on this device yet");
    expect(container.textContent).not.toContain("DEMO-MET-001");

    const loadButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent.includes("Load demo patients")
    );
    act(() => loadButton.click());

    expect(container.textContent).toContain("DEMO-MET-001");
    expect(container.textContent).toContain("DEMO-STABLE-002");
    expect(container.textContent).toContain("DEMO-BP-003");
    expect(container.querySelectorAll(".demo-patient-badge")).toHaveLength(3);
  });

  it("clears demo records without removing a real patient", () => {
    seedProfile("REAL-001", 42, 172);
    seedAssessment("REAL-001", 42, 172);
    localStorage.setItem("ps196_role", ROLES.CLINICIAN);
    render();

    const loadButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent.includes("Load demo patients")
    );
    act(() => loadButton.click());
    const clearButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent.trim() === "Clear demo patients"
    );
    act(() => clearButton.click());

    // Clearing is destructive, so it takes a confirmation click.
    expect(container.textContent).toContain("DEMO-MET-001");
    const confirmButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent.trim() === "Yes, clear demo patients"
    );
    act(() => confirmButton.click());

    expect(container.textContent).toContain("REAL-001");
    expect(container.textContent).not.toContain("DEMO-MET-001");
    expect(listAssessments("REAL-001")).toHaveLength(1);
    expect(demoPatientIds.every((patientId) => loadProfile(patientId) === null)).toBe(true);
    expect(demoPatientIds.every((patientId) => listAssessments(patientId).length === 0)).toBe(true);
  });

  it("runs the model for a selected demo patient's visits before showing the dashboard", async () => {
    localStorage.setItem("ps196_role", ROLES.CLINICIAN);
    render();
    const loadButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent.includes("Load demo patients")
    );
    act(() => loadButton.click());

    const demoRow = [...container.querySelectorAll(".clinician-patient-list-select")].find((row) =>
      row.textContent.includes("DEMO-MET-001")
    );
    await act(async () => {
      demoRow.click();
      await Promise.resolve();
    });

    expect(submitPatientData).toHaveBeenCalledTimes(5);
    expect(container.textContent).toContain("Risk Dashboard");
    expect(container.textContent).toContain("Model output");
  });
});

describe("demo patient histories", () => {
  it("establishes baselines and reports no meaningful stable-patient trend", () => {
    for (const patientId of demoPatientIds) {
      const history = demoPatientHistory.filter((assessment) => assessment.patientId === patientId);
      const baselines = computeAllBaselines(history, history.at(-1).patientData);

      expect(history).toHaveLength(5);
      expect(baselines.systolic_bp.status).toBe("established");
    }

    const stableHistory = demoPatientHistory.filter(
      (assessment) => assessment.patientId === "DEMO-STABLE-002"
    );
    const stableBaselines = computeAllBaselines(stableHistory, stableHistory.at(-1).patientData);
    expect(stableBaselines.systolic_bp.trend).toBe("stable");
    expect(stableBaselines.glucose.trend).toBe("stable");
  });
});
