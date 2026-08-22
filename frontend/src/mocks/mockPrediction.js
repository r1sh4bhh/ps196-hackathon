export function getMockPrediction(patientData) {
  const glucose = patientData?.labs?.glucose ?? 100;
  const systolic = patientData?.vitals?.systolic_bp ?? 120;

  const diabetesRisk = clamp(0.3 + (glucose - 100) / 200, 0, 0.95);
  const hypertensionRisk = clamp(0.2 + (systolic - 120) / 150, 0, 0.95);

  return {
    risk_scores: {
      diabetes: round(diabetesRisk),
      hypertension: round(hypertensionRisk),
      heart_disease: round(clamp((diabetesRisk + hypertensionRisk) / 2, 0, 0.95)),
      obesity: round(estimateObesityRisk(patientData)),
    },
    top_disease: diabetesRisk >= hypertensionRisk ? "diabetes" : "hypertension",
    confidence: round(Math.max(diabetesRisk, hypertensionRisk)),
    trajectory: [1, 2, 3, 4, 5].map((day) => ({
      day,
      risk: round(clamp(diabetesRisk + day * 0.01, 0, 0.99)),
    })),
    evidence: [
      {
        disease: "diabetes",
        factors: glucose > 125 ? ["high_glucose"] : ["borderline_glucose"],
        next_test: "HbA1c",
      },
    ],
  };
}

function estimateObesityRisk(patientData) {
  const { weight_kg, height_cm } = patientData?.vitals || {};
  if (!weight_kg || !height_cm) {
    return 0.3;
  }

  const bmi = weight_kg / Math.pow(height_cm / 100, 2);
  return clamp((bmi - 18.5) / 20, 0, 0.95);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function round(value) {
  return Math.round(value * 100) / 100;
}
