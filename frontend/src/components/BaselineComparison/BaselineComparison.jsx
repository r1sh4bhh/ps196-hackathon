import React from "react";
import "./baselineComparison.css";

export default function BaselineComparison({ current, baseline }) {
  if (!baseline) {
    return (
      <div className="baseline-empty">
        No baseline recorded yet. Future check-ins will show trend comparisons
        here.
      </div>
    );
  }

  const diseases = Object.keys(current);

  return (
    <div className="baseline-comparison">
      <div className="baseline-header">
        <h3>Baseline Comparison</h3>
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
          {diseases.map((disease) => {
            const baseVal = baseline.risk_scores[disease] ?? 0;
            const currVal = current[disease];
            const delta = currVal - baseVal;

            return (
              <tr key={disease}>
                <td className="disease-name">{formatDiseaseName(disease)}</td>
                <td>{Math.round(baseVal * 100)}%</td>
                <td>{Math.round(currVal * 100)}%</td>
                <td
                  className={
                    delta > 0 ? "delta-up" : delta < 0 ? "delta-down" : "delta-flat"
                  }
                >
                  {delta === 0
                    ? "-"
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
