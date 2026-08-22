import React from "react";
import BaselineComparison from "../BaselineComparison/BaselineComparison";
import "./dashboardShell.css";

export default function DashboardShell({
  patientData,
  prediction,
  baselineCurrent,
  baselineData,
  onBackToForm,
}) {
  if (!prediction) {
    return (
      <div className="dashboard-empty">
        <p>No prediction available yet.</p>
        <button className="btn-secondary" onClick={onBackToForm}>
          Back to Form
        </button>
      </div>
    );
  }

  return (
    <div className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <h1>Risk Dashboard</h1>
          <p className="subtitle">
            Patient {patientData?.patientId} - Top risk: <strong>{prediction.top_disease}</strong> (
            {Math.round(prediction.confidence * 100)}% confidence)
          </p>
        </div>
        <button className="btn-secondary" onClick={onBackToForm}>
          New Entry
        </button>
      </header>

      <section className="summary-cards">
        {Object.entries(prediction.risk_scores).map(([disease, score]) => (
          <div className="summary-card" key={disease}>
            <span className="disease-name">{disease.replace(/_/g, " ")}</span>
            <span className="risk-value">{Math.round(score * 100)}%</span>
          </div>
        ))}
      </section>

      <section className="visualization-slot" data-owner="shivangi">
        <p className="placeholder-note">
          Visualization components (trajectory chart, evidence panel) will be integrated here.
        </p>
      </section>

      <section className="visualization-slot" data-owner="shivangi">
        <BaselineComparison current={baselineCurrent} baseline={baselineData} />
      </section>
    </div>
  );
}
