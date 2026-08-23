// Collapses many raw device readings into one representative value per metric
// per day, before anything reaches baseline logic.
//
// Why this exists: PR #21 made a baseline require both MIN_OBSERVATIONS and a
// 24-hour span, precisely so that three readings from one sitting cannot
// masquerade as a baseline. A device emitting a reading every few minutes
// would clear both thresholds within an afternoon, and the same baseline table
// would then hold entries meeting two completely different evidentiary
// standards. Aggregating first means a device day counts exactly as much as a
// manual entry: one observation, timestamped within that day.
//
// Aggregation is the median rather than the mean: device traces contain
// motion artefacts and dropouts, and a single spurious 200 bpm sample should
// not move the day's representative value.

import { READING_SOURCES, normalizeStoredReading } from "./vitalsProvider";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// A day represented by one or two samples describes a moment, not a day. Such
// days are excluded from baseline input by default and, when surfaced, are
// marked `underSampled` - never emitted silently as if equivalent to a
// well-sampled day.
export const MIN_READINGS_PER_DAY = 3;

export function aggregateDailyReadings(
  readings,
  { minReadingsPerDay = MIN_READINGS_PER_DAY, includeUnderSampled = false } = {}
) {
  const deviceReadings = (Array.isArray(readings) ? readings : [])
    .map(normalizeStoredReading)
    .filter((reading) => reading && reading.source === READING_SOURCES.DEVICE);

  const buckets = new Map();
  for (const reading of deviceReadings) {
    // Days are UTC calendar days, taken from the ISO timestamp. This is a
    // known simplification: a reading just either side of local midnight can
    // land in the neighbouring UTC day. It never inflates the observation
    // count beyond one per metric per UTC day, so it cannot weaken the
    // baseline rules; at worst it splits one local day across two.
    const day = reading.measuredAt.slice(0, 10);
    const key = `${day}|${reading.metric}`;
    const bucket = buckets.get(key) || { day, metric: reading.metric, readings: [] };
    bucket.readings.push(reading);
    buckets.set(key, bucket);
  }

  return [...buckets.values()]
    .map((bucket) => summariseBucket(bucket, minReadingsPerDay))
    .filter((entry) => includeUnderSampled || !entry.underSampled)
    .sort((first, second) =>
      first.day === second.day
        ? first.metric.localeCompare(second.metric)
        : first.day.localeCompare(second.day)
    );
}

// Turns aggregated days into the assessment-like shape baseline logic already
// consumes, so a device day travels through computeAllBaselines as exactly one
// observation - the same terms as a manual reading. No rule is relaxed.
export function dailyAggregatesToObservations(aggregates) {
  const byDay = new Map();

  for (const aggregate of Array.isArray(aggregates) ? aggregates : []) {
    const existing = byDay.get(aggregate.day) || {
      timestamp: aggregate.lastReadingAt,
      source: READING_SOURCES.DEVICE,
      simulated: false,
      providerIds: [],
      vitals: {},
      readingCount: 0,
    };

    existing.vitals[aggregate.metric] = aggregate.value;
    existing.readingCount += aggregate.readingCount;
    existing.simulated = existing.simulated || aggregate.simulated;
    for (const providerId of aggregate.providerIds) {
      if (!existing.providerIds.includes(providerId)) {
        existing.providerIds.push(providerId);
      }
    }
    // Both sides are ISO-8601 UTC strings produced by createReading, so a
    // lexicographic comparison is a chronological one. Keep it that way.
    if (aggregate.lastReadingAt > existing.timestamp) {
      existing.timestamp = aggregate.lastReadingAt;
    }

    byDay.set(aggregate.day, existing);
  }

  return [...byDay.entries()]
    .map(([day, entry]) => ({
      id: `device-${day}`,
      day,
      timestamp: entry.timestamp,
      source: entry.source,
      simulated: entry.simulated,
      providerId: entry.providerIds.length === 1 ? entry.providerIds[0] : null,
      providerIds: entry.providerIds,
      readingCount: entry.readingCount,
      patientData: { vitals: entry.vitals },
    }))
    .sort((first, second) => first.day.localeCompare(second.day));
}

// Baseline input for one person: their recorded assessments plus one
// aggregated observation per device day, ordered chronologically. Device days
// are added as ordinary observations - they must satisfy MIN_OBSERVATIONS and
// the 24-hour span rule exactly as manual readings do.
export function buildBaselineHistory(assessments, readings, options) {
  const deviceObservations = dailyAggregatesToObservations(
    aggregateDailyReadings(readings, options)
  );
  return [...(Array.isArray(assessments) ? assessments : []), ...deviceObservations].sort(
    (first, second) => String(first?.timestamp).localeCompare(String(second?.timestamp))
  );
}

export function aggregatedSpanMs(aggregate) {
  return Date.parse(aggregate.lastReadingAt) - Date.parse(aggregate.firstReadingAt);
}

export function describeAggregate(aggregate) {
  if (!aggregate) {
    return "";
  }
  const readingWord = aggregate.readingCount === 1 ? "reading" : "readings";
  const hours = Math.max(0, Math.round(aggregatedSpanMs(aggregate) / (60 * 60 * 1000)));
  const spanText = hours >= 1 ? ` spanning ${hours} hour${hours === 1 ? "" : "s"}` : "";
  const simulatedText = aggregate.simulated ? "Simulated device data - " : "Device data - ";
  const underSampledText = aggregate.underSampled
    ? `; only ${aggregate.readingCount} ${readingWord} that day, too few to represent it`
    : "";
  return `${simulatedText}median of ${aggregate.readingCount} ${readingWord}${spanText}${underSampledText}.`;
}

export { MS_PER_DAY };

function summariseBucket(bucket, minReadingsPerDay) {
  const sortedByTime = [...bucket.readings].sort((first, second) =>
    first.measuredAt.localeCompare(second.measuredAt)
  );
  const providerIds = [];
  for (const reading of sortedByTime) {
    if (!providerIds.includes(reading.providerId)) {
      providerIds.push(reading.providerId);
    }
  }

  return {
    metric: bucket.metric,
    day: bucket.day,
    value: median(sortedByTime.map((reading) => reading.value)),
    readingCount: sortedByTime.length,
    firstReadingAt: sortedByTime[0].measuredAt,
    lastReadingAt: sortedByTime[sortedByTime.length - 1].measuredAt,
    source: READING_SOURCES.DEVICE,
    providerId: providerIds.length === 1 ? providerIds[0] : null,
    providerIds,
    // Simulated is sticky: if any reading feeding this value was synthetic,
    // the aggregate is synthetic.
    simulated: sortedByTime.some((reading) => reading.simulated),
    underSampled: sortedByTime.length < minReadingsPerDay,
  };
}

function median(values) {
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  const value =
    sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
  return Math.round(value * 100) / 100;
}
