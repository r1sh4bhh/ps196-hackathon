// DEMO DATA ONLY: fictional patient-entered histories. Predictions are never
// seeded; they are computed by the live service when a clinician selects a patient.
const visits = [
  ["2026-03-01T09:00:00.000Z", 118, 78, 88],
  ["2026-04-01T09:00:00.000Z", 121, 79, 94],
  ["2026-05-01T09:00:00.000Z", 124, 80, 101],
  ["2026-06-01T09:00:00.000Z", 130, 82, 109],
  ["2026-07-01T09:00:00.000Z", 134, 84, 116],
];

const stableVisits = [
  ["2026-03-03T10:00:00.000Z", 116, 74, 91],
  ["2026-04-03T10:00:00.000Z", 117, 74, 92],
  ["2026-05-03T10:00:00.000Z", 116, 75, 91],
  ["2026-06-03T10:00:00.000Z", 117, 74, 92],
  ["2026-07-03T10:00:00.000Z", 116, 74, 91],
];

const hypertensionVisits = [
  ["2026-03-05T11:00:00.000Z", 122, 78],
  ["2026-04-05T11:00:00.000Z", 128, 81],
  ["2026-05-05T11:00:00.000Z", 134, 85],
  ["2026-06-05T11:00:00.000Z", 141, 89],
  ["2026-07-05T11:00:00.000Z", 148, 93],
];

export const demoProfiles = [
  profile("DEMO-MET-001", 52, 170, 72, ["fatigue"]),
  profile("DEMO-STABLE-002", 34, 165, 62),
  profile("DEMO-BP-003", 61, 176, 84),
];

export const demoPatientIds = demoProfiles.map(({ patientId }) => patientId);

export const demoPatientHistory = [
  ...visits.map(([timestamp, systolicBp, diastolicBp, glucose], index) =>
    assessment(
      `demo-met-${index + 1}`,
      "DEMO-MET-001",
      timestamp,
      52,
      { systolicBp, diastolicBp, glucose, cholesterol: 182, triglycerides: 130, hdl: 48 },
      ["fatigue"]
    )
  ),
  ...stableVisits.map(([timestamp, systolicBp, diastolicBp, glucose], index) =>
    assessment(
      `demo-stable-${index + 1}`,
      "DEMO-STABLE-002",
      timestamp,
      34,
      { systolicBp, diastolicBp, glucose, cholesterol: 164, triglycerides: 82, hdl: 62 }
    )
  ),
  ...hypertensionVisits.map(([timestamp, systolicBp, diastolicBp], index) =>
    assessment(
      `demo-bp-${index + 1}`,
      "DEMO-BP-003",
      timestamp,
      61,
      { systolicBp, diastolicBp, glucose: 96 },
      index >= 3 ? ["headache"] : []
    )
  ),
];

function profile(patientId, age, heightCm, weightKg, baselineSymptoms = []) {
  return {
    patientId,
    isDemo: true,
    questionnaire: { age, height_cm: heightCm, weight_kg: weightKg, baseline_symptoms: baselineSymptoms },
    vitals: {},
    labs: { manual: {}, fromReports: {} },
  };
}

function assessment(id, patientId, timestamp, age, values, symptoms = []) {
  return {
    id,
    timestamp,
    patientId,
    isDemo: true,
    patientData: {
      patientId,
      age,
      vitals: {
        systolic_bp: values.systolicBp,
        diastolic_bp: values.diastolicBp,
        heart_rate: 72,
        temperature: 98.4,
        weight_kg: patientId === "DEMO-STABLE-002" ? 62 : patientId === "DEMO-BP-003" ? 84 : 72,
        height_cm: patientId === "DEMO-STABLE-002" ? 165 : patientId === "DEMO-BP-003" ? 176 : 170,
      },
      symptoms,
      labs: {
        ...(values.glucose !== undefined ? { glucose: values.glucose } : {}),
        ...(values.cholesterol !== undefined ? { cholesterol: values.cholesterol } : {}),
        ...(values.triglycerides !== undefined ? { triglycerides: values.triglycerides } : {}),
        ...(values.hdl !== undefined ? { hdl: values.hdl } : {}),
      },
    },
    prediction: {},
    baselines: {},
  };
}
