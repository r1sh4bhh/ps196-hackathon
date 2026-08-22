"""Tests that inference.py degrades gracefully when model artifacts are
missing, instead of crashing."""

import json
import subprocess
import sys
from pathlib import Path

import pytest

ML_ROOT = Path(__file__).resolve().parent.parent
INFERENCE_SCRIPT = ML_ROOT / "inference" / "inference.py"
SAMPLE_PATIENT_PATH = ML_ROOT / "tests" / "fixtures" / "sample_patient.json"
MODELS_DIR = ML_ROOT / "models"


def run_inference_subprocess(stdin_text: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(INFERENCE_SCRIPT)],
        input=stdin_text,
        capture_output=True,
        text=True,
        cwd=str(ML_ROOT),
        timeout=30,
    )


@pytest.fixture
def all_models_missing():
    """Temporarily rename every model artifact so none are found."""
    moved = []
    for artifact in MODELS_DIR.glob("*.joblib"):
        backup = artifact.with_suffix(artifact.suffix + ".bak")
        artifact.rename(backup)
        moved.append((backup, artifact))
    try:
        yield
    finally:
        for backup, original in moved:
            backup.rename(original)


def test_inference_degrades_gracefully_with_no_models(all_models_missing):
    stdin_text = SAMPLE_PATIENT_PATH.read_text()
    result = run_inference_subprocess(stdin_text)

    assert result.returncode == 0, result.stderr
    output = json.loads(result.stdout)

    assert output["models_available"] == {
        "model_a": False,
        "model_b": False,
        "model_c": False,
    }
    assert output["differential"] == []
    # Clinical rules must still be present - they never depend on ML models.
    assert output["clinical_findings"]["hypertension"]["source"] == "rule"
    assert output["clinical_findings"]["obesity"]["source"] == "rule"
    assert "warnings" in output
