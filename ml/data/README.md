# Datasets

These CSVs are **not committed to the repository**. Licensing varies by source
and the files would bloat the repo, so each developer downloads them locally.
`ml/data/*.csv` is gitignored.

Download all three into this directory before running any training script.

## Expected layout

```
ml/data/
├── dataset.csv                 <- Model A (symptom differential)
├── symptom_Description.csv     <- optional, feeds the evidence panel
├── symptom_precaution.csv      <- optional, feeds the evidence panel
├── Symptom-severity.csv        <- optional
├── diabetes.csv                <- Model B (diabetes risk)
└── heart.csv                   <- Model C (cardiac risk)
```

## Model A — Disease-Symptom dataset

<https://www.kaggle.com/datasets/itachi9604/disease-symptom-description-dataset>

41 conditions, 132 binary symptoms. Save the main file as `dataset.csv`.

**Important caveat:** this dataset is synthetic and near-perfectly separable.
Models trained on it score close to 100%, which reflects the dataset's
construction rather than any real-world diagnostic ability. That figure must
never be presented as clinical performance. See `ml/README.md`.

## Model B — Pima Indians Diabetes Database

<https://www.kaggle.com/datasets/uciml/pima-indians-diabetes-database>

768 rows, 8 features. Save as `diabetes.csv`.

Note that zeros in `Glucose`, `BloodPressure`, `SkinThickness`, `Insulin` and
`BMI` encode *missing values*, not measurements — a living person does not
have a blood pressure of zero. `preprocessing.py` median-imputes them.

The cohort is small and demographically narrow (adult female Pima Indian
heritage), so it does not generalise to the populations this tool targets.
Production deployment would require local validation data.

## Model C — UCI Heart Disease (Cleveland)

<https://www.kaggle.com/datasets/redwankarimsony/heart-disease-data>

303 rows, 13 features. Save as `heart.csv`.

Prefer the Kaggle mirror over the raw UCI archive, which ships without a
header row and encodes missing values as `?`. Preprocessing handles both, but
the mirror needs less work.

## Verifying your download

```powershell
dir ml\data
```

You should see `dataset.csv`, `diabetes.csv` and `heart.csv`. Training scripts
fail with an explicit message naming the missing file if any are absent.
