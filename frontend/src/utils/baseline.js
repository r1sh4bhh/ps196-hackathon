export const MIN_OBSERVATIONS = 3;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Blood pressure, heart rate, weight, and glucose all have meaningful
// diurnal variation, so a handful of readings taken within a single day
// characterise one moment, not a person's typical value. A baseline must
// span at least this long, in addition to meeting MIN_OBSERVATIONS.
export const MIN_BASELINE_SPAN_MS = MS_PER_DAY;

// Heuristic for "clustered" readings: if a large majority of observations
// fall inside a small slice of the total observed span, the mean is really
// describing one sitting plus a lone outlier that happened to satisfy the
// 24-hour span check. This doesn't invalidate the baseline - it's still
// real data - but it should be disclosed rather than presented as if the
// readings were evenly spread across the whole span.
const CLUSTER_MAJORITY_FRACTION = 0.8;
const CLUSTER_WINDOW_FRACTION = 0.1;

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
    ? history
        .map((entry) => ({
          value: toNumber(entry?.value),
          timestamp: toTimestamp(entry?.timestamp),
          // Device-sourced entries arrive already aggregated to one value per
          // day (see vitals/aggregateDailyReadings.js), so they count here as
          // exactly one observation, on the same terms as a manual reading.
          source: entry?.source === "device" ? "device" : "manual",
          simulated: entry?.simulated === true,
        }))
        .filter((entry) => entry.value !== null)
    : [];
  const current = toNumber(currentValue);

  // Sort chronologically (undated entries are treated as oldest, keeping
  // their original relative order) so slice(-5) below reliably reflects
  // the most recent readings rather than however `history` happened to be
  // ordered.
  const chronological = [...observations].sort((a, b) => {
    if (a.timestamp === null && b.timestamp === null) return 0;
    if (a.timestamp === null) return -1;
    if (b.timestamp === null) return 1;
    return a.timestamp - b.timestamp;
  });
  const values = chronological.map((entry) => entry.value);

  const sortedTimestamps = observations
    .map((entry) => entry.timestamp)
    .filter((timestamp) => timestamp !== null)
    .sort((a, b) => a - b);
  const spanMs =
    sortedTimestamps.length >= 2
      ? sortedTimestamps[sortedTimestamps.length - 1] - sortedTimestamps[0]
      : 0;
  const hasSufficientSpan = spanMs >= MIN_BASELINE_SPAN_MS;

  let status;
  if (current === null || observations.length === 0) {
    status = "unavailable";
  } else if (observations.length < MIN_OBSERVATIONS) {
    status = "establishing";
  } else if (!hasSufficientSpan) {
    status = "insufficient_span";
  } else {
    status = "established";
  }

  const clustered = status === "established" && isClustered(sortedTimestamps, spanMs);

  const baseline = status === "established" ? round(mean(values)) : null;
  const recentBaseline = values.length ? round(mean(values.slice(-5))) : null;
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
    trend: getTrend(observations, status, clustered),
    observations: observations.length,
    spanDays: sortedTimestamps.length >= 2 ? Math.floor(spanMs / MS_PER_DAY) : null,
    earliest: sortedTimestamps.length ? new Date(sortedTimestamps[0]).toISOString() : null,
    latest: sortedTimestamps.length
      ? new Date(sortedTimestamps[sortedTimestamps.length - 1]).toISOString()
      : null,
    clustered,
    sources: summariseSources(observations),
    status,
  };
}

// A baseline mixing typed-in readings with aggregated device values is not
// homogeneous evidence, so the mix is reported rather than hidden behind a
// single number.
function summariseSources(observations) {
  const device = observations.filter((entry) => entry.source === "device");
  return {
    manual: observations.length - device.length,
    device: device.length,
    simulated: device.filter((entry) => entry.simulated).length,
  };
}

// Plain-language description of the mix, empty when every observation was
// entered by hand so the existing disclosures are not diluted with a line
// that says nothing.
export function describeBaselineSources(result) {
  const sources = result?.sources;
  if (!sources || sources.device === 0) {
    return "";
  }

  const dayWord = sources.device === 1 ? "daily value" : "daily values";
  const origin = sources.simulated > 0 ? "simulated device" : "device";
  const manualPart =
    sources.manual > 0
      ? ` and ${sources.manual} manually entered reading${sources.manual === 1 ? "" : "s"}`
      : "";
  const simulatedNote =
    sources.simulated > 0
      ? " Simulated device data is synthetic and was not measured from a person."
      : "";

  return `Built from ${sources.device} aggregated ${origin} ${dayWord}${manualPart}.${simulatedNote}`;
}

// Concise, human-readable statement of what a baseline is (or isn't) built
// from, so a reader never has to dig to see how much data backs the number
// they're being compared against.
export function describeBaselineProvenance(result) {
  if (!result) {
    return "";
  }

  const { observations, spanDays, status } = result;
  const readingWord = observations === 1 ? "reading" : "readings";

  if (status === "unavailable") {
    return "No readings recorded yet.";
  }
  if (status === "establishing") {
    return `${observations} ${readingWord} recorded; at least ${MIN_OBSERVATIONS} are needed before a baseline can be established.`;
  }
  if (status === "insufficient_span") {
    return `${observations} ${readingWord} recorded, but they span under 24 hours; a baseline needs readings spread over at least a day.`;
  }
  return `Baseline from ${observations} ${readingWord} over ${spanDays} day${spanDays === 1 ? "" : "s"}.`;
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
            source: assessment?.source,
            simulated: assessment?.simulated,
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

function getTrend(observations, status, clustered) {
  // Insufficient span or clustering means we can't honestly say the mean is
  // representative, so a trend derived from it would be misleading too -
  // omit it rather than showing a flat or fabricated direction.
  if (status !== "established" || clustered) {
    return "unknown";
  }
  if (observations.length < 4) {
    return "unknown";
  }

  const timed = observations
    .filter((entry) => entry.timestamp !== null)
    .sort((a, b) => a.timestamp - b.timestamp);
  if (timed.length < 4) {
    return "unknown";
  }

  // Split by elapsed time, not array position: a 5kg change over two days
  // and over six months are clinically opposite findings and must not be
  // computed the same way just because both have "n" observations.
  const earliest = timed[0].timestamp;
  const latest = timed[timed.length - 1].timestamp;
  const midpoint = (earliest + latest) / 2;
  const older = timed.filter((entry) => entry.timestamp <= midpoint).map((entry) => entry.value);
  const newer = timed.filter((entry) => entry.timestamp > midpoint).map((entry) => entry.value);
  if (older.length === 0 || newer.length === 0) {
    return "unknown";
  }

  const olderMean = mean(older);
  const newerMean = mean(newer);
  if (isWithinDeadBand(newerMean, olderMean)) {
    return "stable";
  }
  return newerMean > olderMean ? "rising" : "falling";
}

function isClustered(sortedTimestamps, spanMs) {
  if (sortedTimestamps.length < 3 || spanMs <= 0) {
    return false;
  }

  const majorityCount = Math.ceil(sortedTimestamps.length * CLUSTER_MAJORITY_FRACTION);
  let minWindow = Infinity;
  for (let index = 0; index + majorityCount - 1 < sortedTimestamps.length; index += 1) {
    const window = sortedTimestamps[index + majorityCount - 1] - sortedTimestamps[index];
    if (window < minWindow) {
      minWindow = window;
    }
  }

  return minWindow <= spanMs * CLUSTER_WINDOW_FRACTION;
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

function toTimestamp(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}
