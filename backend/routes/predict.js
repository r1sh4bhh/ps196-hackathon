const express = require("express");
const { validatePatientData } = require("../utils/validate");
const { normalizePatientData } = require("../utils/normalize");
const { getRiskPrediction } = require("../ml/mlClient");

const router = express.Router();

router.post("/", async (req, res) => {
  const { patientData } = req.body || {};

  if (!patientData) {
    return res.status(400).json({
      status: "error",
      message: "Invalid patient data",
    });
  }

  const { isValid, errors } = validatePatientData(patientData);
  if (!isValid) {
    return res.status(400).json({
      status: "error",
      message: `Invalid patient data: ${errors.join(", ")}`,
    });
  }

  try {
    const normalized = normalizePatientData(patientData);
    // Real ML gets the raw `patientData` (mg/dL, mmHg, kg, cm); the mock
    // path gets `normalized` (0-1 scale), which is what getMockMlOutput
    // expects. Do not swap these -- normalized values reaching the Python
    // layer produce confident, meaningless predictions with no error raised.
    const mlOutput = await getRiskPrediction(patientData, normalized);
    const prediction = buildPredictionResponse(mlOutput, patientData);

    // A degraded/partial result is still clinically useful screening output
    // -- the payload already states what's missing -- so it is a 200, not
    // an error. Only bad input or a total ML failure with no mock fallback
    // should be non-200.
    return res.status(200).json({
      status: "success",
      prediction,
    });
  } catch (error) {
    console.error("[predict] Inference failed:", error.message);
    return res.status(400).json({
      status: "error",
      message: "Prediction failed. Please try again.",
    });
  }
});

function buildPredictionResponse(mlOutput, patientData) {
  const response = {
    risk_scores: mlOutput.risk_scores,
    top_disease: mlOutput.top_disease,
    confidence: mlOutput.confidence,
    trajectory: buildTrajectory(mlOutput.risk_scores[mlOutput.top_disease]),
    evidence: buildEvidence(mlOutput.top_disease, patientData),
  };

  if (mlOutput.ml_detail) {
    response.ml_detail = mlOutput.ml_detail;
  }
  if (mlOutput.source) {
    response.source = mlOutput.source;
  }
  if (mlOutput.fallback_reason) {
    response.fallback_reason = mlOutput.fallback_reason;
  }

  return response;
}

// Placeholder illustrative curve, NOT a prediction: it adds a fixed 0.01/day
// to today's top risk, which is a straight line, not a forecast. Marked
// `illustrative: true` so the UI can label it honestly instead of presenting
// invented data as a real trajectory.
function buildTrajectory(baseRisk) {
  const risk = typeof baseRisk === "number" ? baseRisk : 0.5;
  return [1, 2, 3, 4, 5].map((day) => ({
    day,
    risk: clamp(round(risk + day * 0.01), 0, 0.99),
    illustrative: true,
  }));
}

function buildEvidence(topDisease, patientData) {
  const rules = {
    diabetes: {
      factors: ["high_glucose"],
      next_test: "HbA1c",
    },
    hypertension: {
      factors: ["elevated_systolic_bp"],
      next_test: "24hr Ambulatory BP Monitoring",
    },
    heart_disease: {
      factors: ["elevated_cholesterol", "low_hdl"],
      next_test: "Lipid Panel + ECG",
    },
    obesity: {
      factors: ["elevated_bmi"],
      next_test: "Metabolic Panel",
    },
  };

  const fallbackDisease = inferFallbackDisease(patientData);
  const disease = rules[topDisease] ? topDisease : fallbackDisease;
  const rule = rules[disease];

  return [
    {
      disease,
      factors: rule.factors,
      next_test: rule.next_test,
    },
  ];
}

function inferFallbackDisease(patientData) {
  if ((patientData.labs?.glucose || 0) > 125) {
    return "diabetes";
  }

  if ((patientData.vitals?.systolic_bp || 0) > 130) {
    return "hypertension";
  }

  if ((patientData.labs?.cholesterol || 0) > 200 || (patientData.labs?.hdl || 999) < 40) {
    return "heart_disease";
  }

  return "obesity";
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function round(value) {
  return Math.round(value * 100) / 100;
}

module.exports = router;
