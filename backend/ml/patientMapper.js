// Pure mapping functions between the backend's `patientData` shape and the
// ML layer's input/output contract (see ml/inference/inference.py). No I/O
// here -- pythonBridge.js owns the process spawn.

// Maps the backend's raw `patientData` (docs/API.md) onto the shape
// ml/inference/inference.py expects. Values must stay in raw clinical units
// (mg/dL, mmHg, kg, cm) -- this function must never receive normalized data.
function toMlInput(patientData) {
  const data = patientData || {};
  const vitals = data.vitals || {};
  const labs = data.labs || {};

  return {
    symptoms: Array.isArray(data.symptoms) ? data.symptoms : [],
    vitals: {
      systolic_bp: vitals.systolic_bp,
      diastolic_bp: vitals.diastolic_bp,
      weight_kg: vitals.weight_kg,
      height_cm: vitals.height_cm,
      // The ML layer reads `max_heart_rate` first, falling back to
      // `heart_rate` -- the backend only ever has the latter.
      heart_rate: vitals.heart_rate,
    },
    labs: {
      glucose: labs.glucose,
      cholesterol: labs.cholesterol,
      triglycerides: labs.triglycerides,
      hdl: labs.hdl,
    },
    // `patientData` has `age` at the top level and no `demographics` object
    // (see docs/API.md); build one here since that's what the Python
    // preprocessing reads from.
    demographics: {
      age: data.age,
      sex: data.sex ?? data.gender,
    },
  };
}

// Deterministic, rule-based mappings from the clinical_rules.py output onto
// the 0-1 display scale the frontend's risk_scores expect. These are NOT
// model outputs -- there is no hypertension or obesity model, so a stage/
// class from the rules engine is mapped onto a display number by hand.
const HYPERTENSION_STAGE_SCORES = {
  normal: 0.1,
  elevated: 0.35,
  stage_1: 0.55,
  stage_2: 0.8,
  hypertensive_crisis: 0.95,
};

const BMI_CLASS_SCORES = {
  underweight: 0.2,
  normal: 0.1,
  overweight: 0.5,
  obese: 0.8,
};

// Adapts ml/inference/inference.py's output to the shape the existing
// frontend consumes: `{risk_scores, top_disease, confidence}` (docs/API.md).
// A missing/unavailable model section is omitted from risk_scores entirely
// -- it must never be reported as 0, which would read as "no risk" when the
// truth is "we don't know".
function fromMlOutput(mlResult) {
  const result = mlResult || {};
  const risk_scores = {};

  const diabetes = result.diabetes_risk;
  if (diabetes && diabetes.available) {
    risk_scores.diabetes = diabetes.risk_score;
  }

  const cardiac = result.cardiac_risk;
  if (cardiac && cardiac.available) {
    risk_scores.heart_disease = cardiac.risk_score;
  }

  const hypertension = result.hypertension;
  if (hypertension && hypertension.available && hypertension.stage in HYPERTENSION_STAGE_SCORES) {
    risk_scores.hypertension = HYPERTENSION_STAGE_SCORES[hypertension.stage];
  }

  const obesity = result.obesity;
  if (obesity && obesity.available && obesity.class in BMI_CLASS_SCORES) {
    risk_scores.obesity = BMI_CLASS_SCORES[obesity.class];
  }

  const entries = Object.entries(risk_scores);
  let top_disease = null;
  let confidence = null;
  if (entries.length > 0) {
    const top = entries.sort((a, b) => b[1] - a[1])[0];
    top_disease = top[0];
    confidence = top[1];
  }

  return {
    risk_scores,
    top_disease,
    confidence,
    source: "model",
    // Preserve the honest detail the mock shape has no room for: sparse
    // input flags, review priorities, and the disclaimer. The frontend
    // ignores this today, but it must not be discarded.
    ml_detail: {
      schema_version: result.schema_version,
      symptom_differential: result.symptom_differential,
      diabetes_risk: result.diabetes_risk,
      cardiac_risk: result.cardiac_risk,
      hypertension: result.hypertension,
      obesity: result.obesity,
      review_priority: result.review_priority,
      degraded: result.degraded,
      disclaimer: result.disclaimer,
    },
  };
}

module.exports = { toMlInput, fromMlOutput };
