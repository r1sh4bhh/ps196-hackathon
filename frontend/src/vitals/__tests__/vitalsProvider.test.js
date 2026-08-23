import { describe, expect, it } from "vitest";
import {
  MANUAL_PROVIDER_ID,
  READING_SOURCES,
  VITALS_METRICS,
  createReading,
  isValidReading,
  normalizeStoredReading,
  validateProvider,
} from "../vitalsProvider";

const measuredAt = "2024-05-01T08:00:00.000Z";

function reading(overrides = {}) {
  return {
    metric: "heart_rate",
    value: 72,
    measuredAt,
    source: READING_SOURCES.DEVICE,
    providerId: "simulated",
    simulated: true,
    ...overrides,
  };
}

// A provider that reports only two of the tracked metrics: absence is
// expressed by reporting nothing, never a zero or a placeholder.
const partialProvider = {
  id: "partial-test-provider",
  label: "Partial test provider",
  simulated: true,
  supportedMetrics: ["systolic_bp", "diastolic_bp"],
  read(patientId) {
    return this.supportedMetrics.map((metric) =>
      createReading({
        metric,
        value: metric === "systolic_bp" ? 120 : 80,
        measuredAt,
        source: READING_SOURCES.DEVICE,
        providerId: this.id,
        simulated: true,
        patientId,
      })
    );
  },
};

describe("vitals provider contract", () => {
  it("accepts a well-formed reading with full provenance", () => {
    const created = createReading(reading());

    expect(created).toEqual({
      metric: "heart_rate",
      value: 72,
      measuredAt,
      source: "device",
      providerId: "simulated",
      simulated: true,
    });
  });

  it("rejects readings that are missing provenance or a real value", () => {
    expect(createReading(reading({ value: null }))).toBeNull();
    expect(createReading(reading({ value: "" }))).toBeNull();
    expect(createReading(reading({ metric: "spo2" }))).toBeNull();
    expect(createReading(reading({ source: "guessed" }))).toBeNull();
    expect(createReading(reading({ providerId: "" }))).toBeNull();
    expect(createReading(reading({ simulated: "yes" }))).toBeNull();
    expect(createReading(reading({ measuredAt: "not-a-date" }))).toBeNull();
    expect(isValidReading(undefined)).toBe(false);
  });

  it("validates a provider against the interface", () => {
    expect(validateProvider(partialProvider).valid).toBe(true);
    expect(validateProvider({}).valid).toBe(false);
    expect(validateProvider({ ...partialProvider, supportedMetrics: ["spo2"] }).valid).toBe(false);
    expect(validateProvider({ ...partialProvider, read: undefined }).valid).toBe(false);
  });

  it("reports nothing at all for a metric a provider cannot measure", () => {
    const readings = partialProvider.read("P001");
    const metrics = readings.map((entry) => entry.metric);

    expect(metrics).toEqual(["systolic_bp", "diastolic_bp"]);
    for (const metric of VITALS_METRICS) {
      if (!partialProvider.supportedMetrics.includes(metric)) {
        expect(readings.some((entry) => entry.metric === metric)).toBe(false);
      }
    }
  });

  it("treats a stored reading with no source as manual, never as device data", () => {
    const legacy = normalizeStoredReading({ metric: "systolic_bp", value: 130, measuredAt });

    expect(legacy.source).toBe(READING_SOURCES.MANUAL);
    expect(legacy.providerId).toBe(MANUAL_PROVIDER_ID);
    expect(legacy.simulated).toBe(false);
  });
});
