import { describe, expect, it } from "vitest";
import { buildPatientDataFromProfile } from "../buildPatientData";

describe("buildPatientDataFromProfile", () => {
  it("returns null for a null profile", () => {
    expect(buildPatientDataFromProfile(null)).toBeNull();
  });

  it("only emits API_LAB_KEYS, preferring manual entries over report values", () => {
    const profile = {
      patientId: "P001",
      questionnaire: { age: 45, baseline_symptoms: ["fatigue"] },
      labs: {
        manual: { glucose: 150 },
        fromReports: { glucose: 130, cholesterol: 220, ldl: 100 },
      },
    };

    const patientData = buildPatientDataFromProfile(profile);

    expect(patientData.labs).toEqual({
      glucose: 150,
      cholesterol: 220,
      triglycerides: null,
      hdl: null,
    });
    expect(patientData.labs.ldl).toBeUndefined();
  });

  it("filters symptoms to the canonical list", () => {
    const profile = {
      patientId: "P001",
      questionnaire: { baseline_symptoms: ["fatigue", "made_up_symptom"] },
    };

    const patientData = buildPatientDataFromProfile(profile);

    expect(patientData.symptoms).toEqual(["fatigue"]);
  });

  it("uses null for absent vitals", () => {
    const profile = { patientId: "P001", questionnaire: {} };

    const patientData = buildPatientDataFromProfile(profile);

    expect(patientData.vitals).toEqual({
      systolic_bp: null,
      diastolic_bp: null,
      heart_rate: null,
      temperature: null,
      weight_kg: null,
      height_cm: null,
    });
  });
});
