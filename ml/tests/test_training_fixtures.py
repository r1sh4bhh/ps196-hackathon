"""Confirms every training script runs to completion against the synthetic
fixtures (no real dataset download required)."""

import subprocess
import sys
from pathlib import Path

ML_ROOT = Path(__file__).resolve().parent.parent
TRAINING_DIR = ML_ROOT / "training"


def run_training_script(script_name: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(TRAINING_DIR / script_name), "--fixture"],
        capture_output=True,
        text=True,
        cwd=str(ML_ROOT),
        timeout=120,
    )


def test_train_symptom_model_runs_on_fixture():
    result = run_training_script("train_symptom_model.py")
    assert result.returncode == 0, result.stderr
    assert "does NOT indicate real-world performance" in result.stdout
    assert (ML_ROOT / "models" / "symptom_model.joblib").exists()
    assert (ML_ROOT / "models" / "symptom_model_metrics.json").exists()


def test_train_diabetes_model_runs_on_fixture():
    result = run_training_script("train_diabetes_model.py")
    assert result.returncode == 0, result.stderr
    assert (ML_ROOT / "models" / "diabetes_model.joblib").exists()
    assert (ML_ROOT / "models" / "diabetes_model_metrics.json").exists()


def test_train_heart_model_runs_on_fixture():
    result = run_training_script("train_heart_model.py")
    assert result.returncode == 0, result.stderr
    assert (ML_ROOT / "models" / "heart_model.joblib").exists()
    assert (ML_ROOT / "models" / "heart_model_metrics.json").exists()


def test_symptom_model_missing_dataset_raises_clear_error():
    result = subprocess.run(
        [sys.executable, str(TRAINING_DIR / "train_symptom_model.py")],
        capture_output=True,
        text=True,
        cwd=str(ML_ROOT),
        timeout=30,
    )
    # Real dataset.csv is intentionally not committed - this must fail with
    # a clear, actionable message, not a stack trace about a missing file
    # somewhere deep in pandas.
    assert result.returncode != 0
    assert "ml/data/README.md" in result.stderr
    assert "dataset.csv" in result.stderr
