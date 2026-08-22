"""Round-trip and error-handling tests for ml/inference/inference.py.

inference.py is invoked as a subprocess (stdin JSON -> stdout JSON), which
is exactly how backend/ml/mlClient.js's "python" adapter calls it, so these
tests exercise the real subprocess contract rather than importing the
module directly.
"""

import json
import subprocess
import sys
from pathlib import Path

ML_ROOT = Path(__file__).resolve().parent.parent
INFERENCE_SCRIPT = ML_ROOT / "inference" / "inference.py"
SAMPLE_PATIENT_PATH = ML_ROOT / "tests" / "fixtures" / "sample_patient.json"


def run_inference_subprocess(stdin_text: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(INFERENCE_SCRIPT)],
        input=stdin_text,
        capture_output=True,
        text=True,
        cwd=str(ML_ROOT),
        timeout=30,
    )


def test_inference_round_trips_valid_patient_json():
    stdin_text = SAMPLE_PATIENT_PATH.read_text()
    result = run_inference_subprocess(stdin_text)

    assert result.returncode == 0, result.stderr
    output = json.loads(result.stdout)

    assert "differential" in output
    assert "risk_scores" in output
    assert "clinical_findings" in output
    assert "hypertension" in output["clinical_findings"]
    assert "obesity" in output["clinical_findings"]
    assert output["clinical_findings"]["hypertension"]["source"] == "rule"
    assert output["clinical_findings"]["obesity"]["source"] == "rule"
    assert "models_available" in output


def test_inference_malformed_input_yields_json_error_on_stderr():
    result = run_inference_subprocess("this is not json")

    assert result.returncode != 0
    error_payload = json.loads(result.stderr)
    assert "error" in error_payload


def test_inference_empty_input_yields_json_error_on_stderr():
    result = run_inference_subprocess("")

    assert result.returncode != 0
    error_payload = json.loads(result.stderr)
    assert "error" in error_payload


def test_inference_never_hardcodes_unverified_accuracy():
    stdin_text = SAMPLE_PATIENT_PATH.read_text()
    result = run_inference_subprocess(stdin_text)
    assert "98.7" not in result.stdout
