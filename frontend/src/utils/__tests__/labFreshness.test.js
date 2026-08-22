import { describe, expect, it } from "vitest";
import {
  formatStoredLabAge,
  getStoredLabStatus,
  LAB_FRESHNESS_DAYS,
} from "../labFreshness";

const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date("2026-08-22T12:00:00.000Z");

function recordAtAge(days, extraMs = 0) {
  return {
    value: 100,
    recordedAt: new Date(now.getTime() - days * DAY_MS - extraMs).toISOString(),
  };
}

describe("lab freshness", () => {
  it.each(Object.entries(LAB_FRESHNESS_DAYS))(
    "treats %s as fresh at its %i-day boundary and stale immediately after",
    (labKey, freshnessDays) => {
      expect(getStoredLabStatus(labKey, recordAtAge(freshnessDays), now).isFresh).toBe(true);
      expect(getStoredLabStatus(labKey, recordAtAge(freshnessDays, 1), now).isFresh).toBe(false);
    }
  );

  it("formats the recorded date and elapsed age accurately", () => {
    expect(formatStoredLabAge(recordAtAge(8), now)).toBe("from 14 Aug (8 days ago)");
  });

  it("rejects malformed stored records", () => {
    expect(getStoredLabStatus("glucose", { value: "bad", recordedAt: "not-a-date" }, now)).toBeNull();
  });
});
