# ML layer

Three models and two deterministic clinical rules, behind a single
process-per-request JSON interface.

```
ml/
  feature_spec.py        frozen feature order - the contract between train and serve
  inference/
    preprocessing.py     all shared transforms (imported by BOTH sides)
    inference.py         stdin JSON -> stdout JSON entry point
  rules/
    clinical_rules.py    deterministic thresholds, no model required
  training/
    train_symptoms.py    Model A
    train_diabetes.py    Model B
    train_heart.py       Model C
  data/                  CSVs, gitignored (see below)
  models/                .joblib artefacts, produced by training
```

## Setup

```bash
pip install -r ml/requirements.txt
```

`scikit-learn` is pinned **exactly**. joblib artefacts do not unpickle
reliably across scikit-learn versions, so a teammate on a different minor
version will get either a noisy warning or a hard failure. If you bump the
pin, retrain all three models.

## Training

```bash
py ml/training/train_symptoms.py
py ml/training/train_diabetes.py
py ml/training/train_heart.py
```

Each writes one `.joblib` into `ml/models/`. Takes well under a minute total.

## Inference

```bash
echo '{"symptoms":["headache"],"vitals":{"systolic_bp":135}}' | py ml/inference/inference.py
```

One JSON object in, one JSON object out. The backend spawns this process
rather than embedding Python, so Node needs no bindings.

**It never fails the caller.** Every model loads independently and every
prediction is wrapped. A missing or incompatible model degrades that one
section to `"available": false` with a reason, and everything else still
returns. This matters because the clinical rules need no models at all and
are the findings most likely to require immediate action - a crisis blood
pressure reading must survive any model failure.

Run it before training anything to see that path work.

## Results

| Model | Data | Headline | Honest reading |
|---|---|---|---|
| A - symptoms | 4,920 synthetic rows, 41 conditions | 1.000 CV accuracy | Meaningless as accuracy. See below. |
| B - diabetes | 768 rows, Pima | **0.830 CV ROC-AUC** | Matches published range. Genuine. |
| C - cardiac | 304 rows, Cleveland | 0.918 acc / 0.956 AUC | Sound, but small test split. |

### Model A's perfect score is not a good thing

The symptom dataset is synthetic and near-perfectly separable: each condition
maps to a fixed symptom set with minimal variation, so almost any classifier
scores ~100%. That number measures how cleanly the dataset was *constructed*,
not diagnostic ability. Real patients present with overlapping, partial and
atypical symptoms.

The training script prints this caveat next to the score so it cannot be
quoted out of context, and the API returns
`"confidence_is_ranking_only": true` on every symptom result. Present it as a
ranked differential - a shortlist worth considering - never as a diagnosis.

### Model B: we found and removed label leakage

Our first `diabetes.csv` (a Kaggle mirror) produced 0.95 CV AUC against a
published literature range of 0.83-0.85. That gap was too large to be luck.

The cause: the file had been **pre-imputed by whoever uploaded it**. Canonical
Pima encodes missing readings as zeros - 374 in insulin, 227 in skin
thickness, 35 in blood pressure. That mirror had none. The replacement values
appeared to have been filled group-wise by outcome, so two positive rows both
carried insulin 169.5 while a negative row carried 102.5. The label had been
written into the features, and the model was reading it back out.

It was replaced with the primary source, whose zero counts match the known
signature exactly (`Glucose 5, BloodPressure 35, SkinThickness 227,
Insulin 374, BMI 11`). AUC fell to 0.830, which is the real number.

Worth internalising: **a suspiciously good score is a bug report.** No
modelling change would have fixed this, because nothing was wrong with the
model.

### Model C: Cleveland only

The commonly mirrored heart CSV holds 920 rows from four sites (Cleveland
304, Hungary 293, VA Long Beach 200, Switzerland 123). The non-Cleveland
sites largely did not record `ca` and `thal` - missing in ~611 and ~486 rows
respectively across the full file.

Training on all of it would leave two of thirteen features as mostly imputed
constants, and the inference path already defaults those same fields, which
compounds the problem. `train_heart.py` filters to Cleveland, which also
matches the subset published benchmarks use.

## Screening thresholds

A classifier's default 0.5 cutoff caught only 30 of 54 diabetic patients in
the held-out split - recall 0.56. For triage that is the wrong failure mode:
a false alarm costs a clinician a few minutes, a missed case costs the
patient months of undetected progression.

So `inference.py` bands from **0.30** (diabetes) and **0.35** (cardiac)
rather than 0.5, trading precision for recall deliberately. The thresholds
live in `RISK_THRESHOLDS` at the top of that file, and each response reports
the `threshold_used`.

Bands are **review priorities, not probabilities**. "Elevated" means a
clinician should look; it does not mean the patient has the condition.

## Limitations

State these plainly. They are not disclaimers to bury - a reviewer who spots
an unqualified accuracy claim will distrust everything else.

- **Model A is trained on synthetic data.** It ranks; it does not diagnose.
- **Model B's cohort is 768 adult women of Pima Indian heritage.** It does not
  transfer cleanly to the populations this tool targets.
- **Model C's data was collected in 1988**, and the intake form does not
  capture `ca`, `thal`, `slope` or `oldpeak`. Live predictions run on partial
  input and are coarser than 0.918 suggests - hence `"partial_input": true`
  on every cardiac response.
- **Diabetes without a glucose reading** falls back to the training median,
  and glucose is the dominant predictor. That response is also flagged
  `partial_input`.
- **None of this is a medical device.** It is screening support for a
  clinician, and every response carries a disclaimer saying so.

## Datasets

CSVs are gitignored - they are large and freely available. Place in
`ml/data/`:

| File | Source |
|---|---|
| `dataset.csv` | Kaggle: Disease Symptom Prediction (4,920 x 18) |
| `diabetes.csv` | Pima Indians Diabetes. **Use a primary source**, not a cleaned mirror. |
| `heart.csv` | UCI Heart Disease (the 920-row four-site version is fine; training filters it) |

Verify Pima before training:

```bash
py -c "import pandas as pd; d=pd.read_csv('ml/data/diabetes.csv'); print((d[['Glucose','BloodPressure','SkinThickness','Insulin','BMI']]==0).sum().to_dict())"
```

Expect `{5, 35, 227, 374, 11}`. **All zeros means you have a pre-imputed
mirror** - the exact problem described above. Replace it.

## Changing features

`feature_spec.py` defines the canonical order for every model vector. Both
training and inference import it, so a column added on one side without the
other cannot silently shift positions - `validate_vector` raises instead.

Categorical text in the heart data is decoded through explicit value maps in
`preprocessing.py`, never `Categorical.codes`. Alphabetical codes would map
`thal` to `fixed=0, normal=1, reversable=2` while UCI uses `normal=3,
fixed=6, reversable=7` - the same number meaning different things on each
side, with no error raised anywhere.

If you change a feature list, retrain every affected model.
