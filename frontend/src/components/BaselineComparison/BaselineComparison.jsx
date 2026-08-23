import React from "react";
import {
  BASELINE_METRICS,
  describeBaselineProvenance,
  describeBaselineSources,
} from "../../utils/baseline";
import { formatMeasurement as formatValueWithUnit } from "../../utils/format";
import "./baselineComparison.css";

const BASELINE_STATUS_LABELS = {
  establishing: "Personal baseline is still being established",
  insufficient_span: "Not yet established - readings span too short a period",
};

export default function BaselineComparison({ current, baseline }) {
  if (!baseline) {
    return (
      <div className="baseline-empty">
        No baseline recorded yet. Future check-ins will show trend comparisons here.
      </div>
    );
  }

  const metrics = Object.keys(current);

  return (
    <div className="baseline-comparison">
      <div className="baseline-header">
        <h3>Personal Health Baseline</h3>
        <span className="baseline-date">Since {baseline.recordedAt}</span>
      </div>
      <table className="baseline-table">
        <thead>
          <tr>
            <th>Condition</th>
            <th>Baseline</th>
            <th>Current</th>
            <th>Change</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((metric) => {
            const baseVal = baseline.risk_scores[metric] ?? 0;
            const currVal = current[metric];
            const isPersonalBaseline = typeof baseVal === "object" && baseVal !== null;
            const comparison = isPersonalBaseline ? baseVal : null;
            const delta = isPersonalBaseline ? comparison.difference : currVal - baseVal;
            const notEstablished =
              comparison?.status === "establishing" || comparison?.status === "insufficient_span";

            return (
              <tr key={metric}>
                <td className="disease-name">
                  {isPersonalBaseline ? BASELINE_METRICS[metric]?.label : formatDiseaseName(metric)}
                </td>
                <td>
                  {notEstablished
                    ? BASELINE_STATUS_LABELS[comparison.status]
                    : isPersonalBaseline
                      ? formatMeasurement(comparison.baseline, metric)
                      : `${Math.round(baseVal * 100)}%`}
                  {isPersonalBaseline ? (
                    <div className="baseline-provenance">
                      {describeBaselineProvenance(comparison)}
                    </div>
                  ) : null}
                  {isPersonalBaseline && describeBaselineSources(comparison) ? (
                    <div
                      className={`baseline-source-note${
                        comparison.sources.simulated > 0 ? " baseline-source-simulated" : ""
                      }`}
                    >
                      {describeBaselineSources(comparison)}
                    </div>
                  ) : null}
                  {comparison?.clustered ? (
                    <div className="baseline-cluster-note">
                      Weighted toward one period - most of these readings were taken close
                      together.
                    </div>
                  ) : null}
                </td>
                <td>
                  {isPersonalBaseline
                    ? formatMeasurement(currVal, metric)
                    : `${Math.round(currVal * 100)}%`}
                </td>
                <td className={delta > 0 ? "delta-up" : delta < 0 ? "delta-down" : "delta-flat"}>
                  {comparison?.status !== "established"
                    ? "-"
                    : delta === 0
                      ? "-"
                      : isPersonalBaseline
                        ? `${delta > 0 ? "+" : ""}${formatMeasurement(delta, metric)}`
                        : `${delta > 0 ? "+" : ""}${Math.round(delta * 100)}%`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatDiseaseName(disease) {
  return disease.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

// Display only: values such as a computed BMI arrive at full float precision
// (29.069767441860467) and are rounded here, never upstream, so comparisons
// and deltas keep using the exact numbers.
function formatMeasurement(value, metric) {
  return formatValueWithUnit(value, BASELINE_METRICS[metric]?.unit);
}
