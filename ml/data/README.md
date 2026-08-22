# Datasets

None of the real dataset CSVs are committed to this repository. Download
them yourself and place them in this folder using the **exact filenames**
below - the training scripts look for these names and will fail with a
clear, actionable error message if a file is missing.

Small **synthetic fixture CSVs** already exist in `ml/data/fixtures/` so the
whole pipeline (training, evaluation, inference, tests) runs end-to-end
before you download anything real. They are clearly marked synthetic and
must never be treated as real clinical data.

## Model A - 41-disease symptom differential

**Source:** Kaggle
[`itachi9604/disease-symptom-description-dataset`](https://www.kaggle.com/datasets/itachi9604/disease-symptom-description-dataset)
(41 diseases, 132 binary symptom columns).

1. `kaggle datasets download -d itachi9604/disease-symptom-description-dataset`
2. Unzip into `ml/data/` so you end up with these exact files:
   - `ml/data/dataset.csv` - main training data (rename `Training.csv` from
     the download to `dataset.csv`).
   - `ml/data/symptom_Description.csv`
   - `ml/data/symptom_precaution.csv`
   - `ml/data/Symptom-severity.csv`

> This dataset is synthetic/near-perfectly separable. See
> `ml/README.md` for why Model A's near-100% accuracy does **not** indicate
> real-world performance.

## Model B - diabetes risk (Pima Indians Diabetes)

**Source:** [Pima Indians Diabetes Database](https://www.kaggle.com/datasets/uciml/pima-indians-diabetes-database)
(768 rows).

1. Download and place the CSV at `ml/data/diabetes.csv`.
2. Expected columns (in order): `Pregnancies, Glucose, BloodPressure,
   SkinThickness, Insulin, BMI, DiabetesPedigreeFunction, Age, Outcome`.

`Glucose`, `BloodPressure`, `SkinThickness`, `Insulin`, and `BMI` use `0` to
mean "missing", not a physiological reading of zero. The training script
median-imputes these before fitting - see `ml/inference/preprocessing.py`
for the shared imputation logic used at inference time too.

## Model C - cardiac risk (UCI Heart Disease, Cleveland)

**Source:** [UCI Heart Disease dataset, Cleveland subset](https://archive.ics.uci.edu/dataset/45/heart+disease)
(303 rows).

1. Download the Cleveland processed data (`processed.cleveland.data`) and
   save it as `ml/data/heart.csv` with a header row added:
   `age,sex,cp,trestbps,chol,fbs,restecg,thalach,exang,oldpeak,slope,ca,thal,target`.
2. Rows containing `?` for missing values are dropped by the training
   script.

## Expected file layout

```text
ml/data/
├── README.md                  (this file)
├── dataset.csv                (Model A - not committed)
├── symptom_Description.csv    (Model A - not committed)
├── symptom_precaution.csv     (Model A - not committed)
├── Symptom-severity.csv       (Model A - not committed)
├── diabetes.csv               (Model B - not committed)
├── heart.csv                  (Model C - not committed)
└── fixtures/
    ├── dataset_fixture.csv     (synthetic, committed)
    ├── diabetes_fixture.csv    (synthetic, committed)
    └── heart_fixture.csv       (synthetic, committed)
```

`ml/data/*.csv` is listed in `.gitignore`; `ml/data/fixtures/*.csv` is
explicitly un-ignored so the fixtures stay in version control.
