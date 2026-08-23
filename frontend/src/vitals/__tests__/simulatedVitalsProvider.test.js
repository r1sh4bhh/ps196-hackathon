import { describe, expect, it } from "vitest";
import { SimulatedVitalsProvider, simulatedVitalsProvider } from "../simulatedVitalsProvider";
import { validateProvider } from "../vitalsProvider";

const from = "2024-05-01T00:00:00.000Z";
const to = "2024-05-01T06:00:00.000Z";

describe("SimulatedVitalsProvider", () => {
  it("satisfies the provider contract and declares itself simulated", () => {
    expect(validateProvider(simulatedVitalsProvider).valid).toBe(true);
    expect(simulatedVitalsProvider.simulated).toBe(true);
    expect(simulatedVitalsProvider.label.toLowerCase()).toContain("simulated");
  });

  it("marks every reading as simulated at the data level", () => {
    const readings = simulatedVitalsProvider.read("P001", { from, to });

    expect(readings.length).toBeGreaterThan(0);
    expect(readings.every((reading) => reading.simulated === true)).toBe(true);
    expect(readings.every((reading) => reading.source === "device")).toBe(true);
    expect(readings.every((reading) => reading.providerId === "simulated")).toBe(true);
  });

  it("omits metrics it cannot measure rather than inventing them", () => {
    const readings = simulatedVitalsProvider.read("P001", { from, to });

    expect(simulatedVitalsProvider.supportedMetrics).not.toContain("weight_kg");
    expect(readings.some((reading) => reading.metric === "weight_kg")).toBe(false);
  });

  it("produces physiologically plausible values", () => {
    const readings = simulatedVitalsProvider.read("P001", { from, to });
    const ranges = {
      systolic_bp: [95, 145],
      diastolic_bp: [60, 95],
      heart_rate: [45, 100],
      temperature: [97, 100],
    };

    for (const reading of readings) {
      const [low, high] = ranges[reading.metric];
      expect(reading.value).toBeGreaterThanOrEqual(low);
      expect(reading.value).toBeLessThanOrEqual(high);
    }
  });

  it("is deterministic and consistent over time, not random per call", () => {
    const first = simulatedVitalsProvider.read("P001", { from, to });
    const second = simulatedVitalsProvider.read("P001", { from, to });

    expect(second).toEqual(first);

    const heartRates = first
      .filter((reading) => reading.metric === "heart_rate")
      .map((reading) => reading.value);
    const steps = heartRates.slice(1).map((value, index) => Math.abs(value - heartRates[index]));
    expect(Math.max(...steps)).toBeLessThan(15);
  });

  it("gives different people different traces", () => {
    const first = simulatedVitalsProvider.read("P001", { from, to });
    const second = simulatedVitalsProvider.read("P002", { from, to });

    expect(second).not.toEqual(first);
  });

  it("returns nothing for an unusable window", () => {
    const provider = new SimulatedVitalsProvider();

    expect(provider.read("P001", { from: "nonsense", to })).toEqual([]);
    expect(provider.read("P001", { from, to, intervalMs: 0 })).toEqual([]);
  });
});
