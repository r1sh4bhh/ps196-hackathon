import React from "react";
import { BASELINE_METRICS } from "../../utils/baseline";
import "./baselineComparison.css";

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

            return (
              <tr key={metric}>
                <td className="disease-name">
                  {isPersonalBaseline ? BASELINE_METRICS[metric]?.label : formatDiseaseName(metric)}
                </td>
                <td>
                  {comparison?.status === "establishing"
                    ? "Personal baseline is still being established"
                    : isPersonalBaseline
                      ? formatMeasurement(comparison.baseline, metric)
                      : `${Math.round(baseVal * 100)}%`}
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

function formatMeasurement(value, metric) {
  if (value === null || value === undefined) {
    return "—";
  }
  return `${value} ${BASELINE_METRICS[metric]?.unit || ""}`.trim();
}
