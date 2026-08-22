import { describe, expect, it } from "vitest";
import {
  computeAllBaselines,
  computeBaseline,
  describeBaselineProvenance,
  MIN_BASELINE_SPAN_MS,
} from "../baseline";

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days) {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

function minutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

describe("computeBaseline", () => {
  it("returns unavailable without history", () => {
    const result = computeBaseline("systolic_bp", [], 138);

    expect(result.status).toBe("unavailable");
    expect(result.baseline).toBeNull();
    expect(result.difference).toBeNull();
  });

  it("does not fabricate a baseline from one or two observations", () => {
    const result = computeBaseline(
      "systolic_bp",
      [
        { value: 118, timestamp: daysAgo(10) },
        { value: 121, timestamp: daysAgo(1) },
      ],
      130
    );

    expect(result.status).toBe("establishing");
    expect(result.baseline).toBeNull();
    expect(result.difference).toBeNull();
  });

  it("computes an established baseline, difference, and percentage change", () => {
    const history = [
      { value: 118, timestamp: daysAgo(20) },
      { value: 120, timestamp: daysAgo(15) },
      { value: 117, timestamp: daysAgo(10) },
      { value: 119, timestamp: daysAgo(5) },
      { value: 121, timestamp: daysAgo(0) },
    ];
    const result = computeBaseline("systolic_bp", history, 138);

    expect(result.status).toBe("established");
    expect(result.baseline).toBe(119);
    expect(result.recentBaseline).toBe(119);
    expect(result.difference).toBe(19);
    expect(result.percentage_change).toBe(15.97);
    expect(result.spanDays).toBe(20);
  });

  it("uses the dead-band for values at the baseline", () => {
    const result = computeBaseline(
      "systolic_bp",
      [
        { value: 120, timestamp: daysAgo(5) },
        { value: 120, timestamp: daysAgo(2) },
        { value: 120, timestamp: daysAgo(0) },
      ],
      120
    );

    expect(result.direction).toBe("at_baseline");
  });

  describe("minimum time span", () => {
    it("does not establish when the count is met but the span is under 24 hours", () => {
      const result = computeBaseline(
        "systolic_bp",
        [
          { value: 118, timestamp: minutesAgo(4) },
          { value: 121, timestamp: minutesAgo(2) },
          { value: 119, timestamp: minutesAgo(0) },
        ],
        130
      );

      expect(result.status).toBe("insufficient_span");
      expect(result.status).not.toBe("establishing");
      expect(result.status).not.toBe("unavailable");
      expect(result.baseline).toBeNull();
      expect(result.difference).toBeNull();
    });

    it("establishes once both the count and the 24h span are met", () => {
      const result = computeBaseline(
        "systolic_bp",
        [
          { value: 118, timestamp: daysAgo(2) },
          { value: 121, timestamp: daysAgo(1) },
          { value: 119, timestamp: daysAgo(0) },
        ],
        130
      );

      expect(result.status).toBe("established");
      expect(result.baseline).not.toBeNull();
    });

    it("treats the not-established (insufficient span) state as distinct from no data at all", () => {
      const noData = computeBaseline("systolic_bp", [], 130);
      const tooShortSpan = computeBaseline(
        "systolic_bp",
        [
          { value: 118, timestamp: minutesAgo(4) },
          { value: 121, timestamp: minutesAgo(2) },
          { value: 119, timestamp: minutesAgo(0) },
        ],
        130
      );

      expect(noData.status).toBe("unavailable");
      expect(tooShortSpan.status).toBe("insufficient_span");
      expect(noData.status).not.toBe(tooShortSpan.status);
    });

    it("exposes MIN_BASELINE_SPAN_MS as 24 hours", () => {
      expect(MIN_BASELINE_SPAN_MS).toBe(24 * 60 * 60 * 1000);
    });
  });

  describe("describeBaselineProvenance", () => {
    it("reports reading count and elapsed span for an established baseline", () => {
      const result = computeBaseline(
        "systolic_bp",
        [
          { value: 118, timestamp: daysAgo(12) },
          { value: 120, timestamp: daysAgo(6) },
          { value: 121, timestamp: daysAgo(0) },
        ],
        130
      );

      expect(result.observations).toBe(3);
      expect(result.spanDays).toBe(12);
      expect(describeBaselineProvenance(result)).toBe("Baseline from 3 readings over 12 days.");
    });

    it("names the missing span concretely when the count is met but the span is not", () => {
      const result = computeBaseline(
        "systolic_bp",
        [
          { value: 118, timestamp: minutesAgo(4) },
          { value: 121, timestamp: minutesAgo(2) },
          { value: 119, timestamp: minutesAgo(0) },
        ],
        130
      );

      expect(describeBaselineProvenance(result)).toContain("span under 24 hours");
    });
  });

  describe("clustered readings", () => {
    it("flags a baseline dominated by one sitting even though the span is met", () => {
      const history = [
        { value: 118, timestamp: minutesAgo(9) },
        { value: 119, timestamp: minutesAgo(6) },
        { value: 120, timestamp: minutesAgo(3) },
        { value: 121, timestamp: minutesAgo(0) },
        { value: 122, timestamp: daysAgo(7) },
      ];
      const result = computeBaseline("systolic_bp", history, 130);

      expect(result.status).toBe("established");
      expect(result.clustered).toBe(true);
    });

    it("does not flag an evenly spread set of readings", () => {
      const history = [
        { value: 118, timestamp: daysAgo(28) },
        { value: 119, timestamp: daysAgo(21) },
        { value: 120, timestamp: daysAgo(14) },
        { value: 121, timestamp: daysAgo(7) },
        { value: 122, timestamp: daysAgo(0) },
      ];
      const result = computeBaseline("systolic_bp", history, 130);

      expect(result.status).toBe("established");
      expect(result.clustered).toBe(false);
    });
  });

  describe("time-aware trend", () => {
    it.each([
      [[100, 101, 110, 111], "rising"],
      [[111, 110, 101, 100], "falling"],
      [[100, 101, 100, 101], "stable"],
    ])("reports a %s trend as %s", (values, trend) => {
      const days = [30, 20, 10, 0];
      const history = values.map((value, index) => ({ value, timestamp: daysAgo(days[index]) }));
      const result = computeBaseline("systolic_bp", history, 120);

      expect(result.trend).toBe(trend);
    });

    it("reports unknown trend with fewer than four observations", () => {
      const result = computeBaseline(
        "systolic_bp",
        [
          { value: 100, timestamp: daysAgo(2) },
          { value: 101, timestamp: daysAgo(1) },
          { value: 102, timestamp: daysAgo(0) },
        ],
        120
      );

      expect(result.trend).toBe("unknown");
    });

    it("computes the split from elapsed time, not array position", () => {
      // Three old, low readings (60/50/40 days ago) followed in the array
      // by one very recent, high reading placed *first*. A position-based
      // split (first half of the array vs second half) would pair the
      // recent reading with an old one as the "older" half and the other
      // two old readings as the "newer" half, averaging out to "falling".
      // A time-based split correctly groups all three old readings
      // together (they sit before the time midpoint) against the single
      // recent one, reporting "rising".
      const history = [
        { value: 200, timestamp: daysAgo(0.01) },
        { value: 100, timestamp: daysAgo(60) },
        { value: 101, timestamp: daysAgo(50) },
        { value: 102, timestamp: daysAgo(40) },
      ];
      const result = computeBaseline("systolic_bp", history, 120);

      expect(result.trend).toBe("rising");
    });

    it("omits trend when the span is insufficient", () => {
      const result = computeBaseline(
        "systolic_bp",
        [
          { value: 100, timestamp: minutesAgo(9) },
          { value: 101, timestamp: minutesAgo(6) },
          { value: 102, timestamp: minutesAgo(3) },
          { value: 103, timestamp: minutesAgo(0) },
        ],
        120
      );

      expect(result.status).toBe("insufficient_span");
      expect(result.trend).toBe("unknown");
    });

    it("omits trend when readings are clustered", () => {
      const history = [
        { value: 100, timestamp: minutesAgo(9) },
        { value: 101, timestamp: minutesAgo(6) },
        { value: 102, timestamp: minutesAgo(3) },
        { value: 103, timestamp: minutesAgo(0) },
        { value: 200, timestamp: daysAgo(7) },
      ];
      const result = computeBaseline("systolic_bp", history, 120);

      expect(result.clustered).toBe(true);
      expect(result.trend).toBe("unknown");
    });
  });

  it("ignores null, missing, and non-numeric values", () => {
    expect(() =>
      computeBaseline("glucose", [{ value: null }, {}, { value: "no" }], "no")
    ).not.toThrow();
    expect(computeBaseline("glucose", [{ value: null }, { value: "no" }], "no").status).toBe(
      "unavailable"
    );
    expect(() =>
      computeAllBaselines([{ patientData: {} }, null], { patientData: {} })
    ).not.toThrow();
  });
});
