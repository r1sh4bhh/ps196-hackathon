import { describe, expect, it } from "vitest";
import {
  MIN_READINGS_PER_DAY,
  aggregateDailyReadings,
  buildBaselineHistory,
  dailyAggregatesToObservations,
  describeAggregate,
} from "../aggregateDailyReadings";
import { createReading } from "../vitalsProvider";
import {
  MIN_OBSERVATIONS,
  computeAllBaselines,
  describeBaselineSources,
} from "../../utils/baseline";

function deviceReading(metric, value, measuredAt, overrides = {}) {
  return createReading({
    metric,
    value,
    measuredAt,
    source: "device",
    providerId: "simulated",
    simulated: true,
    ...overrides,
  });
}

// A full day of readings, every 15 minutes, for one metric.
function dayOfReadings(day, metric, baseValue, { count = 48 } = {}) {
  return Array.from({ length: count }, (_, index) => {
    const minutes = index * 15;
    const hour = String(Math.floor(minutes / 60)).padStart(2, "0");
    const minute = String(minutes % 60).padStart(2, "0");
    return deviceReading(metric, baseValue + (index % 5) - 2, `${day}T${hour}:${minute}:00.000Z`);
  });
}

describe("aggregateDailyReadings", () => {
  it("collapses many same-day readings into one value per metric per day", () => {
    const readings = [
      ...dayOfReadings("2024-05-01", "heart_rate", 70),
      ...dayOfReadings("2024-05-01", "systolic_bp", 120),
      ...dayOfReadings("2024-05-02", "heart_rate", 74),
    ];

    const aggregates = aggregateDailyReadings(readings);

    expect(aggregates).toHaveLength(3);
    expect(aggregates.map((entry) => `${entry.day}:${entry.metric}`)).toEqual([
      "2024-05-01:heart_rate",
      "2024-05-01:systolic_bp",
      "2024-05-02:heart_rate",
    ]);
  });

  it("uses the median so a single artefact cannot move the day's value", () => {
    const readings = [
      deviceReading("heart_rate", 70, "2024-05-01T08:00:00.000Z"),
      deviceReading("heart_rate", 72, "2024-05-01T09:00:00.000Z"),
      deviceReading("heart_rate", 205, "2024-05-01T10:00:00.000Z"),
    ];

    const [aggregate] = aggregateDailyReadings(readings);

    expect(aggregate.value).toBe(72);
  });

  it("retains how many readings a value came from and the period they span", () => {
    const aggregates = aggregateDailyReadings(dayOfReadings("2024-05-01", "heart_rate", 70));

    expect(aggregates[0].readingCount).toBe(48);
    expect(aggregates[0].firstReadingAt).toBe("2024-05-01T00:00:00.000Z");
    expect(aggregates[0].lastReadingAt).toBe("2024-05-01T11:45:00.000Z");
    expect(describeAggregate(aggregates[0])).toContain("Simulated device data");
    expect(describeAggregate(aggregates[0])).toContain("median of 48 readings");
  });

  it("excludes under-sampled days by default and marks them when surfaced", () => {
    const readings = [
      deviceReading("heart_rate", 70, "2024-05-01T08:00:00.000Z"),
      deviceReading("heart_rate", 72, "2024-05-01T09:00:00.000Z"),
    ];

    expect(readings.length).toBeLessThan(MIN_READINGS_PER_DAY);
    expect(aggregateDailyReadings(readings)).toEqual([]);

    const [surfaced] = aggregateDailyReadings(readings, { includeUnderSampled: true });
    expect(surfaced.underSampled).toBe(true);
    expect(describeAggregate(surfaced)).toContain("too few to represent it");
  });

  it("keeps the simulated marking on the aggregated value", () => {
    const [aggregate] = aggregateDailyReadings(dayOfReadings("2024-05-01", "heart_rate", 70));

    expect(aggregate.simulated).toBe(true);
    expect(aggregate.source).toBe("device");
    expect(aggregate.providerId).toBe("simulated");
  });

  it("ignores manual readings, which reach the baseline through assessments", () => {
    const readings = [
      createReading({
        metric: "heart_rate",
        value: 70,
        measuredAt: "2024-05-01T08:00:00.000Z",
        source: "manual",
        providerId: "manual-entry",
        simulated: false,
      }),
    ];

    expect(aggregateDailyReadings(readings, { includeUnderSampled: true })).toEqual([]);
  });
});

describe("device readings as baseline observations", () => {
  it("does not satisfy the 24-hour span requirement from a single day of readings", () => {
    const readings = [
      ...dayOfReadings("2024-05-01", "heart_rate", 70, { count: 90 }),
      ...dayOfReadings("2024-05-01", "systolic_bp", 120, { count: 90 }),
    ];

    expect(readings).toHaveLength(180);

    const history = buildBaselineHistory([], readings);
    const baselines = computeAllBaselines(history, { vitals: { heart_rate: 71 } });

    expect(history).toHaveLength(1);
    expect(baselines.heart_rate.observations).toBe(1);
    expect(baselines.heart_rate.status).toBe("establishing");
    expect(baselines.heart_rate.baseline).toBeNull();
  });

  it("counts each aggregated device day as exactly one observation", () => {
    const readings = ["2024-05-01", "2024-05-02", "2024-05-03"].flatMap((day, index) =>
      dayOfReadings(day, "heart_rate", 70 + index)
    );

    const history = buildBaselineHistory([], readings);
    const baselines = computeAllBaselines(history, { vitals: { heart_rate: 75 } });

    expect(history).toHaveLength(3);
    expect(baselines.heart_rate.observations).toBe(MIN_OBSERVATIONS);
    expect(baselines.heart_rate.status).toBe("established");
    expect(baselines.heart_rate.sources).toEqual({ manual: 0, device: 3, simulated: 3 });
  });

  it("discloses a mix of manual and device observations rather than hiding it", () => {
    const assessments = [
      {
        timestamp: "2024-05-01T09:00:00.000Z",
        patientData: { vitals: { heart_rate: 68 } },
      },
      {
        timestamp: "2024-05-02T09:00:00.000Z",
        patientData: { vitals: { heart_rate: 69 } },
      },
    ];
    const readings = dayOfReadings("2024-05-04", "heart_rate", 72);

    const history = buildBaselineHistory(assessments, readings);
    const baselines = computeAllBaselines(history, { vitals: { heart_rate: 75 } });
    const description = describeBaselineSources(baselines.heart_rate);

    expect(baselines.heart_rate.sources).toEqual({ manual: 2, device: 1, simulated: 1 });
    expect(description).toContain("1 aggregated simulated device daily value");
    expect(description).toContain("2 manually entered readings");
    expect(description).toContain("synthetic");
  });

  it("says nothing extra when every observation was entered by hand", () => {
    const assessments = [
      { timestamp: "2024-05-01T09:00:00.000Z", patientData: { vitals: { heart_rate: 68 } } },
    ];
    const baselines = computeAllBaselines(assessments, { vitals: { heart_rate: 70 } });

    expect(baselines.heart_rate.sources).toEqual({ manual: 1, device: 0, simulated: 0 });
    expect(describeBaselineSources(baselines.heart_rate)).toBe("");
  });

  it("groups the metrics measured on one day into a single observation", () => {
    const observations = dailyAggregatesToObservations(
      aggregateDailyReadings([
        ...dayOfReadings("2024-05-01", "heart_rate", 70),
        ...dayOfReadings("2024-05-01", "systolic_bp", 120),
      ])
    );

    expect(observations).toHaveLength(1);
    expect(Object.keys(observations[0].patientData.vitals).sort()).toEqual([
      "heart_rate",
      "systolic_bp",
    ]);
    expect(observations[0].simulated).toBe(true);
    expect(observations[0].source).toBe("device");
  });
});
