# PS196 ML Layer

Local, offline Python ML layer for PS196: symptom differential (Model A),
diabetes risk (Model B), cardiac risk (Model C), plus deterministic
clinical rules for hypertension and obesity. See `docs/ARCHITECTURE.md` and
`docs/API.md` for how this layer fits into the rest of the system.

## What this layer can and cannot do

- **Model A (symptom differential)** ranks up to 41 conditions by how well
  reported symptoms match training patterns. It is a **screening
  shortlist**, not a diagnosis. Its dataset is synthetic (see caveat
  below) - do not trust its accuracy figure as a real-world number.
- **Model B (diabetes risk)** and **Model C (cardiac risk)** produce a
  calibrated risk probability from vitals/labs. They are **decision
  support**, not confirmed diagnoses.
- **Hypertension and obesity are rule-based, not ML.** Obesity is derived
  directly from BMI = weight/height² - training a model to predict a
  closed-form function of its own inputs would be circular. Hypertension
  is defined by published blood-pressure thresholds (ACC/AHA 2017), so
  there is nothing for a model to learn beyond the guideline itself. See
  `rules/clinical_rules.py`.
- Nothing in this repository claims or reproduces a "98.7% accuracy"
  figure from earlier planning docs - that number could not be
  substantiated and must never appear here. Only metrics computed by
  `training/evaluate.py` and written to `models/*_metrics.json` may be
  reported.

## Python version note

Developed and tested against **Python 3.14.6 on Windows**.
`scikit-learn>=1.9.0` ships official PyPI wheels for `cp314` on Windows, so
`pip install -r requirements.txt` should not need to compile anything from
source.

If you are on an older/unsupported interpreter, or `pip install` tries to
build from source and fails, install **Python 3.11 or 3.12** side-by-side
and point your virtual environment at that instead:

```powershell
py -3.12 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Setup

```powershell
cd ml
pip install -r requirements.txt
```

## Download datasets (optional - fixtures work without this)

See `data/README.md` for exact download instructions and expected
filenames. Small synthetic fixtures already exist under `data/fixtures/`
so everything below runs before you download anything real.

## Training order

Train in any order - the three models are independent by design (see
"Architectural decision" below). Each script accepts `--fixture` to train
on the small synthetic fixture instead of a real dataset:

```powershell
python training/train_symptom_model.py --fixture
python training/train_diabetes_model.py --fixture
python training/train_heart_model.py --fixture
```

Drop `--fixture` once you have downloaded the real CSVs into `data/` (see
`data/README.md`). Each script fails with a clear, actionable message if
its expected CSV is missing.

Every script prints the scikit-learn version, trains with
`random_state=42`, cross-validates honestly via `training/evaluate.py`
(stratified k-fold accuracy/precision/recall/F1/ROC-AUC/confusion
matrix/calibration curve/feature importances), and saves:

- `models/<name>_model.joblib` - the trained model.
- `models/<name>_metrics.json` - the metrics actually measured.

**Model A's accuracy will be close to 100% on both the fixture and the
real Kaggle dataset.** This is because that dataset assigns a near-fixed
symptom pattern to each disease and is not representative of noisy,
overlapping real-world presentations. The training script prints this
caveat and writes it into `models/symptom_model_metrics.json` - never
drop or reword it away.

## Architectural decision: multiple models, one merged response

Symptoms, and vitals+labs, live in incompatible feature spaces with very
different missingness patterns. Pooling them into a single model would let
the model learn *which dataset a row came from* rather than the clinical
signal itself. Instead:

```text
Symptoms         -> Model A (41-disease differential)  -> ranked shortlist
Vitals + labs     -> Model B (diabetes risk)            -> calibrated risk
Vitals + labs     -> Model C (cardiac risk)              -> calibrated risk
Vitals            -> Rules  (hypertension, obesity)      -> deterministic
                                                            v
                                              inference.py merges -> one JSON
```

## Running inference

`inference/inference.py` reads one JSON patient object from **stdin** and
writes one merged JSON object to **stdout**. Errors are written as JSON to
**stderr** with a non-zero exit code. It is fully offline and loads models
once at import.

**PowerShell** (PowerShell does not support `<` redirection):

```powershell
Get-Content tests/fixtures/sample_patient.json | python inference/inference.py
```

**POSIX shell:**

```bash
python inference/inference.py < tests/fixtures/sample_patient.json
```

If a model file is missing (e.g. you have not run training yet), that
model's contribution is simply omitted and flagged in the response's
`models_available` and `warnings` fields - inference never crashes because
one model is absent. Clinical rules (hypertension, obesity) never depend on
any model file and are always present.

### Output shape

```json
{
  "differential": [{ "condition": "...", "score": 0.0, "source": "model_a" }],
  "risk_scores": { "diabetes": 0.0, "heart_disease": 0.0 },
  "clinical_findings": {
    "hypertension": { "stage": "...", "source": "rule" },
    "obesity": { "class": "...", "bmi": 0.0, "source": "rule" }
  },
  "top_risk": "...",
  "confidence": 0.0,
  "feature_importances": { "diabetes": [{ "feature": "...", "importance": 0.0 }] },
  "models_available": { "model_a": true, "model_b": true, "model_c": false }
}
```

## Tests

```powershell
cd ml
python -m pytest
```

`pytest.ini`-equivalent configuration lives in `pyproject.toml`
(`[tool.pytest.ini_options]`), so `pytest` discovers `tests/` and resolves
`import feature_spec` / `import inference.preprocessing` / etc regardless
of the current working directory.

## Backend integration

`backend/ml/mlClient.js` is a pluggable adapter selected by the
`ML_ADAPTER` environment variable (`mock` | `python` | `onnx`, default
`mock`):

- `mock` preserves the original mock behaviour exactly - no Python
  required.
- `python` spawns this `inference.py`, writes patient JSON to its stdin,
  and reads the merged JSON back from stdout, with a 5 second timeout
  (killed on timeout).
- `onnx` is a documented stub only - not implemented.

**Any failure in the `python` adapter (missing Python, missing model,
timeout, malformed output) automatically falls back to `mock` and logs the
reason.** A Python crash must never break the demo.

## Terminology

Use "risk", "screening", "estimated", "differential", "decision support".
Avoid "diagnosis", "confirmed", or "medical certainty" - this system
supports clinical decisions, it does not replace them.
