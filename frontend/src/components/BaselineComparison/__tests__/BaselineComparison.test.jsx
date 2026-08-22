import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import BaselineComparison from "../BaselineComparison";
import { computeBaseline } from "../../../utils/baseline";

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days) {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

function minutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

let container;
let root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(props) {
  act(() => {
    root.render(<BaselineComparison {...props} />);
  });
  return container;
}

describe("BaselineComparison", () => {
  it("shows the empty state with no baseline", () => {
    const dom = render({ current: {}, baseline: null });

    expect(dom.querySelector(".baseline-empty")).not.toBeNull();
    expect(dom.textContent).toContain("No baseline recorded yet");
  });

  it("shows a distinct not-yet-established message when the span is too short", () => {
    const comparison = computeBaseline(
      "systolic_bp",
      [
        { value: 118, timestamp: minutesAgo(4) },
        { value: 121, timestamp: minutesAgo(2) },
        { value: 119, timestamp: minutesAgo(0) },
      ],
      130
    );

    const dom = render({
      current: { systolic_bp: 130 },
      baseline: { recordedAt: "today", risk_scores: { systolic_bp: comparison } },
    });

    expect(dom.textContent).toContain("span too short a period");
    expect(dom.textContent).toContain("span under 24 hours");
    expect(dom.querySelector(".delta-up")).toBeNull();
  });

  it("shows reading count and elapsed span for an established baseline", () => {
    const comparison = computeBaseline(
      "systolic_bp",
      [
        { value: 118, timestamp: daysAgo(12) },
        { value: 120, timestamp: daysAgo(6) },
        { value: 121, timestamp: daysAgo(0) },
      ],
      130
    );

    const dom = render({
      current: { systolic_bp: 130 },
      baseline: { recordedAt: "today", risk_scores: { systolic_bp: comparison } },
    });

    expect(dom.textContent).toContain("Baseline from 3 readings over 12 days");
  });

  it("surfaces a clustering note without suppressing the baseline", () => {
    const comparison = computeBaseline(
      "systolic_bp",
      [
        { value: 118, timestamp: minutesAgo(9) },
        { value: 119, timestamp: minutesAgo(6) },
        { value: 120, timestamp: minutesAgo(3) },
        { value: 121, timestamp: minutesAgo(0) },
        { value: 122, timestamp: daysAgo(7) },
      ],
      130
    );

    const dom = render({
      current: { systolic_bp: 130 },
      baseline: { recordedAt: "today", risk_scores: { systolic_bp: comparison } },
    });

    expect(comparison.status).toBe("established");
    expect(dom.textContent).toContain("Weighted toward one period");
    expect(dom.querySelector(".delta-up")).not.toBeNull();
  });
});
