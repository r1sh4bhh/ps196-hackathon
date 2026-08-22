const USE_MOCK_ML = process.env.USE_MOCK_ML !== "false";

async function getRiskPrediction(normalizedData) {
  if (USE_MOCK_ML) {
    return getMockMlOutput(normalizedData);
  }

  try {
    return await callRealMlLayer(normalizedData);
  } catch (error) {
    console.warn(
      "[mlClient] Real ML layer unavailable, falling back to mock:",
      error.message
    );
    return getMockMlOutput(normalizedData);
  }
}

async function callRealMlLayer(normalizedData) {
  void normalizedData;
  throw new Error("Real ML layer not yet integrated");
}

function getMockMlOutput(normalizedData) {
  const glucose = normalizedData?.labs_normalized?.glucose ?? 0.5;
  const systolic = normalizedData?.normalized_vitals?.systolic_bp ?? 0.5;
  const bmi = normalizedData?.normalized_vitals?.bmi ?? 25;

  const diabetes = clampRisk(0.3 + glucose * 0.6);
  const hypertension = clampRisk(0.3 + systolic * 0.6);
  const heartDisease = clampRisk((diabetes + hypertension) / 2);
  const obesity = clampRisk((bmi - 18.5) / 20);

  const risk_scores = {
    diabetes: round(diabetes),
    hypertension: round(hypertension),
    heart_disease: round(heartDisease),
    obesity: round(obesity),
  };

  const top_disease = Object.entries(risk_scores).sort((a, b) => b[1] - a[1])[0][0];

  return {
    risk_scores,
    top_disease,
    confidence: risk_scores[top_disease],
  };
}

function clampRisk(value) {
  return Math.min(Math.max(value, 0), 0.95);
}

function round(value) {
  return Math.round(value * 100) / 100;
}

module.exports = { getRiskPrediction };
