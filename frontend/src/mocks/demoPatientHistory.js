// DEMO DATA ONLY: fictional local history for the P001 demonstration patient.
export const demoPatientHistory = [
  createAssessment("demo-p001-1", "2026-03-01T09:00:00.000Z", 118, 88),
  createAssessment("demo-p001-2", "2026-04-01T09:00:00.000Z", 121, 94),
  createAssessment("demo-p001-3", "2026-05-01T09:00:00.000Z", 124, 101),
  createAssessment("demo-p001-4", "2026-06-01T09:00:00.000Z", 130, 109),
  createAssessment("demo-p001-5", "2026-07-01T09:00:00.000Z", 134, 116),
];

function createAssessment(id, timestamp, systolicBp, glucose) {
  return {
    id,
    timestamp,
    patientId: "P001",
    isDemo: true,
    patientData: {
      patientId: "P001",
      vitals: {
        systolic_bp: systolicBp,
        diastolic_bp: 78,
        heart_rate: 72,
        temperature: 98.4,
        weight_kg: 72,
        height_cm: 170,
      },
      labs: { glucose, cholesterol: 182, triglycerides: 130, hdl: 48 },
    },
    prediction: {
      risk_scores: {},
      top_disease: null,
      confidence: null,
      evidence: [],
      next_test: null,
    },
    baselines: {},
  };
}
