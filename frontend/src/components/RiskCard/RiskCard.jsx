import React from "react";
import "./riskCard.css";

export default function RiskCard({ disease, score, isTopDisease = false }) {
  const percentage = Math.round(score * 100);
  const severity = getSeverity(score);

  return (
    <div
      className={`risk-card severity-${severity} ${
        isTopDisease ? "risk-card-top" : ""
      }`}
    >
      {isTopDisease && <span className="top-badge">Top Risk</span>}
      <span className="risk-card-disease">{formatDiseaseName(disease)}</span>
      <span className="risk-card-score">{percentage}%</span>
      <div className="risk-card-bar-track">
        <div className="risk-card-bar-fill" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

export function RiskCardGrid({ riskScores, topDisease }) {
  return (
    <div className="risk-card-grid">
      {Object.entries(riskScores).map(([disease, score]) => (
        <RiskCard
          key={disease}
          disease={disease}
          score={score}
          isTopDisease={disease === topDisease}
        />
      ))}
    </div>
  );
}

function formatDiseaseName(disease) {
  return disease.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function getSeverity(score) {
  if (score >= 0.7) {
    return "high";
  }
  if (score >= 0.4) {
    return "medium";
  }
  return "low";
}
