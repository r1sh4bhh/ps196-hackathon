import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearReadings,
  connectProvider,
  disconnectProvider,
  getConnectedProviderId,
  listReadings,
  saveReadings,
} from "../vitalsReadingStore";
import { createReading } from "../../vitals/vitalsProvider";

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

describe("vitalsReadingStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("persists provenance with each reading", () => {
    saveReadings("P001", [deviceReading("heart_rate", 70, "2024-05-01T08:00:00.000Z")]);

    const [stored] = listReadings("P001");
    expect(stored).toEqual({
      metric: "heart_rate",
      value: 70,
      measuredAt: "2024-05-01T08:00:00.000Z",
      source: "device",
      providerId: "simulated",
      simulated: true,
    });
  });

  it("rejects readings that do not satisfy the reading contract", () => {
    saveReadings("P001", [
      { metric: "heart_rate", value: 70, measuredAt: "2024-05-01T08:00:00.000Z", source: "device" },
      { metric: "spo2", value: 98, measuredAt: "2024-05-01T08:00:00.000Z" },
      null,
    ]);

    // The first entry claims a device source but records no provider, so it
    // cannot be attributed honestly and is discarded rather than being
    // relabelled as manual; the second names a metric the app does not track.
    expect(listReadings("P001")).toEqual([]);
  });

  it("treats stored readings with no source recorded as manual", () => {
    localStorage.setItem(
      "ps196_vitals_readings",
      JSON.stringify({
        schemaVersion: 1,
        readings: {
          P001: [{ metric: "systolic_bp", value: 128, measuredAt: "2023-01-01T08:00:00.000Z" }],
        },
        connections: {},
      })
    );

    const [legacy] = listReadings("P001");
    expect(legacy.source).toBe("manual");
    expect(legacy.providerId).toBe("manual-entry");
    expect(legacy.simulated).toBe(false);
  });

  it("does not let one person's device readings appear for another", () => {
    saveReadings("P001", [deviceReading("heart_rate", 70, "2024-05-01T08:00:00.000Z")]);
    saveReadings("P002", [deviceReading("heart_rate", 90, "2024-05-01T08:00:00.000Z")]);
    connectProvider("P001", "simulated");

    expect(listReadings("P001").map((entry) => entry.value)).toEqual([70]);
    expect(listReadings("P002").map((entry) => entry.value)).toEqual([90]);
    expect(getConnectedProviderId("P002")).toBeNull();
    expect(listReadings("P003")).toEqual([]);
  });

  it("de-duplicates repeated syncs of the same window", () => {
    const reading = deviceReading("heart_rate", 70, "2024-05-01T08:00:00.000Z");
    saveReadings("P001", [reading]);
    const accepted = saveReadings("P001", [reading]);

    expect(accepted).toEqual([]);
    expect(listReadings("P001")).toHaveLength(1);
  });

  it("keeps readings and their simulated marking after disconnecting", () => {
    saveReadings("P001", [deviceReading("heart_rate", 70, "2024-05-01T08:00:00.000Z")]);
    connectProvider("P001", "simulated");

    expect(getConnectedProviderId("P001")).toBe("simulated");
    disconnectProvider("P001");

    expect(getConnectedProviderId("P001")).toBeNull();
    const stored = listReadings("P001");
    expect(stored).toHaveLength(1);
    expect(stored[0].simulated).toBe(true);
    expect(stored[0].source).toBe("device");
  });

  it("clears readings only for the requested person", () => {
    saveReadings("P001", [deviceReading("heart_rate", 70, "2024-05-01T08:00:00.000Z")]);
    saveReadings("P002", [deviceReading("heart_rate", 90, "2024-05-01T08:00:00.000Z")]);

    clearReadings("P001");

    expect(listReadings("P001")).toEqual([]);
    expect(listReadings("P002")).toHaveLength(1);
  });

  it("degrades to empty rather than throwing on malformed storage", () => {
    localStorage.setItem("ps196_vitals_readings", "not json");

    expect(listReadings("P001")).toEqual([]);
    expect(getConnectedProviderId("P001")).toBeNull();
  });
});
