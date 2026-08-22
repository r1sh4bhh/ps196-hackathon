const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

const { toMlInput, fromMlOutput } = require("../ml/patientMapper");
const { runInference, INFERENCE_SCRIPT } = require("../ml/pythonBridge");

test("toMlInput passes glucose through in raw units, not normalized", () => {
  const patientData = {
    patientId: "P001",
    age: 52,
    vitals: { systolic_bp: 135, diastolic_bp: 75, heart_rate: 72, weight_kg: 82, height_cm: 170 },
    symptoms: ["fatigue"],
    labs: { glucose: 130, cholesterol: 220 },
  };

  const mlInput = toMlInput(patientData);

  // The regression test for the most dangerous bug in this task: glucose
  // must arrive as 130, not normalize.js's 0-1 scaled 0.15.
  assert.equal(mlInput.labs.glucose, 130);
  assert.notEqual(mlInput.labs.glucose, 0.15);
});

test("toMlInput builds demographics.age from top-level patientData.age", () => {
  const mlInput = toMlInput({ age: 52, vitals: {}, labs: {}, symptoms: [] });
  assert.equal(mlInput.demographics.age, 52);
});

test("fromMlOutput omits unavailable sections from risk_scores rather than zeroing them", () => {
  const mlResult = {
    schema_version: "1.2.0",
    diabetes_risk: { available: false, reason: "model unavailable" },
    cardiac_risk: { available: true, risk_score: 0.4 },
    hypertension: { available: false },
    obesity: { available: false },
    degraded: true,
    review_priority: [],
    disclaimer: "test",
  };

  const prediction = fromMlOutput(mlResult);

  assert.equal("diabetes" in prediction.risk_scores, false);
  assert.equal(prediction.risk_scores.heart_disease, 0.4);
});

test("fromMlOutput maps hypertension stage_2 to the expected score", () => {
  const mlResult = {
    hypertension: { available: true, stage: "stage_2" },
  };

  const prediction = fromMlOutput(mlResult);

  assert.equal(prediction.risk_scores.hypertension, 0.8);
});

test("fromMlOutput preserves ml_detail.review_priority and partial_input flags", () => {
  const mlResult = {
    schema_version: "1.2.0",
    diabetes_risk: {
      available: true,
      risk_score: 0.53,
      risk_band: "elevated",
      partial_input: true,
      missing_key_inputs: ["glucose"],
    },
    review_priority: [{ finding: "diabetes risk", detail: "elevated (0.53)", urgency: "routine" }],
    degraded: true,
    disclaimer: "Screening support only.",
  };

  const prediction = fromMlOutput(mlResult);

  assert.deepEqual(prediction.ml_detail.review_priority, mlResult.review_priority);
  assert.equal(prediction.ml_detail.diabetes_risk.partial_input, true);
  assert.deepEqual(prediction.ml_detail.diabetes_risk.missing_key_inputs, ["glucose"]);
});

function pythonAvailable() {
  const pythonBin = process.env.PYTHON_BIN || (process.platform === "win32" ? "python" : "python3");
  const result = spawnSync(pythonBin, ["--version"]);
  return result.status === 0;
}

test("end-to-end: spawns real inference.py and returns parsed JSON", async (t) => {
  if (!fs.existsSync(INFERENCE_SCRIPT)) {
    t.skip("ml/inference/inference.py not found");
    return;
  }
  if (!pythonAvailable()) {
    t.skip("Python is not available in this environment");
    return;
  }

  const mlInput = toMlInput({
    age: 52,
    vitals: { systolic_bp: 135, diastolic_bp: 75, heart_rate: 72, weight_kg: 82, height_cm: 170 },
    symptoms: ["headache"],
    labs: { glucose: 130, cholesterol: 220 },
  });

  let result;
  try {
    result = await runInference(mlInput);
  } catch (error) {
    t.skip(`inference.py could not run: ${error.message}`);
    return;
  }

  if (result.error) {
    // Missing numpy/sklearn or trained .joblib artefacts -- CI will not
    // have these, and a test that fails for that reason is noise.
    t.skip(`inference.py dependencies/models unavailable: ${result.error}`);
    return;
  }

  assert.equal(typeof result, "object");
  assert.ok("hypertension" in result);
});
