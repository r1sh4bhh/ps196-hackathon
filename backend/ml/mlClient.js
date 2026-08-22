const { runInference } = require("./pythonBridge");
const { toMlInput, fromMlOutput } = require("./patientMapper");

const USE_MOCK_ML = process.env.USE_MOCK_ML !== "false";

// `patientData` is the raw request payload (mg/dL, mmHg, kg, cm) and is the
// only thing that may reach the Python layer. `normalizedData` is the 0-1
// scaled output of normalizePatientData and is what the mock path expects --
// getMockMlOutput reads normalizedData.labs_normalized.glucose on a 0-1
// scale. Do not swap these: sending normalized data to Python turns a
// glucose of 130 mg/dL into 0.15 and the model will confidently score
// nonsense with no error raised anywhere.
async function getRiskPrediction(patientData, normalizedData) {
  if (USE_MOCK_ML) {
    return getMockMlOutput(normalizedData);
  }

  try {
    return await callRealMlLayer(patientData);
  } catch (error) {
    console.warn(
      "[mlClient] Real ML layer unavailable, falling back to mock:",
      error.message
    );
    const mockResult = getMockMlOutput(normalizedData);
    return { ...mockResult, source: "mock", fallback_reason: error.message };
  }
}

async function callRealMlLayer(patientData) {
  const mlInput = toMlInput(patientData);
  const mlOutput = await runInference(mlInput);
  return fromMlOutput(mlOutput);
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
    source: "mock",
  };
}

function clampRisk(value) {
  return Math.min(Math.max(value, 0), 0.95);
}

function round(value) {
  return Math.round(value * 100) / 100;
}

module.exports = { getRiskPrediction };
