import React from "react";
import "./evidenceCard.css";

export default function EvidenceCard({ evidence }) {
  if (!evidence) {
    return null;
  }

  return (
    <div className="evidence-card">
      <h4 className="evidence-disease">
        Evidence for {formatDiseaseName(evidence.disease)}
      </h4>
      <ul className="evidence-factors">
        {evidence.factors.map((factor) => (
          <li key={factor}>{formatFactor(factor)}</li>
        ))}
      </ul>
      <div className="evidence-next-test">
        <span className="next-test-label">Recommended next test:</span>
        <span className="next-test-value">{evidence.next_test}</span>
      </div>
    </div>
  );
}

export function EvidenceList({ evidenceItems }) {
  if (!evidenceItems || evidenceItems.length === 0) {
    return <div className="evidence-empty">No evidence available.</div>;
  }

  return (
    <div className="evidence-list">
      {evidenceItems.map((item) => (
        <EvidenceCard key={item.disease} evidence={item} />
      ))}
    </div>
  );
}

function formatDiseaseName(disease) {
  return disease.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatFactor(factor) {
  return factor.replace(/_/g, " ");
}
