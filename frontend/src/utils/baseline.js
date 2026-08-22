export const MIN_OBSERVATIONS = 3;

export const BASELINE_METRICS = {
  systolic_bp: { label: "Systolic blood pressure", unit: "mmHg", path: ["vitals", "systolic_bp"] },
  diastolic_bp: {
    label: "Diastolic blood pressure",
    unit: "mmHg",
    path: ["vitals", "diastolic_bp"],
  },
  heart_rate: { label: "Heart rate", unit: "bpm", path: ["vitals", "heart_rate"] },
  temperature: { label: "Temperature", unit: "°F", path: ["vitals", "temperature"] },
  weight_kg: { label: "Weight", unit: "kg", path: ["vitals", "weight_kg"] },
  bmi: { label: "BMI", unit: "kg/m²", path: ["vitals", "bmi"] },
  glucose: { label: "Glucose", unit: "mg/dL", path: ["labs", "glucose"] },
  cholesterol: { label: "Cholesterol", unit: "mg/dL", path: ["labs", "cholesterol"] },
  triglycerides: { label: "Triglycerides", unit: "mg/dL", path: ["labs", "triglycerides"] },
  hdl: { label: "HDL", unit: "mg/dL", path: ["labs", "hdl"] },
};

export function computeBaseline(metric, history, currentValue) {
  const observations = Array.isArray(history)
    ? history.map((entry) => toNumber(entry?.value)).filter((value) => value !== null)
    : [];
  const current = toNumber(currentValue);
  const status =
    current === null || observations.length === 0
      ? "unavailable"
      : observations.length < MIN_OBSERVATIONS
        ? "establishing"
        : "established";
  const baseline = status === "established" ? round(mean(observations)) : null;
  const recentBaseline = observations.length ? round(mean(observations.slice(-5))) : null;
  const difference = baseline === null ? null : round(current - baseline);
  const percentageChange =
    baseline === null || baseline === 0 ? null : round(((current - baseline) / baseline) * 100);

  return {
    metric,
    current,
    baseline,
    recentBaseline,
    difference,
    percentage_change: percentageChange,
    direction: getDirection(current, baseline),
    trend: getTrend(observations),
    observations: observations.length,
    status,
  };
}

export function computeAllBaselines(assessments, currentAssessment) {
  const results = {};

  for (const metric of Object.keys(BASELINE_METRICS)) {
    const currentValue = getMetricValue(currentAssessment, metric);
    if (currentValue === null) {
      continue;
    }

    const history = Array.isArray(assessments)
      ? assessments
          .map((assessment) => ({
            value: getMetricValue(assessment, metric),
            timestamp: assessment?.timestamp,
          }))
          .filter((entry) => entry.value !== null)
      : [];
    results[metric] = computeBaseline(metric, history, currentValue);
  }

  return results;
}

function getMetricValue(assessment, metric) {
  const patientData = assessment?.patientData || assessment;
  if (!patientData || typeof patientData !== "object") {
    return null;
  }

  if (metric === "bmi") {
    const directBmi = toNumber(patientData?.vitals?.bmi);
    if (directBmi !== null) {
      return directBmi;
    }
    const weight = toNumber(patientData?.vitals?.weight_kg);
    const height = toNumber(patientData?.vitals?.height_cm);
    return weight !== null && height !== null && height > 0
      ? weight / Math.pow(height / 100, 2)
      : null;
  }

  const path = BASELINE_METRICS[metric]?.path;
  return path ? toNumber(path.reduce((value, key) => value?.[key], patientData)) : null;
}

function getDirection(current, baseline) {
  if (current === null || baseline === null) {
    return "at_baseline";
  }
  if (isWithinDeadBand(current, baseline)) {
    return "at_baseline";
  }
  return current > baseline ? "above_baseline" : "below_baseline";
}

function getTrend(observations) {
  if (observations.length < 4) {
    return "unknown";
  }

  const midpoint = Math.floor(observations.length / 2);
  const olderMean = mean(observations.slice(0, midpoint));
  const newerMean = mean(observations.slice(midpoint));
  if (isWithinDeadBand(newerMean, olderMean)) {
    return "stable";
  }
  return newerMean > olderMean ? "rising" : "falling";
}

function isWithinDeadBand(value, reference) {
  return reference === 0
    ? Math.abs(value) < 0.01
    : Math.abs((value - reference) / reference) <= 0.02;
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function toNumber(value) {
  if (value === null || value === undefined || value === "" || !Number.isFinite(Number(value))) {
    return null;
  }
  return Number(value);
}
