// SimulatedVitalsProvider - SYNTHETIC DATA, FOR DEMONSTRATION ONLY.
//
// This file is a mock. It is not connected to any device, service, or vendor,
// and nothing it returns was measured from a person. Every reading it produces
// is marked `simulated: true` at the data level so the flag survives storage,
// aggregation, display, and disconnection.
//
// Values are generated deterministically from the patient id and the reading
// time, so the same window always yields the same series: a plausible,
// internally consistent trace (diurnal rhythm plus slow drift) rather than
// fresh random noise on every call.

import { READING_SOURCES, createReading } from "./vitalsProvider";

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const DEFAULT_INTERVAL_MS = 30 * MS_PER_MINUTE;
// Bounds one call: at most this many sample times, each producing at most one
// reading per supported metric.
const MAX_SAMPLE_TIMES_PER_CALL = 500;

// Per-metric plausible resting centre, diurnal swing, and slow multi-day
// drift. Ranges are ordinary adult values; nothing here is clinically derived.
const METRIC_MODELS = {
  systolic_bp: { centre: 118, diurnal: 7, drift: 3, jitter: 2, decimals: 0, peakHour: 10 },
  diastolic_bp: { centre: 76, diurnal: 5, drift: 2, jitter: 1.5, decimals: 0, peakHour: 10 },
  heart_rate: { centre: 68, diurnal: 9, drift: 2.5, jitter: 3, decimals: 0, peakHour: 15 },
  temperature: { centre: 98.4, diurnal: 0.7, drift: 0.15, jitter: 0.15, decimals: 1, peakHour: 17 },
};

export class SimulatedVitalsProvider {
  constructor({ id = "simulated", intervalMs = DEFAULT_INTERVAL_MS } = {}) {
    this.id = id;
    this.label = "Simulated vitals source (synthetic data)";
    this.description =
      "Generates synthetic readings for demonstration. No real device is connected and no value here was measured from a person.";
    this.simulated = true;
    // A wrist-worn class of device cannot weigh anyone, so weight_kg is
    // omitted entirely rather than reported as a zero or a guess.
    this.supportedMetrics = Object.freeze(Object.keys(METRIC_MODELS));
    this.intervalMs = intervalMs;
  }

  // Returns readings at a fixed cadence across [from, to]. Metrics this
  // provider cannot measure are simply absent from the result.
  read(patientId, { from, to = new Date(), intervalMs = this.intervalMs } = {}) {
    const end = toEpochMs(to);
    const start = from === undefined ? end - 24 * MS_PER_HOUR : toEpochMs(from);
    const step = Number(intervalMs);

    if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(step) || step <= 0) {
      return [];
    }

    const readings = [];
    let sampleTimes = 0;
    for (
      let timestamp = start;
      timestamp <= end && sampleTimes < MAX_SAMPLE_TIMES_PER_CALL;
      timestamp += step
    ) {
      sampleTimes += 1;
      for (const metric of this.supportedMetrics) {
        const reading = createReading({
          metric,
          value: simulatedValue(String(patientId ?? ""), metric, timestamp),
          measuredAt: new Date(timestamp).toISOString(),
          source: READING_SOURCES.DEVICE,
          providerId: this.id,
          simulated: true,
        });
        if (reading) {
          readings.push(reading);
        }
      }
    }

    return readings;
  }
}

export const simulatedVitalsProvider = new SimulatedVitalsProvider();

// Deterministic value for (patient, metric, time): a diurnal sine, a slow
// day-over-day drift, and a small deterministic jitter. Same inputs always
// produce the same number, so the series is consistent rather than random.
function simulatedValue(patientId, metric, timestamp) {
  const model = METRIC_MODELS[metric];
  if (!model) {
    return null;
  }

  const personOffset = (hash(`${patientId}:${metric}`) % 1000) / 1000;
  const hourOfDay = (timestamp % (24 * MS_PER_HOUR)) / MS_PER_HOUR;
  const dayIndex = Math.floor(timestamp / (24 * MS_PER_HOUR));

  const diurnal = Math.sin(((hourOfDay - model.peakHour) / 24) * 2 * Math.PI) * model.diurnal;
  const drift = Math.sin((dayIndex / 30 + personOffset) * 2 * Math.PI) * model.drift;
  const jitter = ((hash(`${patientId}:${metric}:${timestamp}`) % 200) / 100 - 1) * model.jitter;
  const personBias = (personOffset - 0.5) * model.diurnal;

  const value = model.centre + personBias + diurnal + drift + jitter;
  const factor = Math.pow(10, model.decimals);
  return Math.round(value * factor) / factor;
}

function toEpochMs(value) {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === "number") {
    return value;
  }
  return Date.parse(String(value));
}

function hash(text) {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return Math.abs(value);
}
