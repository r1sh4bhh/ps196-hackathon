// Defensive readers for the `ml_detail` block the backend attaches to a
// prediction (backend/ml/patientMapper.js -> fromMlOutput). Every section is
// optional: the browser-side mock path carries no `ml_detail` at all, so each
// accessor must degrade to null rather than render "undefined" or crash.

// Maps a `risk_scores` key onto the `ml_detail` section that produced it.
export const ML_DETAIL_SECTIONS = {
  diabetes: "diabetes_risk",
  heart_disease: "cardiac_risk",
  hypertension: "hypertension",
  obesity: "obesity",
};

// A missing `source` is never treated as a model output -- an untagged
// payload is exactly the case where fabricated numbers slip through unlabelled.
export function getPredictionSource(prediction) {
  return prediction?.source === "model" ? "model" : "mock";
}

export function getSourceBadge(prediction) {
  if (getPredictionSource(prediction) === "model") {
    return {
      variant: "model",
      label: "Model output",
      title: "Risk scores returned by the ML backend.",
      reason: null,
    };
  }

  const reason =
    typeof prediction?.fallback_reason === "string" ? prediction.fallback_reason : null;
  return {
    variant: "mock",
    label: "⚠ Simulated data — not a real prediction",
    title: reason
      ? `Fallback reason: ${reason}`
      : "No prediction source was reported, so these numbers are treated as simulated.",
    reason,
  };
}

export function getMlDetail(prediction) {
  const detail = prediction?.ml_detail;
  return detail && typeof detail === "object" ? detail : null;
}

export function getRiskDetail(prediction, disease) {
  const key = ML_DETAIL_SECTIONS[disease];
  const section = key ? getMlDetail(prediction)?.[key] : null;
  if (!section || typeof section !== "object") {
    return null;
  }

  const band =
    pickString(section.risk_band) ?? pickString(section.stage) ?? pickString(section.class);
  const missingKeyInputs = Array.isArray(section.missing_key_inputs)
    ? section.missing_key_inputs.filter((item) => typeof item === "string" && item)
    : [];

  return {
    available: section.available !== false,
    // "rule" means a deterministic band mapped onto a display number, not a
    // model probability -- the UI must not blur the two.
    provenance: section.source === "rule" || section.source === "model" ? section.source : null,
    band,
    description: pickString(section.description),
    partialInput: section.partial_input === true,
    missingKeyInputs,
  };
}

export function getDisclaimer(prediction) {
  return pickString(getMlDetail(prediction)?.disclaimer);
}

export function isDegraded(prediction) {
  return getMlDetail(prediction)?.degraded === true;
}

export function getSymptomDifferential(prediction) {
  const section = getMlDetail(prediction)?.symptom_differential;
  if (!section || typeof section !== "object" || section.available !== true) {
    return null;
  }

  const predictions = Array.isArray(section.predictions)
    ? section.predictions.filter((item) => item && typeof item.condition === "string")
    : [];
  if (predictions.length === 0) {
    return null;
  }

  return {
    predictions,
    // The Python layer states these confidences rank conditions rather than
    // estimating probability of disease; presenting them as "%" chance would
    // overclaim well beyond what the payload says.
    rankingOnly: section.confidence_is_ranking_only === true,
    sparseInput: section.sparse_input === true,
    unmatchedSymptoms:
      typeof section.unmatched_symptoms === "number" && Number.isFinite(section.unmatched_symptoms)
        ? section.unmatched_symptoms
        : 0,
  };
}

function pickString(value) {
  return typeof value === "string" && value.trim() ? value : null;
}
