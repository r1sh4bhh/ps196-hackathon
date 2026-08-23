// Vendor-neutral contract for a source of vital-sign readings.
//
// A "provider" is anything that can report readings for the vitals this app
// already tracks: a wearable, a connected cuff, a clinic device, or the
// simulated source shipped for demonstration. The interface is deliberately
// small; it exists so a future real integration is a drop-in, not to model
// every capability a device might have.
//
// A provider implements:
//
//   id               string   - stable, vendor-neutral identifier
//   label            string   - human-readable name shown in the connection UI
//   simulated        boolean  - true when the readings are synthetic
//   supportedMetrics string[] - subset of VITALS_METRICS it can report
//   read(patientId, { from, to }) -> Promise<Reading[]> | Reading[]
//
// A reading is:
//
//   { metric, value, measuredAt, source, providerId, simulated }
//
// Not every provider supplies every metric. Absence is represented by
// reporting *nothing* for that metric - never a zero, an empty string, or a
// placeholder that a reader could mistake for a measurement.

export const VITALS_METRICS = Object.freeze([
  "systolic_bp",
  "diastolic_bp",
  "heart_rate",
  "temperature",
  "weight_kg",
]);

export const READING_SOURCES = Object.freeze({
  DEVICE: "device",
  MANUAL: "manual",
});

// Readings typed in by a person are attributed to this pseudo-provider so
// every stored reading carries the same provenance fields.
export const MANUAL_PROVIDER_ID = "manual-entry";

export function isSupportedMetric(metric) {
  return VITALS_METRICS.includes(metric);
}

// Builds a reading, or returns null when the inputs do not describe a real
// measurement. Returning null (rather than a zero-valued reading) is how a
// provider honestly reports "I have nothing for this metric".
export function createReading({ metric, value, measuredAt, source, providerId, simulated } = {}) {
  const numericValue = Number(value);
  const timestamp = Date.parse(measuredAt);

  if (
    !isSupportedMetric(metric) ||
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean" ||
    !Number.isFinite(numericValue) ||
    !Number.isFinite(timestamp) ||
    (source !== READING_SOURCES.DEVICE && source !== READING_SOURCES.MANUAL) ||
    typeof providerId !== "string" ||
    providerId === "" ||
    typeof simulated !== "boolean"
  ) {
    return null;
  }

  return {
    metric,
    value: numericValue,
    measuredAt: new Date(timestamp).toISOString(),
    source,
    providerId,
    simulated,
  };
}

export function isValidReading(reading) {
  return createReading(reading ?? {}) !== null;
}

// Checks a provider honours the contract above. Used by tests and by the
// connection UI so a malformed provider can never be connected silently.
export function validateProvider(provider) {
  const problems = [];

  if (!provider || typeof provider !== "object") {
    return { valid: false, problems: ["provider must be an object"] };
  }
  if (typeof provider.id !== "string" || provider.id === "") {
    problems.push("provider.id must be a non-empty string");
  }
  if (typeof provider.label !== "string" || provider.label === "") {
    problems.push("provider.label must be a non-empty string");
  }
  if (typeof provider.simulated !== "boolean") {
    problems.push("provider.simulated must be a boolean");
  }
  if (
    !Array.isArray(provider.supportedMetrics) ||
    provider.supportedMetrics.length === 0 ||
    !provider.supportedMetrics.every(isSupportedMetric)
  ) {
    problems.push("provider.supportedMetrics must be a non-empty subset of VITALS_METRICS");
  }
  if (typeof provider.read !== "function") {
    problems.push("provider.read must be a function");
  }

  return { valid: problems.length === 0, problems };
}

// Stored readings written before provenance existed have no source recorded.
// They are treated as manual - the conservative reading of the evidence, since
// every reading in the app before this change was typed in by a person. They
// are never guessed as device data.
export function normalizeStoredReading(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const source =
    raw.source === READING_SOURCES.DEVICE ? READING_SOURCES.DEVICE : READING_SOURCES.MANUAL;
  const hasProviderId = typeof raw.providerId === "string" && raw.providerId !== "";
  // A device-sourced reading with no provider recorded cannot be attributed
  // honestly, so it is discarded rather than credited to manual entry (which
  // would misstate its origin) or to an invented provider.
  if (source === READING_SOURCES.DEVICE && !hasProviderId) {
    return null;
  }
  const providerId = hasProviderId ? raw.providerId : MANUAL_PROVIDER_ID;

  return createReading({
    metric: raw.metric,
    value: raw.value,
    measuredAt: raw.measuredAt,
    source,
    providerId,
    simulated: raw.simulated === true,
  });
}
