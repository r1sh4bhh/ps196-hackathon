const { spawn } = require("child_process");
const path = require("path");

// Pluggable ML adapter: "mock" | "python" | "onnx", selected by ML_ADAPTER.
// Defaults to "mock" so the app always runs without any Python dependency.
// USE_MOCK_ML=false is honored for backward compatibility with earlier
// configuration and is equivalent to ML_ADAPTER=python.
function resolveAdapter() {
  if (process.env.ML_ADAPTER) {
    return process.env.ML_ADAPTER;
  }
  if (process.env.USE_MOCK_ML === "false") {
    return "python";
  }
  return "mock";
}

const PYTHON_TIMEOUT_MS = 5000;
const ML_ROOT = path.join(__dirname, "..", "..", "ml");
const INFERENCE_SCRIPT = path.join(ML_ROOT, "inference", "inference.py");
const PYTHON_BIN = process.env.PYTHON_BIN || (process.platform === "win32" ? "python" : "python3");

async function getRiskPrediction(normalizedData) {
  const adapter = resolveAdapter();

  if (adapter === "mock") {
    return getMockMlOutput(normalizedData);
  }

  if (adapter === "onnx") {
    console.warn("[mlClient] onnx adapter is not implemented yet, falling back to mock");
    return getMockMlOutput(normalizedData);
  }

  if (adapter === "python") {
    try {
      return await callPythonMlLayer(normalizedData);
    } catch (error) {
      // The mock fallback is mandatory: any real ML failure (missing
      // Python, missing model, timeout, malformed output) must never break
      // the demo. Always fall back to mock and log why.
      console.warn(
        "[mlClient] Real ML layer unavailable, falling back to mock:",
        error.message
      );
      return getMockMlOutput(normalizedData);
    }
  }

  console.warn(`[mlClient] Unknown ML_ADAPTER "${adapter}", falling back to mock`);
  return getMockMlOutput(normalizedData);
}

// Spawns `python inference/inference.py`, writes normalizedData as JSON to
// its stdin, and reads one JSON object back from its stdout. Killed after
// PYTHON_TIMEOUT_MS if it has not responded.
function callPythonMlLayer(normalizedData) {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON_BIN, [INFERENCE_SCRIPT], { cwd: ML_ROOT });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      child.kill("SIGKILL");
      reject(new Error(`Python inference timed out after ${PYTHON_TIMEOUT_MS}ms`));
    }, PYTHON_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      reject(new Error(`Failed to start Python process: ${error.message}`));
    });

    child.on("close", (code) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);

      if (code !== 0) {
        reject(new Error(`Python inference exited with code ${code}: ${stderr.trim()}`));
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(new Error(`Python inference returned malformed JSON: ${error.message}`));
      }
    });

    child.stdin.write(JSON.stringify(normalizedData));
    child.stdin.end();
  });
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
