const { spawn } = require("child_process");
const path = require("path");

// ml/inference/inference.py lives two levels up from backend/ml/, regardless
// of the process cwd -- resolve relative to __dirname so this works whether
// the server is started from repo root, backend/, or anywhere else.
const INFERENCE_SCRIPT = path.join(__dirname, "..", "..", "ml", "inference", "inference.py");

const DEFAULT_TIMEOUT_MS = 10000;
const STDERR_SNIPPET_LENGTH = 500;

function getPythonBin() {
  return process.env.PYTHON_BIN || (process.platform === "win32" ? "python" : "python3");
}

function getTimeoutMs() {
  const raw = Number(process.env.ML_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

// Spawns ml/inference/inference.py, writes `mlInput` as JSON on stdin, and
// resolves with the parsed JSON written to stdout. Never uses `exec` -- the
// output of a model run is not bounded by exec's default buffer size.
function runInference(mlInput) {
  return new Promise((resolve, reject) => {
    const pythonBin = getPythonBin();
    const timeoutMs = getTimeoutMs();

    let child;
    try {
      child = spawn(pythonBin, [INFERENCE_SCRIPT], {
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (error) {
      reject(new Error(`Failed to spawn Python (${pythonBin}): ${error.message}`));
      return;
    }

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      child.kill();
      reject(new Error(`Python inference timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    const finish = (fn) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      fn();
    };

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      finish(() => {
        if (error.code === "ENOENT") {
          reject(
            new Error(
              `Python executable not found (${pythonBin}). Set PYTHON_BIN or install Python.`
            )
          );
          return;
        }
        reject(new Error(`Failed to run Python inference: ${error.message}`));
      });
    });

    child.on("close", (code) => {
      finish(() => {
        const stderrSnippet = stderr.slice(0, STDERR_SNIPPET_LENGTH);

        if (code !== 0) {
          reject(
            new Error(
              `Python inference exited with code ${code}. stderr: ${stderrSnippet || "(empty)"}`
            )
          );
          return;
        }

        const trimmedStdout = stdout.trim();
        if (!trimmedStdout) {
          reject(
            new Error(
              `Python inference produced no stdout. stderr: ${stderrSnippet || "(empty)"}`
            )
          );
          return;
        }

        try {
          resolve(JSON.parse(trimmedStdout));
        } catch (parseError) {
          reject(
            new Error(
              `Failed to parse Python inference output as JSON: ${parseError.message}. stderr: ${
                stderrSnippet || "(empty)"
              }`
            )
          );
        }
      });
    });

    try {
      child.stdin.write(JSON.stringify(mlInput));
      child.stdin.end();
    } catch (error) {
      finish(() => {
        reject(new Error(`Failed to write to Python stdin: ${error.message}`));
      });
    }
  });
}

module.exports = { runInference, INFERENCE_SCRIPT };
